/**
 * NimJar, in the browser.
 *
 * One job: turn "my NIM is sitting still" into "my NIM is earning" in one tap,
 * and walk it all the way back out again.
 *
 * Nothing here holds a key. Every action is a request to Nimiq Pay, which shows
 * its own confirmation and signs on the person's own phone. Outside Nimiq Pay
 * the app is read-only and shows a real staked wallet instead.
 */

import { init } from "/sdk.js";

const CFG = JSON.parse(document.getElementById("cfg").textContent);
const NETWORK_ID = CFG.networkId;
const EXPLORER = NETWORK_ID === 24 ? "https://nimiq.watch/#" : "https://test.nimiq.watch/#";

const LUNA = 100000n;
const MINIMUM = 10000000n;       // 100 NIM, from the chain's own policy
const YEARLY = 0.15;             // ~15%. Shown per week in NIM, never as a percentage.

/* Getting out takes two transactions paid from the wallet itself (unstake,
   then confirm), so staking never takes everything: a wallet at zero could
   stake but never leave. 5 NIM covers those fees many thousands of times. */
const KEEP = 5n * LUNA;

/* Fees in luna, suggested with each wallet call, sized from the measured
   transactions at one luna per byte. Nimiq Pay picks its own fee (zero, in
   every test so far), so these are a suggestion, not a promise. The withdrawal
   is the exception and always goes at zero: see "withdraw" below. */
const FEE = { create: 300, add: 200, unstake: 300, retire: 300 };

/* Amounts smaller than this are treated as nothing. If a wallet ever leaves a
   few luna behind in the staking contract, the app must not get stuck asking
   someone to withdraw 0.002 NIM that costs more than that to move. */
const DUST = 1000n;

const $ = (id) => document.getElementById(id);
const app = $("app");
const dock = $("dock");
const device = $("device");
/** On a laptop the app scrolls inside a drawn phone; on a phone, the page scrolls. */
const framed = () => !!device && getComputedStyle(device).overflowY !== "visible";
const toTop = (smooth = true) => (framed() ? device : window).scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });

const S = {
  provider: null,           // null outside Nimiq Pay
  address: CFG.demoAddress,
  data: null,
  error: null,
  history: [],
  view: "home",             // "home" | "form"
  amount: "",
  preset: "half",
  msg: null,                // { kind: "info" | "good" | "bad", text }
  busy: false,
  happyUntil: 0,
  qa: 0,
  agree: false,
  sheet: false,
};

/* ---- money ----------------------------------------------------------------
   Five decimal places, integers of luna throughout. Nothing is parsed into a
   float and nothing is rounded up. */
const nim = (luna) => {
  const n = BigInt(luna);
  const whole = (n / LUNA).toLocaleString("en-GB");
  const frac = (n % LUNA).toString().padStart(5, "0").replace(/0+$/, "");
  return frac ? whole + "." + frac : whole;
};
const wholeNim = (luna) => (BigInt(luna) / LUNA).toLocaleString("en-GB");
/** "12.5" or "1,000" → luna. Anything else, including six decimals, is null. */
function parseNim(str) {
  const s = String(str).replace(/[\s,]/g, "");
  const m = /^(\d{1,12})(?:\.(\d{0,5}))?$/.exec(s);
  if (!m) return null;
  return BigInt(m[1]) * LUNA + BigInt((m[2] || "").padEnd(5, "0"));
}
/* The network's rate less the pool's fee: what actually reaches the staker. */
let RATE = YEARLY;
const perWeek = (luna) => (Number(BigInt(luna)) / 1e5) * RATE / 52;
const weekly = (luna) => {
  const w = perWeek(luna);
  return w >= 100 ? Math.floor(w).toLocaleString("en-GB") : w.toFixed(2);
};
const esc = (s) => String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
const compact = (a) => String(a).replace(/\s+/g, "").toUpperCase();
const shortAddr = (a) => { const c = compact(a); return c.slice(0, 4) + " " + c.slice(4, 6) + "…" + c.slice(-4); };

/* ---- icons and the mascot ------------------------------------------------ */
const I = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  in: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  out: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
};
const ic = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

let mid = 0;
const HEX = "25,6.7 75,6.7 100,50 75,93.3 25,93.3 0,50";
const PLACE = "translate(50 19) scale(.9) translate(-50 -24)";
/* The mascot's face says what the money is doing: resting, happy (it just
   worked), dozing (the unstaking wait — nothing to do), serious (the step that
   can't be undone), loading. */
