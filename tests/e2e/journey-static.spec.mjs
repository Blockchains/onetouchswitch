// Production Pages build (catalogue v3: v2 re-verified against live provider pages 2026-10-11, unverifiable/unpriced offers withdrawn; no handoffs approved). Everything runs from static files + the in-browser engine.
import { test, expect } from "@playwright/test";
import { guardOrigin, findArea, addQuote } from "./helpers.mjs";
const ORIGIN = "http://127.0.0.1:8797";

test("postcode -> notices -> published catalogue -> quotes -> acceptance total -> saved (no email gate, no external requests)", async ({ page }) => {
  const done = guardOrigin(page, ORIGIN);
  await page.goto("/onetouchswitch/");
  await expect(page.locator("input[type=email]")).toHaveCount(0);
  await findArea(page, "hu1 1aa");
  await expect(page.getByTestId("area")).toContainText("City of Kingston upon Hull");
  await expect(page.locator('[data-caveat="kcom-area"]')).toBeVisible();
  await expect(page.locator('[data-caveat="social-tariff"]')).toBeVisible();
  await expect(page.getByTestId("offers")).toContainText("KCOM: Power Fibre 100 (HU1-HU17)");
  await expect(page.getByTestId("offers")).not.toContainText("Community Fibre");
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
  await expect(page.getByTestId("area")).toContainText("Northern Ireland");
  // GB-researched offers are not shown for Northern Ireland; quotes still work
  await expect(page.getByTestId("offers")).toHaveCount(0);
  await expect(page.getByTestId("no-offers")).toContainText("Great Britain pages, so we don't list them for Northern Ireland");
  await findArea(page, "JE2 3AB");
  await expect(page.locator('[data-caveat="crown-dependency"]')).toBeVisible();
  await expect(page.getByTestId("no-offers")).toContainText("Jersey");
  done();
});

test("GB postcode lookup: SW1A 1AA, HU1 1AA, EH1 1YZ, CF10 1EP resolve from OS Code-Point Open; bad format rejected; no 404s", async ({ page }) => {
  const done = guardOrigin(page, ORIGIN);
  const bad = []; page.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  await page.goto("/onetouchswitch/");
  for (const [pc, want, country] of [["sw1a 1aa", "Westminster", "England"], ["HU1 1AA", "City of Kingston upon Hull", "England"], ["EH1 1YZ", "City of Edinburgh", "Scotland"], ["CF10 1EP", "Cardiff", "Wales"]]) {
    await findArea(page, pc);
    await expect(page.getByTestId("area")).toContainText(want); await expect(page.getByTestId("area")).toContainText(`(${country})`);
    await expect(page.getByTestId("area")).toContainText("OS Code-Point Open");
    await expect(page.getByTestId("offers").locator("li").first()).toBeVisible();
  }
  await findArea(page, "SW1A");
  await expect(page.getByRole("alert")).toContainText("Enter a full UK postcode");
  await findArea(page, "ZZ1 1ZZ"); // unknown outward code: answered from areas.json, no 404 request
  await expect(page.getByRole("alert")).toContainText("could not find ZZ1 1ZZ");
  await expect(page.getByTestId("manual-fallback")).toBeVisible();
  expect(bad).toEqual([]);
  done();
});

