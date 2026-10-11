// Deterministic contract-cost engine. Same inputs -> same outputs, no network, no randomness.
// UK rules modelled: in-contract price rises stated in pounds and pence (Ofcom, contracts from 17 Jan 2025),
// early termination charges on the current deal, cashback/vouchers shown but EXCLUDED from cost (not a price).
import { z } from "zod";
import { gbp, sum, times, pence, fmt, zero } from "./money.mjs";

export const Deal = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  provider_id: z.string().max(60).optional(),
  monthly_pence: z.number().int().min(0).max(100000),
  upfront_pence: z.number().int().min(0).max(100000).default(0),
  contract_months: z.number().int().min(1).max(36),
  annual_rise_pence: z.number().int().min(0).max(5000).default(0), // £/month added each April-style anniversary
  rise_month: z.number().int().min(1).max(12).optional(),             // calendar month the rise applies (e.g. 4 = April)
  cashback_pence: z.number().int().min(0).max(100000).default(0),
  download_mbps: z.number().min(0).max(10000).optional(),
  source: z.enum(["catalogue", "customer_quote", "current_bill"]),
  catalogue_ref: z.string().optional(),
});
export const CurrentDeal = z.object({
  monthly_pence: z.number().int().min(0).max(100000),
  out_of_contract_monthly_pence: z.number().int().min(0).max(100000).optional(),
  months_left: z.number().int().min(0).max(36).default(0),
  exit_fee_pence: z.number().int().min(0).max(200000).default(0),
});
export const CompareInput = z.object({
  start: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM the new contract would start
  horizon_months: z.number().int().min(1).max(36).optional(),
  current: CurrentDeal.optional(),
  deals: z.array(Deal).min(1).max(50),
});

/** Monthly schedule for one deal over `horizon` months from `start` (YYYY-MM). */
export function schedule(deal, start, horizon) {
  const [y0, m0] = start.split("-").map(Number);
  const out = []; let rises = 0;
  for (let i = 0; i < horizon; i++) {
    const month = ((m0 - 1 + i) % 12) + 1;
    if (i > 0 && deal.annual_rise_pence > 0) {
      const riseNow = deal.rise_month ? month === deal.rise_month : i % 12 === 0;
      if (riseNow && i < deal.contract_months) rises += 1;
    }
    out.push({ i, ym: `${y0 + Math.floor((m0 - 1 + i) / 12)}-${String(month).padStart(2, "0")}`, pence: deal.monthly_pence + rises * deal.annual_rise_pence });
  }
  return out;
}

export function costDeal(deal, start, horizon) {
  const d = Deal.parse(deal);
  const h = horizon ?? d.contract_months;
  const sched = schedule(d, start, h);
  const monthly = sum(sched.map((s) => gbp(s.pence)));
  const total = sum([monthly, gbp(d.upfront_pence)]);
  return {
    id: d.id, label: d.label, provider_id: d.provider_id ?? null, source: d.source, catalogue_ref: d.catalogue_ref ?? null,
    months: h, contract_months: d.contract_months,
    total_pence: pence(total), total: fmt(total),
    effective_monthly_pence: Math.round(pence(total) / h), effective_monthly: fmt(gbp(Math.round(pence(total) / h))),
    first_month_pence: sched[0].pence, last_month_pence: sched[sched.length - 1].pence,
    upfront_pence: d.upfront_pence, cashback_pence: d.cashback_pence,
    cashback_note: d.cashback_pence ? `Cashback/reward of ${fmt(gbp(d.cashback_pence))} not deducted: it is not a price and often has claim conditions.` : null,
    download_mbps: d.download_mbps ?? null,
    months_beyond_contract: Math.max(0, h - d.contract_months),
    beyond_contract_note: h > d.contract_months ? `This deal's contract is ${d.contract_months} months. For the other ${h - d.contract_months} months of the comparison period we assume the last contract price continues; the provider may charge more once the contract ends.` : null,
    schedule: sched,
  };
}

/** Cost of staying (or switching away) from the current deal over the horizon. */
export function costStay(current, horizon) {
  const c = CurrentDeal.parse(current);
  const ooc = c.out_of_contract_monthly_pence ?? c.monthly_pence;
  const inC = Math.min(c.months_left, horizon);
  const total = sum([times(gbp(c.monthly_pence), inC), times(gbp(ooc), horizon - inC)]);
  return { total_pence: pence(total), total: fmt(total), months_in_contract: inC, months_out_of_contract: horizon - inC, exit_fee_pence: c.exit_fee_pence, exit_fee: fmt(gbp(c.exit_fee_pence)) };
}

export function compare(input) {
  const inp = CompareInput.parse(input);
  const horizon = inp.horizon_months ?? Math.max(...inp.deals.map((d) => d.contract_months));
  const rows = inp.deals.map((d) => costDeal(d, inp.start, horizon));
  const stay = inp.current ? costStay(inp.current, horizon) : null;
  for (const r of rows) {
    const switchTotal = r.total_pence + (stay ? stay.exit_fee_pence : 0);
    r.switch_total_pence = switchTotal; r.switch_total = fmt(gbp(switchTotal));
    r.vs_stay_pence = stay ? switchTotal - stay.total_pence : null;
    r.vs_stay = stay ? fmt(gbp(switchTotal - stay.total_pence)) : null;
  }
  // Deterministic order: total incl. exit fee, then first-month price, then id.
  rows.sort((a, b) => a.switch_total_pence - b.switch_total_pence || a.first_month_pence - b.first_month_pence || a.id.localeCompare(b.id));
  rows.forEach((r, i) => (r.rank = i + 1));
  return {
    start: inp.start, horizon_months: horizon, stay, results: rows,
    method: "Total = upfront + every monthly payment over the horizon, including stated in-contract £ rises; switching adds your current exit fee. Cashback is excluded. Ranking is by that total, then the first-month price.",
    engine_version: "cost-1",
  };
}
export { zero };