const FACE = {
  eyes: `<g class="m-eyes"><ellipse cx="40.5" cy="53" rx="3.3" ry="3.8" fill="#1F2348"/><circle cx="41.6" cy="51.6" r="1.1" fill="#fff"/><ellipse cx="59.5" cy="53" rx="3.3" ry="3.8" fill="#1F2348"/><circle cx="60.6" cy="51.6" r="1.1" fill="#fff"/></g>`,
  closed: `<path d="M37 53.5q3.5 3 7 0M56 53.5q3.5 3 7 0" fill="none" stroke="#1F2348" stroke-width="2.4" stroke-linecap="round"/>`,
  smile: `<path d="M45.5 61.5q4.5 4 9 0" fill="none" stroke="#1F2348" stroke-width="2.4" stroke-linecap="round"/>`,
  grin: `<path d="M42.5 59q7.5 10 15 0z" fill="#1F2348" stroke="#1F2348" stroke-width="2" stroke-linejoin="round"/><path d="M46 64.2q4 2.6 8 0" fill="none" stroke="#F27C6B" stroke-width="2.6" stroke-linecap="round"/>`,
  flat: `<path d="M46 62.5h8" fill="none" stroke="#1F2348" stroke-width="2.4" stroke-linecap="round"/>`,
  brows: `<path d="M36.5 46.5l7-.8M56.5 45.7l7 .8" fill="none" stroke="#1F2348" stroke-width="2.2" stroke-linecap="round"/>`,
  snore: `<path d="M47.5 61.5a2.5 2 0 1 0 5 0a2.5 2 0 1 0 -5 0" fill="#1F2348"/>`,
};
const MOOD = {
  idle: FACE.eyes + FACE.smile,
  happy: FACE.eyes + FACE.grin,
  sleepy: FACE.closed + FACE.snore,
  serious: FACE.eyes + FACE.brows + FACE.flat,
  loading: FACE.eyes + FACE.smile,
};
function mascot(size, mood = "idle") {
  const u = "m" + ++mid;
  return `<svg class="albie mood-${mood}" width="${size}" height="${size}" viewBox="-4 -4 108 108" aria-hidden="true">
  <defs>
    <radialGradient id="${u}bg" cx="70%" cy="85%" r="100%"><stop offset="0" stop-color="#2E3572"/><stop offset="1" stop-color="#1F2348"/></radialGradient>
    <radialGradient id="${u}head" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF7B8"/><stop offset=".45" stop-color="#FBDE45"/><stop offset="1" stop-color="#E8A912"/></radialGradient>
    <radialGradient id="${u}leaf" cx="35%" cy="35%" r="80%"><stop offset="0" stop-color="#C9F57A"/><stop offset="1" stop-color="#4DB33A"/></radialGradient>
    <linearGradient id="${u}shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E9BE6"/><stop offset="1" stop-color="#0569B0"/></linearGradient>
    <filter id="${u}soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <clipPath id="${u}clip"><polygon points="${HEX}"/></clipPath>
  </defs>
  <polygon points="${HEX}" fill="url(#${u}bg)" stroke="#E9B213" stroke-width="7" stroke-linejoin="round"/>
  <g clip-path="url(#${u}clip)"><g transform="${PLACE}"><g class="m-hop">
    <path d="M22 110c0-19 12-29 28-29s28 10 28 29z" fill="url(#${u}shirt)"/>
    <polygon points="50,89 55.5,92.2 55.5,98.6 50,101.8 44.5,98.6 44.5,92.2" fill="#E9B213"/>
    <ellipse cx="50" cy="80" rx="21" ry="4.5" fill="#0B0D26" opacity=".5" filter="url(#${u}soft)"/>
    <g class="m-head">
      <path d="M50 24c19 0 30 13 30 29 0 15-12 24-30 24S20 68 20 53c0-16 11-29 30-29z" fill="url(#${u}head)"/>
      <ellipse cx="39" cy="35" rx="9" ry="5" fill="#fff" opacity=".55" filter="url(#${u}soft)"/>
      <ellipse cx="31" cy="60" rx="6.5" ry="4.5" fill="#F59E3B" opacity=".45" filter="url(#${u}soft)"/>
      <ellipse cx="69" cy="60" rx="6.5" ry="4.5" fill="#F59E3B" opacity=".45" filter="url(#${u}soft)"/>
      ${MOOD[mood] || MOOD.idle}
    </g>
  </g></g></g>
  <g transform="${PLACE}"><g class="m-hop"><g class="m-head"><g class="m-leaf">
    <path d="M52 27c1-10 13-17 24-12-2 11-14 17-24 12z" fill="url(#${u}leaf)" stroke="#2F7D24" stroke-width="1" stroke-opacity=".35"/>
    <path d="M54 25.5c5-3.5 11-6.5 17-8" fill="none" stroke="#3E9B2E" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
    <path d="M51 28.5c-.3-2.5.2-4.5 1.5-6" fill="none" stroke="#6B4A1E" stroke-width="2" stroke-linecap="round"/>
  </g></g></g></g>
  ${mood === "sleepy" ? `<g class="m-z" fill="#F4F4F8" font-family="Mulish,sans-serif" font-weight="900"><text x="74" y="32" font-size="15">z</text><text x="84" y="19" font-size="11">z</text></g>` : ""}
</svg>`;
}

