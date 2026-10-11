# Stages (static-only: GitHub Pages + client-side JS)

| Stage | Scope | Status (2026-10-11) |
|---|---|---|
| **1. Comparison core** | Postcode lookup (static Code-Point Open chunks), NI/CI/IoM by format, manual address, versioned catalogue + honest empty state + bring-your-own quote, deterministic engine in the browser, notices (availability, KCOM, NI, social tariff), approved-link-only handoff, TanStack form/table with shortlist / view all / edit costs / exit-fee column / comparison period / breakdown, no email gate | **Done, live on Pages.** |
| 1 data | Real published offers | **Waiting on Ismail.** The catalogue is empty by design (`npm run review`). |
| **2. Bill intelligence** | Client-only: PDF/text bill read with self-hosted pdf.js, literal field extraction with evidence, confirm/correct UI, paste-text, manual entry | **Done.** OCR for photos/scans is **deferred**; manual entry is the equivalent. A private Docling service is optional later and is not required. |
| **3. Content + persistence** | Guides (Markdown → static JSON + HTML) with in-browser search; saved comparisons in localStorage (outward only); offline service worker | **Done.** No CMS needed. Guides are edited as Markdown in `content/guides`. |
| 4. Licensed datasets | Address-level availability (Ofcom Connected Nations / wholesale) | Queued. Needs licences. Availability stays with the provider. |

Offline proof: `tests/e2e/journey-offline.spec.mjs` loads the app once, kills the server, sets the browser offline, then does postcode lookup, manual address, costing, results from the catalogue, guides + search, and saved comparisons. CI runs every test inside a network namespace with no internet.
