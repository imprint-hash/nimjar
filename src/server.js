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
import crypto from "node:crypto";
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

/**
 * The files the page loads, from public/. On Vercel the platform serves that
 * folder itself and these routes are never reached; locally this server does.
 * Read on first request and never at start-up: a missing file must cost one
 * route, not crash every route.
 */
const PUBLIC = new URL("../public/", import.meta.url);
const TYPES = { "/app.js": "text/javascript", "/app.css": "text/css", "/icon.svg": "image/svg+xml", "/sdk.js": "text/javascript" };
const files = new Map();
function publicFile(route) {
  if (!files.has(route)) {
    try { files.set(route, fs.readFileSync(new URL("." + route, PUBLIC))); }
    catch { files.set(route, null); }
  }
  return files.get(route);
}

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


/**
 * Validators the chain says are healthy: not retired, not jailed, not flagged
 * inactive. Necessary, but not enough to recommend one.
 */
async function healthyValidators() {
  const all = await chain.validators();
  return all
    .filter((v) => !v.retired && v.inactivityFlag == null && v.jailedFrom == null)
    .map((v) => ({ address: v.address, stakers: v.numStakers ?? 0 }));
}

/**
 * Nimiq's own validator directory: the list the Nimiq Wallet uses, with each
 * pool's name, fee, payout type and trust score.
 *
 * The chain cannot tell you the one thing a staker needs most: whether the
 * validator passes rewards on at all. The protocol pays the validator; paying
 * stakers is the pool's promise. On 14 Sep 2026 two large mainnet validators
 * were listed with payout type "none" — stake there earns nothing. Picking by
 * chain data alone could send someone's NIM to one of them.
 */
const DIRECTORY_URL = process.env.VALIDATORS_API
  || (NETWORK_ID === 24 ? "https://validators-api-main.je-cf9.workers.dev" : "https://validators-api-test.je-cf9.workers.dev");
let directory = { at: 0, list: [] };

async function validatorDirectory() {
  if (Date.now() - directory.at < 10 * 60_000) return directory.list;
  try {
    const r = await fetch(DIRECTORY_URL + "/api/v1/validators", { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`answered ${r.status}`);
    const all = await r.json();
    directory = {
      at: Date.now(),
      list: all.map((v) => ({
        address: v.address,
        name: typeof v.name === "string" ? v.name.slice(0, 40) : null,
        fee: v.fee == null ? null : Number(v.fee),
        payoutType: v.payoutType ?? null,
        score: typeof v.score?.total === "number" ? v.score.total : null,
        dominance: typeof v.dominanceRatio === "number" && v.dominanceRatio >= 0 ? v.dominanceRatio : null,
        color: /^#[0-9a-f]{6}$/i.test(v.accentColor ?? "") ? v.accentColor : null,
      })),
    };
  } catch (e) {
    console.log(`[validators] directory unavailable (${e.message}); retrying in a minute`);
    directory.at = Date.now() - 9 * 60_000;
  }
  return directory.list;
}

const compact = (a) => String(a).replace(/\s+/g, "").toUpperCase();

/**
 * Which validator to suggest to this person.
 *
 * Only pools that pay their stakers, charge 10% or less, hold under a tenth of
 * all stake, and — where Nimiq has scored them — score well. Among those, each
 * wallet gets its own pick, the same one every time, so NimJar spreads stake
 * across many pools instead of feeding the biggest one, which is what keeps
 * a proof-of-stake network decentralised.
 *
 * If the directory is unreachable, fall back to the busiest healthy validator
 * and say so (vetted: false), rather than pretend it was checked.
 */
function pickValidator(address, healthy, dir) {
  const onChain = new Map(healthy.map((v) => [compact(v.address), v]));
  const pools = dir
    .filter((v) => onChain.has(compact(v.address)))
    .filter((v) => v.payoutType === "restake" || v.payoutType === "direct")
    .filter((v) => v.fee != null && v.fee <= 0.1)
    .filter((v) => v.dominance == null || v.dominance < 0.1);
  const scored = pools.filter((v) => v.score != null && v.score >= 0.95);
  const list = (scored.length ? scored : pools).sort((a, b) => compact(a.address).localeCompare(compact(b.address)));

  if (!list.length) {
    const busiest = [...healthy].sort((a, b) => b.stakers - a.stakers)[0];
    return busiest ? { ...busiest, vetted: false } : null;
  }
  const n = crypto.createHash("sha256").update(compact(address)).digest().readUInt32BE(0);
  const v = list[n % list.length];
  return { ...v, stakers: onChain.get(compact(v.address)).stakers, vetted: true };
}

/** What we know about a validator someone is already staking with. */
function describe(address, healthy, dir) {
  if (!address) return null;
  const chainInfo = healthy.find((v) => compact(v.address) === compact(address));
  const info = dir.find((v) => compact(v.address) === compact(address));
  return { address, stakers: chainInfo?.stakers ?? null, healthy: !!chainInfo, ...(info ?? {}) };
}

/** Everything one screen needs, in one request. */
async function overview(address) {
  const [pay, staker, healthy, dir, height] = await Promise.all([
    chain.payBalance(address),
    chain.staker(address),
    healthyValidators(),
    validatorDirectory(),
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
    suggested: pickValidator(address, healthy, dir),
    current: describe(staker?.delegation, healthy, dir),
  };
}

const json = (res, code, body) => {
  res.writeHead(code, { ...SECURITY, "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
};

/** The whole app as one request handler: a Node server locally, a function on Vercel. */
export async function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { ...SECURITY, "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      return res.end(renderApp({ demoAddress: DEMO_ADDRESS, networkId: NETWORK_ID }));
    }

    if (req.method === "GET" && TYPES[url.pathname]) {
      const body = publicFile(url.pathname);
      if (!body) return json(res, 404, { error: "not found" });
      res.writeHead(200, { ...SECURITY, "content-type": `${TYPES[url.pathname]}; charset=utf-8`, "cache-control": "no-cache" });
      return res.end(body);
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
      // Nimiq Pay's typings describe the send calls as returning "the
      // serialized transaction"; a hash is also plausible. Accept either: a
      // confirmation check that silently never matches is its own lie.
      let hash = decodeURIComponent(url.pathname.slice("/api/tx/".length)).trim().replace(/^0x/i, "");
      if (/^[0-9a-f]{65,4000}$/i.test(hash)) {
        try { hash = (await import("@nimiq/core")).Transaction.fromAny(hash).hash(); }
        catch { return json(res, 400, { error: "that is not a transaction" }); }
      }
      if (!/^[0-9a-f]{64}$/i.test(hash)) return json(res, 400, { error: "that is not a transaction hash" });
      const found = await chain.lookup(hash);
      console.log(`[tx] ${hash.slice(0, 12)}… ${found ? `in block ${found.blockNumber}${found.executionResult === false ? " (FAILED)" : ""}` : "not seen yet"}`);
      return json(res, 200, {
        hash,
        settled: Boolean(found),
        ok: found ? found.executionResult !== false : null,
        blockNumber: found?.blockNumber ?? null,
      });
    }

    json(res, 404, { error: "not found" });
  } catch (e) {
    // A chain that is unreachable is our problem to report precisely, and never
    // a reason to show the visitor a blank screen.
    json(res, 502, { error: String(e?.message || e) });
  }
}

// Vercel treats src/server.js as the app's entry point and requires a default
// export; without it every request failed with "Invalid export found".
export default handler;

// Listen only when run directly (npm start). On Vercel the platform imports
// the handler instead and the platform does the listening.
const runDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (runDirectly) {
  const server = http.createServer(handler);
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
}
