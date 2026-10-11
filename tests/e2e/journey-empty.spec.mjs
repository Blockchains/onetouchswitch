import { test, expect } from "@playwright/test";
test("production default: nothing published -> honest empty state, quotes still compare", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your postcode").fill("EH1 1YZ");
  await page.getByRole("button", { name: "Find my area" }).click();
  await expect(page.getByTestId("area")).toContainText("Scotland");
  await expect(page.getByTestId("no-offers")).toContainText("No reviewed offers have been published yet");
  await page.getByLabel("Provider / deal").fill("Quote A"); await page.getByLabel("Monthly (£)").fill("30"); await page.getByRole("button", { name: "Add quote" }).click();
  await page.getByLabel("Provider / deal").fill("Quote B"); await page.getByLabel("Monthly (£)").fill("27.50"); await page.getByLabel("Upfront (£)").fill("50"); await page.getByRole("button", { name: "Add quote" }).click();
  await page.getByRole("button", { name: "Compare total cost" }).click();
  const rows = page.getByTestId("results").locator("tbody tr");
  await expect(rows.nth(0)).toContainText("Quote B"); await expect(rows.nth(0)).toContainText("£710.00");
  await expect(rows.nth(1)).toContainText("£720.00");
  await expect(page.locator("body")).not.toContainText(/order now|buy now|available at your address/i);
  await page.getByLabel("Your postcode").fill("ZZ1 1ZZ"); await page.getByRole("button", { name: "Find my area" }).click();
  await expect(page.getByRole("alert")).toContainText("could not find ZZ1 1ZZ");
});
