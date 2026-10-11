import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Catalogue } from "../../core/catalogue.mjs";
import { extractBill } from "../../core/bill-extract.mjs";
import { readFileSync } from "node:fs";

test("collect -> review -> versioned publish; rejected offers never publish", () => {
  const cat = new Catalogue(mkdtempSync(join(tmpdir(), "ots-cat-")));
  assert.equal(cat.current().version, 0);
  const base = { provider_id: "bt", name: "X", monthly_pence: 3000, contract_months: 24, source_url: "https://example.org/x", observed_at: "2026-10-01", collected_by: "manual" };
  cat.submit({ ...base, id: "keep" }); cat.submit({ ...base, id: "drop" });
  assert.equal(cat.pending().length, 2);
  cat.decide("keep", { reviewer: "ismail", reviewed_at: "2026-10-11", decision: "approved" });
  cat.decide("drop", { reviewer: "ismail", reviewed_at: "2026-10-11", decision: "rejected" });
  const v1 = cat.publish({ publisher: "test" });
  assert.equal(v1.version, 1); assert.deepEqual(v1.offers.map((o) => o.id), ["keep"]); assert.match(v1.sha256, /^[0-9a-f]{64}$/);
  assert.equal(cat.publish({ publisher: "test" }).version, 2);
  assert.equal(cat.current().version, 2);
  assert.throws(() => cat.submit({ ...base, id: "Bad ID" }));
});

test("bill extraction returns only literal fields with evidence", () => {
  const r = extractBill(readFileSync(new URL("../fixtures/bill.txt", import.meta.url), "utf8"));
  assert.equal(r.fields.provider, "Virgin Media");
  assert.equal(r.fields.monthly_pence, 3850);
  assert.equal(r.fields.exit_fee_pence, 9600);
  assert.equal(r.fields.bill_total_pence, 4125);
  assert.equal(r.fields.contract_end, "14 March 2027");
  assert.equal(r.fields.speed_mbps, 264);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(extractBill("hello").missing.length, 5);
});
