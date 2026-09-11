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

/**
 * Getting out, step three of three: the money lands back in the wallet.
 *
 * In this one transaction the staking contract is the sender, so the fee comes
 * out of the retired balance itself. Asking for the whole retired amount plus a
 * fee asks for more than exists: the node accepts it, then it never lands.
 * Found on mainnet on 10 Sep 2026 — it is exactly the silent failure this app
 * is built to catch. So the amount withdrawn is the retired balance minus fee.
 */
export function signRemoveStake({ keyPair, retiredLuna, validityStartHeight, networkId }) {
  const retired = BigInt(retiredLuna);
  const build = (value, fee) =>
    Nimiq.TransactionBuilder.newRemoveStake(
      keyPair.toAddress(), value, fee, validityStartHeight, networkId,
    );
  const fee = BigInt(build(retired, 0n).serializedSize);
  if (fee >= retired) throw new Error("retired balance is too small to cover the fee");
  const tx = build(retired - fee, fee);
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
   * What Nimiq Pay would call your balance: the plain address plus NIM it has
   * parked in swap contracts on your behalf.
   *
   * Nimiq Pay sweeps anything above an "auto-deposit threshold" (5 NIM by
   * default) into an HTLC it controls with you as the sender, seconds after it
   * arrives. So for most Pay users the plain address holds almost nothing while
   * the wallet shows thousands — and Pay funds staking straight out of those
   * HTLCs. Found on testnet, 11 Sep 2026: a 110,000 NIM faucet payment was
   * swept two seconds after landing, then create-staker and add-stake were
   * both paid from the HTLC, not the address.
   *
   * Reading only the plain address therefore tells a Pay user with 109,000 NIM
   * that they need 100 to start. This sums every HTLC that names them as sender
   * and still holds funds.
   */
  async payBalance(address, lookback = 50) {
    const me = String(address);
    const [plain, txs] = await Promise.all([
      this.balance(me),
      this.call("getTransactionsByAddress", [me, lookback, null]).catch(() => []),
    ]);
    const htlcs = [...new Set((txs ?? [])
      .filter((t) => t.from === me && t.toType === 2)
      .map((t) => t.to))];
    let held = 0n;
    for (const h of htlcs) {
      const acc = await this.call("getAccountByAddress", [h]).catch(() => null);
      if (acc?.type === "htlc" && acc.sender === me) held += BigInt(acc.balance ?? 0);
    }
    return { plain, held, total: plain + held };
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

  /**
   * Everything this wallet has done to its stake, newest first.
   *
   * The type of each action is decoded by the SDK rather than read off the
   * first byte. Guessing at prefixes works right up until it silently doesn't.
   */
  async stakingHistory(address, max = 20) {
    const me = String(address);
    const own = (await this.call("getTransactionsByAddress", [me, max, null])) ?? [];
    // Nimiq Pay pays for staking out of the swap contracts it parks your NIM
    // in, so those transactions list under the contract, not your address.
    // Read your own contracts' histories too, or a Pay user's diary is empty.
    const htlcs = [...new Set(own.filter((t) => t.from === me && t.toType === 2).map((t) => t.to))];
    const more = await Promise.all(htlcs.map((h) =>
      this.call("getTransactionsByAddress", [h, max, null]).catch(() => [])));
    const seen = new Set();
    const txs = [...own, ...more.flat()]
      .filter((t) => (seen.has(t.hash) ? false : seen.add(t.hash)))
      .sort((a, b) => b.blockNumber - a.blockNumber);
    const out = [];
    for (const t of txs) {
      if (!t.recipientData) continue;
      let plain;
      try { plain = Nimiq.StakingContract.dataToPlain(Buffer.from(t.recipientData, "hex")); }
      catch { continue; }          // not a staking transaction
      out.push({
        type: plain.type,
        hash: t.hash,
        blockNumber: t.blockNumber,
        timestamp: t.timestamp,
        value: String(t.value ?? 0),
        delegation: plain.delegation ?? null,
        newActiveBalance: plain.newActiveBalance ?? null,
      });
    }
    return out;
  }

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
