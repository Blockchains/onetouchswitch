# AGENTS.md: onetouchswitch (static comparison app)

Static-only UK broadband comparison for onetouchswitch.com. Manifest: [`blocks.json`](blocks.json).

## Setup / test
```bash
npm ci && npm run stage          # staging is the ONLY online step (build time)
npm run build && npm run check:deps
npm test && npx playwright test  # must pass offline: unshare -rn sh -c 'ip link set lo up && npm test && npx playwright test'
```

## Hard rules
- **Zero runtime dependencies beyond static files on the same origin.** No server, database, Redis/BullMQ, Docling, Payload, Postgres, Docker, paid API, CDN, web font or third-party API at runtime. `npm run check:deps` and the Playwright origin guard enforce this.
- Never add offers to `data/catalogue/published` by hand, and never put real-looking offers in code. Offers go `npm run review -- add` → approve → publish. Test offers live only in `tests/fixtures` and are labelled TEST FIXTURE.
- Never claim availability or orderability. Never automate orders. Keep `OFFER_COPY` exactly as it is. Link text is "Check availability with {Provider}".
- Bills are read in the browser only. Never upload them anywhere. OCR is deferred; manual entry is the equivalent.
- Saved comparisons store the outward code only, never the address or full postcode.
- `config/handoff.json` and `config/permitted-sources.json` change only with Ismail's written approval.
- Money is integer pence via `core/money.mjs` (dinero.js). No floats in the cost engine.
- The partner/stablecoin bridge is a separate optional app. Never fetch from it in the consumer journey.
- Run gitleaks before every push.
