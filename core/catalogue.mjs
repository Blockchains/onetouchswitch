// Local offer catalogue: collected -> pending review -> approved -> versioned publication. Only PUBLISHED offers reach customers.
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const pence = z.number().int().min(0);
const Fee = z.object({ label: z.string().min(1).max(120), pence: pence.nullable() });
const Regions = z.object({ areas: z.array(z.string()).optional(), exclude_areas: z.array(z.string()).optional(), outwards: z.array(z.string()).optional(), exclude_outwards: z.array(z.string()).optional() });
/** Offer record. Every figure must come from source_url (or extra_source_urls) on retrieved_at. A figure that is not on
 *  the page is null and listed in review_flags; null prices are never invented and such offers are not costed. */
export const Offer = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(80),
  provider_id: z.string().max(60),
  name: z.string().min(1).max(120),
  monthly_pence: pence.nullable(),
  price_is_from: z.boolean().default(false),
  intro_pence: pence.nullable().optional(),
  intro_months: z.number().int().min(1).max(36).nullable().optional(),
  upfront_pence: pence.nullable().default(0),
  one_off_fees: z.array(Fee).default([]),
  contract_months: z.number().int().min(1).max(36).nullable(),
  annual_rise_pence: pence.nullable().default(0),
  rise_month: z.number().int().min(1).max(12).nullable().optional(),
  rise_rule: z.string().max(400).nullable().optional(),
  exit_fee_pence: pence.nullable().optional(),
  exit_fee_rule: z.string().max(400).nullable().optional(),
  out_of_contract_rule: z.string().max(400).nullable().optional(),
  cashback_pence: pence.default(0),
  download_mbps: z.number().min(0).nullable().optional(),
  upload_mbps: z.number().min(0).nullable().optional(),
  speed_note: z.string().max(200).nullable().optional(),
  technology: z.enum(["FTTP", "FTTC", "cable", "fixed-wireless", "other"]).nullable().optional(),
  social_tariff: z.object({ name: z.string(), eligible: z.string().optional() }).nullable().optional(),
  eligibility_notes: z.string().max(600).optional(),
  offer_ends: z.string().nullable().optional(),
  regions: Regions.default({}),
  source_url: z.string().url(),
  extra_source_urls: z.array(z.string().url()).default([]),
  retrieved_at: z.string().optional(),
  observed_at: z.string(),
  collected_by: z.enum(["manual", "crawlee", "feed"]),
  terms_note: z.string().max(400).optional(),
  review_flags: z.array(z.string()).default([]),
  needs_review: z.boolean().default(false),
  costable: z.boolean().optional(),
}).transform((o) => ({ ...o, costable: o.monthly_pence != null && o.contract_months != null }));
export const Review = z.object({ reviewer: z.string().min(1), reviewed_at: z.string(), decision: z.enum(["approved", "rejected"]), note: z.string().optional() });
export { OFFER_COPY } from "./copy.mjs";
import { offerMatches } from "./regions.mjs";
export { offerMatches };

export class Catalogue {
  constructor(dir) { this.dir = dir; for (const d of ["pending", "approved", "rejected", "published"]) mkdirSync(join(dir, d), { recursive: true }); }
  current() {
    const p = join(this.dir, "published", "current.json");
    if (!existsSync(p)) return { version: 0, published_at: null, offers: [] };
    const { version } = JSON.parse(readFileSync(p, "utf8"));
    return JSON.parse(readFileSync(join(this.dir, "published", `v${version}.json`), "utf8"));
  }
  offersFor(area, outward) { return this.current().offers.filter((o) => offerMatches(o, area, outward)); }
  submit(offer) { const o = Offer.parse(offer); writeFileSync(join(this.dir, "pending", `${o.id}.json`), JSON.stringify({ offer: o }, null, 1)); return o.id; }
  pending() { return readdirSync(join(this.dir, "pending")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(this.dir, "pending", f), "utf8"))); }
  decide(id, review) {
    const r = Review.parse(review); const src = join(this.dir, "pending", `${id}.json`);
    if (!existsSync(src)) throw new Error(`No pending offer ${id}`);
    const rec = JSON.parse(readFileSync(src, "utf8")); rec.review = r;
    const dest = join(this.dir, r.decision, `${id}.json`); writeFileSync(dest, JSON.stringify(rec, null, 1)); renameSync(src, src + ".done"); return dest;
  }
  /** Publish all approved offers as the next immutable version. */
  publish({ publisher, notes } = {}) {
    const approved = readdirSync(join(this.dir, "approved")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(this.dir, "approved", f), "utf8")));
    const offers = approved.map((r) => ({ ...Offer.parse(r.offer), reviewed_by: r.review.reviewer, reviewed_at: r.review.reviewed_at, review_note: r.review.note ?? null })).sort((a, b) => a.id.localeCompare(b.id));
    const version = this.current().version + 1;
    const doc = { version, published_at: new Date().toISOString(), publisher, ...(notes ? { notes } : {}), offer_count: offers.length, costable_count: offers.filter((o) => o.costable).length, needs_review_count: offers.filter((o) => o.needs_review).length, providers: [...new Set(offers.map((o) => o.provider_id))].sort(), offers };
    doc.sha256 = createHash("sha256").update(JSON.stringify(offers)).digest("hex");
    writeFileSync(join(this.dir, "published", `v${version}.json`), JSON.stringify(doc, null, 1));
    writeFileSync(join(this.dir, "published", "current.json"), JSON.stringify({ version }, null, 1));
    return doc;
  }
}
