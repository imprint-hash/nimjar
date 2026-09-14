/**
 * The gate.
 *
 * Everything this app promises rests on one thing: that a wallet can stake NIM
 * and see it land. Before any screens get built, prove it on mainnet with real
 * money — because the alternative is discovering on day nine that the plan was
 * impossible.
 *
 *   npm run gate
 *
 * It stakes the network minimum, waits for the chain to show it, then reads the
 * staking contract back to confirm the stake exists and is delegated where we
 * asked. Nothing is trusted from the broadcast.
 */

import { Chain, keyPairFromHex, signCreateStaker, signAddStake, MINIMUM_STAKE, nim } from "../src/chain.js";

const RPC_URL = process.env.RPC_URL || process.env.SPOOL_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.SPOOL_PRIVATE_KEY;
const NETWORK_ID = Number(process.env.NETWORK_ID || process.env.SPOOL_NETWORK_ID || 24);

if (!RPC_URL || !PRIVATE_KEY) {
  console.error("RPC_URL and PRIVATE_KEY are required (in .env).");
  process.exit(1);
}

const line = (k, v) => console.log(k.padEnd(15) + ": " + v);

async function main() {
  const keyPair = keyPairFromHex(PRIVATE_KEY);
  const me = keyPair.toAddress().toUserFriendlyAddress();
  const chain = new Chain({ url: RPC_URL });

  line("wallet", me);
  line("network", NETWORK_ID === 24 ? "mainnet" : `id ${NETWORK_ID}`);

  const policy = await chain.policy();
  const minimum = BigInt(policy.minimumStake);
  line("minimum stake", `${nim(minimum)} NIM`);
  if (minimum !== MINIMUM_STAKE) {
    console.log(`  note: chain says ${minimum}, code assumes ${MINIMUM_STAKE} — update src/chain.js`);
  }

  const balance = await chain.balance(me);
  line("balance", `${nim(balance)} NIM`);
  if (balance < minimum * 2n) {
    console.log(`\nNot enough to stake the minimum and still pay fees.`);
    process.exit(1);
  }

  // Pick the validator with the most delegators. For the gate we want the
  // busiest and most obviously alive one, not the most interesting.
  const validators = (await chain.validators())
    .filter((v) => !v.retired && v.inactivityFlag == null && v.jailedFrom == null)
    .sort((a, b) => (b.numStakers || 0) - (a.numStakers || 0));
  const validator = validators[0];
  line("validators", `${validators.length} active`);
  line("chosen", `${validator.address}  (${validator.numStakers} delegators)`);

  const already = await chain.staker(me);
  const value = minimum;
  const height = await chain.height();

  const tx = already
    ? signAddStake({ keyPair, staker: me, valueLuna: value, validityStartHeight: height, networkId: NETWORK_ID })
    : signCreateStaker({ keyPair, validator: validator.address, valueLuna: value, validityStartHeight: height, networkId: NETWORK_ID });

  console.log();
  line("action", already ? "add to existing stake" : "create staker + delegate");
  line("amount", `${nim(value)} NIM`);
  line("fee", `${nim(BigInt(tx.fee))} NIM  (${tx.serializedSize} bytes, measured)`);

  const hash = await chain.broadcast(tx);
  line("broadcast", String(hash));

  process.stdout.write("confirming     : ");
  const found = await chain.waitFor(hash, { onTick: () => process.stdout.write(".") });
  if (!found) {
    console.log("\n\nAccepted by the node but never seen on chain within 90s.");
    console.log("That is the silent failure this app has to be built around — not a pass.");
    process.exit(1);
  }
  console.log(`\nsettled        : block ${found.blockNumber}`);

  // The real proof: ask the staking contract what it thinks, rather than
  // believing our own transaction.
  const staker = await chain.staker(me);
  console.log();
  if (!staker) {
    console.log("Transaction landed but the staking contract has no staker for us.");
    console.log("GATE FAILED — something about the staking data is wrong.");
    process.exit(1);
  }
  line("staker balance", `${nim(BigInt(staker.balance))} NIM`);
  line("delegated to", staker.delegation || "(nobody)");
  line("inactive", nim(BigInt(staker.inactiveBalance ?? 0)) + " NIM");
  line("retired", nim(BigInt(staker.retiredBalance ?? 0)) + " NIM");

  console.log("\nGATE PASSED — real NIM is staked on mainnet and the contract agrees.");
  console.log("\nNext: getting it back out. Two transactions, and up to four days between them.");
  console.log("Run `node --env-file=.env scripts/unstake.js` when you want to start that.");
}

main().catch((e) => {
  console.error("\nGATE FAILED:", e?.message || e);
  process.exit(1);
});
