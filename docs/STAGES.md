# Stages

| Stage | Scope | Status (2026-10-11) |
|---|---|---|
| **1. Independent comparison core** | Local postcode data (OS Code-Point Open, 1.75M GB postcodes; optional self-hosted postcodes.io for NI), manual address (basic normaliser + optional libpostal, never verification), local reviewed offer catalogue with versioned publication, deterministic cost engine (dinero.js), eligibility caveats (availability, KCOM Hull/East Riding, social tariff, NI), link-checked provider directory, approved-handoff route, session records, React UI (TanStack Form + Table), static Pages build + importable engine | **Done.** Unit tests plus 4 Playwright journeys pass with the network disabled. |
| 1 data | Real published offers | **Waiting on Ismail.** The catalogue is empty by design. Offers need a source (manual entry from provider pages, or a permitted feed) and a named reviewer. |
| **2. Bill intelligence** | Upload → server → BullMQ/Redis → worker → docling-serve (private, never browser-facing) → deterministic field extraction with evidence → customer confirms | **Code shipped, partly verified.** The extractor is unit-tested. Queue, worker and Docling are not yet tested end to end; it needs a host with Redis and docling-serve (`docker compose --profile bills up`). |
| **3. CMS / publishing** | Payload CMS (optional) for guides and the offer review UI, replacing the `npm run review` CLI | Queued |
| **4. Licensed datasets** | Ofcom Connected Nations / availability or wholesale data under licence; true address-level availability | Queued. Needs licences. Until then, availability stays with the provider. |

Collection: `collector/` (Crawlee) only visits sources in `config/permitted-sources.json` that have documented permission, and only where robots.txt allows. It writes to the **pending** review queue. The list is empty today, so the collector does nothing.
