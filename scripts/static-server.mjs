// Serves ./site under /onetouchswitch/ exactly like GitHub Pages does (used by the offline tests and `npm run preview`).
//   node scripts/static-server.mjs <port> [overlayDir]   overlay files (e.g. a TEST FIXTURE catalogue) take precedence.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
const SITE = new URL("../site/", import.meta.url).pathname; const port = Number(process.argv[2] ?? 8797); const overlay = process.argv[3] ?? null;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".pdf": "application/pdf" };
const read = async (p) => { for (const root of [overlay, SITE].filter(Boolean)) { try { const f = join(root, p); if ((await stat(f)).isFile()) return await readFile(f); } catch {} } return null; };
createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); if (!u.pathname.startsWith("/onetouchswitch/")) { res.writeHead(404).end(); return; }
  let p = normalize(decodeURIComponent(u.pathname.slice("/onetouchswitch/".length))); if (p.startsWith("..")) { res.writeHead(400).end(); return; }
  if (!p || p === "." || p.endsWith("/")) p = join(p, "index.html");
  const b = await read(p);
  if (b) res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-cache" }).end(b);
  else res.writeHead(404, { "content-type": "text/html" }).end((await read("404.html")) ?? "not found");
}).listen(port, "127.0.0.1", () => console.log(`static on http://127.0.0.1:${port}/onetouchswitch/${overlay ? ` (overlay ${overlay})` : ""}`));
