// UK postcode handling. Static-first: OS Code-Point Open (GB) is pre-chunked into one JSON file per outward code
// and served as static files (GitHub Pages). No postcode API is ever called at runtime.
export function normalisePostcode(input) {
  const s = String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = s.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  return m ? `${m[1]} ${m[2]}` : null;
}
export const isValidFormat = (pc) => /^([A-Z]{1,2}\d[A-Z\d]?) (\d[A-Z]{2})$/.test(pc ?? "");
export const areaOf = (pc) => pc.match(/^[A-Z]+/)[0];
export const outwardOf = (pc) => pc.split(" ")[0];
export const COUNTRY = { E92000001: "England", S92000003: "Scotland", W92000004: "Wales", N92000002: "Northern Ireland" };
/** Areas that OS Code-Point Open (GB) does not cover. We infer the territory from the postcode format only. */
export const NON_GB_AREAS = { BT: "Northern Ireland", GY: "Guernsey", JE: "Jersey", IM: "Isle of Man" };
