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
 *   npm start           → http://localhost:8080, mainnet
 *   npm run start:testnet
 *
 * It is started without .env on purpose. That file holds a key for the
 * command-line scripts; the server has no use for it, so it never sees it.
 */

import http from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Chain, nim } from "./chain.js";
import { renderApp } from "./page.js";

const PORT = Number(process.env.PORT || 8080);
const RPC_URL = process.env.RPC_URL || "https://rpc.nimiqwatch.com";
const NETWORK_ID = Number(process.env.NETWORK_ID || 24);

/**
 * A wallet we know is staking, shown when the app is opened outside Nimiq Pay —
 * which is where anyone on a laptop will open it. Better a real wallet with real
 * numbers a visitor can check on a block explorer than an empty screen.
 */
const DEMO_ADDRESS = process.env.DEMO_ADDRESS || "NQ19 4DVG ARRM PVLY 45HC MRY7 5Y9U 31EG JF9U";

const chain = new Chain({ url: RPC_URL });

/**
 * Amounts this small are treated as nothing. If a few luna are ever left in the
 * staking contract, the app must not sit on "withdraw 0.002 NIM" forever for an
 * amount that costs more than itself to move. The page applies the same rule.
 */
const DUST = 1000n;

/** A Nimiq address, with or without the spaces. Anything else never reaches the node. */
const ADDRESS = /^NQ[0-9]{2}(?: ?[0-9A-Z]{4}){8}$/i;

/** The files the page loads. Read once at start: there is nothing else on disk to serve. */
const PUBLIC = new URL("./public/", import.meta.url);
const STATIC = Object.fromEntries(
  [["/app.js", "text/javascript"], ["/app.css", "text/css"], ["/icon.svg", "image/svg+xml"]]
    .map(([route, type]) => [route, { type: `${type}; charset=utf-8`, body: fs.readFileSync(new URL("." + route, PUBLIC)) }]),
);

/**
 * Only this site, Google Fonts and nothing else. Inline scripts are refused, so
 * even a value that slipped past escaping could not run.
 */
const SECURITY = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; "),
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

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
  const [pay, staker, validators, height] = await Promise.all([
    chain.payBalance(address),
    chain.staker(address),
    healthyValidators(),
    chain.height(),
  ]);

  const staked = BigInt(staker?.balance ?? 0);
  const inactive = BigInt(staker?.inactiveBalance ?? 0);
  const retired = BigInt(staker?.retiredBalance ?? 0);
  const leavingIn = inactive > DUST ? inactive : 0n;
  const leavingOut = retired > DUST ? retired : 0n;

  // When unstaked NIM can take the next step out. Read from Nimiq's own source
  // (staker.rs, is_inactive_stake_released), because the obvious reading is
  // wrong: stake goes inactive at the next election block (`inactiveFrom`), and
  // is only released one full epoch after that, at
  // Policy::block_after_collateral_lockup(inactiveFrom) = inactiveFrom + epoch + 1.
  // Also never while the validator it was delegated to sits in jail.
  //
  // The first version of this app used `inactiveFrom` alone. It said "ready"
  // twelve hours early, and three real attempts to confirm a withdrawal on
  // testnet landed on chain and failed. The whole wait is up to about a day.
  let releaseAt = null;
  if (staker?.inactiveFrom != null && inactive > 0n) {
    const policy = await chain.policy();
    releaseAt = staker.inactiveFrom + policy.blocksPerEpoch + 1;
    const v = staker.delegation ? await chain.validator(staker.delegation) : null;
    if (v?.jailedFrom != null) {
      releaseAt = Math.max(releaseAt, v.jailedFrom + policy.blocksPerEpoch * policy.jailEpochs + 1);
    }
  }

  const secondsLeft = releaseAt && height < releaseAt ? releaseAt - height : 0;

  return {
    address,
    height,
    networkId: NETWORK_ID,
    // What the wallet itself shows: address plus NIM Pay has parked in swap
    // contracts. The parts are kept so the screen can explain a mismatch.
    spendable: String(pay.total),
    inAddress: String(pay.plain),
    heldByPay: String(pay.held),
    staked: String(staked),
    inactive: String(inactive),
    retired: String(retired),
    releaseAt,
    secondsLeft,
    delegation: staker?.delegation ?? null,
    isStaking: staked > 0n || leavingIn > 0n || leavingOut > 0n,
    /** Which of the three steps out the money is on, if any. */
    leaving: leavingOut > 0n ? "ready" : leavingIn > 0n ? (secondsLeft > 0 ? "waiting" : "releasable") : null,
    validators: validators.slice(0, 12),
    suggested: validators[0] ?? null,
  };
}

const json = (res, code, body) => {
  res.writeHead(code, { ...SECURITY, "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { ...SECURITY, "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      return res.end(renderApp({ demoAddress: DEMO_ADDRESS, networkId: NETWORK_ID }));
    }

    if (req.method === "GET" && STATIC[url.pathname]) {
      const file = STATIC[url.pathname];
      res.writeHead(200, { ...SECURITY, "content-type": file.type, "cache-control": "no-cache" });
      return res.end(file.body);
    }

    if (req.method === "GET" && url.pathname === "/sdk.js") {
      res.writeHead(200, { ...SECURITY, "content-type": "text/javascript; charset=utf-8" });
      if (SDK_SOURCE) return res.end(SDK_SOURCE);
      return res.end(
        `const absent=(n)=>()=>Promise.reject(new Error(n+" needs @nimiq/mini-app-sdk"));
         export const init=absent("init"), requestDeviceIdentifier=absent("requestDeviceIdentifier");
         export const getHostLanguage=()=>undefined;`);
    }

    // Health check for the host: answers without touching the chain.
    if (req.method === "GET" && url.pathname === "/healthz") return json(res, 200, { ok: true });

    if (req.method === "GET" && url.pathname.startsWith("/api/") && url.searchParams.has("address")
        && !ADDRESS.test(url.searchParams.get("address").trim())) {
      return json(res, 400, { error: "that is not a Nimiq address" });
    }

    if (req.method === "GET" && url.pathname === "/api/overview") {
      const address = url.searchParams.get("address")?.trim() || DEMO_ADDRESS;
      const o = await overview(address);
      // Addresses are public on chain; logging which one asked makes a wrong
      // balance debuggable without asking the user to read hex off a phone.
      console.log(`[overview] ${address} → spendable ${nim(BigInt(o.spendable))} NIM, staked ${nim(BigInt(o.staked))} NIM`);
      return json(res, 200, o);
    }

    // Every action, with its hash. A staking app that asks to be trusted and
    // then shows nothing checkable is asking for the wrong thing.
    if (req.method === "GET" && url.pathname === "/api/history") {
      const address = url.searchParams.get("address")?.trim() || DEMO_ADDRESS;
      return json(res, 200, { history: await chain.stakingHistory(address, 20) });
    }

    // Broadcast is not settlement, so the page asks here whether a hash has
    // actually landed rather than believing the wallet's reply.
    if (req.method === "GET" && url.pathname.startsWith("/api/tx/")) {
      const hash = decodeURIComponent(url.pathname.slice("/api/tx/".length));
      if (!/^[0-9a-f]{64}$/i.test(hash)) return json(res, 400, { error: "that is not a transaction hash" });
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
