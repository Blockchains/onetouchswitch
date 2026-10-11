// Browser/edge client for the STATIC build (GitHub Pages or any static host). Same answers as the server, no backend:
// postcode -> /api/v1/postcode/<OUTWARD>.json, offers -> /api/v1/catalogue/current.json, compare -> local deterministic engine.
import { normalisePostcode, outwardOf, areaOf, COUNTRY } from "./postcode.mjs";
import { caveatsFor } from "./eligibility.mjs";
import { basicNormalise, ManualAddress } from "./address.mjs";
import { runCompare, offersForArea } from "./compare-request.mjs";
import { OFFER_COPY } from "./copy.mjs";
export { OFFER_COPY, normalisePostcode, caveatsFor };

export class OTSStatic {
  constructor(base) { this.base = base.replace(/\/$/, ""); this._c = new Map(); }
  async get(path) { if (!this._c.has(path)) this._c.set(path, fetch(`${this.base}${path}`, { signal: AbortSignal.timeout(8000) }).then(async (r) => { if (r.status === 404) return null; if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`); return r.json(); })); return this._c.get(path); }
  async providers() { const d = await this.get("/api/v1/providers.json"); return d.providers; }
  async providerView() { const list = await this.providers(); const m = new Map(list.map((p) => [p.id, p])); return (id) => m.get(id) ?? null; }
  async location(raw) {
    const pc = normalisePostcode(raw); if (!pc) return { error: "Enter a full UK postcode, e.g. SW1A 1AA", status: 400 };
    const f = await this.get(`/api/v1/postcode/${outwardOf(pc)}.json`);
    const r = f?.rows.find((x) => x[0] === pc);
    if (!r) return { error: `We could not find ${pc} in our local postcode data. Check it, or enter your address manually.`, status: 404, postcode: pc };
    const [postcode, country_code, district_code, ward_code] = r;
    const location = { postcode, outward: outwardOf(pc), area: areaOf(pc), country_code, country: COUNTRY[country_code] ?? null, district_code, district: f.names[district_code] ?? null, ward_code, ward: f.names[ward_code] ?? null, source: "OS Code-Point Open (local)", data_version: f.data_version };
    return { location, caveats: caveatsFor(location) };
  }
  async offers(raw) {
    const l = await this.location(raw); if (l.error) return l;
    const [doc, pv] = await Promise.all([this.get("/api/v1/catalogue/current.json"), this.providerView()]);
    const offers = offersForArea(doc, l.location.area).map((o) => ({ ...o, provider: pv(o.provider_id), copy: OFFER_COPY }));
    return { ...l, catalogue_version: doc.version, published_at: doc.published_at, offers, empty_reason: offers.length ? null : doc.version === 0 ? "No reviewed offers have been published yet. You can still compare quotes you've been given." : "No published offers match this area. You can still compare quotes you've been given." };
  }
  async compare(body) { const [doc, pv] = await Promise.all([this.get("/api/v1/catalogue/current.json"), this.providerView()]); return runCompare(body, doc, pv); }
  normaliseAddress(a) { return { normalised: basicNormalise(ManualAddress.parse(a)), engine: "basic", verified: false, note: "Address normalised for display and matching only. It is not verified. The provider confirms the address and availability." }; }
}
