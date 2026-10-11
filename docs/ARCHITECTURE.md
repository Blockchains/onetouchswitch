# Architecture (static-only)

- `core/`: pure, deterministic browser-safe logic, bundled into the app and into `engine/v1/ots-engine.mjs`.
  - `static-client.mjs` (`OTSStatic`): the whole engine over static files (location, manual location, offers, compare, providers + approved handoff, guides + search, bill reading, saved comparisons, keep-area-offline).
  - `cost.mjs` (engine), `compare-request.mjs`, `money.mjs` (dinero.js), `postcode.mjs`, `eligibility.mjs` (notices), `address.mjs`, `copy.mjs`, `bill-extract.mjs` (literal fields + evidence), `bill-pdf.mjs` (pdf.js loaded from `{base}/vendor/pdfjs/`), `saved.mjs` (localStorage), `guides.mjs` (search).
  - `catalogue.mjs`: build-time only (Node), for the review CLI. pending → approved/rejected → immutable `vN.json` + sha256.
- `web/`: the React app (TanStack Form + Table) with hash routes `#/`, `#/guides[/slug]`, `#/saved`, and `sw.template.js` (service worker).
- `content/guides/*.md`: guides, built into `api/v1/guides/*.json` and `guides/<slug>/index.html`.
- `scripts/`: `stage-data.mjs` (build time, online), `build-static.mjs`, `review.mjs`, `static-server.mjs` (Pages-like test/preview server), `check-no-external.mjs`, `offline-check.mjs`.
- `collector/`: optional, build-time Crawlee collector. It only visits `config/permitted-sources.json` (empty) and writes to the review queue. It is never part of the site.

## Runtime

Every request the app makes goes to its own origin: `index.html`, `assets/*`, `api/v1/**`, `vendor/pdfjs/**`. The Playwright suite fails on any request to another origin. The only cross-site URLs are plain links the user clicks: provider websites, sources, Ofcom guides, and the optional bridge.

## Offline

`sw.js` precaches the app shell, engine, small JSON (index, providers, handoff, catalogue, areas, guides) and pdf.js. Navigations and small JSON are network-first with a cache fallback, assets are cache-first, and postcode chunks are stale-while-revalidate. "Keep {AREA} postcodes on this device" pre-fetches every outward file for an area.

## Removed in 0.2.0

The Hono server, BullMQ/Redis bill queue, Docling worker, Docker image and self-hosted postcodes.io/libpostal adapters were removed. They are in git history (commit 14229d9) if a private, **optional** service is ever wanted. Nothing in the app depends on them.