/* ---- reading the chain --------------------------------------------------- */
function wallet() {
  const d = S.data;
  const spendable = BigInt(d.spendable);
  const staked = BigInt(d.staked);
  const inactive = BigInt(d.inactive) > DUST ? BigInt(d.inactive) : 0n;
  const retired = BigInt(d.retired) > DUST ? BigInt(d.retired) : 0n;
  const leaving = retired > 0n ? "ready" : inactive > 0n ? (d.secondsLeft > 0 ? "waiting" : "releasable") : null;
  return {
    spendable, staked, inactive, retired, leaving,
    out: inactive + retired,
    total: spendable + staked + inactive + retired,
    isStaking: staked > 0n || leaving !== null,
    maxStake: spendable > KEEP ? spendable - KEEP : 0n,
  };
}

let waitTimer = null;
async function refresh() {
  try {
    const r = await fetch("/api/overview?address=" + encodeURIComponent(S.address));
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || "the node did not answer");
    S.data = body;
    S.error = null;
    const v = body.isStaking ? body.current : body.suggested;
    RATE = YEARLY * (1 - (v?.fee != null && v.fee >= 0 && v.fee < 1 ? v.fee : 0));
  } catch (e) {
    S.error = String(e?.message || e);
  }
  render();
  loadHistory();

  // While the network is releasing stake, keep the countdown honest and move
  // on by itself the moment the wait is over.
  clearTimeout(waitTimer);
  if (S.data && wallet().leaving === "waiting") {
    waitTimer = setTimeout(refresh, Math.min(60_000, S.data.secondsLeft * 1000 + 4000));
  }
}

async function loadHistory() {
  try {
    const r = await fetch("/api/history?address=" + encodeURIComponent(S.address));
    const { history } = await r.json();
    S.history = Array.isArray(history) ? history.slice(0, 5) : [];
    const box = $("activity");
    if (box) box.outerHTML = activity();
  } catch { /* the activity list is a nicety; it never breaks the screen */ }
}

/* ---- screens ------------------------------------------------------------- */
function mood() {
  if (!S.data) return S.error ? "serious" : "loading";
  if (S.happyUntil > Date.now()) return "happy";
  const w = wallet();
  if (w.leaving === "waiting") return "sleepy";
  if (w.leaving === "releasable") return "serious";
  return "idle";
}

function header() {
  const live = !!S.provider;
  return `<header class="top">${mascot(52, mood())}<div class="name">NimJar</div>
    <div class="mode ${live ? "live" : ""}"><i></i>${live ? "Live" : "Preview"}</div></header>`;
}

function seg(label, luna, color) {
  const n = Number(BigInt(luna) / LUNA);
  return `<div class="seg ${n ? "" : "zero"}" style="flex:${n ? Math.max(Math.sqrt(n), 1) + " 1 0;min-width:84px" : "0 0 64px"}">
    <div class="k">${label}</div><div class="bar" style="background:${color}"></div><div class="v">${wholeNim(luna)}</div></div>`;
}

function big(luna) {
  const s = nim(luna);
  const [whole, frac] = s.split(".");
  const size = s.length > 12 ? "32px" : s.length > 9 ? "38px" : "";
  return `<div class="big"${size ? ` style="font-size:${size}"` : ""}>${whole}${frac ? `<small>.${frac}</small>` : ""} <small>NIM</small></div>`;
}

