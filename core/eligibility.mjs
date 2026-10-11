// Notices derived ONLY from facts we hold locally. We never claim a service is available at an address.
export const KCOM_DISTRICTS = new Set(["E06000010", "E06000011"]); // Kingston upon Hull; East Riding of Yorkshire
export const NOTICE = {
  availability: "Published offers are not availability. Check availability at your exact address with the provider before deciding.",
  kcom: "Hull and parts of East Yorkshire are mainly served by KCOM's own network. Many national providers that rely on Openreach may not be available here.",
  ni: "Northern Ireland uses a different network footprint; some GB offers may not apply. Our postcode data covers Great Britain only, so we have not looked up this postcode.",
  crown: "Jersey, Guernsey and the Isle of Man have their own providers and regulators. UK offers and rules in our guides may not apply.",
  social: "If you get Universal Credit, Pension Credit or certain other benefits you may qualify for a social tariff. Ask providers directly.",
};
export function caveatsFor(loc) {
  const c = [{ code: "availability", text: NOTICE.availability }];
  if (!loc) { c.push({ code: "social-tariff", text: NOTICE.social }); return c; }
  if (KCOM_DISTRICTS.has(loc.district_code)) c.push({ code: "kcom-area", text: NOTICE.kcom });
  if (loc.country === "Northern Ireland") c.push({ code: "ni", text: NOTICE.ni });
  if (["Guernsey", "Jersey", "Isle of Man"].includes(loc.country)) c.push({ code: "crown-dependency", text: NOTICE.crown });
  else c.push({ code: "social-tariff", text: NOTICE.social });
  return c;
}
