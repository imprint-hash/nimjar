/**
 * The page shell. Styles and behaviour live in public/, served as files, so
 * nothing here needs escaping and the browser can cache them.
 *
 * The only thing the server fills in is which network it reads and which wallet
 * to show when the app is opened outside Nimiq Pay. It goes in as JSON data,
 * never as code.
 */

const escapeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

export function renderApp({ net, demo }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1F2348" media="(prefers-color-scheme: dark)">
<meta name="description" content="Stake your NIM in one tap inside Nimiq Pay, and get it all back out, step by step.">
<title>NimJar</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mulish:wght@500;600;700;800;900&family=Fira+Mono:wght@500&display=swap">
<link rel="stylesheet" href="/app.css">
<script type="application/json" id="cfg">${escapeJson({ net, demo })}</script>
<script type="module" src="/app.js"></script>
</head>
<body>
<div class="site">
  <nav class="nav" aria-label="NimJar">
    <a class="brand" href="#top"><img src="/icon.svg" width="44" height="44" alt=""><span>NimJar</span></a>
    <div class="links"><a href="#how">How it works</a><a href="#proof">Proof</a><a href="https://github.com/imprint-hash/nimjar" target="_blank" rel="noopener">GitHub</a></div>
    <button class="btn primary" type="button" data-act="demo">Try the demo</button>
  </nav>

  <section class="hero" id="top">
    <div class="hero-copy">
      <p class="eyebrow">Staking for Nimiq Pay</p>
      <h1>Let your NIM <span class="hl">work.</span></h1>
      <p class="lede">Stake in one tap, right inside Nimiq Pay: no website, no switching apps. And when you want it back, NimJar walks you all the way out.</p>
      <div class="ctas">
        <button class="btn primary" type="button" data-act="demo">Try it with a demo wallet</button>
        <button class="btn" type="button" id="copy">Copy link for Nimiq Pay</button>
      </div>
      <p class="how-open">In Nimiq Pay: <b>Mini Apps</b> → <b>Custom URL</b> → <span class="url">nimjar.vercel.app</span></p>
      <div class="stats">
        <div><b>1 tap</b><span>to stake</span></div>
        <div><b>3 taps</b><span>to get it all back</span></div>
        <div><b>0 keys</b><span>held by NimJar</span></div>
      </div>
    </div>
    <div class="hero-app">
      <button class="buddy" type="button" id="buddy" aria-label="Say hi to the NimJar mascot"><span class="bubble-s" id="buddySays">Hi! Tap me.</span><span id="buddyArt"></span></button>
      <div class="device" id="device">
        <main class="app" id="app"></main>
        <div class="dock" id="dock"></div>
      </div>
    </div>
  </section>

  <section class="band" id="how">
    <p class="eyebrow">Getting it back</p>
    <h2>Three taps out. One you can't undo.</h2>
    <div class="cards three">
      <article class="tile"><span class="num">1</span><h3>Unstake</h3><p>Your NIM stops earning. The network holds it for up to about a day. You can close the app.</p><span class="undo yes">You can still change your mind</span></article>
      <article class="tile red"><span class="num">2</span><h3>Confirm withdrawal</h3><p>You tick a box first, because this is the one step that's permanent.</p><span class="undo no">Can't be undone</span></article>
      <article class="tile gold"><span class="num">3</span><h3>Withdraw</h3><p>Every NIM lands back in your wallet, in about a second.</p><span class="undo yes">Done</span></article>
    </div>
  </section>

  <section class="band alt">
    <p class="eyebrow">What we learned the hard way</p>
    <h2>Four things the docs don't tell you.</h2>
    <div class="cards four">
      <article class="tile"><h3>Three steps, not two</h3><p>Getting staked NIM out takes three transactions. Nimiq's FAQ mentions two.</p></article>
      <article class="tile"><h3>A day, not 12 hours</h3><p>Unstaked NIM is released one full period after the next checkpoint. NimJar counts it down exactly.</p></article>
      <article class="tile"><h3>Nothing left behind</h3><p>The network quietly drops a withdrawal that leaves a little NIM staked. NimJar always takes it all.</p></article>
      <article class="tile"><h3>Some pools pay nothing</h3><p>The blockchain can't tell you; Nimiq's validator list can. NimJar only suggests pools that pay.</p></article>
    </div>
  </section>

  <section class="band navy" id="proof">
    <p class="eyebrow">Don't take our word for it</p>
    <h2>Every step, on the blockchain.</h2>
    <div class="ledger">
      <div class="lh">The full round trip, inside Nimiq Pay (testnet)</div>
      <a href="https://test.nimiq.watch/#4318bf6cd8fa3b263ffa2b5ca66c5b768991ebe5a7c1424d155a7c19501b6ca8" target="_blank" rel="noopener"><b>Stake</b><span>100 NIM</span><span>block 11,146,029</span><i>4318bf6c… ↗</i></a>
      <a href="https://test.nimiq.watch/#5d90b1a72e51eb17852552f339e8085ef6cc954abab5bc0e18f2d86574800f5c" target="_blank" rel="noopener"><b>Add stake</b><span>500 NIM</span><span>block 11,146,044</span><i>5d90b1a7… ↗</i></a>
      <a href="https://test.nimiq.watch/#0e631c471ab3ac252631ac0799e18f90d7057e9a1ad8ba79e75ae1b2cc3c48fd" target="_blank" rel="noopener"><b>Unstake</b><span>600 NIM</span><span>block 11,146,249</span><i>0e631c47… ↗</i></a>
      <a href="https://test.nimiq.watch/#9df81d3393c6d3a19e267a13485a2571c6413de1b9146b37f71f2832f2c18a5e" target="_blank" rel="noopener"><b>Confirm withdrawal</b><span>600 NIM</span><span>block 11,436,281</span><i>9df81d33… ↗</i></a>
      <a href="https://test.nimiq.watch/#5d34b3009765fd64452d283a0c261125f4fd42e605bffbc5714d8aa2f92e9f7a" target="_blank" rel="noopener"><b>Withdraw</b><span>600 NIM</span><span>block 11,438,913</span><i>5d34b300… ↗</i></a>
    </div>
    <p class="after">Every step also tested on mainnet with real money: 100 NIM in, 99.99931 NIM back. <a href="https://github.com/imprint-hash/nimjar#proof-that-it-works" target="_blank" rel="noopener">See all the transactions on GitHub</a></p>
  </section>

  <footer class="foot">
    <span><img src="/icon.svg" width="28" height="28" alt=""> NimJar · open source, MIT licence · built for the Nimiq Mini Apps Competition</span>
    <a href="https://github.com/imprint-hash/nimjar" target="_blank" rel="noopener">github.com/imprint-hash/nimjar</a>
  </footer>
</div>
<noscript><p style="padding:20px">NimJar needs JavaScript to read the Nimiq network.</p></noscript>
</body>
</html>`;
}
