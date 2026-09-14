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

/**
 * Both Nimiq networks, served side by side.
 *
 * Nimiq Pay can be switched to testnet, and a mini app can't tell which network
 * it's on except by asking. A server that only reads mainnet shows a testnet
 * user 0 NIM (found 14 Sep 2026, on a phone that had 111,000 testnet NIM). So
 * the page asks Nimiq Pay for its block height, picks the network it matches,
 * and names it in every request. That also lets anyone try NimJar end to end
 * with free testnet NIM, without risking real money.
 *
 * Each network has a wallet we know stakes (or staked), shown in preview when
 * the app is opened outside Nimiq Pay, so the screen is never empty and every
 * figure on it can be checked on a block explorer.
 */
const DEFAULT_NET = Number(process.env.NETWORK_ID || 24) === 24 ? "main" : "test";
const pick = (name, isDefault, fallback) => process.env[name] || (isDefault && process.env[name.replace(/_(MAIN|TEST)$/, "")]) || fallback;
const NETS = {
  main: {
    id: 24,
    rpc: pick("RPC_URL_MAIN", DEFAULT_NET === "main", "https://rpc.nimiqwatch.com"),
    directoryUrl: pick("VALIDATORS_API_MAIN", DEFAULT_NET === "main", "https://validators-api-main.je-cf9.workers.dev"),
    demo: pick("DEMO_ADDRESS_MAIN", DEFAULT_NET === "main", "NQ19 4DVG ARRM PVLY 45HC MRY7 5Y9U 31EG JF9U"),
  },
  test: {
    id: 5,
    rpc: pick("RPC_URL_TEST", DEFAULT_NET === "test", "https://rpc.testnet.nimiqwatch.com"),
    directoryUrl: pick("VALIDATORS_API_TEST", DEFAULT_NET === "test", "https://validators-api-test.je-cf9.workers.dev"),
    demo: pick("DEMO_ADDRESS_TEST", DEFAULT_NET === "test", "NQ72 59DJ JNM7 DK3S 98CC AQ32 NG23 QQHA 33ER"),
  },
};
for (const [name, n] of Object.entries(NETS)) Object.assign(n, { name, chain: new Chain({ url: n.rpc }), directory: { at: 0, list: [] } });
const netOf = (url) => NETS[url.searchParams.get("net")] ?? NETS[DEFAULT_NET];

// The default network, for start-up logs and the page's first render.
const { id: NETWORK_ID, rpc: RPC_URL, demo: DEMO_ADDRESS } = NETS[DEFAULT_NET];

/**
 * Amounts this small are treated as nothing. If a few luna are ever left in the
 * staking contract, the app must not sit on "withdraw 0.002 NIM" forever for an
 * amount that costs more than itself to move. The page applies the same rule.
 */
const DUST = 1000n;

/**
 * A Nimiq address, with or without the spaces, including its IBAN-style
 * checksum. Anything else never reaches the node, so a mistyped address gets a
 * clear answer instead of the node's "Unknown format".
 */
const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVXY";
const ADDRESS = {
  test(value) {
    const c = String(value).replace(/\s+/g, "").toUpperCase();
    if (!/^NQ[0-9]{2}[0-9A-Z]{32}$/.test(c) || [...c.slice(4)].some((ch) => !ALPHABET.includes(ch))) return false;
    const digits = (c.slice(4) + c.slice(0, 4)).replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
    let mod = 0;
    for (const d of digits) mod = (mod * 10 + Number(d)) % 97;
    return mod === 1;
  },
};

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
async function healthyValidators(net) {
  const all = await net.chain.validators();
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
async function validatorDirectory(net) {
  const directory = net.directory;
  if (Date.now() - directory.at < 10 * 60_000) return directory.list;
  try {
    const r = await fetch(net.directoryUrl + "/api/v1/validators", { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`answered ${r.status}`);
    const all = await r.json();
    Object.assign(directory, {
      at: Date.now(),
      list: all.map((v) => ({
        address: v.address,
        name: typeof v.name === "string" ? v.name.slice(0, 40) : null,
        fee: v.fee == null ? null : Number(v.fee),
        payoutType: v.payoutType ?? null,
        score: typeof v.score?.total === "number" ? v.score.total : null,
        dominance: typeof v.dominanceRatio === "number" && v.dominanceRatio >= 0 ? v.dominanceRatio : null,
        color: /^#[0-9a-f]{6}$/i.test(v.accentColor ?? "") ? v.accentColor : null,
        payoutSchedule: typeof v.payoutSchedule === "string" ? v.payoutSchedule.slice(0, 160) : null,
      })),
    });
  } catch (e) {
    console.log(`[validators] ${net.name} directory unavailable (${e.message}); retrying in a minute`);
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
async function overview(address, net) {
  const chain = net.chain;
  const [pay, staker, healthy, dir, height] = await Promise.all([
    chain.payBalance(address),
    chain.staker(address),
    healthyValidators(net),
    validatorDirectory(net),
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

  // Rewards received so far, for pools that add them to the stake. See
  // Chain.stakeFlows for why this is measured as "in the stake now, minus what
  // you put in". Direct pools pay into the wallet instead: no number then.
  let earned = null;
  const inStake = staked + inactive + retired;
  if (inStake > 0n) {
    const flows = await chain.stakeFlows(address).catch(() => null);
    const principal = flows ? flows.deposited - flows.withdrawn : null;
    if (flows?.complete && principal !== null && inStake >= principal) earned = String(inStake - principal);
  }

  return {
    address,
    height,
    networkId: net.id,
    net: net.name,
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
    earned,
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
      return res.end(renderApp({ net: DEFAULT_NET, demo: { main: NETS.main.demo, test: NETS.test.demo } }));
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

    // Both networks' heights, so the page can tell which one Nimiq Pay is on.
    if (req.method === "GET" && url.pathname === "/api/networks") {
      const heights = await Promise.all(Object.values(NETS).map((n) => n.chain.height().catch(() => null)));
      return json(res, 200, Object.fromEntries(Object.keys(NETS).map((k, i) => [k, { id: NETS[k].id, height: heights[i] }])));
    }

    const net = netOf(url);

    if (req.method === "GET" && url.pathname === "/api/overview") {
      const address = url.searchParams.get("address")?.trim() || net.demo;
      const o = await overview(address, net);
      // Addresses are public on chain; logging which one asked makes a wrong
      // balance debuggable without asking the user to read hex off a phone.
      console.log(`[overview] ${net.name} ${address} → spendable ${nim(BigInt(o.spendable))} NIM, staked ${nim(BigInt(o.staked))} NIM`);
      return json(res, 200, o);
    }

    // Every action, with its hash. A staking app that asks to be trusted and
    // then shows nothing checkable is asking for the wrong thing.
    if (req.method === "GET" && url.pathname === "/api/history") {
      const address = url.searchParams.get("address")?.trim() || net.demo;
      return json(res, 200, { history: await net.chain.stakingHistory(address, 20) });
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
      const found = await net.chain.lookup(hash);
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
      const o = await overview(DEMO_ADDRESS, NETS[DEFAULT_NET]);
      console.log(`  demo    : ${nim(BigInt(o.staked))} NIM staked, ${nim(BigInt(o.spendable))} NIM spendable`);
    } catch (e) {
      console.log(`  demo    : could not reach the chain — ${e.message}`);
    }
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
