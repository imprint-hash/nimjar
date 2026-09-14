/**
 * The page shell. Styles and behaviour live in src/public/, served as files, so
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
<main class="app" id="app"></main>
<div class="dock" id="dock"></div>
<noscript><p style="padding:20px">NimJar needs JavaScript to read the Nimiq network.</p></noscript>
</body>
</html>`;
}
