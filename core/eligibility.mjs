// Caveats derived ONLY from facts we hold locally. We never claim a service is available at an address.
export const KCOM_DISTRICTS = new Set(["E06000010", "E06000011"]); // Kingston upon Hull; East Riding of Yorkshire

export function caveatsFor(loc) {
  const c = [{ code: "availability", text: "Published offers are not availability. Check availability at your exact address with the provider before deciding." }];
  if (!loc) return c;
  if (KCOM_DISTRICTS.has(loc.district_code)) c.push({ code: "kcom-area", text: "Hull and parts of East Yorkshire are mainly served by KCOM's own network. Many national providers that rely on Openreach may not be available here." });
  if (loc.country === "Northern Ireland") c.push({ code: "ni", text: "Northern Ireland uses a different network footprint; some GB offers may not apply." });
  if (loc.country === "Scotland" || loc.country === "Wales" || loc.country === "England") c.push({ code: "social-tariff", text: "If you get Universal Credit, Pension Credit or certain other benefits you may qualify for a social tariff. Ask providers directly." });
  return c;
}
