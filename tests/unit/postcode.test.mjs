import { test } from "node:test";
import assert from "node:assert/strict";
import { normalisePostcode } from "../../core/postcode.mjs";
import { caveatsFor } from "../../core/eligibility.mjs";
import { normaliseAddress } from "../../core/address.mjs";
test("normalises messy input", () => { assert.equal(normalisePostcode(" sw1a1aa "), "SW1A 1AA"); assert.equal(normalisePostcode("hu1-1aa"), "HU1 1AA"); assert.equal(normalisePostcode("nope"), null); });
test("notices: KCOM, NI, crown dependencies, social tariff, availability always", () => {
  const codes = (l) => caveatsFor(l).map((c) => c.code);
  assert.deepEqual(codes({ district_code: "E06000010", country: "England" }), ["availability", "kcom-area", "social-tariff"]);
  assert.deepEqual(codes({ district_code: "E09000033", country: "England" }), ["availability", "social-tariff"]);
  assert.deepEqual(codes({ country: "Northern Ireland" }), ["availability", "ni", "social-tariff"]);
  assert.deepEqual(codes({ country: "Jersey" }), ["availability", "crown-dependency"]);
  assert.deepEqual(codes(null), ["availability", "social-tariff"]);
});
test("manual address is tidied and never verified", () => { const r = normaliseAddress({ line1: "10  downing st", town: "london", postcode: "sw1a2aa" }); assert.equal(r.verified, false); assert.equal(r.normalised.postcode, "SW1A 2AA"); assert.equal(r.normalised.town, "LONDON"); assert.throws(() => normaliseAddress({ line1: "", town: "x", postcode: "bad" })); });
