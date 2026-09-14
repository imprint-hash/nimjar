# NimJar

**Stake your NIM in one tap inside Nimiq Pay, and get it all back out, step by step.**

NimJar is a mini app for [Nimiq Pay](https://www.nimiq.com/). Nimiq Pay can hold NIM, but it can't stake it: to earn the ~15% a year that staking pays, people have to leave the app and go to the Nimiq Wallet website, so most never do. With NimJar you stake right inside Nimiq Pay, without leaving the app, and it's the only mini app that also walks you safely through **getting your money back out**.

<p align="center"><img src="src/public/icon.svg" width="120" alt="NimJar's mascot: a small yellow character with a leaf on its head, inside Nimiq's hexagon"></p>

## What makes it different

- **One tap in, without leaving Nimiq Pay.** Pick an amount, tap Stake, confirm in Nimiq Pay.
- **The validator is picked for you.** NimJar reads Nimiq's official validator list (the one the Nimiq Wallet uses) and only suggests pools that pay their stakers, charge 10% or less, have a good trust score and hold under a tenth of all stake. Each wallet gets its own pick from that set, so stake spreads across many pools instead of piling onto the biggest one. You see the pool's name and fee, never a list of addresses to judge. This matters: the chain alone can't tell you whether a validator pays stakers at all, and some large ones don't.
- **The whole way out.** Getting out of staking is three separate transactions with a wait of up to a day in the middle, and one of them can't be undone. NimJar shows where you are, counts down the wait, and makes the permanent step impossible to tap by accident: you tick a box first.
- **It never holds your money.** The server only reads the blockchain. Every action is signed by your own wallet, on your own phone, through Nimiq Pay's confirmation sheet.
- **It checks, instead of trusting.** After every action NimJar asks the chain whether the transaction really landed. Failed transactions are shown as failed, never as done.
- **Plain words.** Available, Staked, Unstake, Withdraw. No "delegate", no "APY", no "epoch". Earnings are shown in NIM per week, not percentages. A mascot whose face follows your money (dozing during the wait, serious at the permanent step) answers the common questions.

## Three things the docs don't tell you

We found these by doing it with real money, on mainnet and inside Nimiq Pay. Each one is handled in the code and backed by a transaction you can check.

**1. Getting out takes three transactions, not two.** Unstake (reversible), confirm the withdrawal (permanent), then withdraw.

**2. Unstaked NIM is released a full epoch later than it looks.** Stake goes inactive at the next election block (`inactiveFrom`), but can only be confirmed for withdrawal one epoch after that: `inactiveFrom + blocksPerEpoch + 1` (Nimiq's `staker.rs`, `is_inactive_stake_released`). Our first version used `inactiveFrom` alone, said "ready" twelve hours early, and three real attempts landed on chain and **failed**:
[b7a5bc76…](https://test.nimiq.watch/#b7a5bc76d1a755e10535311927e502b7ab58f4166fe4ba5535e53cd3a894db4b),
[53da8349…](https://test.nimiq.watch/#53da8349c36bd9c24ce45628e412fa87fb23606bdcab8209b7408663a42351a1),
[4063c266…](https://test.nimiq.watch/#4063c266dcc51e33f21be869ac96d2a973255836872c4bf28277b622c090e67d).
The whole wait is up to about a day. With the rule fixed, the same wallet's next attempt, sent from NimJar inside Nimiq Pay, [went through](https://test.nimiq.watch/#9df81d3393c6d3a19e267a13485a2571c6413de1b9146b37f71f2832f2c18a5e).

**3. The withdrawal fee comes out of the stake itself.** In the last step the staking contract is the sender, so asking for the whole balance plus a fee asks for more than exists. The node **accepts it and it never lands**: no error, a valid-looking hash, nothing on chain. Withdrawing the balance minus the fee lands at once.

## The full round trip, on mainnet

| Step | Amount | Block | Transaction |
|---|---|---|---|
| Stake | 100 NIM | 60,975,069 | [083ce2d7…](https://nimiq.watch/#083ce2d7742b08991b4641090dd7fe0e223ac8e1dba69613a86ee992cd62f463) |
| Add stake | 100 NIM | 60,977,452 | [a83117c9…](https://nimiq.watch/#a83117c9272e35c488aa134b19bbb60cb184c701d9cad14d66d2be013dd3305d) |
| Unstake | 100 NIM | 60,977,466 | [6f5c2dfe…](https://nimiq.watch/#6f5c2dfe909cd41d2c9070bfb94926b279b936463edc0f71cb13fbaea1c4eb9c) |
| Confirm withdrawal (permanent) | 100 NIM | 61,248,207 | [b93d96f6…](https://nimiq.watch/#b93d96f61c87f6f137f06ebb1017cec17cbc672f41d2c65ea052dc26442a81d7) |
| Withdraw | 99.99931 NIM | 61,248,363 | [9827161d…](https://nimiq.watch/#9827161d56f90f90aee801b646ae7cfb36077ef9dff0c63bd1516f4e6750de35) |

The other 100 NIM is still staked: it's the wallet NimJar shows when you open it outside Nimiq Pay, so every number on the preview is real and checkable.

Staking also ran inside Nimiq Pay itself, on testnet: [first stake](https://test.nimiq.watch/#4318bf6cd8fa3b263ffa2b5ca66c5b768991ebe5a7c1424d155a7c19501b6ca8), [add stake](https://test.nimiq.watch/#5d90b1a72e51eb17852552f339e8085ef6cc954abab5bc0e18f2d86574800f5c), [unstake](https://test.nimiq.watch/#0e631c471ab3ac252631ac0799e18f90d7057e9a1ad8ba79e75ae1b2cc3c48fd).

## Try it

**In Nimiq Pay:** Mini Apps → Custom URL → the app's address. Your wallet connects, and every action opens Nimiq Pay's own confirmation.

**On a laptop:** open the same address in a browser. With no wallet to connect, NimJar shows a real staked wallet on mainnet in read-only preview.

**Testnet:** in Nimiq Pay, open the menu and press and hold the Settings button for about 10 seconds to switch to testnet; "Get free NIM" gives you testnet NIM. Point NimJar at testnet with `npm run start:testnet`.

## Run it yourself

```bash
npm install
npm start               # mainnet, http://localhost:8080
npm run start:testnet   # testnet
```

Needs Node 20.6 or newer. No build step and no framework: a small Node server and one page.

| Setting | Default | What it does |
|---|---|---|
| `PORT` | `8080` | Port to listen on |
| `RPC_URL` | `https://rpc.nimiqwatch.com` | Nimiq JSON-RPC node to read from |
| `NETWORK_ID` | `24` (mainnet) | `5` for testnet |
| `DEMO_ADDRESS` | a staked mainnet wallet | Wallet shown in preview, outside Nimiq Pay |

The server takes no keys. `scripts/gate.js` and `scripts/unstake.js` are command-line tools we used to prove each step on mainnet before building screens; they read `PRIVATE_KEY` from a local `.env` that is never committed (see `.env.example`).

## How it's built

```
src/server.js       reads the chain, serves the page. Never signs anything.
src/chain.js        JSON-RPC client, balances, staking history, transaction checks
src/page.js         the HTML shell
src/public/app.js   the app: screens, amounts, Nimiq Pay calls, confirmation checks
src/public/app.css  design: Nimiq's colours (nimiq-style) and fonts (Mulish, Fira Mono)
scripts/            command-line proofs of every staking step
```

- **Nimiq Pay mini app SDK** (`@nimiq/mini-app-sdk`): `listAccounts`, `sendNewStakerTransaction`, `sendStakeTransaction`, `sendSetActiveStakeTransaction`, `sendRetireStakeTransaction`, `sendRemoveStakeTransaction`
- **`@nimiq/core`**: decodes staking transaction data on the server
- **Money is integers.** Amounts are luna (1 NIM = 100,000 luna) as BigInt from end to end. Nothing is parsed into a float, nothing is rounded up.
- **Nimiq Pay's real balance.** Nimiq Pay moves NIM above its auto-deposit threshold into swap contracts (HTLCs) in your name and pays for staking from there. NimJar counts those, or a Pay user with thousands of NIM would be told they have none.
- **Security headers.** A strict Content Security Policy (no inline scripts), address and hash validation before anything reaches the node.

## Licence

[MIT](LICENSE)
