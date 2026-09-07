/**
 * The app, as one string.
 *
 * No build step, no framework, no external assets beyond one font. It is a
 * phone screen inside Nimiq Pay, and it has one job: turn "I am holding NIM
 * doing nothing" into "my NIM is working" in a single tap.
 *
 * Words on screen are the ones a person uses, never the ones the protocol uses.
 * Nobody outside this ecosystem knows what delegating to a validator means, and
 * nobody should have to.
 */

const PALETTE = `
 :root{
   --paper:#EDEFEA; --surface:#FFFFFF; --panel:#E3E7DF; --rule:#D5DAD0;
   --ink:#1A1F1B; --dim:#5F6960; --faint:#8A9389;
   --accent:#A8741A; --accent-soft:#F0E3C8;
   --grow:#2F6B4F; --grow-soft:#DCEADF;
   --bad:#9A3B24;
   --display:"Fraunces",Georgia,serif;
   --body:"Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
   --mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
 }
 @media (prefers-color-scheme:dark){
   :root:not([data-theme="light"]){
     --paper:#12150F; --surface:#1B1F19; --panel:#232821; --rule:#2E342B;
     --ink:#E8EBE2; --dim:#9BA396; --faint:#6E7669;
     --accent:#E0A93F; --accent-soft:#3A2F16;
     --grow:#5FC38E; --grow-soft:#1D3327;
     --bad:#E08163;
   }
 }
 :root[data-theme="dark"]{
   --paper:#12150F; --surface:#1B1F19; --panel:#232821; --rule:#2E342B;
   --ink:#E8EBE2; --dim:#9BA396; --faint:#6E7669;
   --accent:#E0A93F; --accent-soft:#3A2F16;
   --grow:#5FC38E; --grow-soft:#1D3327;
   --bad:#E08163;
 }`;

