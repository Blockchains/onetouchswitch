// Builds the static API under ./site/api/v1 from STAGED local data (no network). Run after `npm run stage` and the static web build.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const ROOT = new URL("..", import.meta.url).pathname;
const DATA = process.env.OTS_DATA_DIR ?? join(ROOT, "data");
const SITE = join(ROOT, "site"); const API = join(SITE, "api", "v1"); mkdirSync(join(API, "postcode"), { recursive: true }); mkdirSync(join(API, "catalogue"), { recursive: true });
const meta = JSON.parse(readFileSync(join(DATA, "postcodes", "meta.json"), "utf8"));
const names = JSON.parse(readFileSync(join(DATA, "postcodes", "names.json"), "utf8"));
let files = 0, rows = 0;
for (const f of readdirSync(join(DATA, "postcodes")).filter((f) => /^[a-z]+\.json$/.test(f) && f !== "meta.json" && f !== "names.json")) {
  const byOut = new Map();
  for (const r of JSON.parse(readFileSync(join(DATA, "postcodes", f), "utf8")).rows) { const out = r[0].split(" ")[0]; if (!byOut.has(out)) byOut.set(out, []); byOut.get(out).push([r[0], r[4], r[5], r[6]]); }
  for (const [out, rs] of byOut) {
    const codes = new Set(rs.flatMap((r) => [r[2], r[3]]).filter(Boolean));
    writeFileSync(join(API, "postcode", `${out}.json`), JSON.stringify({ outward: out, data_version: meta.version, rows: rs, names: Object.fromEntries([...codes].filter((c) => names[c]).map((c) => [c, names[c]])) }));
    files++; rows += rs.length;
  }
}
const prov = JSON.parse(readFileSync(existsSync(join(DATA, "providers.json")) ? join(DATA, "providers.json") : join(ROOT, "config", "providers.json"), "utf8"));
writeFileSync(join(API, "providers.json"), JSON.stringify({ staged_at: prov.staged_at ?? null, note: "Directory of provider websites. Not a list of what is available at your address.", providers: prov.providers.map((p) => ({ id: p.id, name: p.name, url: p.link_check?.final_url ?? p.url, link_ok: p.link_check ? p.link_check.status === 200 : null, handoff: null, districts: p.districts, areas: p.areas })) }, null, 1));
const curF = join(DATA, "catalogue", "published", "current.json");
const cat = existsSync(curF) ? JSON.parse(readFileSync(join(DATA, "catalogue", "published", `v${JSON.parse(readFileSync(curF, "utf8")).version}.json`), "utf8")) : { version: 0, published_at: null, offer_count: 0, offers: [] };
writeFileSync(join(API, "catalogue", "current.json"), JSON.stringify(cat, null, 1));
const BASE = process.env.PAGES_URL ?? "https://blockchains.github.io/onetouchswitch";
writeFileSync(join(API, "index.json"), JSON.stringify({ name: "One Touch Switch comparison — static API", generated_at: new Date().toISOString(), postcodes: { data_version: meta.version, count: rows, outward_files: files, url: `${BASE}/api/v1/postcode/{OUTWARD}.json`, licence: meta.licence }, providers: `${BASE}/api/v1/providers.json`, catalogue: { url: `${BASE}/api/v1/catalogue/current.json`, version: cat.version, offers: cat.offers.length }, engine: `${BASE}/engine/v1/ots-engine.mjs`, offer_copy: "Published offer. Check availability with the provider.", docs: "https://github.com/Blockchains/onetouchswitch/blob/main/docs/INTEGRATION.md" }, null, 1));
writeFileSync(join(SITE, ".nojekyll"), "");
console.log(`static API: ${files} outward files, ${rows} postcodes, catalogue v${cat.version} (${cat.offers.length} offers)`);
