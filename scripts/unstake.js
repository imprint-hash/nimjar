/**
 * Getting your money back out.
 *
 * The staking FAQ says this takes two transactions. It takes three, and the
 * middle one cannot be undone. Reading the contract's own type definitions is
 * the only way to learn that, and getting it wrong on day nine would have been
 * expensive.
 *
 *   1. setActiveStake   deactivate — moves active balance to "inactive"
 *      ...wait...       until the release block, about twelve hours
 *   2. retireStake      IRREVERSIBLE. Retired stake can only be withdrawn
 *   3. removeStake      the money lands back in the wallet
 *
 * Usage:
 *   node --env-file=.env scripts/unstake.js                 → show where you are
 *   node --env-file=.env scripts/unstake.js deactivate 100  → step 1
 *   node --env-file=.env scripts/unstake.js retire --yes    → step 2, irreversible
 *   node --env-file=.env scripts/unstake.js withdraw        → step 3
 */

import {
  Chain, keyPairFromHex, nim, LUNA,
  signSetActiveStake, signRetireStake, signRemoveStake,
} from "../src/chain.js";

const RPC_URL = process.env.SPOOL_RPC_URL;
const PRIVATE_KEY = process.env.SPOOL_PRIVATE_KEY;
const NETWORK_ID = Number(process.env.SPOOL_NETWORK_ID || 24);

const [, , command = "status", ...rest] = process.argv;
const line = (k, v) => console.log(k.padEnd(16) + ": " + v);

/** One second per block, so a block gap converts straight into a wait. */
function untilBlock(target, now) {
  const blocks = target - now;
  if (blocks <= 0) return "ready now";
  const mins = Math.round(blocks / 60);
  return mins < 90 ? `about ${mins} minutes` : `about ${(mins / 60).toFixed(1)} hours`;
}

async function main() {
  const keyPair = keyPairFromHex(PRIVATE_KEY);
  const me = keyPair.toAddress().toUserFriendlyAddress();
  const chain = new Chain({ url: RPC_URL });

  const [staker, height] = await Promise.all([chain.staker(me), chain.height()]);
  if (!staker) {
    console.log("Nothing staked from this wallet.");
    process.exit(0);
  }

  const active = BigInt(staker.balance ?? 0);
  const inactive = BigInt(staker.inactiveBalance ?? 0);
  const retired = BigInt(staker.retiredBalance ?? 0);
  // The type definitions promise an `inactiveRelease` field. This node does not
  // send one, so reading it gives undefined and every wait looks already over.
  // `inactiveFrom` is what actually arrives: the future block at which the
  // stake becomes inactive, which is the next election block, not now.
  const release = staker.inactiveRelease ?? staker.inactiveFrom ?? null;

  line("wallet", me);
  line("block", height.toLocaleString("en-GB"));
  console.log();
  line("1 working", `${nim(active)} NIM`);
  line("2 on its way out", `${nim(inactive)} NIM` + (release ? `  · released at block ${release.toLocaleString("en-GB")} (${untilBlock(release, height)})` : ""));
  line("3 ready to take", `${nim(retired)} NIM`);
  console.log();

  if (command === "status") {
    if (inactive > 0n && release && height < release) {
      console.log("Waiting on the network. Nothing to do until the release block.");
    } else if (inactive > 0n) {
      console.log("Released. Next: `retire --yes`  (this step cannot be undone)");
    } else if (retired > 0n) {
      console.log("Next: `withdraw` — the money comes straight back.");
    } else {
      console.log("Next: `deactivate <amount>` to start taking some back.");
    }
    return;
  }

  const send = async (tx, what) => {
    line("fee", `${nim(BigInt(tx.fee))} NIM  (${tx.serializedSize} bytes)`);
    const hash = await chain.broadcast(tx);
    line("broadcast", String(hash));
    process.stdout.write("confirming      : ");
    const found = await chain.waitFor(hash, { onTick: () => process.stdout.write(".") });
    if (!found) {
      console.log("\n\nAccepted by the node but never seen on chain. Not a success.");
      process.exit(1);
    }
    console.log(`\nsettled         : block ${found.blockNumber.toLocaleString("en-GB")}`);
    console.log(`\n${what}`);
  };

  if (command === "deactivate") {
    const amount = BigInt(Math.floor(Number(rest[0] ?? 0) * 1e5));
    if (amount <= 0n || amount > active) {
      console.log(`Give an amount between 0 and ${nim(active)} NIM.`);
      process.exit(1);
    }
    // The parameter is what stays working, not what leaves. Getting that
    // backwards would deactivate the wrong side of the stake.
    const keepActive = active - amount;
    line("action", `deactivate ${nim(amount)} NIM, leaving ${nim(keepActive)} working`);
    const tx = signSetActiveStake({
      keyPair, newActiveBalanceLuna: keepActive,
      validityStartHeight: height, networkId: NETWORK_ID,
    });
    return send(tx, "Deactivated. It is released in about twelve hours, then `retire --yes`.");
  }

  if (command === "retire") {
    if (!rest.includes("--yes")) {
      console.log("Retiring cannot be undone — retired stake can only be withdrawn,");
      console.log("never put back to work. Re-run with --yes if you mean it.");
      process.exit(1);
    }
    if (inactive <= 0n) { console.log("Nothing is waiting to be retired."); process.exit(1); }
    if (release && height < release) {
      console.log(`Not released yet — ${untilBlock(release, height)} to go.`);
      process.exit(1);
    }
    line("action", `retire ${nim(inactive)} NIM  (irreversible)`);
    const tx = signRetireStake({
      keyPair, valueLuna: inactive, validityStartHeight: height, networkId: NETWORK_ID,
    });
    return send(tx, "Retired. Now `withdraw` to move it back to the wallet.");
  }

  if (command === "withdraw") {
    if (retired <= 0n) { console.log("Nothing retired to withdraw."); process.exit(1); }
    const tx = signRemoveStake({
      keyPair, retiredLuna: retired, validityStartHeight: height, networkId: NETWORK_ID,
    });
    line("action", `withdraw ${nim(BigInt(tx.value))} NIM back to the wallet (fee paid from the stake)`);
    return send(tx, "Back in your wallet.");
  }

  console.log(`Unknown command "${command}". Try: status, deactivate <amount>, retire --yes, withdraw`);
  process.exit(1);
}

main().catch((e) => {
  console.error("\nFAILED:", e?.message || e);
  process.exit(1);
});
