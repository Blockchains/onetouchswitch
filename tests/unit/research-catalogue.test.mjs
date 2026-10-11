// The published catalogue must match the dated research file exactly: no figure added, changed or invented on the way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Offer } from "../../core/catalogue.mjs";
import { compare } from "../../core/cost.mjs";
const ROOT = new URL("../..", import.meta.url).pathname;
const cur = JSON.parse(readFileSync(`${ROOT}catalogue/published/current.json`, "utf8"));
const pub = JSON.parse(readFileSync(`${ROOT}catalogue/published/v${cur.version}.json`, "utf8"));
const research = JSON.parse(readFileSync(`${ROOT}${pub.notes.research_file.replace(/^\//, "")}`, "utf8"));
const FIELDS = ["provider_id", "name", "monthly_pence", "intro_pence", "intro_months", "contract_months", "annual_rise_pence", "rise_month", "exit_fee_pence", "upfront_pence", "download_mbps", "upload_mbps", "source_url", "retrieved_at", "price_is_from"];

test("every published offer is identical to its research record, with reviewer + source + date", () => {
  const r = new Map(research.offers.map((o) => [o.id, o]));
  assert.equal(pub.offers.length, research.offers.length);
  for (const o of pub.offers) {
    const src = r.get(o.id); assert.ok(src, o.id);
    for (const k of FIELDS) assert.deepEqual(o[k] ?? null, src[k] ?? null, `${o.id}.${k}`);
    assert.ok(o.reviewed_by && o.reviewed_at, `${o.id} reviewer`);
    assert.match(o.source_url, /^https:\/\//); assert.match(o.retrieved_at, /^\d{4}-\d{2}-\d{2}$/);
    Offer.parse(o);
  }
  assert.match(pub.sha256, /^[0-9a-f]{64}$/);
});

test("missing figures are null and flagged, never filled in", () => {
  for (const o of pub.offers) {
    for (const [k, flag] of [["monthly_pence", "monthly_pence"], ["contract_months", "contract_months"], ["exit_fee_pence", "exit_fee_pence"], ["download_mbps", "download_mbps"]]) if (o[k] == null) assert.ok(o.review_flags.includes(flag), `${o.id} ${k} unflagged`);
    if (o.price_is_from) assert.ok(o.review_flags.includes("price_is_from"));
    assert.equal(o.needs_review, o.review_flags.length > 0);
    assert.equal(o.costable, o.monthly_pence != null && o.contract_months != null);
  }
  assert.ok(pub.offers.some((o) => !o.costable), "offers without a published price stay listed but uncostable");
});

test("the cost engine runs on every costable published offer (deterministic, integer pence)", () => {
  const deals = pub.offers.filter((o) => o.costable).map((o) => ({ id: o.id, label: o.name, monthly_pence: o.monthly_pence, intro_pence: o.intro_pence ?? undefined, intro_months: o.intro_months ?? undefined, upfront_pence: o.upfront_pence ?? 0, contract_months: o.contract_months, annual_rise_pence: o.annual_rise_pence ?? 0, rise_month: o.rise_month ?? undefined, rise_unknown: o.annual_rise_pence == null, cashback_pence: o.cashback_pence, source: "catalogue" }));
  assert.ok(deals.length >= 40);
  for (let i = 0; i < deals.length; i += 50) {
    const a = compare({ start: "2026-10", deals: deals.slice(i, i + 50) }), b = compare({ start: "2026-10", deals: deals.slice(i, i + 50) });
    assert.deepEqual(a, b); for (const r of a.results) assert.ok(Number.isInteger(r.total_pence) && r.total_pence > 0, r.id);
  }
  const one = (id, h) => compare({ start: "2026-10", horizon_months: h, deals: deals.filter((d) => d.id === id) }).results[0];
  assert.equal(one("bt-full-fibre-300").total_pence, 6 * 3099 + 12 * 3499 + 6 * 3899);         // +£4 each spring, as on bt.com
  assert.equal(one("hyperoptic-1gb").total_pence, 3 * 0 + 3 * 2600 + 12 * 3000 + 6 * 3400);    // 3 months free, then £26/£30/£34
  assert.equal(one("youfibre-you-1000").total_pence, 24 * 2400);                                 // no in-contract rises
  assert.equal(one("ee-core-100").total_pence, 3000 + 6 * 2699 + 12 * 3099 + 6 * 3499);          // £30 one-off
  assert.match(one("now-full-fibre-300").rise_note, /doesn't state the amount/);
});
