// Permitted-only offer collection with Crawlee. Output goes to the REVIEW queue (pending), never straight to customers.
// A source is visited only if config/permitted-sources.json lists it with documented permission AND robots.txt allows the URL.
// Each source supplies its own extractor module (collector/extractors/<id>.mjs) that returns Offer-shaped objects from the page.
import { CheerioCrawler } from "crawlee";
import robotsParser from "robots-parser";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Catalogue } from "../core/catalogue.mjs";
const ROOT = new URL("..", import.meta.url).pathname;
const UA = "OneTouchSwitchCollector/1.0 (+https://onetouchswitch.com/uk/methodology)";
const { sources } = JSON.parse(readFileSync(join(ROOT, "config", "permitted-sources.json"), "utf8"));
const permitted = sources.filter((s) => s.permission?.type && s.permission?.evidence && s.permission?.granted_by && Array.isArray(s.urls) && s.urls.length);
if (!permitted.length) { console.log("No permitted sources configured (config/permitted-sources.json). Nothing collected — by design."); process.exit(0); }
const cat = new Catalogue(process.env.OTS_CATALOGUE_DIR ?? join(ROOT, "data", "catalogue"));
const queue = [];
for (const s of permitted) {
  const ex = join(ROOT, "collector", "extractors", `${s.id}.mjs`); if (!existsSync(ex)) { console.warn(`skip ${s.id}: no extractor`); continue; }
  for (const url of s.urls) {
    const origin = new URL(url).origin; const r = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": UA } }).catch(() => null);
    const robots = robotsParser(`${origin}/robots.txt`, r && r.ok ? await r.text() : "");
    if (robots.isDisallowed(url, UA)) { console.warn(`robots.txt disallows ${url}; skipped`); continue; }
    queue.push({ url, userData: { source: s, extractor: ex } });
  }
}
const crawler = new CheerioCrawler({ maxConcurrency: 1, maxRequestsPerMinute: 10, additionalMimeTypes: ["application/json"], preNavigationHooks: [(_, o) => { o.headers = { ...(o.headers || {}), "user-agent": UA }; }],
  async requestHandler({ request, $, body }) {
    const { extract } = await import(request.userData.extractor);
    for (const o of await extract({ $, body: String(body), url: request.url })) {
      const id = cat.submit({ ...o, source_url: request.url, observed_at: new Date().toISOString(), collected_by: "crawlee" });
      console.log(`pending review: ${id}`);
    }
  } });
await crawler.run(queue);
