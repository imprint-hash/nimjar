// Temporary: proves whether any function runs on this deployment at all.
export default function ping(req, res) {
  res.setHeader("content-type", "text/plain");
  res.end(`pong ${process.version}`);
}
