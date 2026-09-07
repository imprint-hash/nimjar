/**
 * The server.
 *
 * It reads the chain and serves one page. That is all it is allowed to do.
 *
 * Every transaction is signed by the user's own wallet, on their own phone,
 * through Nimiq Pay. No key ever reaches this process, so there is nothing here
 * to steal and nothing to trust us with. A staking app that holds your money is
 * a different, much worse product.
 *
 *   npm start        → http://localhost:8080
 */

import http from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Chain, nim } from "./chain.js";
import { renderApp } from "./page.js";

const PORT = Number(process.env.PORT || 8080);
const RPC_URL = process.env.SPOOL_RPC_URL || "https://rpc.nimiqwatch.com";
const NETWORK_ID = Number(process.env.SPOOL_NETWORK_ID || 24);

/**
 * A wallet we know is staking, shown when the app is opened outside Nimiq Pay —
 * which is where anyone on a laptop will open it. Better a real wallet with real
 * numbers a visitor can check on a block explorer than an empty screen.
 */
const DEMO_ADDRESS = process.env.DEMO_ADDRESS || "NQ19 4DVG ARRM PVLY 45HC MRY7 5Y9U 31EG JF9U";

const chain = new Chain({ url: RPC_URL });

/** The SDK entry is 722 bytes of browser ESM with no imports, so it is served as-is. */
let SDK_SOURCE = null;
try {
  SDK_SOURCE = fs
    .readFileSync(fileURLToPath(import.meta.resolve("@nimiq/mini-app-sdk")), "utf8")
    .replace(/\/\/# sourceMappingURL=.*$/m, "");
} catch { /* absent: /sdk.js answers with a stub and the page still loads */ }

/**
 * Validators, ranked so the top one is a defensible default.
 *
 * Nobody can read a list of 37 hex addresses and judge it, so the app chooses —
 * but it shows why, in facts anyone can check, and it never hides the list.
 * Anything jailed, retired or flagged inactive is not a candidate at all.
 */
async function healthyValidators() {
  const all = await chain.validators();
  return all
    .filter((v) => !v.retired && v.inactivityFlag == null && v.jailedFrom == null)
    .map((v) => ({
      address: v.address,
      stakers: v.numStakers ?? 0,
      balance: String(v.balance ?? 0),
    }))
    .sort((a, b) => b.stakers - a.stakers);
}

/** Everything one screen needs, in one request. */
async function overview(address) {
  const [balance, staker, validators, height] = await Promise.all([
    chain.balance(address),
    chain.staker(address),
    healthyValidators(),
    chain.height(),
  ]);

  const staked = BigInt(staker?.balance ?? 0);
  const inactive = BigInt(staker?.inactiveBalance ?? 0);
  const retired = BigInt(staker?.retiredBalance ?? 0);

  // The type definitions promise `inactiveRelease`. This node never sends one,
  // so trusting it means every wait looks like it is already over. What does
  // arrive is `inactiveFrom` — a future block, the next election block.
  const releaseAt = staker?.inactiveRelease ?? staker?.inactiveFrom ?? null;

  // One second per block, so the gap converts straight into a wait.
  const secondsLeft = releaseAt && height < releaseAt ? releaseAt - height : 0;

  return {
    address,
    height,
    networkId: NETWORK_ID,
    spendable: String(balance),
    staked: String(staked),
    inactive: String(inactive),
    retired: String(retired),
    releaseAt,
    secondsLeft,
    delegation: staker?.delegation ?? null,
    isStaking: staked > 0n || inactive > 0n || retired > 0n,
    /** Which of the three steps out the money is on, if any. */
    leaving: retired > 0n ? "ready" : inactive > 0n ? (secondsLeft > 0 ? "waiting" : "releasable") : null,
    validators: validators.slice(0, 12),
    suggested: validators[0] ?? null,
  };
}

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(renderApp({ demoAddress: DEMO_ADDRESS, networkId: NETWORK_ID }));
    }

    if (req.method === "GET" && url.pathname === "/sdk.js") {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      if (SDK_SOURCE) return res.end(SDK_SOURCE);
      return res.end(
        `const absent=(n)=>()=>Promise.reject(new Error(n+" needs @nimiq/mini-app-sdk"));
         export const init=absent("init"), requestDeviceIdentifier=absent("requestDeviceIdentifier");
         export const getHostLanguage=()=>undefined;`);
    }

    if (req.method === "GET" && url.pathname === "/api/overview") {
      const address = url.searchParams.get("address") || DEMO_ADDRESS;
      return json(res, 200, await overview(address));
    }

    // Every action, with its hash. A staking app that asks to be trusted and
    // then shows nothing checkable is asking for the wrong thing.
    if (req.method === "GET" && url.pathname === "/api/history") {
      const address = url.searchParams.get("address") || DEMO_ADDRESS;
      return json(res, 200, { history: await chain.stakingHistory(address, 20) });
    }

    // Broadcast is not settlement, so the page asks here whether a hash has
    // actually landed rather than believing the wallet's reply.
    if (req.method === "GET" && url.pathname.startsWith("/api/tx/")) {
      const hash = decodeURIComponent(url.pathname.slice("/api/tx/".length));
      const found = await chain.lookup(hash);
      return json(res, 200, {
        hash,
        settled: Boolean(found),
        blockNumber: found?.blockNumber ?? null,
      });
    }

    json(res, 404, { error: "not found" });
  } catch (e) {
    // A chain that is unreachable is our problem to report precisely, and never
    // a reason to show the visitor a blank screen.
    json(res, 502, { error: String(e?.message || e) });
  }
});

server.listen(PORT, async () => {
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`  network : ${NETWORK_ID === 24 ? "mainnet" : `id ${NETWORK_ID}`} via ${RPC_URL}`);
  console.log(`  reads only — every transaction is signed by the user's own wallet`);
  try {
    const o = await overview(DEMO_ADDRESS);
    console.log(`  demo    : ${nim(BigInt(o.staked))} NIM staked, ${nim(BigInt(o.spendable))} NIM spendable`);
  } catch (e) {
    console.log(`  demo    : could not reach the chain — ${e.message}`);
  }
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
