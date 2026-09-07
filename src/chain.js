/**
 * Chain access, and the staking transactions this app is built on.
 *
 * The key never leaves this process. Transactions are signed here and the node
 * is only ever handed something already signed.
 *
 * Amounts are luna and always BigInt. 1 NIM = 100,000 luna. A staking app that
 * rounds is worse than one that refuses to run.
 */

import * as Nimiq from "@nimiq/core";

export const LUNA = 100_000n;

/** 100 NIM. Read from the chain's own policy, not guessed. Verified 7 Sep 2026. */
export const MINIMUM_STAKE = 10_000_000n;

export const nim = (luna) => (Number(luna) / 1e5).toFixed(5).replace(/\.?0+$/, "");

export function keyPairFromHex(hex) {
  return Nimiq.KeyPair.derive(Nimiq.PrivateKey.fromHex(hex));
}

const addr = (a) =>
  a instanceof Nimiq.Address ? a : Nimiq.Address.fromUserFriendlyAddress(String(a));

/**
 * Nimiq charges by transaction size, and a staking transaction is bigger than a
 * plain transfer. So the fee is measured rather than assumed: build once at zero
 * to learn the size, then rebuild paying one luna per byte.
 *
 * This matters more than it looks. A transaction whose fee is too low is
 * accepted by the node and then never relayed — it comes back with a hash and
 * silently never lands, which is indistinguishable from a payment that was lost.
 */
function withMeasuredFee(build) {
  const probe = build(0n);
  const size = BigInt(probe.serializedSize);
  return build(size);
}

/** First-time staking: creates the staker and delegates to a validator. */
export function signCreateStaker({ keyPair, validator, valueLuna, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newCreateStaker(
      keyPair.toAddress(),
      addr(validator),
      BigInt(valueLuna),
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/** Adding to a stake that already exists. */
export function signAddStake({ keyPair, staker, valueLuna, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newAddStake(
      keyPair.toAddress(),
      addr(staker ?? keyPair.toAddress()),
      BigInt(valueLuna),
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/**
 * Getting out, step one of three: deactivate.
 *
 * The parameter is what stays **working**, not what leaves. Pass 0 to take
 * everything out. Deactivated stake moves to `inactiveBalance` and is released
 * about twelve hours later, on the next election block.
 *
 * This step is reversible — call it again with a higher number to put stake
 * back to work. The next one is not.
 */
export function signSetActiveStake({ keyPair, newActiveBalanceLuna, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newSetActiveStake(
      keyPair.toAddress(),
      BigInt(newActiveBalanceLuna),
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/**
 * Getting out, step two of three. **Irreversible.**
 *
 * Retired stake can only ever be withdrawn — it can never go back to work. Only
 * released inactive balance can be retired, so this fails until the wait is up.
 */
export function signRetireStake({ keyPair, valueLuna, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newRetireStake(
      keyPair.toAddress(),
      BigInt(valueLuna),
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/** Getting out, step three of three: the money lands back in the wallet. */
export function signRemoveStake({ keyPair, valueLuna, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newRemoveStake(
      keyPair.toAddress(),
      BigInt(valueLuna),
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/** Moving a stake to a different validator. */
export function signUpdateStaker({ keyPair, newValidator, reactivateAllStake = true, validityStartHeight, networkId }) {
  const tx = withMeasuredFee((fee) =>
    Nimiq.TransactionBuilder.newUpdateStaker(
      keyPair.toAddress(),
      addr(newValidator),
      reactivateAllStake,
      fee,
      validityStartHeight,
      networkId,
    ),
  );
  tx.sign(keyPair);
  return tx;
}

/**
 * A JSON-RPC node. Reads and broadcasts only.
 */
export class Chain {
  constructor({ url, fetchImpl = fetch }) {
    this.url = url;
    this.fetch = fetchImpl;
    this.id = 0;
  }

  async call(method, params = []) {
    const res = await this.fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++this.id, method, params }),
    });
    if (!res.ok) throw new Error(`${method}: node answered ${res.status}`);
    const body = await res.json();
    if (body.error) {
      // The node puts the useful sentence in `data` and a useless "Internal
      // error" in `message`. Reading only `message` throws away the reason.
      const why = body.error.data || body.error.message || JSON.stringify(body.error);
      throw new Error(`${method}: ${why}`);
    }
    return body.result?.data ?? body.result;
  }

  height() { return this.call("getBlockNumber"); }
  policy() { return this.call("getPolicyConstants"); }
  validators() { return this.call("getActiveValidators"); }

  async balance(address) {
    const acc = await this.call("getAccountByAddress", [String(address)]);
    return BigInt(acc?.balance ?? 0);
  }

  /**
   * What the staking contract knows about this address, or null if nothing.
   *
   * "Never staked" is a normal state, not an error, but the node reports it as
   * one — code -32603 "Internal error", with the actual sentence hidden in the
   * data field. Anything else is a real failure and must not be swallowed.
   */
  async staker(address) {
    try {
      return await this.call("getStakerByAddress", [String(address)]);
    } catch (e) {
      if (/no staker with address/i.test(e.message)) return null;
      throw e;
    }
  }

  broadcast(tx) { return this.call("sendRawTransaction", [tx.toHex()]); }

  async lookup(hash) {
    try { return await this.call("getTransactionByHash", [String(hash)]); }
    catch { return null; }
  }

  /**
   * Broadcast is not settlement. A node accepting a transaction says only that
   * it accepted it, so this waits for the chain to actually show it.
   */
  async waitFor(hash, { timeoutMs = 90_000, everyMs = 2_000, onTick } = {}) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const found = await this.lookup(hash);
      if (found) return found;
      onTick?.();
      await new Promise((r) => setTimeout(r, everyMs));
    }
    return null;
  }
}
