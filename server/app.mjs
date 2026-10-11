// OTS comparison API (Hono). Local-first: serves only staged/local data; optional self-hosted services via env.
import { Hono } from "hono";
import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { normalisePostcode, lookupPostcodesIo } from "../core/postcode.mjs";
import { PostcodeStore } from "../core/postcode-store.mjs";
import { caveatsFor } from "../core/eligibility.mjs";
import { normaliseAddress } from "../core/address.mjs";
import { Catalogue, OFFER_COPY } from "../core/catalogue.mjs";
import { runCompare as runCompareCore } from "../core/compare-request.mjs";

export function createApp(cfg = {}) {
  const ROOT = new URL("..", import.meta.url).pathname;
  const dataDir = cfg.dataDir ?? process.env.OTS_DATA_DIR ?? join(ROOT, "data");
  const catDir = cfg.catalogueDir ?? process.env.OTS_CATALOGUE_DIR ?? join(dataDir, "catalogue");
  const configDir = cfg.configDir ?? process.env.OTS_CONFIG_DIR ?? join(ROOT, "config");
  const sessionsDir = join(dataDir, "sessions"); mkdirSync(sessionsDir, { recursive: true });
  const postcodesIo = cfg.postcodesIoUrl ?? process.env.POSTCODES_IO_URL ?? null;
  const libpostalUrl = cfg.libpostalUrl ?? process.env.LIBPOSTAL_URL ?? null;
  const store = new PostcodeStore(join(dataDir, "postcodes"));
  const catalogue = new Catalogue(catDir);
  const providersDoc = existsSync(join(dataDir, "providers.json")) ? JSON.parse(readFileSync(join(dataDir, "providers.json"), "utf8")) : JSON.parse(readFileSync(join(configDir, "providers.json"), "utf8"));
  const providers = new Map(providersDoc.providers.map((p) => [p.id, p]));
  const approved = new Set(JSON.parse(readFileSync(join(configDir, "handoff.json"), "utf8")).approved);
  const bills = cfg.bills ?? null; // { enqueue(file, meta) -> id, status(id) }

  const app = new Hono();
  const bad = (c, msg, code = 400) => c.json({ error: msg }, code);

  app.get("/api/health", (c) => c.json({ ok: true, postcodes: store.meta ? { version: store.meta.version, count: store.meta.postcodes, partial: store.meta.partial } : null, catalogue_version: catalogue.current().version, postcodes_io: !!postcodesIo, libpostal: !!libpostalUrl, bills: !!bills }));

  async function locate(raw) {
    const pc = normalisePostcode(raw); if (!pc) return { error: "Enter a full UK postcode, e.g. SW1A 1AA" };
    let loc = store.staged ? store.lookup(pc) : null;
    if (!loc && postcodesIo) { try { loc = await lookupPostcodesIo(postcodesIo, pc); } catch { /* fall through */ } }
    if (!loc) return { error: `We could not find ${pc} in our local postcode data. Check it, or enter your address manually.`, postcode: pc, not_found: true };
    return { location: loc };
  }
  app.get("/api/location/postcode", async (c) => {
    const r = await locate(c.req.query("postcode")); if (r.error) return c.json(r, r.not_found ? 404 : 400);
    return c.json({ ...r, caveats: caveatsFor(r.location) });
  });

  app.post("/api/address/normalise", async (c) => {
    try { return c.json(await normaliseAddress(await c.req.json(), { libpostalUrl })); } catch (e) { return bad(c, e.issues ? e.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") : e.message); }
  });

  const providerView = (p) => ({ id: p.id, name: p.name, url: p.link_check?.final_url ?? p.url, link_ok: p.link_check ? p.link_check.status === 200 : null, handoff: approved.has(p.id) ? `/api/handoff/${p.id}` : null });
  app.get("/api/providers", (c) => {
    const district = c.req.query("district"), area = c.req.query("area");
    const list = [...providers.values()].filter((p) => (!p.districts || !district || p.districts.includes(district)) && (!p.areas || !area || p.areas.includes(area)));
    return c.json({ note: "Directory of provider websites. Not a list of what is available at your address.", providers: list.map(providerView) });
  });

  app.get("/api/offers", async (c) => {
    const r = await locate(c.req.query("postcode")); if (r.error) return c.json(r, r.not_found ? 404 : 400);
    const cur = catalogue.current();
    const offers = catalogue.offersFor(r.location.area).map((o) => ({ ...o, provider: providers.get(o.provider_id) ? providerView(providers.get(o.provider_id)) : null, copy: OFFER_COPY }));
    return c.json({ location: r.location, catalogue_version: cur.version, published_at: cur.published_at, offers, caveats: caveatsFor(r.location), empty_reason: offers.length ? null : cur.version === 0 ? "No reviewed offers have been published yet. You can still compare quotes you've been given." : "No published offers match this area. You can still compare quotes you've been given." });
  });

  const runCompare = (body) => runCompareCore(body, catalogue.current(), (id) => (providers.get(id) ? providerView(providers.get(id)) : null));
  app.post("/api/compare", async (c) => { try { return c.json(runCompare(await c.req.json())); } catch (e) { return bad(c, e.issues ? e.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") : e.message); } });

  // Session records: comparison inputs + results, stored locally (JSONL). Address is never stored; only the postcode district.
  app.post("/api/sessions", async (c) => {
    try {
      const body = await c.req.json(); const result = runCompare(body);
      const id = randomUUID(); const pc = normalisePostcode(body.postcode ?? "");
      const rec = { id, created_at: new Date().toISOString(), outward: pc ? pc.split(" ")[0] : null, catalogue_version: catalogue.current().version, engine_version: result.engine_version, request: { ...result.request, postcode: undefined }, results: result.results.map(({ schedule, ...r }) => r), stay: result.stay };
      appendFileSync(join(sessionsDir, `${rec.created_at.slice(0, 10)}.jsonl`), JSON.stringify(rec) + "\n");
      writeFileSync(join(sessionsDir, `${id}.json`), JSON.stringify(rec));
      return c.json({ id, record: rec }, 201);
    } catch (e) { return bad(c, e.issues ? e.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") : e.message); }
  });
  app.get("/api/sessions/:id", (c) => { const id = c.req.param("id"); if (!/^[0-9a-f-]{36}$/.test(id)) return bad(c, "bad id"); const f = join(sessionsDir, `${id}.json`); return existsSync(f) ? c.json(JSON.parse(readFileSync(f, "utf8"))) : bad(c, "not found", 404); });

  // Approved provider handoff: only providers in config/handoff.json. Logs the handoff against the session.
  app.get("/api/handoff/:provider", (c) => {
    const p = providers.get(c.req.param("provider")); if (!p || !approved.has(p.id)) return bad(c, "No approved handoff for this provider", 404);
    const sid = c.req.query("session"); appendFileSync(join(sessionsDir, "handoffs.jsonl"), JSON.stringify({ at: new Date().toISOString(), provider: p.id, session: /^[0-9a-f-]{36}$/.test(sid ?? "") ? sid : null }) + "\n");
    return c.redirect(p.link_check?.final_url ?? p.url, 302);
  });

  // Stage 2: private bill processing. Browser uploads here; the server queues it; only the worker talks to Docling.
  app.post("/api/bills", async (c) => {
    if (!bills) return c.json({ error: "Bill upload is not enabled on this server yet. Enter your current deal manually." }, 503);
    const form = await c.req.parseBody(); const f = form.file;
    if (!f || typeof f === "string") return bad(c, "Attach a PDF or image as 'file'");
    if (f.size > 10 * 1024 * 1024) return bad(c, "File too large (max 10 MB)");
    if (!/^(application\/pdf|image\/(png|jpeg))$/.test(f.type)) return bad(c, "PDF, PNG or JPEG only");
    const id = await bills.enqueue(Buffer.from(await f.arrayBuffer()), { name: f.name, type: f.type });
    return c.json({ id, status: "queued" }, 202);
  });
  app.get("/api/bills/:id", async (c) => { if (!bills) return c.json({ error: "Bill upload is not enabled" }, 503); const s = await bills.status(c.req.param("id")); return s ? c.json(s) : bad(c, "not found", 404); });

  return app;
}
