// UK postcode handling. Local-first: OS Code-Point Open index staged in data/postcodes (GB).
// Optional: a SELF-HOSTED postcodes.io (POSTCODES_IO_URL) for NI / richer fields. Never calls the public postcodes.io at request time.

const RX = /^([A-Z]{1,2}\d[A-Z\d]?) ?(\d[A-Z]{2})$/;
export function normalisePostcode(input) {
  const s = String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = s.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  return m ? `${m[1]} ${m[2]}` : null;
}
export const isValidFormat = (pc) => RX.test(pc ?? "");
export const areaOf = (pc) => pc.match(/^[A-Z]+/)[0];
export const outwardOf = (pc) => pc.split(" ")[0];

export const COUNTRY = { E92000001: "England", S92000003: "Scotland", W92000004: "Wales", N92000002: "Northern Ireland" };

/** Self-hosted postcodes.io adapter (GET {base}/postcodes/{pc}). */
export async function lookupPostcodesIo(base, pc, fetchImpl = fetch) {
  const r = await fetchImpl(`${base.replace(/\/$/, "")}/postcodes/${encodeURIComponent(pc)}`, { signal: AbortSignal.timeout(4000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`postcodes.io ${r.status}`);
  const j = (await r.json()).result;
  return { postcode: j.postcode, outward: j.outcode, area: areaOf(j.postcode), country: j.country, district_code: j.codes?.admin_district ?? null, district: j.admin_district ?? null, ward_code: j.codes?.admin_ward ?? null, ward: j.admin_ward ?? null, county: j.admin_county ?? null, latitude: j.latitude, longitude: j.longitude, source: "postcodes.io (self-hosted)" };
}
