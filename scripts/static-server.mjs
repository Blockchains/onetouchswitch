// Serves ./site under /onetouchswitch/ exactly like GitHub Pages does (for offline tests).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
const SITE = new URL("../site/", import.meta.url).pathname; const port = Number(process.argv[2] ?? 8797);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css" };
createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); if (!u.pathname.startsWith("/onetouchswitch/")) { res.writeHead(404).end(); return; }
  let p = normalize(u.pathname.slice("/onetouchswitch/".length)); if (p.startsWith("..")) { res.writeHead(400).end(); return; } if (!p || p.endsWith("/") || p === ".") p = join(p, "index.html");
  try { const b = await readFile(join(SITE, p)); res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream", "access-control-allow-origin": "*" }).end(b); } catch { res.writeHead(404).end("not found"); }
}).listen(port, "127.0.0.1", () => console.log(`static on http://127.0.0.1:${port}/onetouchswitch/`));
