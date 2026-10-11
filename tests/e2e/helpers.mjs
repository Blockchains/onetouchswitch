import { expect } from "@playwright/test";
/** Records every request; the test fails if anything leaves the page's own origin (zero external runtime deps).
 *  Also fails on any console error or uncaught page error on the flow (pass allow=[regex] for expected offline errors). */
export function guardOrigin(page, origin, { allow = [] } = {}) {
  const external = [], errors = [];
  page.context().on("request", (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u); });
  page.on("console", (m) => { if (m.type() === "error" && !allow.some((rx) => rx.test(m.text()))) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return () => { expect(external, "requests to other origins").toEqual([]); expect(errors, "console errors").toEqual([]); };
}
export async function findArea(page, pc) { await page.getByLabel("Your postcode").fill(pc); await page.getByRole("button", { name: "Find my area" }).click(); }
export async function addQuote(page, { label, monthly, upfront, months, rise }) {
  await page.getByLabel("Provider / deal").fill(label); await page.getByLabel("Monthly (£)").fill(monthly);
  if (upfront) await page.getByLabel("Upfront (£)").fill(upfront);
  if (months) await page.getByLabel("Contract months").selectOption(months);
  if (rise) await page.getByLabel("April rise (£/month)").fill(rise);
  await page.getByRole("button", { name: "Add quote" }).click();
}