function card(w) {
  let label = "Your NIM", sub = "";
  if (!w.isStaking) { label = "Available"; sub = "Not earning anything yet"; }
  else if (w.leaving === "waiting") sub = `${nim(w.out)} NIM unstaking · not earning while it unlocks`;
  else if (w.leaving === "releasable") sub = `${nim(w.out)} NIM unlocked · two taps to get it back`;
  else if (w.leaving === "ready") sub = `${nim(w.out)} NIM confirmed · ready to withdraw`;
  else sub = `${nim(w.staked)} NIM staked · earning about ${weekly(w.staked)} NIM a week`;

  const pills = w.staked > 0n && S.view === "home"
    ? `<div class="pills">
         <button class="pill" type="button" data-act="more" ${w.maxStake >= MINIMUM ? "" : "disabled"}>Stake more ${ic("plus")}</button>
         ${w.leaving ? "" : `<button class="pill" type="button" data-act="unstake">Unstake ${ic("minus")}</button>`}
       </div>` : "";

  return `<section class="card">
    <div class="total"><div class="label">${label}</div>${big(w.isStaking ? w.total : w.spendable)}<div class="sub">${sub}</div></div>
    <div class="split" aria-label="Where your NIM is">${seg("Available", w.spendable, "var(--gold)")}${seg("Staked", w.staked, "var(--green)")}${seg("Unstaking", w.out, "var(--blue)")}</div>
    ${pills}
  </section>`;
}

const PAYOUT = { restake: "rewards added to your stake", direct: "rewards paid to your wallet" };
function validatorCard(w) {
  const v = w.isStaking ? S.data.current : S.data.suggested;
  if (!v) return "";
  const pct = v.fee != null ? `${+(v.fee * 100).toFixed(2)}% fee` : null;
  const facts = [pct, PAYOUT[v.payoutType] ?? null, v.stakers != null ? `${v.stakers} stakers` : null].filter(Boolean).join(" · ");
  const why = w.isStaking ? "Your validator"
    : v.vetted ? "Picked for you from Nimiq's validator list: it pays its stakers, has a good trust score and isn't too big."
    : "Picked for you: the busiest healthy validator right now.";
  const warn = w.isStaking && v.payoutType === "none"
    ? `<p class="hint" style="color:var(--red-text)">This validator doesn't pay rewards to its stakers.</p>` : "";
  // The pool's own colour, with a navy or white icon, whichever reads on it.
  let dot = "background:var(--green-soft)";
  if (/^#[0-9a-f]{6}$/i.test(v.color ?? "")) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(v.color.slice(i, i + 2), 16));
    dot = `background:${v.color};color:${0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1F2348" : "#fff"}`;
  }
  return `<div class="val"><div class="row">
      <div class="dot" style="${dot}">${ic("shield")}</div>
      <div class="t"><b>${v.name ? esc(v.name) : `<span class="mono">${esc(shortAddr(v.address))}</span>`}</b><span>${esc(facts || shortAddr(v.address))}</span></div>
    </div>
    <p class="hint" style="margin-top:10px">${why}</p>${warn}</div>`;
}

function form(w) {
  const first = !w.isStaking;
  if (w.maxStake < MINIMUM) {
    return `<div class="sec"><div class="msg" style="margin:0">The minimum stake is 100 NIM. That's set by the network, not by us.
      ${w.spendable > 0n ? `You have ${nim(w.spendable)} NIM available, and NimJar keeps 5 NIM aside so you can always afford to unstake.` : ""}</div></div>`;
  }
  return `<div class="sec">
    <h2>${first ? "How much do you want to stake?" : "How much more do you want to stake?"}</h2>
    <label class="field" id="field"><input id="amt" inputmode="decimal" autocomplete="off" value="${esc(S.amount)}" aria-label="Amount to stake, in NIM"><span>NIM</span></label>
    <div class="chips">
      ${[["100", "100"], ["half", "Half"], ["most", "Most of it"]].map(([k, t]) =>
        `<button class="chip" type="button" data-act="preset" data-set="${k}" aria-pressed="${S.preset === k}">${t}</button>`).join("")}
    </div>
    <p class="hint" id="left"></p>
    <div class="earn" id="earn">${ic("in")}<span></span></div>
    ${first ? "" : `<button class="link" type="button" data-act="cancel">Cancel</button>`}
  </div>
  ${first ? `<div class="sec"><h2>Validator</h2>${validatorCard(w)}
    <p class="hint">Your NIM stays yours. Staking lends it to help run the Nimiq network, and the network pays you rewards for it.</p></div>` : ""}`;
}

function track(w) {
  const at = w.leaving === "waiting" ? 1 : w.leaving === "releasable" ? 2 : 3;
  const steps = [
    ["Unstake requested", "Done"],
    ["Unlocking", at === 1 ? countdown(S.data.secondsLeft) : "Done"],
    [`Confirm withdrawal<em class="tag">Permanent</em>`, at === 2 ? "Waiting for you" : at > 2 ? "Done" : "Can't be undone"],
    ["Withdraw", at === 3 ? "Ready. Back to your wallet" : "Back to your wallet"],
  ];
  const again = at < 3
    ? `<button class="cta quiet" type="button" data-act="restake">Changed your mind? Stake ${nim(w.inactive)} NIM again</button>`
    : `<p class="hint">Confirmed withdrawals can't go back to staking. Once it's in your wallet you can stake it again.</p>`;
  return `<div class="sec"><h2>Getting your NIM back</h2><ol class="track">${steps.map(([b, s], i) =>
    `<li class="${i < at ? "done" : i === at ? "now" : "later"}"><div class="n">${i < at ? ic("check") : i + 1}</div><div><b>${b}</b><span>${s}</span></div></li>`).join("")}</ol>${again}</div>`;
}

