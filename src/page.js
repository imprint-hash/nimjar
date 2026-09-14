/**
 * The page shell. Styles and behaviour live in public/, served as files, so
 * nothing here needs escaping and the browser can cache them.
 *
 * The only thing the server fills in is which network it reads and which wallet
 * to show when the app is opened outside Nimiq Pay. It goes in as JSON data,
 * never as code.
 */

const escapeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

export function renderApp({ demoAddress, networkId }) {
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
<script type="application/json" id="cfg">${escapeJson({ demoAddress, networkId })}</script>
<script type="module" src="/app.js"></script>
</head>
<body>
<div class="stage">
<aside class="intro" aria-label="About NimJar">
  <img src="/icon.svg" width="88" height="88" alt="">
  <h1>NimJar</h1>
  <p class="lede">Stake your NIM in one tap inside Nimiq Pay, and get it all back out, step by step.</p>
  <h2>Try it in Nimiq Pay</h2>
  <ol>
    <li>Open Nimiq Pay on your phone</li>
    <li>Go to <b>Mini Apps</b>, then <b>Custom URL</b></li>
    <li>Enter <b class="url">nimjar.vercel.app</b></li>
  </ol>
  <button class="copy" type="button" id="copy">Copy link</button>
  <p class="note">Next to this is a live preview of a real staked wallet on Nimiq mainnet. Every number in it is real, and every entry links to the blockchain.</p>
  <p class="note"><a href="https://github.com/imprint-hash/nimjar" target="_blank" rel="noopener">Source code and proof on GitHub</a></p>
</aside>
<div class="device" id="device">
<main class="app" id="app"></main>
<div class="dock" id="dock"></div>
</div>
</div>
<noscript><p style="padding:20px">NimJar needs JavaScript to read the Nimiq network.</p></noscript>
</body>
</html>`;
}
