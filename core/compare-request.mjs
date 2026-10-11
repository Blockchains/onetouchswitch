// Shared by the server and the static/browser client: request schema -> deals -> deterministic comparison.
import { z } from "zod";
import { compare, CompareInput } from "./cost.mjs";
import { OFFER_COPY, QUOTE_COPY } from "./copy.mjs";

export const Quote = z.object({ label: z.string().min(1).max(120), provider_id: z.string().optional(), monthly_pence: z.number().int().min(0), upfront_pence: z.number().int().min(0).default(0), contract_months: z.number().int().min(1).max(36), annual_rise_pence: z.number().int().min(0).default(0), rise_month: z.number().int().min(1).max(12).optional(), cashback_pence: z.number().int().min(0).default(0), download_mbps: z.number().optional() });
export const CompareReq = z.object({ postcode: z.string().optional(), start: z.string().regex(/^\d{4}-\d{2}$/), horizon_months: z.number().int().min(1).max(36).optional(), current: CompareInput.shape.current, offer_ids: z.array(z.string()).max(30).default([]), quotes: z.array(Quote).max(20).default([]) });

/** @param catalogueDoc published catalogue {version, offers}; @param providerView (id) => provider view or null */
export function runCompare(body, catalogueDoc, providerView) {
  const req = CompareReq.parse(body);
  const pub = new Map(catalogueDoc.offers.map((o) => [o.id, o]));
  const deals = [
    ...req.offer_ids.map((id) => { const o = pub.get(id); if (!o) throw new Error(`Offer ${id} is not in the published catalogue`); return { id: o.id, label: `${providerView(o.provider_id)?.name ?? o.provider_id} — ${o.name}`, provider_id: o.provider_id, monthly_pence: o.monthly_pence, upfront_pence: o.upfront_pence, contract_months: o.contract_months, annual_rise_pence: o.annual_rise_pence, rise_month: o.rise_month, cashback_pence: o.cashback_pence, download_mbps: o.download_mbps, source: "catalogue", catalogue_ref: `v${catalogueDoc.version}:${o.id}` }; }),
    ...req.quotes.map((q, i) => ({ ...q, id: `quote-${i + 1}`, source: "customer_quote" })),
  ];
  if (!deals.length) throw new Error("Add at least one published offer or quote to compare");
  const res = compare({ start: req.start, horizon_months: req.horizon_months, current: req.current, deals });
  for (const r of res.results) { r.copy = r.source === "catalogue" ? OFFER_COPY : QUOTE_COPY; r.provider = r.provider_id ? providerView(r.provider_id) : null; }
  return { request: req, ...res };
}
export const offersForArea = (doc, area) => doc.offers.filter((o) => (!o.regions?.areas?.length || o.regions.areas.includes(area)) && !(o.regions?.exclude_areas ?? []).includes(area));