const ACTION = {
  "create-staker": ["Staked", "--green-soft", "in", "Stake"],
  "add-stake": ["Added stake", "--green-soft", "in", "Add stake"],
  "set-active-stake": ["Stake changed", "--blue-soft", "clock", "Change stake"],
  "retire-stake": ["Withdrawal confirmed", "--red-soft", "check", "Confirm withdrawal"],
  "remove-stake": ["Withdrawn", "--gold-soft", "out", "Withdraw"],
  "update-staker": ["Validator changed", "--blue-soft", "swap", "Change validator"],
};
function activity() {
  if (!S.history.length) return `<div id="activity"></div>`;
  return `<div class="sec" id="activity"><h2>Activity</h2>${S.history.map((h) => {
    let [label, dot, icon, attempt] = ACTION[h.type] || [h.type, "--blue-soft", "clock", h.type];
    // Setting the active stake to zero is a full unstake. Any other number is a
    // partial unstake or a restake, and one transaction alone can't say which.
    if (h.type === "set-active-stake") label = h.newActiveBalance != null && BigInt(h.newActiveBalance) > 0n ? "Stake changed" : "Unstake requested";
    const amount = h.type === "retire-stake" ? h.retireStake : h.type === "set-active-stake" ? null : h.value;
    let shown = amount != null && BigInt(amount) > 0n ? nim(amount) + " NIM" : "";
    // On chain but changed nothing. Shown as what it was, never as done.
    if (h.ok === false) { label = `${attempt}: didn't go through`; dot = "--red-soft"; icon = "x"; shown = ""; }
    return `<a class="row" href="${EXPLORER}${esc(h.hash)}" target="_blank" rel="noopener">
      <div class="dot" style="background:var(${dot})">${ic(icon)}</div>
      <div class="t"><b>${esc(label)}</b><span>${when(h.timestamp)}</span></div>
      <div class="amt">${shown}<span>Proof ↗</span></div></a>`;
  }).join("")}</div>`;
}

function qa(w) {
  const example = w.staked > 0n ? w.staked : 600n * LUNA;
  return [
    ["Is my NIM safe?", "It stays yours. Staked NIM sits in Nimiq's staking contract under your own address, and only your wallet can take it out. NimJar can't move it: every step needs your OK in Nimiq Pay."],
    ["How much will I earn?", `About 15% a year from the network, minus the pool's fee. ${nim(example)} NIM earns about ${weekly(example)} NIM a week. The rate moves a little as more people stake.`],
    ["Why do I have to wait?", "For safety, the network holds unstaked NIM for a while: until its next 12-hour checkpoint, then one more 12 hours. So up to about a day. It stops earning while it waits, then it's ready to withdraw."],
    ["What's a validator?", "A computer that helps run the Nimiq network, usually run by a staking pool. Your stake backs one, and it passes the rewards on to you, minus a small fee. NimJar picks one for you from Nimiq's official validator list: it has to pay its stakers and have a good trust score, and different people get different pools so no single one gets too big."],
    ["Why confirm before withdrawing?", "Confirming is the one step you can't undo: after it, those NIM can't go back to staking. So it gets its own tap. Then Withdraw sends them to your wallet."],
  ];
}
function ask(w) {
  const list = qa(w);
  const i = Math.min(S.qa, list.length - 1);
  return `<div class="sec">
    <div class="ask">${mascot(54, "idle")}<h2>Got a question?</h2></div>
    <div class="qs">${list.map(([q], k) => `<button class="q" type="button" data-act="qa" data-i="${k}" aria-pressed="${k === i}">${q}</button>`).join("")}</div>
    <div class="bubble" aria-live="polite"><b>${list[i][0]}</b>${list[i][1]}</div>
  </div>`;
}

function message() {
  if (!S.msg) return "";
  return `<div class="msg ${S.msg.kind}" role="status">${esc(S.msg.text)}</div>`;
}

