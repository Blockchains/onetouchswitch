import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { normalisePostcode } from "../../core/postcode.mjs";
import { PostcodeStore } from "../../core/postcode-store.mjs";
import { caveatsFor } from "../../core/eligibility.mjs";
const store = new PostcodeStore(join(new URL("../..", import.meta.url).pathname, "data", "postcodes"));

test("normalises messy input", () => { assert.equal(normalisePostcode(" sw1a1aa "), "SW1A 1AA"); assert.equal(normalisePostcode("hu1-1aa"), "HU1 1AA"); assert.equal(normalisePostcode("nope"), null); });
test("staged OS Code-Point Open data is present", () => { assert.ok(store.staged, "run npm run stage first"); assert.ok(store.meta.postcodes > 1_000_000 || store.meta.partial); });
test("real postcodes resolve from local data (England, Scotland, Wales)", () => {
  assert.equal(store.lookup("SW1A 1AA").district, "City of Westminster");
  assert.equal(store.lookup("EH1 1YZ").country, "Scotland");
  assert.equal(store.lookup("CF10 1EP").country, "Wales");
  assert.equal(store.lookup("ZZ1 1ZZ"), null);
});
test("KCOM caveat for Hull, not for Westminster", () => {
  assert.ok(caveatsFor(store.lookup("HU1 1AA")).some((c) => c.code === "kcom-area"));
  assert.ok(!caveatsFor(store.lookup("SW1A 1AA")).some((c) => c.code === "kcom-area"));
  assert.ok(caveatsFor(null).some((c) => c.code === "availability"));
});
