import { test, expect } from "@playwright/test";
test("static build (GitHub Pages mode): local postcode files + in-browser engine", async ({ page }) => {
  await page.goto("/onetouchswitch/");
  await page.getByLabel("Your postcode").fill("cf10 1ep");
  await page.getByRole("button", { name: "Find my area" }).click();
  await expect(page.getByTestId("area")).toContainText("Wales");
  await expect(page.getByTestId("no-offers")).toBeVisible();
  await page.getByLabel("Provider / deal").fill("Quote A"); await page.getByLabel("Monthly (£)").fill("30"); await page.getByRole("button", { name: "Add quote" }).click();
  await page.getByRole("button", { name: "Compare total cost" }).click();
  await expect(page.getByTestId("results").locator("tbody tr").nth(0)).toContainText("£720.00");
  await page.getByRole("button", { name: "Save this comparison" }).click();
  await expect(page.getByTestId("session")).toContainText(/[0-9a-f-]{36}/);
});
test("engine bundle importable by touch.grok.me", async ({ page }) => {
  await page.goto("/onetouchswitch/");
  const r = await page.evaluate(async () => { const m = await import("/onetouchswitch/engine/v1/ots-engine.mjs"); const c = new m.OTSStatic(location.origin + "/onetouchswitch/"); const l = await c.location("HU1 1AA"); const cmp = await c.compare({ start: "2026-10", quotes: [{ label: "Q", monthly_pence: 2000, contract_months: 12 }] }); return { d: l.location.district, kcom: l.caveats.some((x) => x.code === "kcom-area"), total: cmp.results[0].total, copy: m.OFFER_COPY }; });
  expect(r).toEqual({ d: "City of Kingston upon Hull", kcom: true, total: "£240.00", copy: "Published offer. Check availability with the provider." });
});
