# Architecture

- `core/` holds pure, deterministic logic, shared by server, browser and static client:
  - `cost.mjs`: engine; `compare-request.mjs`: request → deals; `postcode.mjs`; `eligibility.mjs`; `address.mjs`; `copy.mjs`; `bill-extract.mjs`.
  - Node-only modules: `postcode-store.mjs` (local index), `catalogue.mjs` (pending/approved/rejected/published, immutable `vN.json` + sha256).
  - `static-client.mjs` gives the same answers from static JSON. It is bundled to `engine/v1/ots-engine.mjs`.
- `server/` holds the Hono API (`app.mjs`), the entry point (`index.mjs`), the BullMQ queue (`bills.mjs`) and the Docling worker (`worker.mjs`).
- `web/` is the React UI. It runs against the server, or in static mode with `VITE_STATIC=1`.
- `scripts/` holds `stage-data.mjs` (online), `build-static.mjs`, `review.mjs`, test servers and `offline-check.mjs`.
- `collector/` is the permitted-only Crawlee collector. It writes to the review queue.
- Data lives in `data/`, which is git-ignored and staged: `postcodes/<area>.json`, `names.json`, `meta.json`, `providers.json`, `catalogue/`, `sessions/`, `private-bills/` (0700, files deleted after OCR).

Optional self-hosted services, all on the private network: postcodes.io (`POSTCODES_IO_URL`), libpostal (`LIBPOSTAL_URL`), Redis (`REDIS_URL`), docling-serve (`DOCLING_URL`, worker only).

**Why Code-Point Open as well as postcodes.io:** it is a single 14 MB OGL download that covers every GB postcode, so the core works offline with no database. A self-hosted postcodes.io adds Northern Ireland and lat/long when it is configured. The public postcodes.io is never called at request time.
