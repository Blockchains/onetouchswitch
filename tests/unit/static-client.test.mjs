// The full engine against the BUILT static site (./site), via a fetch shim that reads files: proves no server is needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OTSStatic, OFFER_COPY, extractBill, monthsUntil, SavedStore, searchGuides } from "../../core/static-client.mjs";
const ROOT = new URL("../..", import.meta.url).pathname;
const SITE = join(ROOT, "site"), OVERLAY = join(ROOT, "tests/fixtures/overlay");
const requested = [];
globalThis.fetch = async (url) => { const u = new URL(url); requested.push(u.href); assert.equal(u.origin, "http://local.test", "only the site's own origin may be fetched");
  const p = u.pathname.replace(/^\/onetouchswitch\//, "");
  for (const root of globalThis.__overlay ? [OVERLAY, SITE] : [SITE]) { const f = join(root, p); if (existsSync(f)) return new Response(await readFile(f), { status: 200 }); }
  return new Response("nf", { status: 404 }); };
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const base = "http://local.test/onetouchswitch/";

test("site was built", () => assert.ok(existsSync(join(SITE, "api/v1/index.json")), "run npm run build first"));
test("postcode lookups from static chunks (England, Scotland, Wales, Hull) + not found + NI by format", async () => {
  const c = new OTSStatic(base);
  assert.equal((await c.location("SW1A 1AA")).location.district, "City of Westminster");
  assert.equal((await c.location("eh1 1yz")).location.country, "Scotland");
  assert.equal((await c.location("CF10 1EP")).location.country, "Wales");
  const hu = await c.location("HU1 1AA"); assert.equal(hu.location.district, "City of Kingston upon Hull"); assert.ok(hu.caveats.some((x) => x.code === "kcom-area"));
  assert.equal((await c.location("ZZ1 1ZZ")).status, 404);
  assert.equal((await c.location("bad")).status, 400);
  const ni = await c.location("BT1 1AA"); assert.equal(ni.location.country, "Northern Ireland"); assert.ok(ni.caveats.some((x) => x.code === "ni"));
});
test("production catalogue is empty -> honest empty state; no-postcode path works", async () => {
  const c = new OTSStatic(base);
  const r = await c.offers("HU1 1AA"); assert.equal(r.catalogue_version, 0); assert.deepEqual(r.offers, []); assert.match(r.empty_reason, /No reviewed offers/);
  const n = await c.offers(null); assert.equal(n.location, null); assert.deepEqual(n.offers, []);
  assert.deepEqual(await c.handoff(), []);
});
test("fixture catalogue: area filtering, copy, approved handoff only, edit-as-quote, comparison period", async () => {
  globalThis.__overlay = true; const c = new OTSStatic(base);
  try {
    assert.deepEqual((await c.offers("HU1 1AA")).offers.map((o) => o.id), ["fixture-fibre-a", "fixture-fibre-b"]);
    const sw = await c.offers("SW1A 1AA"); assert.deepEqual(sw.offers.map((o) => o.id), ["fixture-fibre-a"]); assert.ok(sw.offers.every((o) => o.copy === OFFER_COPY));
    const h = await c.handoff(); assert.deepEqual(h.map((x) => x.provider_id), ["bt"]);
    const res = await c.compare({ start: "2026-10", horizon_months: 36, offer_ids: ["fixture-fibre-a"], quotes: [{ label: "BT edited", provider_id: "bt", monthly_pence: 2800, contract_months: 24 }] });
    assert.equal(res.horizon_months, 36); assert.match(res.results[0].beyond_contract_note, /12 months/);
    assert.equal(res.results.find((r) => r.id === "quote-1").provider.handoff, "https://www.bt.com/broadband?ref=TEST-FIXTURE");
    const m = new OTSStatic(base).manualLocation({ line1: "1 a st", town: "hull", postcode: "HU1 9ZZ" }); assert.equal(m.location.area, "HU"); assert.equal(m.address.verified, false);
    assert.deepEqual((await c.offers(m)).offers.map((o) => o.id), ["fixture-fibre-a", "fixture-fibre-b"]);
  } finally { globalThis.__overlay = false; }
});
test("acceptance: £29.99 x 24 with £3 April rise from Oct 2026 = £791.76", async () => {
  const r = await new OTSStatic(base).compare({ start: "2026-10", quotes: [{ label: "Q", monthly_pence: 2999, contract_months: 24, annual_rise_pence: 300, rise_month: 4 }] });
  assert.equal(r.results[0].total, "£791.76");
});
test("guides index + search are static", async () => {
  const c = new OTSStatic(base); const all = await c.guides(); assert.ok(all.length >= 10);
  assert.equal((await c.searchGuides("exit fee"))[0].slug, "exit-fees");
  assert.equal((await c.searchGuides("hull"))[0].slug, "hull-kcom");
  assert.deepEqual(searchGuides(all, "zzzzqq"), []);
  assert.match((await c.guide("social-tariffs")).html, /Universal Credit/);
  assert.equal(await c.guide("../x"), null);
});
test("keep area offline fetches every outward file for the area", async () => { const r = await new OTSStatic(base).keepAreaOffline("hu"); assert.equal(r.area, "HU"); assert.ok(r.files >= 15); });
test("saved comparisons: outward only, no address or full postcode", async () => {
  const c = new OTSStatic(base, { storage: mem() });
  const req = { postcode: "HU1 1AA", start: "2026-10", quotes: [{ label: "Q", monthly_pence: 2000, contract_months: 12 }] };
  const rec = c.saved.save(await c.compare(req), req, { outward: "HU1" });
  const s = JSON.stringify(c.saved.list()); assert.ok(!s.includes("HU1 1AA")); assert.ok(!s.includes("schedule")); assert.equal(c.saved.get(rec.id).outward, "HU1");
  c.saved.remove(rec.id); assert.deepEqual(c.saved.list(), []);
});
test("bill text extraction (client-side) + months until contract end", () => {
  const r = extractBill("Virgin Media\nmonthly charge £38.50\nYour minimum term ends on 14 March 2027\nEarly termination charge: £96.00");
  assert.equal(r.fields.monthly_pence, 3850); assert.equal(r.fields.exit_fee_pence, 9600);
  assert.equal(monthsUntil("14 March 2027", new Date(Date.UTC(2026, 9, 11))), 5);
  assert.equal(monthsUntil("14/03/2027", new Date(Date.UTC(2026, 9, 11))), 5);
  assert.equal(monthsUntil("garbage"), null);
});
test("every request stayed on the site's own origin", () => { assert.ok(requested.length > 0); assert.ok(requested.every((u) => u.startsWith(base))); });
