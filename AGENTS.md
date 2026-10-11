# AGENTS.md: onetouchswitch (comparison platform)

Local-first UK broadband comparison core for onetouchswitch.com. Manifest: [`blocks.json`](blocks.json).

## Setup / test
```bash
npm ci && npm run stage          # staging is the ONLY online step
npx vite build && npm run build:static
npm test && npx playwright test  # must pass offline: unshare -rn sh -c 'ip link set lo up && npm test && npx playwright test'
```

## Hard rules
- Never add offers to `data/catalogue/published` by hand, and never put real-looking offers in code. Offers go `npm run review -- add` → approve → publish. Test offers live only in `tests/fixtures` and are labelled TEST FIXTURE.
- Never claim availability or orderability. Never automate orders. Keep `OFFER_COPY` exactly as it is.
- Never call public third-party APIs at request time. Only staged data and self-hosted services (env URLs) are allowed.
- The browser must never talk to Docling. Bills go server → queue → worker.
- Do not store customer addresses in session records (outward code only).
- `config/handoff.json` and `config/permitted-sources.json` change only with Ismail's written approval.
- Money is integer pence via `core/money.mjs` (dinero.js). No floats in the cost engine.
- Run gitleaks before every push.
