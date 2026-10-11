# Wiring touch.grok.me / onetouchswitch.com

Two options. Both are keyless, read-only and deterministic.

## A. Static (live now on GitHub Pages)
`BASE = https://blockchains.github.io/onetouchswitch` (env `VITE_OTS_COMPARE_BASE`)

| Need | Call |
|---|---|
| Postcode → area | `GET ${BASE}/api/v1/postcode/{OUTWARD}.json`, then find the row `[postcode, country_code, district_code, ward_code]`; names are in `names` |
| Providers | `GET ${BASE}/api/v1/providers.json` |
| Published offers | `GET ${BASE}/api/v1/catalogue/current.json` (`version` 0 = nothing published yet) |
| Everything above + cost engine | `const m = await import("${BASE}/engine/v1/ots-engine.mjs"); const c = new m.OTSStatic(BASE + "/")` |

```js
const BASE = import.meta.env.VITE_OTS_COMPARE_BASE ?? "https://blockchains.github.io/onetouchswitch";
const { OTSStatic, OFFER_COPY } = await import(/* @vite-ignore */ `${BASE}/engine/v1/ots-engine.mjs`);
const ots = new OTSStatic(BASE + "/");
const area = await ots.offers("HU1 1AA");          // { location, caveats[], offers[], empty_reason }
const res  = await ots.compare({ start: "2026-10", current: { monthly_pence: 2500, out_of_contract_monthly_pence: 4500, months_left: 0, exit_fee_pence: 0 },
                                 offer_ids: area.offers.map(o => o.id), quotes: [{ label: "Quote", monthly_pence: 2200, contract_months: 24 }] });
// res.results[]: rank, label, total, switch_total, vs_stay, copy, provider{name,url}
```

## B. Self-hosted server
Deploy with `docker compose up app` (after `npm run stage`), then call the `/api/*` routes in the README. Set `VITE_OTS_COMPARE_API` to its origin and enable CORS at the proxy.

## UX copy rules (must keep)
- Every catalogue offer: **"Published offer. Check availability with the provider."**
- Never say "available at your address", "order now" or "we'll switch you". Provider links read "Check availability with {Provider}".
- If a fetch fails or nothing is published, show the `empty_reason` text and the "add a quote" form. Never invent offers.
