# Build log

Nimiq Mini Apps Competition, Cycle II. **Closes 18 September 2026, 23:59 UTC.**

One rule for the order below: **at the end of every step there is something that
works.** Build the thinnest complete path first, then thicken it. If time runs
out after step 2 there is still a submission; building screen by screen would
leave three nice screens and no product.

---

## 1. Gate — prove the risky part ✅ 7 Sep

Before any screens: can a wallet stake real NIM on mainnet and can we see it land?

**Passed.**

```
staked        100 NIM
fee           0.00188 NIM   (286 bytes, measured — not guessed)
transaction   083ce2d7742b08991b4641090dd7fe0e223ac8e1dba69613a86ee992cd62f463
block         60,975,069
delegated to  NQ05 U1RF QJNH JCS1 RDQX 4M3Y 60KR K6CN 5LKC  (407 delegators)
```

The script does not trust its own transaction — it asks the staking contract
afterwards and checks the answer matches.

**What the run taught us**

- **Minimum stake is 100 NIM.** Read from the chain's own policy, not assumed
- **Fees must be measured.** A staking transaction is 286 bytes, more than twice
  a plain transfer. Build once at zero fee to learn the size, rebuild at one
  luna per byte. A fee that is too low is accepted and then never relayed
- **"Never staked" arrives as an error.** The node returns code -32603
  *"Internal error"* and hides the real sentence — *"No staker with address…"* —
  in a `data` field the usual shape ignores. Read only `message` and a normal
  first-run state looks like a crash
- 37 active validators. The busiest has 407 delegators

That 100 NIM stays staked. It earns ~0.29 NIM a week and is the app's live demo
data — real numbers a judge can check on a block explorer.

---

### Full round trip — completed 10 Sep

Money in and money out, every step on mainnet:

```
create staker   100 NIM   block 60,975,069   083ce2d7…cd62f463
add stake       100 NIM   block 60,977,452   a83117c9…3dd3305d
deactivate      100 NIM   block 60,977,466   6f5c2dfe…a1c4eb9c
retire          100 NIM   block 61,248,207   b93d96f6…6442a81d7   irreversible
withdraw        100 NIM   block 61,248,363   9827161d…4e6750de35
```

Wallet before the withdrawal: 1,798.94097 NIM. After: 1,898.94028 NIM.
Change: **+99.99931 NIM** — the 100 NIM, less a 0.00069 NIM fee.

**Three more things the docs do not tell you**

- **Getting out is three transactions, not two.** Nimiq's staking FAQ says two.
  It is deactivate, then retire (irreversible), then withdraw
- **`inactiveRelease` is never sent.** The type definitions promise it; this
  node returns `inactiveFrom` instead. Reading the promised field makes every
  wait look already over
- **The withdrawal fee comes out of the stake.** In a remove-stake the staking
  contract is the sender, so asking for the whole retired balance plus a fee
  asks for more than exists. The node **accepts it and it never lands** — no
  error, a valid-looking hash, nothing on chain. It happened here first:
  `85a12516…910764b04` was accepted and vanished. Withdrawing the balance minus
  the fee landed at once

That last one is the exact silent failure this app is built to catch, found by
the app's own confirmation check rather than by a user losing money.

## 2. Walking skeleton ✅

The whole path, end to end, ugly on purpose.

- [ ] Server reads the chain: balance, staker, validators
- [ ] Page detects Nimiq Pay (`window.nimiqPay != null`)
- [ ] `listAccounts()` → show what this wallet holds and what it would earn
- [ ] One button → `sendNewStakerTransaction` through Nimiq Pay
- [ ] Show the result, read back from the staking contract

**Outside Nimiq Pay** — which is where a judge on a laptop will open it — the app
shows the real staked wallet instead, so the screen is never empty and every
figure on it is true.

**Non-custodial throughout.** The server only ever reads. Every transaction is
signed by the user's own wallet, on their own phone. We never hold a key.

---

## 3. Harden

- [ ] Below the 100 NIM minimum
- [ ] Not enough left for the fee
- [ ] Broadcast accepted then never confirmed — the silent failure
- [ ] Already staking: add to the stake instead of creating one
- [ ] Getting out: retire, then the wait, then remove
- [ ] Device identifier, if it earns its place

## 4. Design pass ✅ 14 Sep

NimJar: the Geex Arts "Wallet" reference redrawn in Nimiq's colours and fonts,
with a mascot in Nimiq's hexagon whose mood follows the money.

Only once it works. Sketch: https://claude.ai/code/artifact/5246978e-0c08-43e5-94a9-fcf04143d440

- One hero number per screen
- Earnings in NIM per week, never percentages
- No protocol words on screen — *put to work*, not *delegate*
- Five decimals, trimmed, never rounded up
- Light and dark, both designed

## 5. Evidence

- [ ] README a stranger can follow
- [ ] Every claim backed by a real transaction hash
- [ ] 60–90 second demo video
- [ ] MIT licence (required)

## 6. Ship

- [ ] Deploy
- [ ] Public repo
- [ ] Submit through the portal
- [ ] Pull request to `nimiq/awesome`
- [ ] Post progress in Skool

---

## Facts this is built on

```
Network      mainnet, id 24
RPC          https://rpc.nimiqwatch.com
Explorer     https://nimiq.watch/#<txhash>
Units        1 NIM = 100,000 luna. Integers only, never floats
Minimum      100 NIM
Getting out  three transactions; released inactiveFrom + one epoch + 1 (up to ~a day)
Reward       ~15% a year, paid per validator, not auto-compounded
```

**Wallet calls the app uses** — all of them open a confirmation the app cannot
skip, so no screen ever needs two payments in a row.

| Call | For |
|---|---|
| `listAccounts()` | who is here |
| `sendNewStakerTransaction({ delegation, value })` | first stake |
| `sendStakeTransaction({ value })` | adding more |
| `sendRetireStakeTransaction({ retireStake })` | getting out, step 1 |
| `sendRemoveStakeTransaction({ value })` | getting out, step 2 |
| `sendUpdateStakerTransaction({ newDelegation })` | switching validator |

## Why this app

> **"One-click NIM staking (operator mini-apps; single-validator)"**
> — Micha, Nimiq team, Nimiq Pay roadmap

Nimiq Pay cannot stake. Nimiq built the staking plumbing for mini apps five
months ago and nobody used it. Six of the ten wallet calls available are staking
commands; one app out of 62 in Cycle 1 touched them, and it was a leaderboard.
Six of the thirteen Community Council candidates run validators or pools.
