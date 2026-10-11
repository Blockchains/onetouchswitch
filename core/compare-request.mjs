// Shared by the server and the static/browser client: request schema -> deals -> deterministic comparison.
import { z } from "zod";
import { compare, CompareInput } from "./cost.mjs";
import { OFFER_COPY, QUOTE_COPY } from "./copy.mjs";
import { offerMatches } from "./regions.mjs";

export const Quote = z.object({ label: z.string().min(1).max(120), provider_id: z.string().optional(), monthly_pence: z.number().int().min(0), upfront_pence: z.number().int().min(0).default(0), contract_months: z.number().int().min(1).max(36), annual_rise_pence: z.number().int().min(0).default(0), rise_month: z.number().int().min(1).max(12).optional(), from_offer: z.string().optional(), cashback_pence: z.number().int().min(0).default(0), download_mbps: z.number().optional() });
export const CompareReq = z.object({ postcode: z.string().optional(), start: z.string().regex(/^\d{4}-\d{2}$/), horizon_months: z.number().int().min(1).max(36).optional(), current: CompareInput.shape.current, offer_ids: z.array(z.string()).max(30).default([]), quotes: z.array(Quote).max(20).default([]) });

/** @param catalogueDoc published catalogue {version, offers}; @param providerView (id) => provider view or null */
export function runCompare(body, catalogueDoc, providerView) {
  const req = CompareReq.parse(body);
  const pub = new Map(catalogueDoc.offers.map((o) => [o.id, o]));
  const deals = [
    ...req.offer_ids.map((id) => { const o = pub.get(id); if (!o) throw new Error(`Offer ${id} is not in the published catalogue`);
      if (o.monthly_pence == null || o.contract_months == null) throw new Error(`Offer ${id} has no published monthly price or contract length, so it can't be costed. Check with the provider and add it as a quote.`);
      return { id: o.id, label: `${providerView(o.provider_id)?.name ?? o.provider_id} — ${o.name}`, provider_id: o.provider_id, monthly_pence: o.monthly_pence, intro_pence: o.intro_pence ?? undefined, intro_months: o.intro_months ?? undefined, upfront_pence: o.upfront_pence ?? 0, contract_months: o.contract_months, annual_rise_pence: o.annual_rise_pence ?? 0, rise_month: o.rise_month ?? undefined, cashback_pence: o.cashback_pence ?? 0, download_mbps: o.download_mbps ?? undefined, rise_unknown: o.annual_rise_pence == null, source: "catalogue", catalogue_ref: `v${catalogueDoc.version}:${o.id}` }; }),
    ...req.quotes.map((q, i) => ({ ...q, id: `quote-${i + 1}`, source: "customer_quote" })),
  ];
  if (!deals.length) throw new Error("Add at least one published offer or quote to compare");
  const res = compare({ start: req.start, horizon_months: req.horizon_months, current: req.current, deals });
  for (const r of res.results) { r.copy = r.source === "catalogue" ? OFFER_COPY : QUOTE_COPY; r.provider = r.provider_id ? providerView(r.provider_id) : null; }
  return { request: req, ...res };
}
export const offersForArea = (doc, area, outward) => doc.offers.filter((o) => offerMatches(o, area, outward));
