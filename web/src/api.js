// The app talks ONLY to static files on its own origin (GitHub Pages or any static host) through the bundled engine.
import { OTSStatic, UNAVAILABLE } from "../../core/static-client.mjs";
export const BASE = new URL(import.meta.env.BASE_URL, location.origin).href;
export const ots = new OTSStatic(BASE);
export { UNAVAILABLE };
export const toPence = (v) => { const m = String(v ?? "").trim().replace(/^£/, "").match(/^(\d+)(?:\.(\d{1,2}))?$/); return m ? Number(m[1]) * 100 + Number((m[2] || "0").padEnd(2, "0")) : NaN; };
export const poundsOf = (p) => (p == null ? "" : (p / 100).toFixed(2));
export const fmt = (p) => (p < 0 ? "-£" : "£") + (Math.abs(p) / 100).toFixed(2);
export const moneyErr = (v, required = false) => (!String(v ?? "").trim() ? (required ? "Required" : undefined) : Number.isNaN(toPence(v)) ? "Use pounds and pence, e.g. 29.99" : undefined);
export const errMsg = (e) => (e?.issues ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : e?.message ?? String(e));
