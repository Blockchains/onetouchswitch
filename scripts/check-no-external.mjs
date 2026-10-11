// Fails if the built static site, or package.json, gains a runtime dependency on anything other than this origin's static files.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const ROOT = new URL("..", import.meta.url).pathname; const SITE = join(ROOT, "site"); const bad = [];
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const BANNED_PKGS = ["bullmq", "ioredis", "redis", "hono", "@hono/node-server", "express", "payload", "pg", "postgres", "docling", "@supabase/supabase-js", "firebase"];
for (const d of BANNED_PKGS) if (pkg.dependencies?.[d] || pkg.devDependencies?.[d]) bad.push(`package.json depends on ${d}`);
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const code = [...walk(join(SITE, "assets")), ...walk(join(SITE, "engine")), join(SITE, "sw.js"), join(SITE, "index.html")].filter((p) => [".js", ".mjs", ".html", ".css"].includes(extname(p)));
const BANNED = [/cdn\.jsdelivr|unpkg\.com|cdnjs|googleapis|gstatic|fonts\.google/i, /api\.postcodes\.io|api\.os\.uk|getaddress\.io|ideal-postcodes/i, /docling|bullmq|redis:\/\/|postgres:\/\//i, /onetouchswitch-bridge\/v1/];
for (const f of code) { const s = readFileSync(f, "utf8"); for (const rx of BANNED) if (rx.test(s)) bad.push(`${f.replace(SITE, "site")}: ${rx}`); }
const html = readFileSync(join(SITE, "index.html"), "utf8");
for (const m of html.matchAll(/<(script|link)[^>]+(src|href)="(https?:)?\/\/[^"]+"/g)) bad.push(`index.html loads external ${m[0]}`);
if (bad.length) { console.error("External runtime dependencies found:\n" + bad.join("\n")); process.exit(1); }
console.log(`no external runtime deps: ${code.length} built files checked; deps: ${Object.keys(pkg.dependencies).join(", ")}`);
