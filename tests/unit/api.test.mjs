import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, symlinkSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../server/app.mjs";

const ROOT = new URL("../..", import.meta.url).pathname;
const data = mkdtempSync(join(tmpdir(), "ots-data-")); symlinkSync(join(ROOT, "data", "postcodes"), join(data, "postcodes"));
const cat = mkdtempSync(join(tmpdir(), "ots-cat-")); cpSync(join(ROOT, "tests/fixtures/catalogue"), cat, { recursive: true });
const app = createApp({ dataDir: data, catalogueDir: cat });
const j = async (u, o) => { const r = await app.request(u, o); return { status: r.status, body: await r.json() }; };
const post = (b) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

test("health reports staged data", async () => { const r = await j("/api/health"); assert.equal(r.body.ok, true); assert.ok(r.body.postcodes.count > 0); assert.equal(r.body.bills, false); });
test("GET /api/location/postcode", async () => {
  const r = await j("/api/location/postcode?postcode=hu11aa"); assert.equal(r.status, 200); assert.equal(r.body.location.district_code, "E06000010");
  assert.equal((await j("/api/location/postcode?postcode=ZZ1%201ZZ")).status, 404);
  assert.equal((await j("/api/location/postcode?postcode=bad")).status, 400);
});
test("offers are area-filtered and carry the honest copy", async () => {
  const hu = await j("/api/offers?postcode=HU1%201AA"); assert.deepEqual(hu.body.offers.map((o) => o.id).sort(), ["fixture-fibre-a", "fixture-fibre-b"]);
  const sw = await j("/api/offers?postcode=SW1A%201AA"); assert.deepEqual(sw.body.offers.map((o) => o.id), ["fixture-fibre-a"]);
  assert.ok(sw.body.offers.every((o) => o.copy === "Published offer. Check availability with the provider."));
});
test("compare + session record (no address stored)", async () => {
  const body = { postcode: "HU1 1AA", start: "2026-10", offer_ids: ["fixture-fibre-a", "fixture-fibre-b"], quotes: [{ label: "My quote", monthly_pence: 2200, contract_months: 24 }], current: { monthly_pence: 2500, out_of_contract_monthly_pence: 4500, months_left: 0, exit_fee_pence: 0 } };
  const c = await j("/api/compare", post(body)); assert.equal(c.status, 200); assert.equal(c.body.results[0].id, "quote-1");
  const s = await j("/api/sessions", post(body)); assert.equal(s.status, 201); assert.equal(s.body.record.outward, "HU1");
  const g = await j(`/api/sessions/${s.body.id}`); assert.equal(g.body.results.length, 3); assert.ok(!JSON.stringify(g.body).includes("HU1 1AA"));
  assert.equal((await j("/api/compare", post({ start: "2026-10", offer_ids: ["not-published"] }))).status, 400);
});
test("handoff only for approved providers; bills disabled without Redis", async () => {
  assert.equal((await app.request("/api/handoff/bt")).status, 404);
  assert.equal((await app.request("/api/bills", { method: "POST" })).status, 503);
});
test("address normalisation is labelled unverified", async () => { const r = await j("/api/address/normalise", post({ line1: "10  downing st", town: "london", postcode: "sw1a2aa" })); assert.equal(r.body.verified, false); assert.equal(r.body.normalised.postcode, "SW1A 2AA"); assert.equal(r.body.normalised.town, "LONDON"); });
