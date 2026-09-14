# NimJar

**Stake your NIM in one tap inside Nimiq Pay, and get it all back out, step by step.**

<p align="center"><img src="public/icon.svg" width="120" alt="NimJar's mascot: a small yellow character with a leaf on its head, inside Nimiq's hexagon"></p>

## The problem

Staking NIM pays about 15% a year. But Nimiq Pay can't stake: to earn it, people have to leave the app and go to the Nimiq Wallet website. Most never do, so their NIM just sits there.

And getting staked NIM back out is confusing: it takes three separate steps, a wait of up to a day, and one step that can't be undone. No mini app helps with that part.

## What NimJar does

- **Stake without leaving Nimiq Pay.** Pick an amount, tap Stake, confirm in Nimiq Pay. That's it.
- **Picks a good validator for you.** NimJar uses Nimiq's official validator list and only suggests pools that actually pay their stakers, charge a fair fee, have a good trust score and aren't too big. Different people get different pools, so stake is spread out. You see the pool's name and fee, never a code to decode.
- **Walks you all the way back out.** It shows which step you're on, counts down the wait, and won't let you tap the permanent step by accident.
- **Never holds your money.** NimJar can't move your NIM. Every action is confirmed by you, in Nimiq Pay.
- **Shows the truth.** After every action NimJar checks the blockchain to see that it really went through. If something failed, it says so.
- **Easy to understand.** Plain words (Available, Staked, Unstake, Withdraw), earnings shown in NIM per week, and a friendly mascot that answers common questions. Its face changes with your money: it dozes while you wait, and looks serious at the step that can't be undone.

## Getting your NIM back: three taps

| Tap | What happens | Can you undo it? |
|---|---|---|
| **1. Unstake** | Your NIM stops earning. The network then holds it for up to about a day. | Yes. Until tap 2, you can stake it again. |
| **2. Confirm withdrawal** | You confirm you're done staking. NimJar asks you to tick a box first. | **No.** This one is permanent. |
| **3. Withdraw** | Your NIM lands back in your wallet, in about a second. | — |

## Proof that it works

### The full round trip inside Nimiq Pay

Every step below was tapped in NimJar and confirmed in Nimiq Pay, on a phone (Nimiq testnet).

| Step | Amount | Transaction |
|---|---|---|
| Stake | 100 NIM | [4318bf6c…](https://test.nimiq.watch/#4318bf6cd8fa3b263ffa2b5ca66c5b768991ebe5a7c1424d155a7c19501b6ca8) |
| Add stake | 500 NIM | [5d90b1a7…](https://test.nimiq.watch/#5d90b1a72e51eb17852552f339e8085ef6cc954abab5bc0e18f2d86574800f5c) |
| Unstake | 600 NIM | [0e631c47…](https://test.nimiq.watch/#0e631c471ab3ac252631ac0799e18f90d7057e9a1ad8ba79e75ae1b2cc3c48fd) |
| Confirm withdrawal | 600 NIM | [9df81d33…](https://test.nimiq.watch/#9df81d3393c6d3a19e267a13485a2571c6413de1b9146b37f71f2832f2c18a5e) |
| Withdraw | 600 NIM | [5d34b300…](https://test.nimiq.watch/#5d34b3009765fd64452d283a0c261125f4fd42e605bffbc5714d8aa2f92e9f7a) |

### The same round trip with real money, on mainnet

| Step | Amount | Transaction |
|---|---|---|
| Stake | 100 NIM | [083ce2d7…](https://nimiq.watch/#083ce2d7742b08991b4641090dd7fe0e223ac8e1dba69613a86ee992cd62f463) |
| Add stake | 100 NIM | [a83117c9…](https://nimiq.watch/#a83117c9272e35c488aa134b19bbb60cb184c701d9cad14d66d2be013dd3305d) |
| Unstake | 100 NIM | [6f5c2dfe…](https://nimiq.watch/#6f5c2dfe909cd41d2c9070bfb94926b279b936463edc0f71cb13fbaea1c4eb9c) |
| Confirm withdrawal | 100 NIM | [b93d96f6…](https://nimiq.watch/#b93d96f61c87f6f137f06ebb1017cec17cbc672f41d2c65ea052dc26442a81d7) |
| Withdraw | 99.99931 NIM | [9827161d…](https://nimiq.watch/#9827161d56f90f90aee801b646ae7cfb36077ef9dff0c63bd1516f4e6750de35) |

The other 100 NIM in that wallet is still staked. When you open NimJar in a normal browser, outside Nimiq Pay, it shows this real wallet, so every number you see can be checked.

## What we learned the hard way

We found four rules that aren't in the docs by testing with real money. NimJar handles all of them.

1. **Getting out is three steps, not two.** Nimiq's staking FAQ mentions two.
2. **The wait is up to a day, not 12 hours.** Unstaked NIM is only released one full 12-hour period after the next checkpoint. Our first version didn't know this, and three early attempts to confirm a withdrawal failed on the blockchain ([1](https://test.nimiq.watch/#b7a5bc76d1a755e10535311927e502b7ab58f4166fe4ba5535e53cd3a894db4b), [2](https://test.nimiq.watch/#53da8349c36bd9c24ce45628e412fa87fb23606bdcab8209b7408663a42351a1), [3](https://test.nimiq.watch/#4063c266dcc51e33f21be869ac96d2a973255836872c4bf28277b622c090e67d)). NimJar now shows them as failed, instead of pretending they worked.
3. **A withdrawal can't leave a little behind.** The network quietly drops any withdrawal that would leave between 0 and 100 NIM staked. NimJar always withdraws the whole amount.
4. **Some validators pay their stakers nothing.** The blockchain can't tell you this; Nimiq's validator list can. NimJar only suggests pools that pay.

## Try it

Open the app in Nimiq Pay (Mini Apps → Custom URL), or in any browser to see the preview:

**Link coming soon**

## For developers

```bash
npm install
npm start               # http://localhost:8080, reads Nimiq mainnet
npm run start:testnet   # reads Nimiq testnet
```

A small Node server that only reads the blockchain, and one page. No build step, no framework, no keys. Built with the Nimiq Pay mini app SDK (`@nimiq/mini-app-sdk`), `@nimiq/core`, Nimiq's validator list, and Nimiq's own colours and fonts.

| File | What it does |
|---|---|
| `src/server.js` | Reads the blockchain and serves the page. Never signs anything. |
| `src/chain.js` | Balances, staking history, transaction checks |
| `public/app.js` | The app: screens, amounts, Nimiq Pay calls |
| `public/app.css` | The design |
| `scripts/` | Command-line tools we used to test each step on mainnet |

## Licence

[MIT](LICENSE)
