// Withdraw approved offers before the next publish (price no longer on the provider's page, or the page can't be verified).
//   node scripts/withdraw.mjs <withdrawals.json> --reviewer "Name"
//   withdrawals.json: { "checked_at": "...", "withdrawn": [{ "id": "...", "reason": "..." }] }
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Catalogue } from "../core/catalogue.mjs";
const ROOT = new URL("..", import.meta.url).pathname;
const args = process.argv.slice(2); const i = args.indexOf("--reviewer"); const reviewer = i >= 0 ? args[i + 1] : null;
if (!args[0] || !reviewer) { console.error("usage: withdraw.mjs <withdrawals.json> --reviewer NAME"); process.exit(2); }
const doc = JSON.parse(readFileSync(args[0], "utf8"));
const cat = new Catalogue(process.env.OTS_CATALOGUE_DIR ?? join(ROOT, "catalogue"));
for (const w of doc.withdrawn) { cat.withdraw(w.id, { reviewer, reason: w.reason, at: doc.checked_at }); console.log(`withdrawn ${w.id}: ${w.reason}`); }
