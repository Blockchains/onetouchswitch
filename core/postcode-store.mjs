// Node-only: local OS Code-Point Open index reader.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { areaOf, outwardOf, COUNTRY } from "./postcode.mjs";

export class PostcodeStore {
  constructor(dir) { this.dir = dir; this.cache = new Map(); this.meta = existsSync(join(dir, "meta.json")) ? JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) : null; this.names = existsSync(join(dir, "names.json")) ? JSON.parse(readFileSync(join(dir, "names.json"), "utf8")) : {}; }
  get staged() { return !!this.meta; }
  area(a) {
    if (this.cache.has(a)) return this.cache.get(a);
    const f = join(this.dir, `${a.toLowerCase()}.json`);
    const v = existsSync(f) ? new Map(JSON.parse(readFileSync(f, "utf8")).rows.map((r) => [r[0], r])) : null;
    this.cache.set(a, v); return v;
  }
  lookup(pc) {
    const rows = this.area(areaOf(pc)); if (!rows) return null;
    const r = rows.get(pc); if (!r) return null;
    const [postcode, quality, eastings, northings, country, district, ward, county] = r;
    return { postcode, outward: outwardOf(postcode), area: areaOf(postcode), country_code: country, country: COUNTRY[country] ?? null, district_code: district, district: this.names[district] ?? null, ward_code: ward || null, ward: this.names[ward] ?? null, county_code: county || null, county: county ? this.names[county] ?? null : null, eastings, northings, positional_quality: quality, source: "OS Code-Point Open (local)", data_version: this.meta.version };
  }
}
