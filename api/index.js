// Vercel entry point: every request goes to the same handler `npm start` uses.
//
// Loaded on first request rather than imported at the top, so that if the
// server ever fails to start, the reason reaches the browser and the logs
// instead of an anonymous FUNCTION_INVOCATION_FAILED.
let loading = null;

export default async function nimjar(req, res) {
  try {
    loading ??= import("../src/server.js");
    const { handler } = await loading;
    return await handler(req, res);
  } catch (e) {
    loading = null;
    console.error("NimJar failed to start:", e);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("NimJar failed to start: " + String(e?.message || e));
  }
}
