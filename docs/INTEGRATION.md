# Wiring touch.grok.me / onetouchswitch.com

touch.grok.me loads **only** the Pages engine and assets. There is no other API, key, server or third-party call. These are the same files github.io serves.

`BASE = https://blockchains.github.io/onetouchswitch` (env `VITE_OTS_COMPARE_BASE`). CORS is `*` on GitHub Pages.

```js
const BASE = import.meta.env.VITE_OTS_COMPARE_BASE ?? "https://blockchains.github.io/onetouchswitch";
const { OTSStatic, OFFER_COPY, UNAVAILABLE } = await import(/* @vite-ignore */ `${BASE}/engine/v1/ots-engine.mjs`);
const ots = new OTSStatic(BASE + "/");
const area = await ots.offers("HU1 1AA");            // { location, caveats[], offers[], empty_reason, catalogue_version } or { error }
const manual = await ots.offers(ots.manualLocation({ line1, line2, town, postcode }));   // postcode not found
const none = await ots.offers(null);                 // continue without a postcode
const res = await ots.compare({ start: "2026-10", horizon_months: 24, current: { monthly_pence: 2500, out_of_contract_monthly_pence: 4500, months_left: 0, exit_fee_pence: 0 },
                                offer_ids: area.offers.map(o => o.id), quotes: [{ label: "Quote", monthly_pence: 2200, contract_months: 24 }] });
const guides = await ots.searchGuides("exit fee");   // [{slug,title,summary}], then ots.guide(slug) -> {title, html}
const bill = await ots.readBill(file);               // PDF/text read on the device -> { fields, evidence, missing, note }
ots.saved.save(res, request, { outward: area.location.outward });   // localStorage, outward only
await ots.keepAreaOffline("HU");                     // pre-fetch postcode files for offline use
```

| Need | Static file |
|---|---|
| Postcode → area | `${BASE}/api/v1/postcode/{OUTWARD}.json`, with rows `[postcode, country_code, district_code, ward_code]` and `names` |
| Area → outward codes | `${BASE}/api/v1/postcode/areas.json` |
| Providers / approved handoff | `${BASE}/api/v1/providers.json`, `${BASE}/api/v1/handoff.json` (`approved: []` means plain links) |
| Published offers | `${BASE}/api/v1/catalogue/current.json` and the current immutable `vN.json` (superseded versions are not served). v3 has 59 re-verified offers. Each offer has `monthly_pence` (always set on live versions), `price_is_from`, `intro_pence`/`intro_months`, `contract_months`, `annual_rise_pence` + `rise_month` + `rise_rule`, `exit_fee_pence`/`exit_fee_rule`, `upfront_pence` + `one_off_fees[]`, `download_mbps`/`upload_mbps`, `social_tariff`, `eligibility_notes`, `regions` (`areas`, `outwards`, `exclude_outwards`), `source_url`, `retrieved_at`, `reviewed_by`, `review_flags`, `needs_review` and `costable` |
| Guides | `${BASE}/api/v1/guides/index.json`, `${BASE}/api/v1/guides/{slug}.json`, HTML at `${BASE}/guides/{slug}/` |
| pdf.js (bill reading) | `${BASE}/vendor/pdfjs/` (loaded by the engine; a cross-origin worker is handled by pdf.js) |

Alternatively, host the whole static bundle on touch.grok.me itself: `VITE_BASE=/ PAGES_URL=https://touch.grok.me npm run build` and serve `site/`.

## UX copy rules (must keep)
- Every catalogue offer: **"Published offer. Check availability with the provider."**
- Show `needs_review` offers with the fields they lack. Offers with `costable: false` can't be passed to `compare` (it throws); let the customer enter the price as a quote instead.
- Never say "available at your address", "order now", "buy now", "switch now" or "we'll switch you". Provider links read "Check availability with {Provider}".
- If an engine call throws or times out, show `UNAVAILABLE` ("Live comparison is unavailable right now. Please try again shortly.") and no numbers. If nothing is published, show `empty_reason` and the "add a quote" form. Never invent offers.
