/**
 * Chain access, and the staking transactions this app is built on.
 *
 * Reading only: signing lives in sign.js, used by the command-line scripts.
 *
 * Amounts are luna and always BigInt. 1 NIM = 100,000 luna. A staking app that
 * rounds is worse than one that refuses to run.
 */

export const LUNA = 100_000n;

/** 100 NIM. Read from the chain's own policy, not guessed. Verified 7 Sep 2026. */
export const MINIMUM_STAKE = 10_000_000n;

export const nim = (luna) => (Number(luna) / 1e5).toFixed(5).replace(/\.?0+$/, "");

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
  policy() { return (this._policy ??= this.call("getPolicyConstants").catch((e) => { this._policy = null; throw e; })); }
  validator(address) { return this.call("getValidatorByAddress", [String(address)]).catch(() => null); }
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
    // Loaded only here, and only when there is something to decode, so the
    // rest of the server never waits on (or fails with) a 28 MB wasm library.
    const needsCore = txs.some((t) => t.recipientData && t.toType === 3);
    const Nimiq = needsCore ? await import("@nimiq/core") : null;
    const out = [];
    for (const t of txs) {
      let plain = null;
      if (t.recipientData && t.toType === 3) {
        try { plain = Nimiq.StakingContract.dataToPlain(Buffer.from(t.recipientData, "hex")); }
        catch { plain = null; }
      } else if (t.fromType === 3 && t.senderData === "01") {
        // Money coming back out: the staking contract is the sender and the
        // action sits in the sender data (1 = remove stake), not the recipient
        // data. Read only the recipient side and the withdrawal — the step
        // that matters most — never shows up.
        plain = { type: "remove-stake" };
      }
      if (!plain) continue;        // not a staking transaction
      out.push({
        type: plain.type,
        hash: t.hash,
        blockNumber: t.blockNumber,
        timestamp: t.timestamp,
        value: String(t.value ?? 0),
        // A transaction can land in a block and still fail: it is on chain,
        // with a hash, and changed nothing. Found on testnet, 12 Sep 2026: three
        // retire-stake attempts sent before the stake was released all failed.
        // Listing those as done would be the exact lie this app exists to stop.
        ok: t.executionResult !== false,
        delegation: plain.delegation ?? null,
        newActiveBalance: plain.newActiveBalance ?? null,
        // A retire moves stake without a value on the transaction itself; the
        // amount lives in its data. Without this the list would say "0 NIM".
        retireStake: plain.retireStake != null ? String(plain.retireStake) : null,
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
