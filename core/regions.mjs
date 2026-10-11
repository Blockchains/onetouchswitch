// Pure (browser-safe) region filter for catalogue offers: postcode area (e.g. "HU") and outward code (e.g. "HU1").
export function offerMatches(o, area, outward) {
  const r = o.regions ?? {};
  if (r.areas?.length && !r.areas.includes(area)) return false;
  if ((r.exclude_areas ?? []).includes(area)) return false;
  if (r.outwards?.length && !r.outwards.includes(outward)) return false;
  if (outward && (r.exclude_outwards ?? []).includes(outward)) return false;
  return true;
}
