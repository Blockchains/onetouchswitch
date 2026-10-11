// The whole One Touch Switch comparison engine as a browser module. Needs ONLY static files from the same base
// (GitHub Pages, touch.grok.me or any static host): no server, no database, no third-party API, no keys.
//   postcode  -> {base}/api/v1/postcode/<OUTWARD>.json   (OS Code-Point Open, chunked per outward code)
//   offers    -> {base}/api/v1/catalogue/current.json    (reviewed, versioned; version 0 = nothing published)
//   providers -> {base}/api/v1/providers.json + {base}/api/v1/handoff.json (approved links only; empty = plain links)
//   guides    -> {base}/api/v1/guides/index.json + /api/v1/guides/<slug>.json
//   compare   -> deterministic engine in this bundle (dinero.js integer pence, zod validation)
//   bills     -> pdf.js self-hosted at {base}/vendor/pdfjs/, parsed on this device; never uploaded
//   saved     -> localStorage on this device (outward code only)
import { normalisePostcode, outwardOf, areaOf, COUNTRY, NON_GB_AREAS } from "./postcode.mjs";
import { caveatsFor, NOTICE } from "./eligibility.mjs";
import { normaliseAddress, basicNormalise, ManualAddress, ADDRESS_NOTE } from "./address.mjs";
import { runCompare, offersForArea, CompareReq, Quote } from "./compare-request.mjs";
import { OFFER_COPY, QUOTE_COPY, LINK_TEXT } from "./copy.mjs";
import { extractBill } from "./bill-extract.mjs";
import { readBillFile, monthsUntil, BILL_PRIVACY, OCR_DEFERRED } from "./bill-pdf.mjs";
import { SavedStore } from "./saved.mjs";
import { searchGuides } from "./guides.mjs";
export { OFFER_COPY, QUOTE_COPY, LINK_TEXT, NOTICE, ADDRESS_NOTE, BILL_PRIVACY, OCR_DEFERRED, normalisePostcode, outwardOf, caveatsFor, extractBill, monthsUntil, searchGuides, basicNormalise, ManualAddress, CompareReq, Quote, SavedStore };
export const ENGINE_VERSION = "ots-static-2";
export const UNAVAILABLE = "Live comparison is unavailable right now. Please try again shortly.";

export class OTSStatic {
  constructor(base, { storage, timeoutMs = 8000 } = {}) { this.base = String(base).replace(/\/$/, ""); this._c = new Map(); this.saved = new SavedStore(storage); this.timeoutMs = timeoutMs; }
  async get(path) {
    if (!this._c.has(path)) {
      const p = fetch(`${this.base}${path}`, { signal: AbortSignal.timeout(this.timeoutMs) }).then(async (r) => { if (r.status === 404) return null; if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`); return r.json(); });
      p.catch(() => this._c.delete(path)); this._c.set(path, p);
    }
    return this._c.get(path);
  }
  async index() { return this.get("/api/v1/index.json"); }
  async providers() { const [d, h] = await Promise.all([this.get("/api/v1/providers.json"), this.handoff()]); const ok = new Map(h.map((x) => [x.provider_id, x])); return d.providers.map((p) => ({ ...p, handoff: ok.get(p.id)?.url ?? null, handoff_disclosure: ok.get(p.id)?.disclosure ?? null })); }
  /** Approved handoff links only (config/handoff.json). Empty list = plain informational links; never an order. */
  async handoff() { const d = await this.get("/api/v1/handoff.json"); return (d?.approved ?? []).filter((x) => /^https:\/\//.test(x.url ?? "") && x.provider_id && x.approved_by && x.approved_at); }
  async providerView() { const list = await this.providers(); const m = new Map(list.map((p) => [p.id, p])); return (id) => m.get(id) ?? null; }

  async location(raw) {
    const pc = normalisePostcode(raw); if (!pc) return { error: "Enter a full UK postcode, e.g. SW1A 1AA", status: 400 };
    const area = areaOf(pc);
    if (NON_GB_AREAS[area]) { const location = { postcode: pc, outward: outwardOf(pc), area, country: NON_GB_AREAS[area], district: null, ward: null, source: "postcode format only (not in OS Code-Point Open)", data_version: null, partial: true }; return { location, caveats: caveatsFor(location) }; }
    const f = await this.get(`/api/v1/postcode/${outwardOf(pc)}.json`);
    const r = f?.rows.find((x) => x[0] === pc);
    if (!r) return { error: `We could not find ${pc} in our local postcode data. Check it, or enter your address manually.`, status: 404, postcode: pc, caveats: caveatsFor(null) };
    const [postcode, country_code, district_code, ward_code] = r;
    const location = { postcode, outward: outwardOf(pc), area, country_code, country: COUNTRY[country_code] ?? null, district_code, district: f.names[district_code] ?? null, ward_code, ward: f.names[ward_code] ?? null, source: "OS Code-Point Open", data_version: f.data_version };
    return { location, caveats: caveatsFor(location) };
  }
  /** Location from a manually typed address (used when the postcode is not in our data). Never verified. */
  manualLocation(addr) {
    const a = normaliseAddress(addr), pc = a.normalised.postcode, area = areaOf(pc);
    const location = { postcode: pc, outward: outwardOf(pc), area, country: NON_GB_AREAS[area] ?? null, district: null, ward: null, source: "address you typed (not verified)", partial: true };
    return { location, caveats: caveatsFor(location), address: a };
  }
  async catalogue() { return (await this.get("/api/v1/catalogue/current.json")) ?? { version: 0, published_at: null, offers: [] }; }
  /** @param where postcode string, a location object, or null (no area: only offers without area limits) */
  async offers(where) {
    let l = { location: null, caveats: caveatsFor(null) };
    if (typeof where === "string") { l = await this.location(where); if (l.error) return l; } else if (where?.location) l = where;
    const [doc, pv] = await Promise.all([this.catalogue(), this.providerView()]);
    const list = l.location ? offersForArea(doc, l.location.area) : doc.offers.filter((o) => !o.regions?.areas?.length);
    const offers = list.map((o) => ({ ...o, provider: pv(o.provider_id), copy: OFFER_COPY }));
    return { ...l, catalogue_version: doc.version, published_at: doc.published_at, offers, empty_reason: offers.length ? null : doc.version === 0 ? "No reviewed offers have been published yet. You can still compare quotes you've been given." : "No published offers match this area. You can still compare quotes you've been given." };
  }
  async compare(body) { const [doc, pv] = await Promise.all([this.catalogue(), this.providerView()]); return runCompare(body, doc, pv); }
  normaliseAddress(a) { return normaliseAddress(a); }

  async guides() { return (await this.get("/api/v1/guides/index.json"))?.guides ?? []; }
  async guide(slug) { if (!/^[a-z0-9-]+$/.test(slug)) return null; return this.get(`/api/v1/guides/${slug}.json`); }
  async searchGuides(q) { return searchGuides(await this.guides(), q); }

  extractBillText(text) { return extractBill(text); }
  async readBill(file) { return readBillFile(this.base, file); }

  /** Pre-fetch every outward-code file for a postcode area (e.g. "HU") so lookups there work offline. */
  async keepAreaOffline(area) {
    const idx = await this.get("/api/v1/postcode/areas.json"); const outs = idx?.areas?.[String(area).toUpperCase()] ?? [];
    let done = 0; for (let i = 0; i < outs.length; i += 8) { await Promise.all(outs.slice(i, i + 8).map((o) => this.get(`/api/v1/postcode/${o}.json`).then(() => done++))); }
    return { area: String(area).toUpperCase(), files: done };
  }
}
