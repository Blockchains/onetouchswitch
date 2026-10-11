import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, costDeal, costStay } from "../../core/cost.mjs";

const deal = (o) => ({ id: "d", label: "D", monthly_pence: 3000, upfront_pence: 0, contract_months: 24, annual_rise_pence: 0, cashback_pence: 0, source: "customer_quote", ...o });

test("flat 24-month deal totals exactly", () => { const r = costDeal(deal({ upfront_pence: 1999 }), "2026-10"); assert.equal(r.total_pence, 3000 * 24 + 1999); assert.equal(r.total, "£739.99"); });
test("April £3 rises apply in-contract only, by calendar month", () => {
  const r = costDeal(deal({ annual_rise_pence: 300, rise_month: 4 }), "2026-10");
  // Oct26..Mar27: 6 x 3000; Apr27..Mar28: 12 x 3300; Apr28..Sep28: 6 x 3600
  assert.equal(r.total_pence, 6 * 3000 + 12 * 3300 + 6 * 3600);
  assert.equal(r.last_month_pence, 3600);
});
test("cashback is reported but never deducted", () => { const r = costDeal(deal({ cashback_pence: 10000 }), "2026-01"); assert.equal(r.total_pence, 72000); assert.match(r.cashback_note, /not deducted/); });
test("stay cost splits in/out of contract", () => { const s = costStay({ monthly_pence: 2500, out_of_contract_monthly_pence: 4500, months_left: 3, exit_fee_pence: 6000 }, 24); assert.equal(s.total_pence, 3 * 2500 + 21 * 4500); });
test("compare is deterministic and ranks by total incl. exit fee", () => {
  const input = { start: "2026-10", current: { monthly_pence: 2500, out_of_contract_monthly_pence: 4500, months_left: 3, exit_fee_pence: 6000 }, deals: [deal({ id: "b", label: "B", monthly_pence: 2800 }), deal({ id: "a", label: "A", monthly_pence: 2800 }), deal({ id: "c", label: "C", monthly_pence: 2000, upfront_pence: 30000 })] };
  const r1 = compare(input), r2 = compare(structuredClone(input));
  assert.deepEqual(r1, r2);
  assert.deepEqual(r1.results.map((r) => r.id), ["a", "b", "c"]); // a,b tie at 73200 (broken by id); c = 84000
  assert.equal(r1.results[2].switch_total_pence, 2000 * 24 + 30000 + 6000);
  assert.equal(r1.results[0].vs_stay_pence, 2800 * 24 + 6000 - (3 * 2500 + 21 * 4500));
});
test("rejects nonsense input", () => { assert.throws(() => compare({ start: "2026-13x", deals: [] })); assert.throws(() => costDeal(deal({ monthly_pence: -1 }), "2026-01")); });