function render() {
  if (!S.data) {
    app.innerHTML = header() + (S.error
      ? `<div class="msg bad" role="alert">Couldn't read the Nimiq network: ${esc(S.error)}</div>
         <div class="sec"><button class="cta quiet" type="button" data-act="retry">Try again</button></div>`
      : `<div class="loading">${mascot(96, "loading")}Reading the Nimiq network…</div>`);
    dock.innerHTML = "";
    return;
  }

  const w = wallet();
  if (S.view === "form" && w.maxStake < MINIMUM) S.view = "home";
  const showForm = !w.isStaking || S.view === "form";
  const preview = S.provider ? "" :
    `<div class="msg">Preview: this is a real staked wallet on Nimiq ${NETWORK_ID === 24 ? "mainnet" : "testnet"}. Open NimJar inside Nimiq Pay to stake your own NIM.</div>`;

  let body = "";
  if (showForm) {
    body = form(w) + (w.isStaking ? "" : ask(w));
  } else if (w.leaving) {
    body = track(w);
    if (w.leaving === "releasable") {
      body += `<div class="sec"><div class="warn"><b>This can't be undone.</b><p>After you confirm, these ${nim(w.inactive)} NIM can only be withdrawn. You can't change your mind and keep them staked.</p></div>
        <label class="agree"><input type="checkbox" id="agree" ${S.agree ? "checked" : ""}> I understand these ${nim(w.inactive)} NIM will stop earning for good.</label></div>`;
    }
    body += activity() + ask(w);
  } else {
    body = `<div class="sec"><div class="facts">
        <div class="fact"><span class="k">Staked</span><span class="v">${nim(w.staked)} NIM</span></div>
        <div class="fact"><span class="k">Yearly rewards</span><span class="v">≈ ${Math.floor(perWeek(w.staked) * 52).toLocaleString("en-GB")} NIM</span></div>
      </div>${validatorCard(w)}</div>` + activity() + ask(w);
  }

  app.innerHTML = header() + preview + message() + card(w) + body;
  dock.innerHTML = dockFor(w, showForm);
  if (showForm) updateForm();
}

function dockFor(w, showForm) {
  const hint = `<div class="small">${S.provider ? "Nimiq Pay will ask you to confirm" : "Preview only: open in Nimiq Pay to stake"}</div>`;
  const wrap = (x) => `<div>${x}</div>`;
  if (S.busy) return wrap(`<button class="cta" type="button" disabled>Waiting for Nimiq Pay…</button>`);
  if (showForm) return w.maxStake >= MINIMUM ? wrap(`<button class="cta" type="button" id="go" data-act="stake">Stake</button>` + hint) : "";
  if (w.leaving === "waiting") return wrap(`<div class="calm">Unlocking · ${countdown(S.data.secondsLeft)}</div><div class="small">You can close the app. It keeps going.</div>`);
  if (w.leaving === "releasable") return wrap(`<button class="cta red" type="button" id="retire" data-act="retire" ${S.agree ? "" : "disabled"}>Confirm withdrawal of ${nim(w.inactive)} NIM</button>` + hint);
  if (w.leaving === "ready") {
    return wrap(`<button class="cta" type="button" data-act="withdraw">Withdraw ${nim(w.retired)} NIM to your wallet</button>` + hint);
  }
  return "";
}

/** Keeps the form honest as someone types, without redrawing (and losing focus). */
function updateForm() {
  const input = $("amt");
  if (!input) return;
  const w = wallet();
  const want = parseNim(input.value);
  const go = $("go");
  let problem = "";
  if (input.value.trim() === "") problem = "Type an amount, or pick one below.";
  else if (want === null) problem = "Use numbers only, with up to 5 decimal places.";
  else if (want < MINIMUM) problem = "The minimum stake is 100 NIM. That's set by the network, not by us.";
  else if (want > w.maxStake) problem = `You can stake up to ${nim(w.maxStake)} NIM. NimJar keeps 5 NIM aside so you can always afford to unstake.`;

  $("field").classList.toggle("bad", !!problem && input.value.trim() !== "");
  $("left").textContent = problem || `Leaves ${nim(w.spendable - want)} NIM available to spend.`;
  $("earn").hidden = !!problem;
  if (!problem) $("earn").querySelector("span").innerHTML = `Earn about <b>${weekly(want)} NIM a week</b>`;
  if (go) { go.disabled = !!problem; go.textContent = problem ? "Stake" : `Stake ${nim(want)} NIM`; }
}