test("current deal: exit fee clarity, vs staying, comparison period, shortlist + view all", async ({ page }) => {
  const done = guardOrigin(page, ORIGIN);
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
  done();
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
  const done = guardOrigin(page, ORIGIN);
  await page.goto("/onetouchswitch/");
  const r = await page.evaluate(async () => { const m = await import("/onetouchswitch/engine/v1/ots-engine.mjs"); const c = new m.OTSStatic(location.origin + "/onetouchswitch/");
    const l = await c.location("HU1 1AA"); const cmp = await c.compare({ start: "2026-10", quotes: [{ label: "Q", monthly_pence: 2999, contract_months: 24, annual_rise_pence: 300, rise_month: 4 }] });
    const g = await c.searchGuides("social tariff"); const b = c.extractBillText("monthly £30.00");
    return { d: l.location.district, kcom: l.caveats.some((x) => x.code === "kcom-area"), total: cmp.results[0].total, copy: m.OFFER_COPY, guide: g[0].slug, bill: b.fields.monthly_pence }; });
  expect(r).toEqual({ d: "City of Kingston upon Hull", kcom: true, total: "£791.76", copy: "Published offer. Check availability with the provider.", guide: "social-tariffs", bill: 3000 });
  done();
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

test("published catalogue v3: only re-verified priced offers; listed-only offers have no tick box; cost several real offers", async ({ page }) => {
  const done = guardOrigin(page, ORIGIN);
  await page.clock.setFixedTime(new Date("2026-10-15T12:00:00"));
  await page.goto("/onetouchswitch/");
  await findArea(page, "HU1 1AA");
  const offers = page.getByTestId("offers");
  await expect(page.getByTestId("catalogue-meta")).toContainText("Catalogue v3");
  await expect(page.getByTestId("versions")).toContainText("offer catalogue v3 (59 offers)");
  await expect(offers.locator("li[data-offer=bt-full-fibre-300]")).toContainText("£30.99/month");
  await expect(offers.locator("li[data-offer=bt-full-fibre-300]")).toContainText("reviewer: Ismail Malik");
  await expect(offers.locator("li[data-offer=bt-full-fibre-300] a", { hasText: "source" })).toHaveAttribute("href", "https://www.bt.com/broadband/deals");
  // withdrawn on re-check: no price on the page / page not verifiable
  await expect(offers.locator("li[data-offer=bt-home-essentials]")).toHaveCount(0);
  await expect(offers.locator("li[data-offer=plusnet-full-fibre-from]")).toHaveCount(0);
  await expect(offers).not.toContainText("price not published");
  // every visible offer shows a real £ price
  for (const li of await offers.locator("li").all()) await expect(li).toContainText(/£\d+\.\d{2}\/month/);
  // no disabled controls anywhere in the offer list
  await expect(offers.locator("input:disabled, button:disabled")).toHaveCount(0);
  const vm = offers.locator("li[data-offer=virgin-media-m125]");
  await expect(vm.getByRole("checkbox")).toHaveCount(0);
  await expect(vm.getByTestId("listed-only")).toBeVisible();
  await expect(vm).toContainText("doesn't state the contract length");
  // Edit costs on a listed-only offer: never guesses the contract length
  await vm.getByRole("button", { name: "Edit costs" }).click();
  await expect(page.getByLabel("Contract months")).toHaveValue("");
  await page.getByRole("button", { name: "Save costs" }).click();
  await expect(page.getByTestId("quote-form")).toContainText("Choose the contract length you were quoted");
  await page.getByLabel("Contract months").selectOption("18");
  await page.getByRole("button", { name: "Save costs" }).click();
  await expect(page.getByTestId("quotes")).toContainText("Virgin Media — M125 Fibre Broadband (my costs): £23.99/month, 18 months");
  await page.getByTestId("quotes").getByRole("button", { name: "Remove" }).click();
  await page.getByLabel("Filter by provider").selectOption("kcom");
  await expect(offers.locator("li")).toHaveCount(3);
  await offers.locator("li[data-offer=kcom-power-fibre-100-hull] input").check();
  await page.getByLabel("Filter by provider").selectOption("");
  for (const id of ["bt-full-fibre-300", "hyperoptic-1gb", "youfibre-you-1000"]) await offers.locator(`li[data-offer=${id}] input`).check();
  await page.getByRole("button", { name: "Compare total cost" }).click();
  const t = page.getByTestId("results");
  await expect(t.locator("tr[data-row=bt-full-fibre-300]")).toContainText("£839.76");
  await expect(t.locator("tr[data-row=hyperoptic-1gb]")).toContainText("£642.00");
  await expect(t.locator("tr[data-row=kcom-power-fibre-100-hull]")).toContainText("£651.76");
  await expect(t.locator("tr[data-row=youfibre-you-1000]")).toContainText("£576.00");
  await expect(t.locator("tr[data-row]").nth(0)).toContainText("YouFibre");
  await expect(t).toContainText("Published offer. Check availability with the provider.");
  await expect(t.getByRole("link", { name: "Check availability with BT" })).toHaveAttribute("href", /^https:\/\/www\.bt\.com\//);
  await expect(page.locator("body")).not.toContainText(/order now|buy now|switch now|available at your address|we'll switch you/i);
  done();
});
