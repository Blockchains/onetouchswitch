# onetouchswitch: static-only broadband comparison

The comparison engine and app for **[onetouchswitch.com](https://onetouchswitch.com)** (touch.grok.me). It answers one question honestly: *what will each deal cost me over the contract, compared with staying put?*

**It runs entirely on static files plus JavaScript in the browser.** There is no server, database, queue, OCR service, paid API or third-party API at runtime. The same bundle works on GitHub Pages, on touch.grok.me, or on any static host, and keeps working offline once loaded.

- **App:** https://blockchains.github.io/onetouchswitch/
- **Static API index:** https://blockchains.github.io/onetouchswitch/api/v1/index.json
- **Engine (ESM) for touch.grok.me:** https://blockchains.github.io/onetouchswitch/engine/v1/ots-engine.mjs
- **Guides:** https://blockchains.github.io/onetouchswitch/guides/

```
browser ── {base}/index.html + assets          (React, TanStack Form + Table; service worker for offline)
        ├─ {base}/api/v1/postcode/<OUT>.json    OS Code-Point Open, 1.75M GB postcodes chunked per outward code
        ├─ {base}/api/v1/catalogue/current.json reviewed, versioned offers (v1: 61 offers from 16 providers, researched 2026-10-11)
        ├─ {base}/api/v1/providers.json + handoff.json   provider sites; approved handoff links only (none = plain links)
        ├─ {base}/api/v1/guides/*.json          guides + client-side search
        ├─ {base}/vendor/pdfjs/                 self-hosted pdf.js: bills read on the device, never uploaded
        └─ in-browser engine                    zod validation + dinero.js integer pence; localStorage for saved comparisons
build time only (GitHub Actions): stage Code-Point Open + provider link checks -> vite build -> scripts/build-static.mjs
```

## What works (all client-side)

| Feature | How |
|---|---|
| Postcode lookup | Fetches one small static file per outward code from this site. "Keep HU postcodes on this device" caches a whole area for offline use. |
| NI, Jersey, Guernsey, Isle of Man | Recognised by postcode format with the right notice. You can still compare quotes. |
| Manual address | Fallback when a postcode isn't found, or optional. Tidied in the browser and labelled "not verified". Never stored. |
| Offer catalogue | Versioned JSON in `catalogue/published/`, built from a dated research file (`catalogue/research/`) where every figure was read from the provider's own page. Each offer carries `source_url`, `retrieved_at`, `reviewed_by`, `review_flags` and `needs_review`. Figures not on the page are `null`, never guessed; offers without a price or contract length are listed but not costed. |
| Costing | Deterministic engine in the browser: in-contract £ rises, upfront fees, exit fees, out-of-contract price, and cashback shown but never deducted. |
| Results UI | TanStack Table: sortable, shortlist ☆ with View all / Shortlist, monthly breakdown per row, "vs staying", exit-fee column, comparison period (longest / 12 / 18 / 24 / 36 months). Edit costs on any offer or quote. No email gate. |
| Notices | Availability (always), KCOM (Hull and East Riding), Northern Ireland, crown dependencies, social tariff. |
| Provider links | "Check availability with {Provider}". Only `config/handoff.json` entries Ismail approved become tracked links, with a disclosure. None approved means plain links to the provider website. We never place orders. |
| Bill reading | PDF or text bill read **on the device** with self-hosted pdf.js. You see each extracted field with the line it came from, and confirm or correct it. Paste text or type values; manual entry is equally first-class. |
| Guides and search | 12 Markdown guides, built into JSON for the app plus plain HTML pages. Search runs in the browser. |
| Saved comparisons | localStorage on the device: outward code and your numbers only, never the address or full postcode. Open and delete in "Saved". |
| Offline | A service worker caches the app, engine, catalogue, guides, pdf.js and postcode files you use. Tested by killing the server and setting the browser offline. |

**Deferred (not required):** OCR for photos and scanned bills. It is too heavy for a static page, so the manual-entry form is the equivalent. A private Docling service could be added later as an **optional** enhancement; nothing depends on it. Address-level availability needs licensed data (Stage 4).

**Partner/stablecoin bridge:** a separate, optional app, [Blockchains/onetouchswitch-bridge](https://github.com/Blockchains/onetouchswitch-bridge). The consumer app only links to it in the footer, never fetches from it, and works without it.

## Run it

```bash
npm ci
npm run stage     # build time, ONLINE once: OS Code-Point Open + provider link checks -> data/
npm run build     # -> site/ (app, engine, postcode chunks, guides, pdf.js, sw.js)
npm run preview   # http://127.0.0.1:8797/onetouchswitch/  (a plain static file server; any static host works)
npm test && npx playwright test   # passes with the network disabled; see CI
npm run check:deps                 # fails if the build gains any external runtime dependency
```

Host at a domain root (e.g. touch.grok.me) with `VITE_BASE=/ PAGES_URL=https://touch.grok.me npm run build`, and upload `site/` as-is.

## Honesty rules (enforced in code and tests)
- Offers reach customers only through versioned publication with a named reviewer. v2 (2026-10-11) is live with reviewer Ismail Malik: 61 offers, `needs_review` cleared, null fields left null (no invented exit fees). `review_flags` still list what each provider page did not state. Refresh: add a new dated research file, then run `node scripts/import-research.mjs <file> --reviewer "<name>"`.
- Every offer shows "Published offer. Check availability with the provider."
- No orderability claims, no "available at your address", and no orders placed for you. Cashback is never deducted.

Integration: [docs/INTEGRATION.md](docs/INTEGRATION.md) · Stages: [docs/STAGES.md](docs/STAGES.md) · Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Agents: [AGENTS.md](AGENTS.md)

Postcode data: Contains OS data © Crown copyright and database right; Royal Mail data © Royal Mail copyright and database right; National Statistics data © Crown copyright and database right (Open Government Licence v3.0). pdf.js: Apache-2.0. Code: MIT.