export function renderApp({ demoAddress, networkId }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Put your NIM to work</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
${PALETTE}
 *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
 body{margin:0;background:var(--paper);color:var(--ink);
   font:16px/1.55 var(--body);overscroll-behavior:none;-webkit-font-smoothing:antialiased}
 .wrap{max-width:460px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;
   padding:18px 20px calc(24px + env(safe-area-inset-bottom))}

 header{display:flex;align-items:center;gap:9px;margin-bottom:22px}
 .mark{width:16px;height:16px;border-radius:5px;background:var(--grow);flex:none}
 .appname{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
 .mode{margin-left:auto;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;
   text-transform:uppercase;padding:3px 9px;border-radius:99px;border:1px solid currentColor;color:var(--faint)}
 .mode.live{color:var(--grow)}

 main{flex:1;display:flex;flex-direction:column;gap:16px}
 .kicker{font-size:13.5px;color:var(--dim);margin:0}
 .hero{font-family:var(--display);font-optical-sizing:auto;font-weight:400;
   font-size:46px;line-height:1;letter-spacing:-.025em;font-variant-numeric:tabular-nums;
   margin:0;display:flex;align-items:baseline;gap:6px;overflow-wrap:anywhere}
 .hero .unit{font-family:var(--body);font-size:15px;font-weight:600;color:var(--dim);letter-spacing:0}
 .hero.grow{color:var(--grow)}
 .sub{font-family:var(--mono);font-size:11.5px;color:var(--faint);margin:0}

 .earn{background:var(--grow-soft);border-radius:12px;padding:12px 14px;
   display:flex;align-items:center;justify-content:space-between;gap:10px}
 .earn .lbl{font-size:12.5px;color:var(--dim);line-height:1.35}
 .earn .amt{font-family:var(--mono);font-size:15px;font-weight:500;color:var(--grow);white-space:nowrap}

 .tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
 .tile{background:var(--panel);border-radius:12px;padding:12px 13px;display:flex;flex-direction:column;gap:3px}
 .tile .k{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
 .tile .v{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}
 .tile .v .m{font-family:var(--mono);font-size:13px;font-weight:400;color:var(--dim)}

 .amount{border:1.5px solid var(--ink);border-radius:12px;padding:12px 14px;
   display:flex;align-items:baseline;justify-content:space-between;gap:10px}
 .amount input{border:0;background:transparent;color:var(--ink);width:100%;
   font:400 30px/1 var(--display);font-variant-numeric:tabular-nums;letter-spacing:-.02em;
   padding:0;outline:none;-moz-appearance:textfield}
 .amount input::-webkit-outer-spin-button,.amount input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
 .amount .cur{font-size:12.5px;font-weight:600;color:var(--dim);flex:none}
 .presets{display:flex;gap:8px}
 .presets button{flex:1;font:500 12.5px var(--body);padding:8px 4px;border-radius:9px;
   border:1px solid var(--rule);background:transparent;color:var(--dim);cursor:pointer}
 .presets button:hover{border-color:var(--ink);color:var(--ink)}

 .keeper{border:1px solid var(--rule);border-radius:12px;padding:11px 13px;display:flex;align-items:center;gap:11px}
 .keeper .badge{width:30px;height:30px;border-radius:9px;background:var(--accent-soft);color:var(--accent);
   display:grid;place-items:center;font:500 11px var(--mono);flex:none}
 .keeper .who{display:block;font-size:13px;font-weight:600;line-height:1.3}
 .keeper .why{display:block;font-size:11px;color:var(--faint);line-height:1.35;margin-top:2px;font-family:var(--mono)}

 .note{font-size:12.5px;color:var(--dim);line-height:1.5;margin:0}
 .note code{font-family:var(--mono);font-size:11.5px}
 a{color:var(--accent)}

 .leaving{border:1px solid var(--rule);border-radius:14px;padding:14px 15px 6px;
   display:flex;flex-direction:column;gap:6px}
 .leaving .kicker{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;
   text-transform:uppercase;color:var(--faint)}
 /* Deliberately smaller than the hero. Money coming back is a secondary state;
    what is still working is the number people opened the app for. */
 .leaving-amt{font-size:19px;font-weight:600;font-variant-numeric:tabular-nums;
   margin:0;display:flex;align-items:baseline;gap:5px}
 .leaving-amt .unit{font-size:12px;font-weight:600;color:var(--dim)}
 .track{display:flex;flex-direction:column;margin-top:6px}
 .track-step{display:flex;gap:11px;align-items:flex-start;padding:7px 0}
 .track-step .pip{width:11px;height:11px;border-radius:50%;flex:none;margin-top:4px;
   background:var(--rule);box-shadow:0 0 0 1.5px var(--rule)}
 .track-step.done .pip{background:var(--grow);box-shadow:0 0 0 1.5px var(--grow)}
 .track-step.now .pip{background:var(--accent);box-shadow:0 0 0 1.5px var(--accent)}
 .track-step .t{display:block;font-size:13px;font-weight:600;line-height:1.3}
 .track-step .d{display:block;font-family:var(--mono);font-size:10.5px;color:var(--faint);
   line-height:1.35;margin-top:2px}
 .track-step.pending .t{color:var(--faint);font-weight:500}
 .track-rail{width:1.5px;background:var(--rule);margin-left:4.75px;height:8px}

 .history{display:flex;flex-direction:column;gap:0;margin-top:2px}
 .history .kicker{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;
   text-transform:uppercase;color:var(--faint);margin:0 0 4px}
 .hrow{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:baseline;
   padding:9px 2px;border-bottom:1px solid var(--rule);text-decoration:none;color:inherit}
 .hrow:last-child{border-bottom:0}
 .hrow:hover .hwhat{text-decoration:underline;text-decoration-color:var(--faint)}
 .hwhat{font-size:13px;font-weight:500}
 .hamt{font-family:var(--mono);font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}
 .hwhen{font-family:var(--mono);font-size:10.5px;color:var(--faint);white-space:nowrap}

 .msg{border-radius:11px;padding:11px 13px;font-size:13px;line-height:1.45}
 .msg.bad{background:color-mix(in srgb,var(--bad) 12%,transparent);color:var(--bad);border:1px solid var(--bad)}
 .msg.wait{background:var(--accent-soft);color:var(--accent)}

 .foot{margin-top:auto;padding-top:16px;display:flex;flex-direction:column;gap:9px}
 button.act{border:0;border-radius:12px;padding:15px;width:100%;
   font:600 15px var(--body);cursor:pointer;background:var(--ink);color:var(--paper)}
 button.act:disabled{opacity:.4;cursor:default}
 button.act.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--rule)}
 button.act.quiet{background:transparent;color:var(--dim);border:0;font-weight:500;font-size:13.5px;padding:9px}
 button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
 .hint{font-family:var(--mono);font-size:9.5px;color:var(--faint);text-align:center;line-height:1.45;margin:0}
 .hidden{display:none !important}
 .skeleton{color:var(--faint)}
 @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style></head><body><div class="wrap">

<header>
  <span class="mark"></span>
  <span class="appname">Put to work</span>
  <span class="mode" id="mode">connecting</span>
</header>

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

const $ = (id) => document.getElementById(id);
const main = $("main");

let provider = null;      // null outside Nimiq Pay — the app is then read-only
let address = DEMO_ADDRESS;
let data = null;
let busy = false;

/* ---- money ----------------------------------------------------------------
   NIM has five decimal places and amounts are integers of luna throughout.
   Nothing is ever parsed into a float, and nothing is ever rounded up: money
   that rounds itself looks like money that might go missing. */
function nim(luna, places = 2) {
  const n = BigInt(luna);
  const whole = n / LUNA;
  const frac = (n % LUNA).toString().padStart(5, "0").slice(0, places).replace(/0+$/, "");
  return whole.toLocaleString("en-GB") + (frac ? "." + frac : "");
}
const perWeek = (luna) => (Number(BigInt(luna)) / 1e5) * YEARLY / 52;
const fmtWeek = (luna) => perWeek(luna).toFixed(2);
const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
const short = (a) => { const c = String(a).replace(/\\s+/g, ""); return c.slice(0, 6) + "…" + c.slice(-4); };

/* ---- boot ---------------------------------------------------------------- */
async function boot() {
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
  main.innerHTML = data.isStaking ? screenWorking() : screenStart();
  wire();
  loadHistory();
}

function screenStart() {
  const spendable = BigInt(data.spendable);
  const enough = spendable > MINIMUM;
  const v = data.suggested;

  return \`
    <p class="kicker">You are holding</p>
    <p class="hero">\${nim(spendable)}<span class="unit">NIM</span></p>
    <p class="sub">earning nothing</p>

    \${enough ? \`
      <div class="earn">
        <span class="lbl">Put it all to work and it earns about</span>
        <span class="amt">\${fmtWeek(spendable)} / week</span>
      </div>

      <div class="amount">
        <input id="amt" type="number" inputmode="decimal" value="\${Math.floor(Number(spendable) / 1e5 * 0.5)}" min="100" step="1" aria-label="Amount in NIM">
        <span class="cur">NIM</span>
      </div>
      <div class="presets">
        <button data-set="100">100</button>
        <button data-set="half">Half</button>
        <button data-set="max">Most of it</button>
      </div>
      <p class="note" id="leftover"></p>

      \${v ? \`<div class="keeper">
        <span class="badge">\${esc(short(v.address).slice(2, 4).toUpperCase())}</span>
        <span>
          <span class="who">Looked after by \${esc(short(v.address))}</span>
          <span class="why">\${v.stakers} people already use it · picked for you</span>
        </span>
      </div>\` : ""}

      <p class="note">Your NIM stays yours, in your own wallet. You are lending it
      to the network to help keep it running, and being paid for it.</p>
    \` : \`
      <div class="msg wait">You need at least 100 NIM to start. That is the
      network's own minimum, not ours.</div>
    \`}

    <div class="foot">
      <button class="act" id="go" \${enough ? "" : "disabled"}>Put my NIM to work</button>
      <p class="hint">\${provider ? "Nimiq Pay will ask you to confirm" : "Open inside Nimiq Pay to stake — this is a live preview of a real wallet"}</p>
    </div>\`;
}

function screenWorking() {
  const staked = BigInt(data.staked);
  const spendable = BigInt(data.spendable);
  return \`
    <p class="kicker">Working for you</p>
    <p class="hero grow">\${nim(staked)}<span class="unit">NIM</span></p>
    <p class="sub">earning about \${fmtWeek(staked)} NIM a week</p>

    <div class="tiles">
      <div class="tile"><span class="k">Free to spend</span><span class="v">\${nim(spendable)}<span class="m"> NIM</span></span></div>
      <div class="tile"><span class="k">A year at this rate</span><span class="v">\${(perWeek(staked) * 52).toFixed(0)}<span class="m"> NIM</span></span></div>
    </div>

    \${data.delegation ? \`<div class="keeper">
      <span class="badge">✓</span>
      <span>
        <span class="who">Looked after by \${esc(short(data.delegation))}</span>
        <span class="why">delegated · block \${data.height.toLocaleString("en-GB")}</span>
      </span>
    </div>\` : ""}

    \${data.leaving ? leavingPanel() : ""}

    <div id="history"></div>

    <div class="foot">
      \${staked > 0n ? \`<button class="act" id="more" \${spendable > MINIMUM ? "" : "disabled"}>Put more to work</button>\` : ""}
      \${staked > 0n && !data.leaving ? \`<button class="act quiet" id="out">Take it back</button>\` : ""}
      <p class="hint">\${provider ? "Nimiq Pay will ask you to confirm" : "Live preview of a real staked wallet — every figure is on chain"}</p>
    </div>\`;
}

/**
 * The way out.
 *
 * Three transactions with a wait in the middle, and the middle one cannot be
 * undone. Nimiq's own FAQ says it is two steps; it is three. Nobody else in the
 * ecosystem has built this, which is exactly why it is worth building properly.
 *
 * The rule for this panel: never let anyone reach the irreversible step without
 * having read the word irreversible.
 */
function leavingPanel() {
  const inactive = BigInt(data.inactive);
  const retired = BigInt(data.retired);
  const stage = data.leaving;

  const step = (n, state, title, detail) => \`
    <div class="track-step \${state}">
      <span class="pip"></span>
      <span><span class="t">\${title}</span><span class="d">\${detail}</span></span>
    </div>\${n < 3 ? '<div class="track-rail"></div>' : ""}\`;

  return \`
    <div class="leaving">
      <p class="kicker">Coming back to you</p>
      <p class="leaving-amt">\${nim(inactive + retired)}<span class="unit">NIM</span></p>
      <div class="track">
        \${step(1, "done", "You asked for it back", "confirmed")}
        \${step(2, stage === "waiting" ? "now" : "done",
          stage === "waiting" ? "The network is releasing it" : "Released by the network",
          stage === "waiting" ? countdown(data.secondsLeft) : "ready")}
        \${step(3, stage === "ready" ? "now" : "pending",
          stage === "ready" ? "Move it back to your wallet" : "Back in your wallet",
          stage === "ready" ? "one tap, nothing to wait for" : "one more tap, when ready")}
      </div>
    </div>
    \${stage === "releasable" ? \`
      <div class="msg bad">Next step cannot be undone. Once retired, this NIM can
      only be withdrawn — it can never go back to work.</div>
      <button class="act" id="retire">Retire \${nim(inactive)} NIM — permanent</button>\` : ""}
    \${stage === "ready" ? \`<button class="act" id="withdraw">Move \${nim(retired)} NIM back to my wallet</button>\` : ""}\`;
}

/**
 * What you have done, with a link to the chain for each.
 *
 * Loaded after the screen so a slow node never delays the numbers people came
 * for. This is the trust layer: an app that moves your money and shows you
 * nothing you can check independently is asking to be taken on faith.
 */
const ACTION_NAMES = {
  "create-staker": "Started earning",
  "add-stake": "Put more to work",
  "set-active-stake": "Asked for it back",
  "retire-stake": "Retired — permanent",
  "remove-stake": "Moved back to wallet",
  "update-staker": "Changed who looks after it",
};

async function loadHistory() {
  const box = $("history");
  if (!box) return;
  try {
    const { history } = await fetch("/api/history?address=" + encodeURIComponent(address)).then((r) => r.json());
    if (!history?.length) return;
    box.innerHTML = \`
      <div class="history">
        <p class="kicker">What you've done</p>
        \${history.slice(0, 5).map((h) => \`
          <a class="hrow" href="https://nimiq.watch/#\${esc(h.hash)}" target="_blank" rel="noopener">
            <span class="hwhat">\${ACTION_NAMES[h.type] || h.type}</span>
            <span class="hamt">\${BigInt(h.value) > 0n ? nim(h.value) + " NIM" : ""}</span>
            <span class="hwhen">\${when(h.timestamp)}</span>
          </a>\`).join("")}
      </div>\`;
  } catch { /* history is a nicety; never let it break the screen */ }
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
  if (seconds <= 0) return "ready";
  const h = seconds / 3600;
  if (h < 1) return \`about \${Math.max(1, Math.round(seconds / 60))} minutes left\`;
  return \`about \${h.toFixed(1)} hours left\`;
}

/* ---- actions ------------------------------------------------------------- */
function wire() {
  const amt = $("amt");
  const spendable = BigInt(data.spendable);

  const showLeftover = () => {
    if (!amt || !$("leftover")) return;
    const want = BigInt(Math.max(0, Math.floor(Number(amt.value || 0) * 1e5)));
    const left = spendable > want ? spendable - want : 0n;
    $("leftover").textContent = "Leaves " + nim(left) + " NIM free to spend.";
    const go = $("go");
    if (go) go.disabled = want < MINIMUM || want > spendable;
  };
  amt?.addEventListener("input", showLeftover);
  showLeftover();

  for (const b of document.querySelectorAll("[data-set]")) {
    b.addEventListener("click", () => {
      const kind = b.dataset.set;
      const whole = Number(spendable / LUNA);
      amt.value = kind === "100" ? 100
        : kind === "half" ? Math.floor(whole / 2)
        // Never all of it: a wallet with nothing spendable cannot pay the fee
        // to get back out again.
        : Math.max(100, whole - 5);
      showLeftover();
    });
  }

  $("go")?.addEventListener("click", () => stake(BigInt(Math.floor(Number(amt.value) * 1e5)), true));
  $("more")?.addEventListener("click", () => {
    const whole = Number(spendable / LUNA);
    stake(BigInt(Math.max(100, Math.floor(whole / 2))) * LUNA, false);
  });
  // Getting out, step one: deactivate. The wallet call takes what should stay
  // working, not what should leave — passing 0 takes everything out.
  $("out")?.addEventListener("click", () => {
    if (!provider) return say("wait", "This is a preview. Open it inside Nimiq Pay to move your own NIM.");
    if (!confirm("Take it all back?\\n\\nIt stops earning now, and the network takes up to twelve hours to release it. You will need two more taps after that.")) return;
    run(() => provider.sendSetActiveStakeTransaction({ newActiveBalance: 0 }),
        "Asked for it back. The network is releasing it now.");
  });

  $("retire")?.addEventListener("click", () => {
    if (!provider) return say("wait", "This is a preview. Open it inside Nimiq Pay to move your own NIM.");
    if (!confirm("This cannot be undone.\\n\\nRetired NIM can only be withdrawn — it can never be put back to work. Continue?")) return;
    run(() => provider.sendRetireStakeTransaction({ retireStake: Number(data.inactive) }),
        "Retired. One tap left.");
  });

  $("withdraw")?.addEventListener("click", () => {
    if (!provider) return say("wait", "This is a preview. Open it inside Nimiq Pay to move your own NIM.");
    run(() => provider.sendRemoveStakeTransaction({ value: Number(data.retired) }),
        "Back in your wallet.");
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
    say("wait", "This is a preview. Open it inside Nimiq Pay to stake your own NIM.");
    return;
  }
  busy = true;
  const btn = $("go") || $("more");
  if (btn) { btn.disabled = true; btn.textContent = "Waiting for you to confirm…"; }

  try {
    // Sizes are in luna. The wallet signs; nothing here ever sees a key.
    const value = Number(valueLuna);
    const result = isFirst
      ? await provider.sendNewStakerTransaction({ delegation: data.suggested.address, value })
      : await provider.sendStakeTransaction({ value });

    if (result && result.error) throw new Error(result.error.message || "the wallet refused");

    // Broadcast is not settlement. Ask the chain, do not believe the reply.
    say("wait", "Sent. Waiting for the chain to show it…");
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
  say("bad", "The network accepted it but it has not appeared yet. Nothing is lost — check again in a minute.");
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
