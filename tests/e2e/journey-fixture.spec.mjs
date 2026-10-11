// Same static build with a TEST FIXTURE catalogue + handoff overlay (never deployed).
import { test, expect } from "@playwright/test";
import { guardOrigin, findArea, addQuote } from "./helpers.mjs";

test("published offers -> select + edit costs -> results ranked -> approved handoff link only", async ({ page }) => {
  const done = guardOrigin(page, "http://127.0.0.1:8798");
  await page.goto("/onetouchswitch/");
  await findArea(page, "HU1 1AA");
  const offers = page.getByTestId("offers");
  await expect(offers.locator("li")).toHaveCount(2);
  await expect(offers).toContainText("Published offer. Check availability with the provider.");
  await page.getByLabel("Monthly price now (£)").fill("25.00"); await page.getByLabel("Price after contract ends (£)").fill("45.00");
  for (const cb of await offers.getByRole("checkbox").all()) await cb.check();
  await addQuote(page, { label: "Quote from a shop", monthly: "22" });
  await offers.getByRole("button", { name: "Edit costs" }).first().click();
  await expect(page.getByLabel("Provider / deal")).toHaveValue(/TEST FIXTURE Fibre A \(my costs\)/);
  await page.getByLabel("Monthly (£)").fill("28.00"); await page.getByRole("button", { name: "Save costs" }).click();
  await page.getByRole("button", { name: "Compare total cost" }).click();
  const rows = page.getByTestId("results").locator("tr[data-row]");
  await expect(rows).toHaveCount(4);
  // 24 months: shop quote £528.00; fixture B 25*24+29.99 = £629.99; my-costs A 6x28+12x31+6x34 = £744.00; fixture A £792.00
  await expect(rows.nth(0)).toContainText("£528.00"); await expect(rows.nth(1)).toContainText("£629.99");
  await expect(rows.nth(2)).toContainText("£744.00"); await expect(rows.nth(3)).toContainText("£792.00");
  await expect(page.getByTestId("results")).toContainText("not deducted");
  await expect(page.getByTestId("stay")).toContainText("£1080.00");
  const bt = page.getByTestId("results").getByRole("link", { name: "Check availability with BT" }).first();
  await expect(bt).toHaveAttribute("href", "https://www.bt.com/broadband?ref=TEST-FIXTURE");
  await expect(page.getByTestId("results")).toContainText("TEST FIXTURE: we may be paid");
  const kcom = page.getByTestId("results").getByRole("link", { name: "Check availability with KCOM" });
  await expect(kcom).toHaveAttribute("href", /kcom\.com/); // insecure/unapproved handoff entries are ignored
  await expect(page.locator("body")).not.toContainText(/order now|buy now|switch now|available at your address/i);
  await page.getByRole("button", { name: "Save this comparison" }).click();
  await expect(page.getByTestId("session")).toBeVisible();
  done();
});
