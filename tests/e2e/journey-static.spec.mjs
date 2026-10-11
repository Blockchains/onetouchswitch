// Production Pages build (empty catalogue). Everything runs from static files + the in-browser engine.
import { test, expect } from "@playwright/test";
import { guardOrigin, findArea, addQuote } from "./helpers.mjs";
const ORIGIN = "http://127.0.0.1:8797";

test("postcode -> notices -> empty catalogue -> quotes -> acceptance total -> saved (no email gate, no external requests)", async ({ page }) => {
  const done = guardOrigin(page, ORIGIN);
  await page.goto("/onetouchswitch/");
  await expect(page.locator("input[type=email]")).toHaveCount(0);
  await findArea(page, "hu1 1aa");
  await expect(page.getByTestId("area")).toContainText("City of Kingston upon Hull");
  await expect(page.locator('[data-caveat="kcom-area"]')).toBeVisible();
  await expect(page.locator('[data-caveat="social-tariff"]')).toBeVisible();
  await expect(page.getByTestId("no-offers")).toContainText("No reviewed offers have been published yet");
  await addQuote(page, { label: "Quote A", monthly: "29.99", months: "24", rise: "3" });
  await page.getByRole("button", { name: "Compare total cost" }).click();
  const rows = page.getByTestId("results").locator("tbody tr[data-row]");
  await expect(rows.nth(0)).toContainText("£791.76");
  await page.getByRole("button", { name: /Show how Quote A adds up/ }).click();
  await expect(page.getByTestId("breakdown-quote-1")).toContainText("Oct 2026 – Mar 2027: 6 × £29.99");
  await expect(page.locator("body")).not.toContainText(/order now|buy now|switch now|available at your address|we'll switch you/i);
  await page.getByRole("button", { name: "Save this comparison" }).click();
  await expect(page.getByTestId("session")).toContainText(/[0-9a-f-]{36}/);
  const stored = await page.evaluate(() => localStorage.getItem("ots-saved-v1"));
  expect(stored).toContain('"outward":"HU1"'); expect(stored).not.toContain("HU1 1AA");
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(page.getByTestId("saved-list")).toContainText("HU1");
  done();
});

test("unknown postcode -> manual address (not verified) -> quotes compare; no-postcode path; NI by format", async ({ page }) => {
  const done = guardOrigin(page, ORIGIN);
  await page.goto("/onetouchswitch/");
  await findArea(page, "ZZ1 1ZZ");
  await expect(page.getByRole("alert")).toContainText("could not find ZZ1 1ZZ");
  const mf = page.getByTestId("manual-fallback");
  await mf.getByLabel("Address line 1").fill("1  high   street"); await mf.getByLabel("Town").fill("somewhere");
  await mf.getByRole("button", { name: "Continue with this address" }).click();
  await expect(page.getByTestId("address-result")).toContainText("1 High Street, SOMEWHERE, ZZ1 1ZZ");
  await expect(page.getByTestId("address-result")).toContainText("do not verify");
  await addQuote(page, { label: "Quote B", monthly: "27.50", upfront: "50", months: "24" });
  await page.getByRole("button", { name: "Compare total cost" }).click();
  await expect(page.getByTestId("results")).toContainText("£710.00");
  await page.reload();
  await page.getByRole("button", { name: "Continue without a postcode" }).click();
  await expect(page.getByTestId("area")).toContainText("No postcode");
  await findArea(page, "BT1 1AA");
  await expect(page.locator('[data-caveat="ni"]')).toBeVisible();
  done();
});

test("current deal: exit fee clarity, vs staying, comparison period, shortlist + view all", async ({ page }) => {
  await page.goto("/onetouchswitch/");
  await findArea(page, "EH1 1YZ");
  await page.getByLabel("Monthly price now (£)").fill("25"); await page.getByLabel("Price after contract ends (£)").fill("45");
  await page.getByLabel("Months left in contract").fill("3"); await page.getByLabel("Exit fee if you leave now (£)").fill("60");
  await addQuote(page, { label: "Quote A", monthly: "30", months: "24" });
  await addQuote(page, { label: "Quote B", monthly: "20", months: "12" });
  await page.getByLabel("Comparison period").selectOption("24");
  await page.getByRole("button", { name: "Compare total cost" }).click();
  const t = page.getByTestId("results");
  await expect(page.getByRole("heading", { name: "5. Results over 24 months" })).toBeVisible();
  // B: 20*24 = 480 + 60 exit = 540; A: 720 + 60 = 780; stay: 3*25 + 21*45 = 1020
  await expect(t.locator("tr[data-row]").nth(0)).toContainText("£540.00"); await expect(t.locator("tr[data-row]").nth(0)).toContainText("£480.00 less");
  await expect(t.locator("tr[data-row]").nth(0)).toContainText("assume the last contract price continues");
  await expect(page.getByTestId("stay")).toContainText("£1020.00");
  await page.getByRole("button", { name: "Add Quote A to shortlist" }).click();
  await page.getByRole("button", { name: "Shortlist (1)" }).click();
  await expect(t.locator("tr[data-row]")).toHaveCount(1); await expect(t).toContainText("Quote A");
  await page.getByRole("button", { name: "View all (2)" }).click();
  await expect(t.locator("tr[data-row]")).toHaveCount(2);
  // edit a quote's costs
  await page.getByTestId("quotes").getByRole("button", { name: "Edit" }).first().click();
  await page.getByLabel("Monthly (£)").fill("10"); await page.getByRole("button", { name: "Save costs" }).click();
  await expect(page.getByTestId("quotes")).toContainText("Quote A: £10.00/month");
});

test("bill: PDF read on device -> confirm -> fills current deal; pasted text; photo -> manual entry", async ({ page }) => {
  const done = guardOrigin(page, ORIGIN);
  await page.goto("/onetouchswitch/");
  await findArea(page, "CF10 1EP");
  await page.getByText("Fill this in from your bill").click();
  await page.getByLabel("Choose your bill (PDF or text)").setInputFiles("tests/fixtures/bill.pdf");
  const c = page.getByTestId("bill-confirm");
  await expect(c.getByLabel("Monthly price (£)")).toHaveValue("38.50");
  await expect(c.getByLabel("Exit fee (£)")).toHaveValue("96.00");
  await expect(c.getByLabel("Provider")).toHaveValue("Virgin Media");
  await expect(c).toContainText("Early termination charge if you leave now");
  await c.getByLabel("Monthly price (£)").fill("38.00");
  await c.getByRole("button", { name: "Use these values" }).click();
  await expect(page.getByLabel("Monthly price now (£)")).toHaveValue("38.00");
  await expect(page.getByLabel("Exit fee if you leave now (£)")).toHaveValue("96.00");
  await page.getByLabel("Or paste the text of your bill").fill("Sky\nBroadband monthly £27.00");
  await page.getByRole("button", { name: "Read pasted text" }).click();
  await expect(c.getByLabel("Monthly price (£)")).toHaveValue("27.00");
  await page.getByLabel("Choose your bill (PDF or text)").setInputFiles({ name: "bill.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await expect(c).toContainText("type the values from your bill");
  done();
});

test("guides: static pages + in-app search", async ({ page }) => {
  const done = guardOrigin(page, ORIGIN);
  await page.goto("/onetouchswitch/#/guides");
  await page.getByLabel("Search guides").fill("exit fee");
  await expect(page.getByTestId("guide-list").locator("li").first()).toContainText("Exit fees");
  await page.getByTestId("guide-list").getByRole("link").first().click();
  await expect(page.getByTestId("guide")).toContainText("early termination charge");
  await page.goto("/onetouchswitch/#/guides"); await page.getByLabel("Search guides").fill("qqqzzz");
  await expect(page.getByTestId("guide-none")).toBeVisible();
  await page.goto("/onetouchswitch/guides/mid-contract-price-rises/");
  await expect(page.locator("h1")).toContainText("pounds and pence");
  done();
});

test("engine bundle importable by touch.grok.me (same answers, same files)", async ({ page }) => {
  await page.goto("/onetouchswitch/");
  const r = await page.evaluate(async () => { const m = await import("/onetouchswitch/engine/v1/ots-engine.mjs"); const c = new m.OTSStatic(location.origin + "/onetouchswitch/");
    const l = await c.location("HU1 1AA"); const cmp = await c.compare({ start: "2026-10", quotes: [{ label: "Q", monthly_pence: 2999, contract_months: 24, annual_rise_pence: 300, rise_month: 4 }] });
    const g = await c.searchGuides("social tariff"); const b = c.extractBillText("monthly £30.00");
    return { d: l.location.district, kcom: l.caveats.some((x) => x.code === "kcom-area"), total: cmp.results[0].total, copy: m.OFFER_COPY, guide: g[0].slug, bill: b.fields.monthly_pence }; });
  expect(r).toEqual({ d: "City of Kingston upon Hull", kcom: true, total: "£791.76", copy: "Published offer. Check availability with the provider.", guide: "social-tariffs", bill: 3000 });
});

test("cross-origin embed (touch.grok.me model): another origin imports the engine + reads a PDF bill using only the Pages origin", async ({ page }) => {
  const PAGES = "http://127.0.0.1:8798/onetouchswitch";
  const seen = new Set(); page.on("request", (r) => seen.add(new URL(r.url()).origin));
  await page.goto("/onetouchswitch/guides/");   // stands in for touch.grok.me
  const pdf = [...(await import("node:fs")).readFileSync("tests/fixtures/bill.pdf")];
  const r = await page.evaluate(async ({ PAGES, pdf }) => {
    const m = await import(`${PAGES}/engine/v1/ots-engine.mjs`); const c = new m.OTSStatic(PAGES + "/");
    const o = await c.offers("HU1 1AA");
    const bill = await c.readBill(new File([new Uint8Array(pdf)], "bill.pdf", { type: "application/pdf" }));
    return { offers: o.offers.length, kcom: o.caveats.some((x) => x.code === "kcom-area"), monthly: bill.fields.monthly_pence, exit: bill.fields.exit_fee_pence };
  }, { PAGES, pdf });
  expect(r).toEqual({ offers: 2, kcom: true, monthly: 3850, exit: 9600 });
  expect([...seen].sort()).toEqual(["http://127.0.0.1:8797", "http://127.0.0.1:8798"]);
});
