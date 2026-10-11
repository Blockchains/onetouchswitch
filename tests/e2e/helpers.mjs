import { expect } from "@playwright/test";
/** Records every request; the test fails if anything leaves the page's own origin (zero external runtime deps). */
export function guardOrigin(page, origin) {
  const external = [];
  page.context().on("request", (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u); });
  return () => expect(external, "requests to other origins").toEqual([]);
}
export async function findArea(page, pc) { await page.getByLabel("Your postcode").fill(pc); await page.getByRole("button", { name: "Find my area" }).click(); }
export async function addQuote(page, { label, monthly, upfront, months, rise }) {
  await page.getByLabel("Provider / deal").fill(label); await page.getByLabel("Monthly (£)").fill(monthly);
  if (upfront) await page.getByLabel("Upfront (£)").fill(upfront);
  if (months) await page.getByLabel("Contract months").selectOption(months);
  if (rise) await page.getByLabel("April rise (£/month)").fill(rise);
  await page.getByRole("button", { name: "Add quote" }).click();
}
