// Server mode: calls /api/* on the OTS server. Static mode (VITE_STATIC=1): same contract served by OTSStatic
// from static JSON + the local deterministic engine; session records stay in this browser (localStorage).
import { OTSStatic } from "../../core/static-client.mjs";
const STATIC = import.meta.env.VITE_STATIC === "1";
const client = STATIC ? new OTSStatic(new URL(import.meta.env.BASE_URL, location.origin).href) : null;
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };

async function staticApi(path, opts) {
  const u = new URL(path, location.origin); const body = opts.body ? JSON.parse(opts.body) : null;
  try {
    if (u.pathname === "/api/location/postcode") { const r = await client.location(u.searchParams.get("postcode")); return r.error ? fail(r.error, r.status) : r; }
    if (u.pathname === "/api/offers") { const r = await client.offers(u.searchParams.get("postcode")); return r.error ? fail(r.error, r.status) : r; }
    if (u.pathname === "/api/address/normalise") return client.normaliseAddress(body);
    if (u.pathname === "/api/compare") return await client.compare(body);
    if (u.pathname === "/api/sessions") { const res = await client.compare(body); const id = crypto.randomUUID(); const rec = { id, created_at: new Date().toISOString(), outward: res.request.postcode?.split(" ")[0] ?? null, engine_version: res.engine_version, results: res.results.map(({ schedule, ...r }) => r), stay: res.stay, stored: "this browser only" }; localStorage.setItem(`ots-session-${id}`, JSON.stringify(rec)); return { id, record: rec }; }
  } catch (e) { if (e.status) throw e; fail(e.issues ? e.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") : e.message); }
  fail("Not available in static mode", 404);
}

export async function api(path, opts = {}) {
  if (STATIC) return staticApi(path, opts);
  const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { body: j, status: r.status });
  return j;
}
export const toPence = (v) => { const m = String(v ?? "").trim().replace(/^£/, "").match(/^(\d+)(?:\.(\d{1,2}))?$/); return m ? Number(m[1]) * 100 + Number((m[2] || "0").padEnd(2, "0")) : NaN; };
export const fmt = (p) => (p < 0 ? "-£" : "£") + (Math.abs(p) / 100).toFixed(2);
