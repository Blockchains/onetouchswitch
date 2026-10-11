// Local offer catalogue: collected -> pending review -> approved -> versioned publication. Only PUBLISHED offers reach customers.
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const Offer = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(80),
  provider_id: z.string().max(60),
  name: z.string().min(1).max(120),
  monthly_pence: z.number().int().min(0),
  upfront_pence: z.number().int().min(0).default(0),
  contract_months: z.number().int().min(1).max(36),
  annual_rise_pence: z.number().int().min(0).default(0),
  rise_month: z.number().int().min(1).max(12).optional(),
  cashback_pence: z.number().int().min(0).default(0),
  download_mbps: z.number().min(0).optional(),
  technology: z.enum(["FTTP", "FTTC", "cable", "fixed-wireless", "other"]).optional(),
  regions: z.object({ areas: z.array(z.string()).optional(), exclude_areas: z.array(z.string()).optional() }).default({}),
  source_url: z.string().url(),
  observed_at: z.string(),
  collected_by: z.enum(["manual", "crawlee", "feed"]),
  terms_note: z.string().max(400).optional(),
});
export const Review = z.object({ reviewer: z.string().min(1), reviewed_at: z.string(), decision: z.enum(["approved", "rejected"]), note: z.string().optional() });
export { OFFER_COPY } from "./copy.mjs";

export class Catalogue {
  constructor(dir) { this.dir = dir; for (const d of ["pending", "approved", "rejected", "published"]) mkdirSync(join(dir, d), { recursive: true }); }
  current() {
    const p = join(this.dir, "published", "current.json");
    if (!existsSync(p)) return { version: 0, published_at: null, offers: [] };
    const { version } = JSON.parse(readFileSync(p, "utf8"));
    return JSON.parse(readFileSync(join(this.dir, "published", `v${version}.json`), "utf8"));
  }
  offersFor(area) { return this.current().offers.filter((o) => (!o.regions?.areas?.length || o.regions.areas.includes(area)) && !(o.regions?.exclude_areas ?? []).includes(area)); }
  submit(offer) { const o = Offer.parse(offer); writeFileSync(join(this.dir, "pending", `${o.id}.json`), JSON.stringify({ offer: o }, null, 1)); return o.id; }
  pending() { return readdirSync(join(this.dir, "pending")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(this.dir, "pending", f), "utf8"))); }
  decide(id, review) {
    const r = Review.parse(review); const src = join(this.dir, "pending", `${id}.json`);
    if (!existsSync(src)) throw new Error(`No pending offer ${id}`);
    const rec = JSON.parse(readFileSync(src, "utf8")); rec.review = r;
    const dest = join(this.dir, r.decision, `${id}.json`); writeFileSync(dest, JSON.stringify(rec, null, 1)); renameSync(src, src + ".done"); return dest;
  }
  /** Publish all approved offers as the next immutable version. */
  publish({ publisher }) {
    const approved = readdirSync(join(this.dir, "approved")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(this.dir, "approved", f), "utf8")));
    const offers = approved.map((r) => ({ ...Offer.parse(r.offer), reviewed_by: r.review.reviewer, reviewed_at: r.review.reviewed_at })).sort((a, b) => a.id.localeCompare(b.id));
    const version = this.current().version + 1;
    const doc = { version, published_at: new Date().toISOString(), publisher, offer_count: offers.length, offers };
    doc.sha256 = createHash("sha256").update(JSON.stringify(offers)).digest("hex");
    writeFileSync(join(this.dir, "published", `v${version}.json`), JSON.stringify(doc, null, 1));
    writeFileSync(join(this.dir, "published", "current.json"), JSON.stringify({ version }, null, 1));
    return doc;
  }
}
