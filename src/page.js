/**
 * The app, as one string.
 *
 * No build step, no framework. A phone screen inside Nimiq Pay with one job:
 * turn "my NIM is sitting still" into "my NIM is growing" in one tap — and
 * back again, honestly.
 *
 * Design direction, decided before any of this was written:
 *   material     a risograph-printed seed packet: flat ink shapes, a few spot
 *                colours, a little grain
 *   composition  scene first. An illustrated field fills the top and changes
 *                with the wallet's real state; one control block sits below it
 *   structure    a farm almanac: seed-packet data labels, thin rules, a diary
 *   feeling      playful but calm. Things sway and grow; nothing flashes
 *
 * The metaphor is load-bearing, not decoration. The barn is the wallet, the
 * field is staking, and the one irreversible step on the way out becomes the
 * harvest: once it is cut, it cannot be replanted. People understand that
 * without ever reading the word "retire".
 */

const PALETTE = `
 :root{
   --paper:#EEF1E6; --card:#F7F8F2; --rule:#D3D9C8;
   --ink:#20251E; --dim:#5B6456; --faint:#8C9585;
   --field:#3E8E5E; --field-soft:#DCEBDD;
   --soil:#8A5A3B; --sun:#F2C230; --sun-soft:#FBEFC4;
   --sky-top:#9FCBDC; --sky-low:#E3EFE7;
   --hill-far:#B7D3A8; --hill-near:#8DBF85;
   --shirt:#3D6FA8; --skin:#E2B08A; --straw:#E8C35A;
   --bad:#B4432E; --bad-soft:#F5DCD5;
   --display:"Fraunces",Georgia,serif;
   --body:"Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
   --mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
 }
 @media (prefers-color-scheme:dark){
   :root:not([data-theme="light"]){
     --paper:#11150F; --card:#181D16; --rule:#2B3327;
     --ink:#ECEFE3; --dim:#A2AB99; --faint:#6F786A;
     --field:#5DB983; --field-soft:#1B3024;
     --soil:#6B4A33; --sun:#F4E7B6; --sun-soft:#39321A;
     --sky-top:#0D1729; --sky-low:#1D2B3A;
     --hill-far:#1E3326; --hill-near:#27442F;
     --shirt:#4E7FB8; --skin:#C99774; --straw:#C9A64C;
     --bad:#EE8468; --bad-soft:#3A1E17;
   }
 }
 :root[data-theme="dark"]{
   --paper:#11150F; --card:#181D16; --rule:#2B3327;
   --ink:#ECEFE3; --dim:#A2AB99; --faint:#6F786A;
   --field:#5DB983; --field-soft:#1B3024;
   --soil:#6B4A33; --sun:#F4E7B6; --sun-soft:#39321A;
   --sky-top:#0D1729; --sky-low:#1D2B3A;
   --hill-far:#1E3326; --hill-near:#27442F;
   --shirt:#4E7FB8; --skin:#C99774; --straw:#C9A64C;
   --bad:#EE8468; --bad-soft:#3A1E17;
 }`;