function setPreset(kind) {
  const w = wallet();
  const pick = kind === "100" ? MINIMUM : kind === "half" ? (w.maxStake / 2n / LUNA) * LUNA : (w.maxStake / LUNA) * LUNA;
  S.preset = kind;
  S.amount = wholeNim(pick < MINIMUM ? MINIMUM : pick).replace(/,/g, "");
  const input = $("amt");
  if (input) input.value = S.amount;
  document.querySelectorAll("[data-act=preset]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.set === kind));
  updateForm();
}

function openSheet(w) {
  const wrap = document.createElement("div");
  wrap.className = "sheetwrap";
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="grab"></div>
    <div class="ask">${mascot(64, "idle")}<h2 id="sheet-title">Unstake all ${nim(w.staked)} NIM?</h2></div>
    <p class="hint" style="color:var(--text)">It stops earning now. The network releases it within about a day. Then two more taps bring it back to your wallet.</p>
    <p class="hint">Changed your mind before then? You can stake it again.</p>
    <button class="cta" type="button" data-act="unstake-yes">Unstake ${nim(w.staked)} NIM</button>
    <button class="cta quiet" type="button" data-act="sheet-close">Keep staking</button>
  </div>`;
  if (framed()) {
    // Inside the drawn phone: cover what's on screen now, and hold the scroll.
    wrap.style.top = device.scrollTop + "px";
    wrap.style.height = device.clientHeight + "px";
    device.style.overflowY = "hidden";
    device.appendChild(wrap);
  } else {
    document.body.appendChild(wrap);
  }
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeSheet(); });
  wrap.querySelector("[data-act=unstake-yes]").focus();
}
function closeSheet() {
  document.querySelector(".sheetwrap")?.remove();
  if (device) device.style.overflowY = "";
}

/* ---- actions ------------------------------------------------------------- */
function previewOnly() {
  S.msg = { kind: "info", text: "This is a preview of a real wallet. Open NimJar inside Nimiq Pay to move your own NIM." };
  render();
  toTop();
}

/** What Nimiq Pay said, in words a person would use. */
function friendly(e) {
  const m = String(e?.message || e || "");
  if (/reject|cancel|denied|abort|closed|dismiss/i.test(m)) return "You cancelled in Nimiq Pay. Nothing was sent.";
  // Nimiq Pay handles one transaction at a time and keeps an unconfirmed one
  // "in progress" until it lands or expires (the network's validity window is
  // 7,200 blocks, about two hours).
  if (/in progress|pending/i.test(m)) return "Nimiq Pay is still busy with an earlier transaction. Close and reopen Nimiq Pay, or wait for it to finish, then try again.";
  if (/timeout|timed out/i.test(m)) return "Nimiq Pay didn't answer in time. Nothing is lost: check Nimiq Pay's activity, then refresh this page before trying again.";
  return "Nimiq Pay couldn't send it: " + m;
}

/** One shape for every wallet action: ask, then wait for the chain. Never assume. */
async function run(send, sentText, doneText) {
  if (S.busy) return;
  if (!S.provider) return previewOnly();
  S.busy = true; S.msg = null; render();
  try {
    const result = await send();
    if (result && result.error) throw new Error(result.error.message || "the wallet refused");
    const hash = typeof result === "string" ? result : result?.hash ?? String(result);
    S.msg = { kind: "info", text: sentText + " Waiting for the network to confirm it…" };
    S.busy = false; render();
    const landed = await settle(hash);
    if (landed && !landed.ok) {
      S.msg = { kind: "bad", text: `It reached the network in block ${landed.block.toLocaleString("en-GB")} but didn't go through, so nothing moved. Your NIM is where it was.` };
    } else if (landed) {
      S.msg = { kind: "good", text: `${doneText} Confirmed in block ${landed.block.toLocaleString("en-GB")}.` };
      S.happyUntil = Date.now() + 4000;
      S.view = "home"; S.agree = false;
    } else {
      S.msg = { kind: "bad", text: "The network accepted it but it hasn't appeared yet. Nothing is lost. Check again in a minute." };
    }
  } catch (e) {
    S.msg = { kind: "bad", text: friendly(e) };
  } finally {
    S.busy = false;
    await refresh();
    toTop();
  }
}

