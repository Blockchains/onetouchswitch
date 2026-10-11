// Builds everything the static app needs under ./site from STAGED local data (no network):
//   api/v1/postcode/<OUTWARD>.json + areas.json, providers.json, handoff.json, catalogue/current.json + the current vN.json only (superseded/draft versions are not served),
//   guides (JSON for the app + plain HTML pages), self-hosted pdf.js, service worker (offline), index.json.
// Run after `npm run stage` and the two vite builds.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { marked } from "marked";
const ROOT = new URL("..", import.meta.url).pathname;
const DATA = process.env.OTS_DATA_DIR ?? join(ROOT, "data");
const SITE = join(ROOT, "site"); const API = join(SITE, "api", "v1");
const BASE_PATH = process.env.VITE_BASE ?? "/onetouchswitch/";
const BASE = process.env.PAGES_URL ?? "https://blockchains.github.io/onetouchswitch";
for (const d of ["postcode", "catalogue", "guides"]) mkdirSync(join(API, d), { recursive: true });
const J = (p, o, pretty) => { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, JSON.stringify(o, null, pretty ? 1 : 0)); };

// 1. Postcodes, one file per outward code, plus an area -> outward index for "keep this area offline".
const meta = JSON.parse(readFileSync(join(DATA, "postcodes", "meta.json"), "utf8"));
const names = JSON.parse(readFileSync(join(DATA, "postcodes", "names.json"), "utf8"));
let files = 0, rows = 0; const areas = {};
for (const f of readdirSync(join(DATA, "postcodes")).filter((f) => /^[a-z]+\.json$/.test(f) && f !== "meta.json" && f !== "names.json")) {
  const byOut = new Map();
  for (const r of JSON.parse(readFileSync(join(DATA, "postcodes", f), "utf8")).rows) { const out = r[0].split(" ")[0]; if (!byOut.has(out)) byOut.set(out, []); byOut.get(out).push([r[0], r[4], r[5], r[6]]); }
  for (const [out, rs] of byOut) {
    const codes = new Set(rs.flatMap((r) => [r[2], r[3]]).filter(Boolean));
    J(join(API, "postcode", `${out}.json`), { outward: out, data_version: meta.version, rows: rs, names: Object.fromEntries([...codes].filter((c) => names[c]).map((c) => [c, names[c]])) });
    (areas[out.match(/^[A-Z]+/)[0]] ??= []).push(out); files++; rows += rs.length;
  }
}
for (const a of Object.values(areas)) a.sort((x, y) => x.localeCompare(y, "en", { numeric: true }));
J(join(API, "postcode", "areas.json"), { data_version: meta.version, areas });

