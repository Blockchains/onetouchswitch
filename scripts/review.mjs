// Human review CLI for the local offer catalogue.
//   npm run review -- list
//   npm run review -- add path/to/offer.json            (manual entry -> pending)
//   npm run review -- approve <id> --reviewer "Name" [--note "..."]
//   npm run review -- reject  <id> --reviewer "Name" --note "why"
//   npm run review -- publish --publisher "Name"        (approved -> next immutable version)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Catalogue } from "../core/catalogue.mjs";
const ROOT = new URL("..", import.meta.url).pathname;
const cat = new Catalogue(process.env.OTS_CATALOGUE_DIR ?? join(ROOT, "catalogue"));
const [cmd, arg, ...rest] = process.argv.slice(2);
const opt = (k) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : (process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : undefined); };
const now = new Date().toISOString();
switch (cmd) {
  case "list": console.table(cat.pending().map((r) => ({ id: r.offer.id, provider: r.offer.provider_id, name: r.offer.name, monthly: (r.offer.monthly_pence / 100).toFixed(2), months: r.offer.contract_months, source: r.offer.source_url, observed: r.offer.observed_at }))); console.log("published version:", cat.current().version); break;
  case "add": console.log("pending:", cat.submit(JSON.parse(readFileSync(arg, "utf8")))); break;
  case "approve": case "reject": { const reviewer = opt("reviewer"); if (!reviewer) throw new Error("--reviewer required"); console.log(cat.decide(arg, { reviewer, reviewed_at: now, decision: cmd === "approve" ? "approved" : "rejected", note: opt("note") })); break; }
  case "publish": { const publisher = opt("publisher") ?? arg; if (!publisher) throw new Error("--publisher required"); const d = cat.publish({ publisher }); console.log(`published v${d.version}: ${d.offer_count} offers sha256=${d.sha256}`); break; }
  default: console.log("usage: list | add <file> | approve <id> --reviewer N | reject <id> --reviewer N --note W | publish --publisher N");
}
