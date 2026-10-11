// Saved comparisons, kept in this browser only (localStorage). We store the outward code (e.g. "HU1") and the
// numbers you entered, never your address or full postcode, so a saved comparison can be reopened offline.
const KEY = "ots-saved-v1";
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
export class SavedStore {
  constructor(storage) { this.s = storage ?? (typeof localStorage !== "undefined" ? localStorage : mem()); }
  list() { try { return JSON.parse(this.s.getItem(KEY) ?? "[]"); } catch { return []; } }
  _write(xs) { this.s.setItem(KEY, JSON.stringify(xs)); }
  /** @param res result of compare(); @param inputs the request ({start,horizon_months,current,offer_ids,quotes}) */
  save(res, inputs, { outward = null, catalogue_version = null } = {}) {
    const id = globalThis.crypto?.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`;
    const { postcode, ...safeInputs } = inputs ?? {};
    const rec = { id, created_at: new Date().toISOString(), outward, catalogue_version, engine_version: res.engine_version, horizon_months: res.horizon_months,
      inputs: safeInputs, stay: res.stay, results: res.results.map(({ schedule, provider, ...r }) => ({ ...r, provider_name: provider?.name ?? null })), stored: "this browser only" };
    this._write([rec, ...this.list()].slice(0, 50));
    return rec;
  }
  get(id) { return this.list().find((r) => r.id === id) ?? null; }
  remove(id) { this._write(this.list().filter((r) => r.id !== id)); }
  clear() { this.s.removeItem(KEY); }
}
