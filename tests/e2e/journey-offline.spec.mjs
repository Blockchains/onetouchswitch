// Load once from a Pages-like static server, then KILL the server and set the browser offline.
// Prove: postcode lookup, manual address, costing, guides + search, results from the local catalogue, saved comparisons.
import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { guardOrigin, findArea, addQuote } from "./helpers.mjs";
const PORT = 8796, ORIGIN = `http://127.0.0.1:${PORT}`, URL0 = `${ORIGIN}/onetouchswitch/`;

test("works with no network after the first load", async ({ page, context }) => {
  const srv = spawn(process.execPath, ["scripts/static-server.mjs", String(PORT), "tests/fixtures/overlay"], { stdio: "pipe" });
  await new Promise((ok, no) => { srv.stdout.on("data", (d) => String(d).includes("static on") && ok()); srv.on("exit", no); });
  const done = guardOrigin(page, ORIGIN);
  try {
    await page.goto(URL0);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await findArea(page, "HU1 1AA");
    await expect(page.getByTestId("area")).toContainText("City of Kingston upon Hull");
    await page.getByRole("button", { name: "Keep HU postcodes on this device" }).click();
    await expect(page.getByTestId("offline-area")).toContainText("postcode files for HU are kept on this device");
    await page.goto(URL0 + "#/guides"); await expect(page.getByTestId("guide-list")).toBeVisible();
  } finally { srv.kill("SIGKILL"); }
  await new Promise((r) => srv.on("exit", r));
  await context.setOffline(true);
  expect(await fetch(URL0).then(() => "up", () => "down")).toBe("down");

  await page.goto(URL0);
  await expect(page.getByTestId("net")).toContainText("Offline");
  // postcode lookups from cached static chunks (HU1 looked up before; HU5 only via "keep HU on this device")
  await findArea(page, "HU5 1AA");
  await expect(page.getByTestId("area")).toContainText("Kingston upon Hull");
  await expect(page.locator('[data-caveat="kcom-area"]')).toBeVisible();
  // results from the local catalogue (cached), with the honest copy
  await expect(page.getByTestId("offers").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("offers")).toContainText("Published offer. Check availability with the provider.");
  await page.getByTestId("offers").getByRole("checkbox").first().check();
  // costing
  await addQuote(page, { label: "Offline quote", monthly: "29.99", months: "24", rise: "3" });
  await page.getByRole("button", { name: "Compare total cost" }).click();
  await expect(page.getByTestId("results")).toContainText("£791.76");
  await expect(page.getByTestId("results")).toContainText("£792.00");
  // persistence
  await page.getByRole("button", { name: "Save this comparison" }).click();
  await expect(page.getByTestId("session")).toBeVisible();
  // manual address for a postcode whose data isn't on this device
  await page.reload();
  await findArea(page, "SW1A 1AA");
  await expect(page.getByRole("alert")).toContainText(/couldn't load postcode data|could not find/);
  const mf = page.getByTestId("manual-fallback");
  await mf.getByLabel("Address line 1").fill("10 downing st"); await mf.getByLabel("Town").fill("london"); await mf.getByLabel("Postcode").fill("SW1A 2AA");
  await mf.getByRole("button", { name: "Continue with this address" }).click();
  await expect(page.getByTestId("address-result")).toContainText("10 Downing St, LONDON, SW1A 2AA");
  await expect(page.getByTestId("offers").locator("li")).toHaveCount(1); // area-limited HU offer filtered out
  // guides + search offline
  await page.goto(URL0 + "#/guides");
  await page.getByLabel("Search guides").fill("social tariff");
  await page.getByTestId("guide-list").getByRole("link").first().click();
  await expect(page.getByTestId("guide")).toContainText("Universal Credit");
  // saved comparison survives reload offline
  await page.goto(URL0 + "#/saved");
  await expect(page.getByTestId("saved-list")).toContainText("HU5");
  await page.getByTestId("saved-list").getByRole("button", { name: "Open" }).click();
  await expect(page.getByTestId("saved-open")).toContainText("£791.76");
  done();
});