// 2. Providers (link-checked directory) and approved handoff links (config/handoff.json; empty = plain links only).
const prov = JSON.parse(readFileSync(existsSync(join(DATA, "providers.json")) ? join(DATA, "providers.json") : join(ROOT, "config", "providers.json"), "utf8"));
J(join(API, "providers.json"), { staged_at: prov.staged_at ?? null, note: "Directory of provider websites. Not a list of what is available at your address.", providers: prov.providers.map((p) => ({ id: p.id, name: p.name, url: p.link_check && p.link_check.status !== 200 ? null : (p.link_check?.final_url ?? p.url), link_ok: p.link_check ? p.link_check.status === 200 : null, districts: p.districts, areas: p.areas })) }, true);
const ho = JSON.parse(readFileSync(process.env.OTS_HANDOFF_FILE ?? join(ROOT, "config", "handoff.json"), "utf8"));
const ids = new Set(prov.providers.map((p) => p.id));
const approved = (ho.approved ?? []).filter((x) => ids.has(x.provider_id) && /^https:\/\//.test(x.url ?? "") && x.approved_by && x.approved_at).map(({ provider_id, url, approved_by, approved_at, disclosure }) => ({ provider_id, url, approved_by, approved_at, disclosure: disclosure ?? "We may be paid if you sign up through this link. It does not change our ranking." }));
J(join(API, "handoff.json"), { note: "Provider links approved by Ismail. Empty = we only link to provider websites. A link is never an order.", approved }, true);

// 3. Catalogue: current + only live-approved immutable versions (needs_review cleared). Draft / needs_review versions stay in git under catalogue/published/ but are not served on Pages.
const pubDir = join(process.env.OTS_CATALOGUE_DIR ?? join(ROOT, "catalogue"), "published");
const isLive = (doc) => (doc.needs_review_count ?? 0) === 0 && !(doc.offers ?? []).some((o) => o.needs_review);
let cat = { version: 0, published_at: null, offer_count: 0, offers: [] };
if (existsSync(join(pubDir, "current.json"))) {
  cat = JSON.parse(readFileSync(join(pubDir, `v${JSON.parse(readFileSync(join(pubDir, "current.json"), "utf8")).version}.json`), "utf8"));
  if (!isLive(cat)) throw new Error(`Refuse to publish catalogue v${cat.version}: still has needs_review / draft flags`);
  const bad = cat.offers.filter((o) => o.monthly_pence == null || !/^https:\/\//.test(o.source_url ?? "") || !o.reviewed_by || !o.retrieved_at);
  if (bad.length) throw new Error(`Refuse to publish catalogue v${cat.version}: offers without a price, https source, reviewer or retrieved date: ${bad.map((o) => o.id).join(", ")}`);
  // Only the CURRENT version is served. Superseded versions (which may hold withdrawn offers) stay in git, not on Pages.
  cpSync(join(pubDir, `v${cat.version}.json`), join(API, "catalogue", `v${cat.version}.json`));
}
J(join(API, "catalogue", "current.json"), cat, true);

// 4. Guides: markdown with a small front-matter block -> JSON for the app/engine + static HTML pages.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const guides = [];
for (const f of readdirSync(join(ROOT, "content", "guides")).filter((f) => f.endsWith(".md")).sort()) {
  const src = readFileSync(join(ROOT, "content", "guides", f), "utf8"); const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); if (!m) throw new Error(`front matter missing in ${f}`);
  const fm = Object.fromEntries(m[1].split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(([, k, v]) => [k, v.startsWith("[") ? v.slice(1, -1).split(",").map((s) => s.trim()) : v]));
  const slug = f.replace(/\.md$/, ""); const html = marked.parse(m[2]).replace(/<a href="http/g, '<a rel="noopener" target="_blank" href="http');
  const text = m[2].replace(/[#*_`>\[\]()]/g, " ").replace(/https?:\S+/g, "").replace(/\s+/g, " ").trim();
  guides.push({ slug, title: fm.title, summary: fm.summary, tags: fm.tags ?? [], updated: fm.updated, text });
  J(join(API, "guides", `${slug}.json`), { slug, title: fm.title, summary: fm.summary, updated: fm.updated, html });
  const page = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(fm.title)} | One Touch Switch guides</title><meta name="description" content="${esc(fm.summary)}"><link rel="canonical" href="${BASE}/guides/${slug}/"><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:auto;padding:24px;color:#12202B;background:#f7f5f0}a{color:#0f766e}h1{font-family:Georgia,serif}</style></head><body><p><a href="${BASE_PATH}#/guides">All guides</a> · <a href="${BASE_PATH}">Compare broadband costs</a></p><h1>${esc(fm.title)}</h1><p><em>Updated ${esc(fm.updated)}</em></p>${html}</body></html>`;
  mkdirSync(join(SITE, "guides", slug), { recursive: true }); writeFileSync(join(SITE, "guides", slug, "index.html"), page);
}
J(join(API, "guides", "index.json"), { count: guides.length, guides }, true);
mkdirSync(join(SITE, "guides"), { recursive: true });
writeFileSync(join(SITE, "guides", "index.html"), `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Broadband guides | One Touch Switch</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:auto;padding:24px}a{color:#0f766e}</style></head><body><h1>Broadband guides</h1><p><a href="${BASE_PATH}">Compare broadband costs</a></p><ul>${guides.map((g) => `<li><a href="${BASE_PATH}guides/${g.slug}/">${esc(g.title)}</a><br>${esc(g.summary)}</li>`).join("")}</ul></body></html>`);

// 5. Self-hosted pdf.js for in-browser bill reading (no CDN).
const PDF = join(ROOT, "node_modules", "pdfjs-dist"); const V = join(SITE, "vendor", "pdfjs"); mkdirSync(V, { recursive: true });
for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs"]) cpSync(join(PDF, "build", f), join(V, f));
for (const d of ["cmaps", "standard_fonts"]) cpSync(join(PDF, d), join(V, d), { recursive: true });
cpSync(join(PDF, "LICENSE"), join(V, "LICENSE"));

// 6. index.json, llms.txt, .nojekyll, 404.
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
J(join(API, "index.json"), { name: "One Touch Switch comparison: static API", generated_at: new Date().toISOString(), engine_version: "ots-static-2", app_version: pkg.version,
  runtime_dependencies: "none: static files on this origin + in-browser engine. No server, database, queue, OCR service or third-party API.",
  postcodes: { data_version: meta.version, count: rows, outward_files: files, url: `${BASE}/api/v1/postcode/{OUTWARD}.json`, areas: `${BASE}/api/v1/postcode/areas.json`, licence: meta.licence },
  providers: `${BASE}/api/v1/providers.json`, handoff: { url: `${BASE}/api/v1/handoff.json`, approved: approved.length },
  catalogue: { url: `${BASE}/api/v1/catalogue/current.json`, version: cat.version, offers: cat.offers.length }, guides: { url: `${BASE}/api/v1/guides/index.json`, count: guides.length },
  engine: `${BASE}/engine/v1/ots-engine.mjs`, pdfjs: `${BASE}/vendor/pdfjs/pdf.min.mjs`, offer_copy: "Published offer. Check availability with the provider.", docs: "https://github.com/Blockchains/onetouchswitch/blob/main/docs/INTEGRATION.md" }, true);
cpSync(join(ROOT, "llms.txt"), join(SITE, "llms.txt"));
writeFileSync(join(SITE, ".nojekyll"), "");
cpSync(join(SITE, "index.html"), join(SITE, "404.html"));

// 7. Service worker: precache the app shell + small data; postcode files are cached as they are used.
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pre = ["", "index.html", "llms.txt", ...walk(join(SITE, "assets")).map((p) => relative(SITE, p)), "engine/v1/ots-engine.mjs",
  "api/v1/index.json", "api/v1/providers.json", "api/v1/handoff.json", "api/v1/catalogue/current.json", "api/v1/postcode/areas.json", "api/v1/guides/index.json",
  ...guides.map((g) => `api/v1/guides/${g.slug}.json`), "guides/", ...guides.map((g) => `guides/${g.slug}/`), "vendor/pdfjs/pdf.min.mjs", "vendor/pdfjs/pdf.worker.min.mjs"];
const h = createHash("sha256"); for (const p of pre) { const fp = join(SITE, p.endsWith("/") || p === "" ? join(p, "index.html") : p); h.update(p); h.update(readFileSync(fp)); }
const ver = h.digest("hex").slice(0, 12);
writeFileSync(join(SITE, "sw.js"), readFileSync(join(ROOT, "web", "sw.template.js"), "utf8").replace("__VERSION__", ver).replace("__PRECACHE__", JSON.stringify(pre)));
console.log(`static: ${files} outward files, ${rows} postcodes, catalogue v${cat.version} (${cat.offers.length} offers), ${approved.length} approved handoffs, ${guides.length} guides, sw ${ver} (${pre.length} precached)`);
