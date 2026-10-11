# onetouchswitch — local-first broadband comparison platform

A self-hostable comparison core for **[onetouchswitch.com](https://onetouchswitch.com)** (built on touch.grok.me). It answers one question honestly: *what will each deal cost me over the contract, compared with staying put?* It uses only data held locally, and it never claims a deal is available or orderable at your address.

```
customer → web app ─ postcode (local OS Code-Point Open / self-hosted postcodes.io)
                    ─ manual address (normalised, NOT verified; optional libpostal)
                    ─ published offers (local reviewed catalogue, versioned) + quotes the customer enters
                    ─ deterministic cost engine (dinero.js, integer pence)  → results + session record
                    ─ provider links ("Published offer. Check availability with the provider.")
         [Stage 2] bill upload → server → BullMQ/Redis → worker → docling-serve (private) → extracted fields to confirm
background: permitted sources (Crawlee) / manual entry → pending → human review → versioned publication
```

**Live (static GitHub Pages build, same engine):** https://blockchains.github.io/onetouchswitch/ · API catalogue https://blockchains.github.io/onetouchswitch/api/v1/index.json

## Run it

```bash
npm ci
npm run stage            # ONLINE once: OS Code-Point Open (1.7M GB postcodes, OGL) + provider link checks -> data/
npx vite build && npm start   # http://127.0.0.1:8787  (everything after staging works offline)
npm test                 # unit tests (offline)
npx playwright test      # 4 journeys: server+fixture catalogue, server+empty catalogue, static build, engine import
docker compose up app    # self-hosted; add --profile bills | postcodes | libpostal for optional services
```

## API (server)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | data versions, enabled services |
| GET | `/api/location/postcode?postcode=` | local lookup → district, ward, country, caveats |
| POST | `/api/address/normalise` | `{line1,line2,town,postcode}` → tidy form, `verified:false` |
| GET | `/api/providers` | directory of provider websites (link-checked at staging) |
| GET | `/api/offers?postcode=` | published, area-filtered catalogue offers + caveats |
| POST | `/api/compare` | `{start, current?, offer_ids[], quotes[]}` → deterministic ranked totals |
| POST/GET | `/api/sessions[/:id]` | stored comparison record (outward code only, no address) |
| GET | `/api/handoff/:provider` | 302 to the provider, **only** for providers approved in `config/handoff.json` (empty by default) |
| POST/GET | `/api/bills[/:id]` | Stage 2. Returns 503 unless `BILLS_ENABLED=1` and `REDIS_URL` are set |

Static equivalents for touch.grok.me: see [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Honesty rules (enforced in code and tests)
- Offers only reach customers after human review and versioned publication (`npm run review`). The production catalogue is **empty** until offers are approved.
- Every offer shows "Published offer. Check availability with the provider."
- No orderability, no "available at your address", and no autonomous orders.
- Cashback is shown but never deducted from cost.

Stages: [docs/STAGES.md](docs/STAGES.md) · Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Agents: [AGENTS.md](AGENTS.md)

Postcode data: Contains OS data © Crown copyright and database right; Royal Mail data © Royal Mail copyright and database right; National Statistics data © Crown copyright and database right (Open Government Licence v3.0). Code: MIT.
