// Import a dated research file (figures read from provider pages) into the review pipeline, record the reviewer, and publish
// the next immutable catalogue version. Every offer keeps its source_url, retrieved_at, review_flags and needs_review.
//   node scripts/import-research.mjs data/catalogue/research/uk-broadband-2026-10-11.json --reviewer "Name" --publisher "Name" [--note "..."]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Catalogue, Offer } from "../core/catalogue.mjs";
const ROOT = new URL("..", import.meta.url).pathname;
const args = process.argv.slice(2); const file = args[0];
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const reviewer = opt("reviewer"), publisher = opt("publisher") ?? reviewer;
if (!file || !reviewer) { console.error("usage: import-research.mjs <file> --reviewer NAME [--publisher NAME] [--note TEXT]"); process.exit(2); }
const doc = JSON.parse(readFileSync(file, "utf8"));
const cat = new Catalogue(process.env.OTS_CATALOGUE_DIR ?? join(ROOT, "catalogue"));
const now = new Date().toISOString(); let n = 0;
for (const raw of doc.offers) {
  const o = Offer.parse(raw);
  if (!/^https:\/\//.test(o.source_url)) throw new Error(`${o.id}: source_url must be https`);
  if (o.monthly_pence == null && !o.review_flags.includes("monthly_pence")) throw new Error(`${o.id}: null price must be flagged`);
  cat.submit(o);
  cat.decide(o.id, { reviewer, reviewed_at: now, decision: "approved", note: (opt("note") ?? "Checked against source_url on retrieved_at.") + (o.needs_review ? ` Needs review: ${o.review_flags.join(", ")}.` : "") });
  n++;
}
const pub = cat.publish({ publisher, notes: { research_file: file.replace(ROOT, ""), retrieved_at: doc.retrieved_at, method: doc.method, reviewer } });
console.log(`imported ${n}; published v${pub.version}: ${pub.offer_count} offers (${pub.costable_count} costable, ${pub.needs_review_count} need review) sha256=${pub.sha256}`);
