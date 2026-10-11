// Manual address entry. libpostal (optional, self-hosted) is used for NORMALISATION ONLY, never as proof an address exists.
import { z } from "zod";
import { normalisePostcode } from "./postcode.mjs";

export const ManualAddress = z.object({
  line1: z.string().trim().min(1).max(120),
  line2: z.string().trim().max(120).optional().default(""),
  town: z.string().trim().min(1).max(80),
  postcode: z.string().trim().min(5).max(10),
});

export function basicNormalise(a) {
  const tidy = (s) => s.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
  const title = (s) => tidy(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
  return { line1: title(a.line1), line2: a.line2 ? title(a.line2) : "", town: tidy(a.town).toUpperCase(), postcode: normalisePostcode(a.postcode) };
}

/** pelias/libpostal-service: GET {base}/parse?address=... -> [{label,value}] */
export async function libpostalParse(base, text, fetchImpl = fetch) {
  const r = await fetchImpl(`${base.replace(/\/$/, "")}/parse?address=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`libpostal ${r.status}`);
  return Object.fromEntries((await r.json()).map((x) => [x.label, x.value]));
}

export async function normaliseAddress(input, { libpostalUrl, fetchImpl } = {}) {
  const a = ManualAddress.parse(input);
  const base = basicNormalise(a);
  let parsed = null, engine = "basic";
  if (libpostalUrl) { try { parsed = await libpostalParse(libpostalUrl, [a.line1, a.line2, a.town, a.postcode].filter(Boolean).join(", "), fetchImpl); engine = "libpostal"; } catch { engine = "basic (libpostal unreachable)"; } }
  return { normalised: base, components: parsed, engine, verified: false, note: "Address normalised for display and matching only. It is not verified. The provider confirms the address and availability." };
}
