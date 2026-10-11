// Live site: real postcode lookup -> only real, priced, re-verified offers -> costing. No console errors, no third-party requests.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { guardOrigin, findArea } from "../e2e/helpers.mjs";
const BASE = process.env.LIVE_URL ?? "https://blockchains.github.io/onetouchswitch/";
const ORIGIN = new URL(BASE).origin;
const pub = JSON.parse(readFileSync(new URL("../../catalogue/published/current.json", import.meta.url)));
const doc = JSON.parse(readFileSync(new URL(`../../catalogue/published/v${pub.version}.json`, import.meta.url)));

test("live API: catalogue is the committed version, every offer priced with an https source; postcode chunks answer HU1 1AA + SW1A 1AA", async ({ request }) => {
  const cur = await (await request.get(`${BASE}api/v1/catalogue/current.json`)).json();
  expect(cur.version).toBe(doc.version); expect(cur.offers.length).toBe(doc.offers.length);
  for (const o of cur.offers) { expect(o.monthly_pence, o.id).not.toBeNull(); expect(o.source_url).toMatch(/^https:\/\//); expect(o.reviewed_by).toBeTruthy(); }
  for (const [out, pc, district] of [["HU1", "HU1 1AA", "City of Kingston upon Hull"], ["SW1A", "SW1A 1AA", "City of Westminster"]]) {
    const f = await (await request.get(`${BASE}api/v1/postcode/${out}.json`)).json();
    const r = f.rows.find((x) => x[0] === pc); expect(r, pc).toBeTruthy(); expect(f.names[r[2]]).toBe(district);
  }
  for (let v = 1; v < doc.version; v++) expect((await request.get(`${BASE}api/v1/catalogue/v${v}.json`)).status(), `superseded v${v} not served`).toBe(404);
});

test("live journey: HU1 1AA and SW1A 1AA -> real offers -> compare; NI format notice; unknown postcode -> manual address", async ({ page }) => {
  const done = guardOrigin(page, ORIGIN);
  const bad = []; page.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE);
  await findArea(page, "HU1 1AA");
  await expect(page.getByTestId("area")).toContainText("City of Kingston upon Hull");
  await expect(page.locator('[data-caveat="kcom-area"]')).toBeVisible();
  const offers = page.getByTestId("offers");
  await expect(offers.locator("li[data-offer=kcom-power-fibre-100-hull]")).toBeVisible();
  await expect(page.getByTestId("catalogue-meta")).toContainText(`Catalogue v${doc.version}`);
  for (const li of await offers.locator("li").all()) await expect(li).toContainText(/£\d+\.\d{2}\/month/);
  await expect(offers.locator("input:disabled, button:disabled")).toHaveCount(0);
  await offers.locator("li[data-offer=kcom-power-fibre-100-hull] input").check();
  await offers.locator("li[data-offer=bt-full-fibre-300] input").check();
  await page.getByRole("button", { name: "Compare total cost" }).click();
  const t = page.getByTestId("results");
  await expect(t.locator("tr[data-row]")).toHaveCount(2);
  await expect(t.getByRole("link", { name: "Check availability with KCOM" })).toHaveAttribute("href", /^https:\/\/www\.kcom\.com\//);

  await findArea(page, "SW1A 1AA");
  await expect(page.getByTestId("area")).toContainText("City of Westminster");
  await expect(offers.locator("li[data-offer=community-fibre-300]")).toBeVisible();
  await expect(offers.locator("li[data-offer^=kcom]")).toHaveCount(0);

  await findArea(page, "BT1 1AA");
  await expect(page.locator('[data-caveat="ni"]')).toBeVisible();
  await expect(page.getByTestId("no-offers")).toContainText("Northern Ireland");

  await findArea(page, "ZZ1 1ZZ");
  await expect(page.getByRole("alert")).toContainText("could not find ZZ1 1ZZ");
  const mf = page.getByTestId("manual-fallback");
  await mf.getByLabel("Address line 1").fill("1 high street"); await mf.getByLabel("Town").fill("somewhere");
  await mf.getByRole("button", { name: "Continue with this address" }).click();
  await expect(page.getByTestId("address-result")).toContainText("do not verify");
  expect(bad).toEqual([]);
  done();
});