export function renderApp({ demoAddress, networkId }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Put your NIM to work</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
${PALETTE}
 *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
 body{margin:0;background:var(--paper);color:var(--ink);
   font:16px/1.55 var(--body);overscroll-behavior:none;-webkit-font-smoothing:antialiased}
 .wrap{max-width:460px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;
   padding:14px 16px calc(22px + env(safe-area-inset-bottom))}

 header{display:flex;align-items:center;gap:8px;margin:0 4px 12px}
 .sprout{width:18px;height:18px;flex:none}
 .appname{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
 .mode{margin-left:auto;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;
   text-transform:uppercase;padding:3px 9px;border-radius:99px;border:1.5px solid currentColor;color:var(--faint)}
 .mode.live{color:var(--field)}

 /* The scene. The one place the design spends its boldness. */
 .scene{position:relative;border-radius:18px;overflow:hidden;border:1.5px solid var(--ink);
   background:var(--sky-low);height:212px;flex:none}
 .scene canvas{display:block;width:100%;height:100%}
 .scene .tag{position:absolute;left:10px;top:10px;font-family:var(--mono);font-size:9.5px;
   letter-spacing:.14em;text-transform:uppercase;background:var(--card);color:var(--ink);
   border:1.5px solid var(--ink);border-radius:99px;padding:3px 9px}

 main{flex:1;display:flex;flex-direction:column;gap:14px;padding:16px 4px 0}
 .kicker{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin:0}
 .hero{font-family:var(--display);font-optical-sizing:auto;font-weight:500;
   font-variation-settings:"SOFT" 100,"WONK" 1;
   font-size:50px;line-height:.95;letter-spacing:-.02em;font-variant-numeric:tabular-nums;
   margin:2px 0 0;display:flex;align-items:baseline;gap:7px;overflow-wrap:anywhere}
 .hero .unit{font-family:var(--body);font-size:15px;font-weight:700;color:var(--dim);letter-spacing:0}
 .hero.grow{color:var(--field)}
 .sub{font-size:14px;color:var(--dim);margin:-4px 0 0}

 /* Seed-packet data panel: a bordered table, not a row of floating cards. */
 .packet{border:1.5px solid var(--ink);border-radius:14px;background:var(--card);
   display:grid;grid-template-columns:1fr 1fr;overflow:hidden}
 .packet > div{padding:11px 13px;display:flex;flex-direction:column;gap:2px}
 .packet > div + div{border-left:1.5px dashed var(--rule)}
 .packet .k{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
 .packet .v{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}
 .packet .v small{font-family:var(--mono);font-size:12px;font-weight:400;color:var(--dim)}

 .earn{background:var(--sun-soft);border-radius:12px;padding:11px 13px;
   display:flex;align-items:center;justify-content:space-between;gap:10px}
 .earn .lbl{font-size:13px;color:var(--ink);line-height:1.35}
 .earn .amt{font-family:var(--mono);font-size:15px;font-weight:500;white-space:nowrap}

 .field-label{font-size:13px;font-weight:600;margin:4px 0 -6px}
 .amount{border:1.5px solid var(--ink);border-radius:12px;padding:10px 14px;background:var(--card);
   display:flex;align-items:baseline;justify-content:space-between;gap:10px}
 .amount input{border:0;background:transparent;color:var(--ink);width:100%;
   font:500 32px/1.1 var(--display);font-variation-settings:"SOFT" 100;font-variant-numeric:tabular-nums;
   letter-spacing:-.02em;padding:0;outline:none;-moz-appearance:textfield}
 .amount input::-webkit-outer-spin-button,.amount input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
 .amount .cur{font-size:12.5px;font-weight:700;color:var(--dim);flex:none}
 .presets{display:flex;gap:8px}
 .presets button{flex:1;font:600 13px var(--body);padding:9px 4px;border-radius:10px;
   border:1.5px solid var(--rule);background:transparent;color:var(--dim);cursor:pointer}
 .presets button:hover,.presets button:focus-visible{border-color:var(--ink);color:var(--ink)}

 .hand{border:1.5px solid var(--rule);border-radius:14px;padding:11px 13px;display:flex;align-items:center;gap:11px}
 .hand .face{width:34px;height:34px;border-radius:50%;background:var(--sun-soft);flex:none;
   display:grid;place-items:center;font-size:17px}
 .hand .who{display:block;font-size:13.5px;font-weight:700;line-height:1.3}
 .hand .why{display:block;font-size:11px;color:var(--faint);line-height:1.35;margin-top:1px;font-family:var(--mono)}

 .note{font-size:13px;color:var(--dim);line-height:1.5;margin:0}
 a{color:inherit}

 .leaving{border:1.5px solid var(--ink);border-radius:14px;padding:13px 14px 6px;background:var(--card)}
 .leaving-amt{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;margin:3px 0 4px}
 .leaving-amt small{font-size:12px;color:var(--dim)}
 .track{display:flex;flex-direction:column}
 .track-step{display:flex;gap:11px;align-items:flex-start;padding:7px 0}
 .track-step .pip{width:12px;height:12px;border-radius:50%;flex:none;margin-top:4px;
   background:var(--paper);border:2px solid var(--rule)}
 .track-step.done .pip{background:var(--field);border-color:var(--field)}
 .track-step.now .pip{background:var(--sun);border-color:var(--ink)}
 .track-step .t{display:block;font-size:13.5px;font-weight:700;line-height:1.3}
 .track-step .d{display:block;font-family:var(--mono);font-size:10.5px;color:var(--faint);line-height:1.35;margin-top:2px}
 .track-step.pending .t{color:var(--faint);font-weight:500}
 .track-rail{width:2px;background:var(--rule);margin-left:5px;height:6px}

 .diary .kicker{margin-bottom:4px}
 .hrow{display:grid;grid-template-columns:auto 1fr auto auto;gap:10px;align-items:baseline;
   padding:9px 2px;border-bottom:1.5px dashed var(--rule);text-decoration:none}
 .hrow:last-child{border-bottom:0}
 .hrow .ic{width:9px;height:9px;border-radius:50%;border:1.5px solid var(--ink);align-self:center}
 .hrow .hwhat{font-size:13.5px;font-weight:600}
 .hrow:hover .hwhat{text-decoration:underline;text-decoration-color:var(--faint)}
 .hamt{font-family:var(--mono);font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}
 .hwhen{font-family:var(--mono);font-size:10.5px;color:var(--faint);white-space:nowrap}

 .msg{border-radius:12px;padding:11px 13px;font-size:13.5px;line-height:1.45}
 .msg.bad{background:var(--bad-soft);color:var(--bad);border:1.5px solid var(--bad)}
 .msg.wait{background:var(--sun-soft);color:var(--ink)}

 .foot{margin-top:auto;padding-top:14px;display:flex;flex-direction:column;gap:8px}
 /* Riso misregistration: the primary button's green shadow sits slightly off,
    the way a second ink never quite lands on the first. */
 button.act{border:1.5px solid var(--ink);border-radius:14px;padding:15px;width:100%;
   font:700 16px var(--body);cursor:pointer;background:var(--ink);color:var(--paper);
   box-shadow:4px 4px 0 var(--field);transition:transform .08s ease,box-shadow .08s ease}
 button.act:active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--field)}
 button.act:disabled{opacity:.4;cursor:default;box-shadow:none}
 button.act.danger{background:var(--bad);border-color:var(--bad);color:#fff;box-shadow:4px 4px 0 var(--ink)}
 button.act.quiet{background:transparent;color:var(--ink);border:0;box-shadow:none;font-weight:600;font-size:14px;padding:9px}
 button:focus-visible{outline:2px solid var(--sun);outline-offset:3px}
 .hint{font-family:var(--mono);font-size:9.5px;color:var(--faint);text-align:center;line-height:1.45;margin:2px 0 0}
 .skeleton{color:var(--faint)}
 @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body><div class="wrap">

<header>
  <svg class="sprout" viewBox="0 0 18 18" aria-hidden="true">
    <path d="M9 17V8" stroke="currentColor" stroke-width="2" fill="none" style="color:var(--field)"></path>
    <path d="M9 9C9 5 6 3 2 3c0 4 3 6 7 6z" fill="var(--field)"></path>
    <path d="M9 8c0-3 2.5-5 6.5-5 0 3.5-2.5 5-6.5 5z" fill="var(--sun)"></path>
  </svg>
  <span class="appname">Put to work</span>
  <span class="mode" id="mode">connecting</span>
</header>

<div class="scene" id="scene">
  <canvas id="farm" aria-label="Your field" role="img"></canvas>
  <span class="tag" id="sceneTag">your field</span>
</div>

<main id="main">
  <p class="kicker skeleton">Reading the chain…</p>
  <p class="hero skeleton">—</p>
</main>

<script type="module">
import { init } from "/sdk.js";

const DEMO_ADDRESS = ${JSON.stringify(demoAddress)};
const NETWORK_ID = ${networkId};
const MINIMUM = 10000000n;            // 100 NIM, from the chain's own policy
const YEARLY = 0.15;                  // ~15%. Shown per week, never as a percentage.
const LUNA = 100000n;

/* Fees, in luna, sent on every wallet call. Tested in Nimiq Pay on 11 Sep:
   Pay used zero instead and both stakes still landed, so these are a floor the
   wallet may override, not a promise. Sized from the measured transactions. */
const FEE = { create: 300, add: 200, deactivate: 300, retire: 300, withdraw: 200 };
// A drawn straw hat, not an emoji: emoji render as empty boxes on some devices.
const HAT = '<svg viewBox="0 0 24 24" width="22" height="22"><ellipse cx="12" cy="15" rx="10" ry="3.2" fill="var(--straw)" stroke="var(--ink)" stroke-width="1.3"/><path d="M7 15c0-5 2-8 5-8s5 3 5 8" fill="var(--straw)" stroke="var(--ink)" stroke-width="1.3"/><path d="M7.4 12.6h9.2" stroke="#A8432E" stroke-width="1.8"/></svg>';
const EXPLORER = NETWORK_ID === 24 ? "https://nimiq.watch/#" : "https://test.nimiq.watch/#";

const $ = (id) => document.getElementById(id);
const main = $("main");

let provider = null;      // null outside Nimiq Pay — the app is then read-only
let address = DEMO_ADDRESS;
let data = null;
let busy = false;

/* ---- money ----------------------------------------------------------------
   NIM has five decimal places and amounts are integers of luna throughout.
   Nothing is parsed into a float and nothing is rounded up: money that rounds
   itself looks like money that might go missing. */
function nim(luna, places = 2) {
  const n = BigInt(luna);
  const whole = n / LUNA;
  const frac = (n % LUNA).toString().padStart(5, "0").slice(0, places).replace(/0+$/, "");
  return whole.toLocaleString("en-GB") + (frac ? "." + frac : "");
}
const perWeek = (luna) => (Number(BigInt(luna)) / 1e5) * YEARLY / 52;
const fmtWeek = (luna) => perWeek(luna).toFixed(2);
const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
const short = (a) => { const c = String(a).split(" ").join(""); return c.slice(0, 6) + "…" + c.slice(-4); };

/* ==== the farm ==============================================================
   Drawn on a canvas from the wallet's real state — never a looping video.
   Plant count follows the size of the stake, the field clears while the
   network releases it, sheaves turn gold when they can be harvested, and a
   cart heads for the barn at the end. Night theme draws the same farm at night.
   Reduced motion gets a single still frame. */
const farm = { mode: "empty", plants: 0, t0: performance.now() };
const cvs = $("farm");
const ctx = cvs.getContext("2d");
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
let tokens = {};

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  tokens = {
    ink: g("--ink"), field: g("--field"), soil: g("--soil"), sun: g("--sun"),
    skyTop: g("--sky-top"), skyLow: g("--sky-low"), hillFar: g("--hill-far"), hillNear: g("--hill-near"),
    shirt: g("--shirt"), skin: g("--skin"), straw: g("--straw"), paper: g("--paper"),
    night: matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light"
        || document.documentElement.dataset.theme === "dark",
  };
}

function sizeCanvas() {
  const r = cvs.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cvs.width = Math.round(r.width * dpr);
  cvs.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// A fixed pseudo-random sequence, so stars and grain sit still between frames.
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function drawFarm(now) {
  const W = cvs.clientWidth, H = cvs.clientHeight, T = tokens;
  const t = still ? 0 : (now - farm.t0) / 1000;
  ctx.clearRect(0, 0, W, H);

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, T.skyTop); sky.addColorStop(1, T.skyLow);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  if (T.night) {
    const r = seeded(7);
    for (let i = 0; i < 46; i++) {
      const x = r() * W, y = r() * H * 0.5, s = r() * 1.4 + 0.4;
      ctx.globalAlpha = 0.45 + 0.45 * Math.abs(Math.sin(t * 0.8 + i));
      ctx.fillStyle = "#FFF7DA"; ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // sun or moon
  const sx = W - 58, sy = 42;
  ctx.fillStyle = T.sun;
  if (!T.night) {
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.15);
    for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); ctx.fillRect(22, -2, 9, 4); }
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(sx, sy, 17, 0, Math.PI * 2); ctx.fill();
  if (T.night) { ctx.fillStyle = T.skyTop; ctx.beginPath(); ctx.arc(sx + 7, sy - 5, 14, 0, Math.PI * 2); ctx.fill(); }

  // hills, far then near
  const hill = (base, amp, len, color, phase) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) ctx.lineTo(x, base + Math.sin(x / len + phase) * amp);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  };
  hill(H * 0.52, 10, 70, T.hillFar, 0.8);
  hill(H * 0.60, 8, 52, T.hillNear, 2.1);

  // barn, back right
  const bx = W - 96, by = H * 0.57;
  ctx.fillStyle = "#A8432E"; ctx.fillRect(bx, by - 34, 46, 34);
  ctx.beginPath(); ctx.moveTo(bx - 5, by - 34); ctx.lineTo(bx + 23, by - 54); ctx.lineTo(bx + 51, by - 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = T.paper; ctx.fillRect(bx + 16, by - 20, 14, 20);
  ctx.strokeStyle = "#A8432E"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx + 16, by - 20); ctx.lineTo(bx + 30, by); ctx.moveTo(bx + 30, by - 20); ctx.lineTo(bx + 16, by); ctx.stroke();

  // field: rows of soil in perspective
  const top = H * 0.64, rows = 4;
  for (let i = 0; i < rows; i++) {
    const y0 = top + (H - top) * (i / rows), y1 = top + (H - top) * ((i + 1) / rows);
    ctx.fillStyle = T.soil; ctx.globalAlpha = 0.78 + i * 0.06;
    ctx.fillRect(0, y0, W, y1 - y0); ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.fillRect(0, y1 - 2, W, 2);
  }

  // what grows, row by row
  const n = farm.plants, per = Math.ceil(n / rows) || 0;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / per), col = i % per;
    const y = top + (H - top) * ((row + 0.72) / rows);
    const x = 104 + (col + (row % 2) * 0.5) * ((W - 124) / Math.max(per, 1));
    const scale = 0.72 + row * 0.12;
    if (farm.mode === "growing") drawPlant(x, y, scale, t, i);
    else if (farm.mode === "clearing" || farm.mode === "harvest") drawSheaf(x, y, scale, farm.mode === "harvest", t, i);
  }
  if (farm.mode === "empty") {
    const r = seeded(3);
    for (let i = 0; i < 26; i++) {
      const row = i % rows, y = top + (H - top) * ((row + 0.6) / rows);
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath();
      ctx.arc(110 + r() * (W - 140), y, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (farm.mode === "home") drawCart(W * 0.5 + Math.sin(t * 0.6) * 18, H - 22, T);

  // coins rising from the crop while it earns
  if (farm.mode === "growing" && n && !still) {
    for (let k = 0; k < 3; k++) {
      const life = (t * 0.55 + k / 3) % 1, idx = (Math.floor(t * 0.55 + k / 3) * 7 + k * 5) % n;
      const row = Math.floor(idx / per), col = idx % per;
      const x = 104 + (col + (row % 2) * 0.5) * ((W - 124) / Math.max(per, 1));
      const y = top + (H - top) * ((row + 0.72) / rows) - 26 - life * 34;
      ctx.globalAlpha = 1 - life; ctx.fillStyle = T.sun; ctx.strokeStyle = T.ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawFarmer(66, H - 16, t, T);

  // print grain
  const g = seeded(11); ctx.fillStyle = "rgba(0,0,0,.05)";
  for (let i = 0; i < 520; i++) ctx.fillRect(g() * W, g() * H, 1, 1);
}

function drawPlant(x, y, s, t, i) {
  const T = tokens, sway = Math.sin(t * 1.4 + i * 0.7) * 0.07, h = 26 * s;
  ctx.save(); ctx.translate(x, y); ctx.rotate(sway);
  ctx.strokeStyle = T.field; ctx.lineWidth = 2.2 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h); ctx.stroke();
  ctx.fillStyle = T.field;
  ctx.beginPath(); ctx.ellipse(-5 * s, -h * 0.45, 6 * s, 2.6 * s, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5 * s, -h * 0.62, 6 * s, 2.6 * s, 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = T.sun;
  ctx.beginPath(); ctx.ellipse(0, -h - 3 * s, 3 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawSheaf(x, y, s, ripe, t, i) {
  const T = tokens;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = ripe ? T.sun : T.straw; ctx.strokeStyle = T.ink; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(0, -22 * s); ctx.lineTo(7 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = T.soil; ctx.fillRect(-5 * s, -9 * s, 10 * s, 2.4 * s);
  if (ripe && !still) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 3 + i); ctx.fillStyle = T.sun;
    ctx.beginPath(); ctx.arc(0, -12 * s, 12 * s, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}

function drawCart(x, y, T) {
  ctx.fillStyle = "#A8432E"; ctx.strokeStyle = T.ink; ctx.lineWidth = 1.4;
  ctx.fillRect(x - 26, y - 22, 52, 16); ctx.strokeRect(x - 26, y - 22, 52, 16);
  ctx.fillStyle = T.sun;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 22 + k * 13, y - 22); ctx.lineTo(x - 16 + k * 13, y - 38); ctx.lineTo(x - 10 + k * 13, y - 22); ctx.fill(); }
  ctx.fillStyle = T.ink;
  for (const dx of [-15, 15]) { ctx.beginPath(); ctx.arc(x + dx, y - 4, 6, 0, Math.PI * 2); ctx.fill(); }
}

function drawFarmer(x, y, t, T) {
  const bob = still ? 0 : Math.sin(t * 2) * 1.2;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5; ctx.lineCap = "round";
  // legs, overalls, shirt
  ctx.fillStyle = "#2F4A6B"; ctx.fillRect(-9, -22, 7, 22); ctx.fillRect(2, -22, 7, 22);
  ctx.fillStyle = T.shirt; ctx.beginPath(); ctx.roundRect(-12, -52, 24, 32, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#2F4A6B"; ctx.fillRect(-9, -38, 18, 18);
  // head and hat
  ctx.fillStyle = T.skin; ctx.beginPath(); ctx.arc(0, -61, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = T.ink; ctx.fillRect(-4, -63, 2, 2); ctx.fillRect(3, -63, 2, 2);
  ctx.fillStyle = T.straw; ctx.beginPath(); ctx.ellipse(0, -68, 17, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-8, -80, 16, 12, 5); ctx.fill(); ctx.stroke();
  // what they hold says what is happening
  if (farm.mode === "empty") {             // a sack of seed
    ctx.fillStyle = "#D8C49A"; ctx.beginPath(); ctx.roundRect(12, -42, 16, 20, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = T.ink; ctx.font = "700 8px system-ui"; ctx.fillText("N", 17, -29);
  } else if (farm.mode === "growing") {    // a watering can, tipping
    ctx.save(); ctx.translate(20, -34); ctx.rotate(still ? 0.3 : 0.25 + Math.sin(t * 1.6) * 0.12);
    ctx.fillStyle = "#7B8C8E"; ctx.beginPath(); ctx.roundRect(-6, -8, 16, 13, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(20, -10); ctx.stroke(); ctx.restore();
  } else {                                 // a pitchfork
    ctx.beginPath(); ctx.moveTo(16, -10); ctx.lineTo(24, -60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, -58); ctx.lineTo(28, -62); ctx.moveTo(22, -62); ctx.lineTo(24, -70);
    ctx.moveTo(26, -60); ctx.lineTo(30, -68); ctx.stroke();
  }
  ctx.restore();
}

function loop(now) { drawFarm(now); if (!still) requestAnimationFrame(loop); }

function setScene(mode, stakedLuna, tag, label) {
  farm.mode = mode;
  // More NIM, more plants — on a log scale, so 100 NIM is a small plot and
  // 100,000 is a full field rather than an unreadable carpet.
  const whole = Number(BigInt(stakedLuna || 0n) / LUNA);
  farm.plants = whole > 0 ? Math.max(6, Math.min(36, Math.round(Math.log10(whole) * 9))) : 0;
  $("sceneTag").textContent = tag;
  cvs.setAttribute("aria-label", label);
  if (still) drawFarm(performance.now());
}

/* ---- boot ---------------------------------------------------------------- */
async function boot() {
  readTokens(); sizeCanvas();
  addEventListener("resize", () => { sizeCanvas(); if (still) drawFarm(performance.now()); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTokens(); if (still) drawFarm(performance.now()); });
  requestAnimationFrame(loop);

  try {
    provider = await init({ timeout: 2500 });
    const accounts = await provider.listAccounts();
    if (Array.isArray(accounts) && accounts.length) address = accounts[0];
  } catch {
    provider = null;   // not inside Nimiq Pay: show the real staked wallet instead
  }
  $("mode").textContent = provider ? "Live" : "Preview";
  $("mode").className = "mode" + (provider ? " live" : "");
  await refresh();
}

async function refresh() {
  try {
    const r = await fetch("/api/overview?address=" + encodeURIComponent(address));
    data = await r.json();
    if (!r.ok) throw new Error(data.error || "could not read the chain");
    render();
  } catch (e) {
    main.innerHTML = '<div class="msg bad">Could not read the chain. ' + esc(e.message) + "</div>";
  }
}

/* ---- screens ------------------------------------------------------------- */
function render() {
  const staked = BigInt(data.staked), leaving = BigInt(data.inactive) + BigInt(data.retired);
  if (!data.isStaking) setScene("empty", 0n, "empty field", "An empty field. Nothing planted yet.");
  else if (data.leaving === "ready") setScene("home", leaving, "heading to the barn", "The harvest is on a cart heading to the barn.");
  else if (data.leaving === "releasable") setScene("harvest", leaving, "ready to harvest", "Golden sheaves, ready to harvest.");
  else if (data.leaving && staked === 0n) setScene("clearing", leaving, "clearing the field", "The field is being cleared.");
  else setScene("growing", staked, "growing", "A field of crops, growing.");

  main.innerHTML = data.isStaking ? screenWorking() : screenStart();
  wire();
  loadHistory();
}

function screenStart() {
  const spendable = BigInt(data.spendable);
  const enough = spendable > MINIMUM;
  const v = data.suggested;
  const half = Math.floor(Number(spendable) / 1e5 * 0.5);

  return \`
    <p class="kicker">In your barn</p>
    <p class="hero">\${nim(spendable)}<span class="unit">NIM</span></p>
    <p class="sub">sitting still — earning nothing</p>

    \${enough ? \`
      <div class="earn">
        <span class="lbl">Plant all of it and it grows about</span>
        <span class="amt">\${fmtWeek(spendable)} NIM / week</span>
      </div>

      <p class="field-label">How much do you want to plant?</p>
      <div class="amount">
        <input id="amt" type="number" inputmode="decimal" value="\${half}" min="100" step="1" aria-label="Amount to plant, in NIM">
        <span class="cur">NIM</span>
      </div>
      <div class="presets">
        <button data-set="100">100</button>
        <button data-set="half">Half</button>
        <button data-set="max">Most of it</button>
      </div>
      <p class="note" id="leftover"></p>

      \${v ? \`<div class="hand">
        <span class="face" aria-hidden="true">\${HAT}</span>
        <span>
          <span class="who">Tended by \${esc(short(v.address))}</span>
          <span class="why">\${v.stakers} people already use them · picked for you</span>
        </span>
      </div>\` : ""}

      <p class="note">Your barn is your wallet; the field is staking. It stays yours the
      whole time — you're lending it to keep the Nimiq network running, and the
      network pays you for it.</p>
    \` : \`
      <div class="msg wait">You need at least 100 NIM to plant. That's the network's
      own minimum, not ours.</div>
    \`}

    <div class="foot">
      <button class="act" id="go" \${enough ? "" : "disabled"}>Plant \${enough ? half.toLocaleString("en-GB") + " NIM" : "NIM"}</button>
      <p class="hint">\${provider ? "Nimiq Pay will ask you to confirm" : "Open inside Nimiq Pay to plant — this is a live preview of a real wallet"}</p>
    </div>\`;
}

function screenWorking() {
  const staked = BigInt(data.staked);
  const spendable = BigInt(data.spendable);
  // Everything on its way out: a big green "0 NIM growing" reads as a failure.
  // The harvest coming home is the only number worth the headline.
  const allLeaving = staked === 0n && data.leaving;
  return \`
    \${allLeaving ? \`
      <p class="kicker">Coming home to your barn</p>
      <p class="hero">\${nim(BigInt(data.inactive) + BigInt(data.retired))}<span class="unit">NIM</span></p>
      <p class="sub">nothing is growing right now</p>
      <div class="packet">
        <div><span class="k">In the barn</span><span class="v">\${nim(spendable)} <small>NIM</small></span></div>
        <div><span class="k">Growing</span><span class="v">0 <small>NIM</small></span></div>
      </div>\` : \`
      <p class="kicker">Growing in your field</p>
      <p class="hero grow">\${nim(staked)}<span class="unit">NIM</span></p>
      <p class="sub">grows about \${fmtWeek(staked)} NIM a week</p>
      <div class="packet">
        <div><span class="k">In the barn</span><span class="v">\${nim(spendable)} <small>NIM</small></span></div>
        <div><span class="k">A year's harvest</span><span class="v">≈ \${(perWeek(staked) * 52).toFixed(0)} <small>NIM</small></span></div>
      </div>\`}

    \${data.delegation ? \`<div class="hand">
      <span class="face" aria-hidden="true">\${HAT}</span>
      <span>
        <span class="who">Tended by \${esc(short(data.delegation))}</span>
        <span class="why">block \${data.height.toLocaleString("en-GB")}</span>
      </span>
    </div>\` : ""}

    \${data.leaving ? leavingPanel() : ""}

    <div id="history"></div>

    <div class="foot">
      \${staked > 0n ? \`<button class="act" id="more" \${spendable > MINIMUM ? "" : "disabled"}>Plant more</button>\` : ""}
      \${staked > 0n && !data.leaving ? \`<button class="act quiet" id="out">Bring it all back to the barn</button>\` : ""}
      <p class="hint">\${provider ? "Nimiq Pay will ask you to confirm" : "Live preview of a real wallet — every figure is on chain"}</p>
    </div>\`;
}

/**
 * The way out.
 *
 * Three transactions with a wait, and one of them cannot be undone. Nimiq's own
 * FAQ says two steps; it is three. On the farm: stop it growing, wait while the
 * field is cleared, harvest it (permanent — cut crops cannot be replanted),
 * then carry it to the barn.
 *
 * The rule for this panel: nobody reaches the permanent step without reading
 * that it is permanent.
 */
function leavingPanel() {
  const inactive = BigInt(data.inactive);
  const retired = BigInt(data.retired);
  const stage = data.leaving;

  const step = (n, state, title, detail) => \`
    <div class="track-step \${state}">
      <span class="pip"></span>
      <span><span class="t">\${title}</span><span class="d">\${detail}</span></span>
    </div>\${n < 4 ? '<div class="track-rail"></div>' : ""}\`;

  return \`
    <div class="leaving">
      <p class="kicker">Bringing it in</p>
      <p class="leaving-amt">\${nim(inactive + retired)} <small>NIM</small></p>
      <div class="track">
        \${step(1, "done", "Stopped growing", "confirmed")}
        \${step(2, stage === "waiting" ? "now" : "done",
          stage === "waiting" ? "The network is clearing the field" : "Field cleared",
          stage === "waiting" ? countdown(data.secondsLeft) : "done")}
        \${step(3, stage === "releasable" ? "now" : stage === "ready" ? "done" : "pending",
          "Harvest it", "permanent — cut crops can't be replanted")}
        \${step(4, stage === "ready" ? "now" : "pending",
          "Carry it to the barn", "back in your wallet")}
      </div>
    </div>
    \${stage === "releasable" ? \`
      <div class="msg bad">Harvesting can't be undone. Once it's cut, this NIM can only go
      to your barn — it can never be planted back in this field.</div>
      <button class="act danger" id="retire">Harvest \${nim(inactive)} NIM — can't be replanted</button>\` : ""}
    \${stage === "ready" ? \`<button class="act" id="withdraw">Carry \${nim(retired)} NIM to the barn</button>\` : ""}\`;
}

/**
 * The field diary: every action, with a link to the chain.
 *
 * Loaded after the screen so a slow node never delays the numbers people came
 * for. An app that moves your money and shows you nothing you can check for
 * yourself is asking to be taken on faith.
 */
const ACTION = {
  "create-staker": ["var(--field)", "Planted"],
  "add-stake": ["var(--field)", "Planted more"],
  "set-active-stake": ["var(--sun)", "Stopped growing"],
  "retire-stake": ["var(--sun)", "Harvested"],
  "remove-stake": ["#A8432E", "Carried to the barn"],
  "update-staker": ["var(--faint)", "Changed who tends it"],
};

async function loadHistory() {
  const box = $("history");
  if (!box) return;
  try {
    const { history } = await fetch("/api/history?address=" + encodeURIComponent(address)).then((r) => r.json());
    if (!history?.length) return;
    box.innerHTML = \`
      <div class="diary">
        <p class="kicker">Field diary</p>
        \${history.slice(0, 5).map((h) => {
          const a = ACTION[h.type] || ["var(--faint)", h.type];
          return \`<a class="hrow" href="\${EXPLORER}\${esc(h.hash)}" target="_blank" rel="noopener">
            <span class="ic" aria-hidden="true" style="background:\${a[0]}"></span>
            <span class="hwhat">\${a[1]}</span>
            <span class="hamt">\${BigInt(h.value) > 0n ? nim(h.value) + " NIM" : ""}</span>
            <span class="hwhen">\${when(h.timestamp)}</span>
          </a>\`;
        }).join("")}
      </div>\`;
  } catch { /* the diary is a nicety; never let it break the screen */ }
}

function when(ts) {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return mins + "m ago";
  const h = mins / 60;
  if (h < 24) return h.toFixed(0) + "h ago";
  return Math.round(h / 24) + "d ago";
}

/** A wait in words people use, not a block number. */
function countdown(seconds) {
  if (seconds <= 0) return "done";
  const h = seconds / 3600;
  if (h < 1) return "about " + Math.max(1, Math.round(seconds / 60)) + " minutes left";
  return "about " + h.toFixed(1) + " hours left";
}

/* ---- actions ------------------------------------------------------------- */
function wire() {
  const amt = $("amt");
  const spendable = BigInt(data.spendable);

  const showLeftover = () => {
    if (!amt || !$("leftover")) return;
    const want = BigInt(Math.max(0, Math.floor(Number(amt.value || 0) * 1e5)));
    const left = spendable > want ? spendable - want : 0n;
    $("leftover").textContent = "Leaves " + nim(left) + " NIM in the barn to spend.";
    const go = $("go");
    if (go) {
      go.disabled = want < MINIMUM || want > spendable;
      go.textContent = "Plant " + nim(want) + " NIM";
    }
  };
  amt?.addEventListener("input", showLeftover);
  showLeftover();

  for (const b of document.querySelectorAll("[data-set]")) {
    b.addEventListener("click", () => {
      const kind = b.dataset.set;
      const whole = Number(spendable / LUNA);
      amt.value = kind === "100" ? 100
        : kind === "half" ? Math.floor(whole / 2)
        // Never all of it: a barn with nothing in it cannot pay the fee to
        // bring the harvest back in.
        : Math.max(100, whole - 5);
      showLeftover();
    });
  }

  $("go")?.addEventListener("click", () => stake(BigInt(Math.floor(Number(amt.value) * 1e5)), true));
  $("more")?.addEventListener("click", () => {
    const whole = Number(spendable / LUNA);
    stake(BigInt(Math.max(100, Math.floor(whole / 2))) * LUNA, false);
  });

  // Getting out, step one: deactivate. The wallet call takes what should keep
  // growing, not what should leave — passing 0 brings everything in.
  $("out")?.addEventListener("click", () => {
    if (!provider) return say("wait", "This is a preview. Open it inside Nimiq Pay to move your own NIM.");
    if (!confirm("Bring it all back?\\n\\nIt stops growing now. The network takes up to twelve hours to clear the field, then two more taps: harvest it, then carry it to the barn.")) return;
    run(() => provider.sendSetActiveStakeTransaction({ newActiveBalance: 0, fee: FEE.deactivate }),
        "Stopped growing. The network is clearing the field.");
  });

  $("retire")?.addEventListener("click", () => {
    if (!provider) return say("wait", "This is a preview. Open it inside Nimiq Pay to move your own NIM.");
    if (!confirm("This can't be undone.\\n\\nOnce harvested, this NIM can only go to your barn. It can never be planted back. Harvest it?")) return;
    run(() => provider.sendRetireStakeTransaction({ retireStake: Number(data.inactive), fee: FEE.retire }),
        "Harvested. One tap left — carry it to the barn.");
  });

  $("withdraw")?.addEventListener("click", () => {
    if (!provider) return say("wait", "This is a preview. Open it inside Nimiq Pay to move your own NIM.");
    // The staking contract is the sender here, so the fee comes out of the
    // harvest itself. Asking for all of it plus a fee is accepted by the node
    // and then never lands — proven on mainnet, 10 Sep. Leave room for the fee.
    const fee = FEE.withdraw;
    run(() => provider.sendRemoveStakeTransaction({ value: Number(data.retired) - fee, fee }),
        "In your barn.");
  });
}

/** One shape for every wallet action: ask, wait for the chain, never assume. */
async function run(send, doneText) {
  if (busy) return;
  busy = true;
  try {
    const result = await send();
    if (result && result.error) throw new Error(result.error.message || "the wallet refused");
    say("wait", "Sent. Waiting for the chain to show it…");
    if (await settle(String(result))) say("wait", doneText);
  } catch (e) {
    say("bad", String(e?.message || e));
  } finally {
    busy = false;
    await refresh();
  }
}

async function stake(valueLuna, isFirst) {
  if (busy) return;
  if (!provider) {
    say("wait", "This is a preview. Open it inside Nimiq Pay to plant your own NIM.");
    return;
  }
  busy = true;
  const btn = $("go") || $("more");
  if (btn) { btn.disabled = true; btn.textContent = "Waiting for you to confirm…"; }

  try {
    // Sizes are in luna. The wallet signs; nothing here ever sees a key.
    const value = Number(valueLuna);
    const result = isFirst
      ? await provider.sendNewStakerTransaction({ delegation: data.suggested.address, value, fee: FEE.create })
      : await provider.sendStakeTransaction({ value, fee: FEE.add });

    if (result && result.error) throw new Error(result.error.message || "the wallet refused");

    // Broadcast is not settlement. Ask the chain, do not believe the reply.
    say("wait", "Planted. Waiting for the chain to show it…");
    await settle(String(result));
  } catch (e) {
    say("bad", String(e?.message || e));
  } finally {
    busy = false;
    await refresh();
  }
}

async function settle(hash) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch("/api/tx/" + encodeURIComponent(hash)).then((x) => x.json()).catch(() => null);
    if (r?.settled) {
      say("wait", "Done — settled in block " + r.blockNumber.toLocaleString("en-GB") + ".");
      return true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  // Accepted and then never seen. Saying nothing here is the one unforgivable
  // outcome, because the person's money has moved and they do not know.
  say("bad", "The network accepted it but it hasn't appeared yet. Nothing is lost — check again in a minute.");
  return false;
}

function say(kind, text) {
  let el = document.querySelector(".msg.live");
  if (!el) {
    el = document.createElement("div");
    el.className = "msg live";
    main.insertBefore(el, main.querySelector(".foot"));
  }
  el.className = "msg live " + kind;
  el.textContent = text;
}

boot();
</script>
</div></body></html>`;
}