/** Broadcast is not settlement: ask the chain whether the hash really landed. */
async function settle(hash) {
  for (let i = 0; i < 45; i++) {
    const r = await fetch("/api/tx/" + encodeURIComponent(hash)).then((x) => x.json()).catch(() => null);
    if (r?.settled) return { block: r.blockNumber, ok: r.ok !== false };
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  return null;
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  const w = S.data ? wallet() : null;

  if (act === "retry") { S.error = null; render(); refresh(); }
  if (act === "qa") {
    S.qa = Number(el.dataset.i);
    const sec = el.closest(".sec");
    const [q, a] = qa(w)[S.qa];
    sec.querySelectorAll("[data-act=qa]").forEach((b) => b.setAttribute("aria-pressed", b === el));
    sec.querySelector(".bubble").innerHTML = `<b>${q}</b>${a}`;
  }
  if (act === "preset") setPreset(el.dataset.set);
  if (act === "more") { S.view = "form"; S.msg = null; render(); setPreset("half"); toTop(false); }
  if (act === "cancel") { S.view = "home"; render(); }
  if (act === "unstake") { if (!S.provider) return previewOnly(); openSheet(w); }
  if (act === "sheet-close") closeSheet();

  if (act === "stake") {
    const want = parseNim($("amt")?.value ?? "");
    if (want === null || want < MINIMUM || want > w.maxStake) return updateForm();
    const first = !w.isStaking;
    run(() => first
        ? S.provider.sendNewStakerTransaction({ delegation: S.data.suggested.address, value: Number(want), fee: FEE.create })
        : S.provider.sendStakeTransaction({ value: Number(want), fee: FEE.add }),
      "Sent.", `Done. ${nim(want)} NIM is now earning.`);
  }

  // Getting out, step one. The wallet call takes what should stay staked, not
  // what should leave: 0 means all of it.
  if (act === "unstake-yes") {
    closeSheet();
    run(() => S.provider.sendSetActiveStakeTransaction({ newActiveBalance: 0, fee: FEE.unstake }),
      "Sent.", "Unstaking. The network releases it within about a day.");
  }

  // Step two. Permanent. Only reachable after ticking the box on this screen.
  if (act === "retire") {
    if (!S.agree) return;
    run(() => S.provider.sendRetireStakeTransaction({ retireStake: Number(w.inactive), fee: FEE.retire }),
      "Sent.", "Withdrawal confirmed. One tap left: withdraw it to your wallet.");
  }

  // Step three: everything retired, in one go, at zero fee.
  //
  // Two network rules meet here. The staking contract is the sender, so value
  // and fee both come out of the retired balance, and asking for more than it
  // holds is accepted by the node and never lands (mainnet, 10 Sep). And no
  // withdrawal may leave between 0 and 100 NIM behind (staker.rs, invariant 2).
  // Nimiq Pay pays zero fees whatever we suggest, so "retired minus a fee"
  // left 0.002 NIM behind and vanished (testnet, 14 Sep). value + fee must be
  // exactly the retired balance, so: all of it, fee 0.
  if (act === "withdraw") {
    run(() => S.provider.sendRemoveStakeTransaction({ value: Number(w.retired), fee: 0 }),
      "Sent.", `Done. ${nim(w.retired)} NIM is back in your wallet.`);
  }

  // Changed your mind while it unlocks: put the unstaking NIM back to work.
  // Possible right up until the permanent step, never after.
  if (act === "restake") {
    run(() => S.provider.sendSetActiveStakeTransaction({ newActiveBalance: Number(w.staked + w.inactive), fee: FEE.unstake }),
      "Sent.", `Done. ${nim(w.staked + w.inactive)} NIM is earning again.`);
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "amt") {
    S.amount = e.target.value; S.preset = null;
    document.querySelectorAll("[data-act=preset]").forEach((b) => b.setAttribute("aria-pressed", "false"));
    updateForm();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "agree") {
    S.agree = e.target.checked;
    const btn = $("retire");
    if (btn) btn.disabled = !S.agree;
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

function when(ts) {
  const mins = Math.max(0, Math.round((Date.now() - Number(ts)) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
  const h = Math.round(mins / 60);
  if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
  const d = Math.round(h / 24);
  return d + (d === 1 ? " day ago" : " days ago");
}

/** A wait in words people use, not a block number. */
function countdown(seconds) {
  if (seconds <= 0) return "almost done";
  if (seconds < 3600) return "about " + Math.max(1, Math.round(seconds / 60)) + " minutes left";
  return "about " + (seconds / 3600).toFixed(1) + " hours left";
}

/* The laptop panel's "Copy link": the way into Nimiq Pay is pasting this URL. */
$("copy")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  try { await navigator.clipboard.writeText(location.origin); btn.textContent = "Copied"; }
  catch { btn.textContent = location.host; }
  setTimeout(() => { btn.textContent = "Copy link"; }, 2500);
});

/* ---- boot ---------------------------------------------------------------- */
async function boot() {
  render();
  try {
    S.provider = await init({ timeout: 2500 });
    const accounts = await S.provider.listAccounts();
    if (Array.isArray(accounts) && accounts.length) S.address = accounts[0];
  } catch {
    S.provider = null;   // not inside Nimiq Pay: show the real staked wallet instead
  }
  await refresh();
  if (S.data && !wallet().isStaking) setPreset("half");
}

boot();
