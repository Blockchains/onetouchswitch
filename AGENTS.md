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
- Never edit `catalogue/published` by hand, and never put real-looking offers in code. Real offers come from a dated research file in `catalogue/research/`, where every figure is read from the provider's own page (`source_url`, `retrieved_at`). Figures that aren't on the page stay `null` and are listed in `review_flags` (`needs_review`). Comparison sites can help you find a URL but never supply a price. Publish with `node scripts/import-research.mjs <file> --reviewer "<name>"` (or `npm run review`). Test offers live only in `tests/fixtures` and are labelled TEST FIXTURE.
- Never claim availability or orderability. Never automate orders. Keep `OFFER_COPY` exactly as it is. Link text is "Check availability with {Provider}".
- Bills are read in the browser only. Never upload them anywhere. OCR is deferred; manual entry is the equivalent.
- Saved comparisons store the outward code only, never the address or full postcode.
- `config/handoff.json` and `config/permitted-sources.json` change only with Ismail's written approval.
- Money is integer pence via `core/money.mjs` (dinero.js). No floats in the cost engine.
- The stablecoin/FX bridge is the backend that settles with PROVIDERS and partners, never with customers. Never fetch from it or mention payments in the consumer journey. The only allowed reference is the operator footer link.
- Run gitleaks before every push.
