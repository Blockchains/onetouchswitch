// Stage local data (run ONLINE, once per release). After this the app and tests run with the network disabled.
//  - OS Code-Point Open (OGL): every GB postcode -> data/postcodes/<area>.json + names.json + meta.json
//  - Provider directory URL checks -> data/providers.json
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";

const ROOT = new URL("..", import.meta.url).pathname;
const DATA = process.env.OTS_DATA_DIR ?? join(ROOT, "data");
const CPO_URL = process.env.CPO_URL ?? "https://api.os.uk/downloads/v1/products/CodePointOpen/downloads?area=GB&format=CSV&redirect";
const ONLY = process.env.STAGE_AREAS ? new Set(process.env.STAGE_AREAS.toLowerCase().split(",")) : null;
const tmp = join(DATA, ".tmp"); mkdirSync(tmp, { recursive: true });
const out = join(DATA, "postcodes"); mkdirSync(out, { recursive: true });

async function stagePostcodes() {
  const zip = join(tmp, "codepo_gb.zip");
  if (!existsSync(zip)) { const r = await fetch(CPO_URL); if (!r.ok) throw new Error(`Code-Point Open HTTP ${r.status}`); writeFileSync(zip, Buffer.from(await r.arrayBuffer())); }
  const sha = createHash("sha256").update(readFileSync(zip)).digest("hex");
  rmSync(join(tmp, "cpo"), { recursive: true, force: true });
  execFileSync("unzip", ["-q", "-o", zip, "-d", join(tmp, "cpo")]);
  const csvDir = join(tmp, "cpo", "Data", "CSV");
  let total = 0; const areas = [];
  for (const f of readdirSync(csvDir).filter((f) => f.endsWith(".csv")).sort()) {
    const area = f.replace(".csv", ""); if (ONLY && !ONLY.has(area)) continue;
    const rows = readFileSync(join(csvDir, f), "utf8").split(/\r?\n/).filter(Boolean).map((l) => {
      const c = l.split(",").map((x) => x.replace(/^"|"$/g, ""));
      const pc = c[0].replace(/\s+/g, ""); const norm = `${pc.slice(0, -3)} ${pc.slice(-3)}`;
      return [norm, Number(c[1]), Number(c[2]), Number(c[3]), c[4], c[8], c[9], c[7]];
    });
    writeFileSync(join(out, `${area}.json`), JSON.stringify({ area: area.toUpperCase(), count: rows.length, rows }));
    total += rows.length; areas.push(area.toUpperCase());
  }
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(join(tmp, "cpo", "Doc", "Codelist.xlsx"));
  const names = {}; wb.eachSheet((ws) => { if (["Sheet1", "AREA_CODES"].includes(ws.name)) return; ws.eachRow((row) => { const [, name, code] = row.values; if (typeof code === "string" && /^[A-Z]\d{8}$/.test(code)) names[code] = String(name).replace(/ (District|London Boro|County|Ward|ED)\b.*$/, "").replace(/ \(B\)$/, "").trim(); }); });
  writeFileSync(join(out, "names.json"), JSON.stringify(names));
  const md = readFileSync(join(tmp, "cpo", "Doc", "metadata.txt"), "latin1");
  const version = (md.match(/(?:Product version|Version|Edition)[^\n]*?:\s*([^\n]+)/i)?.[1] ?? "unknown").trim();
  const meta = { source: "OS Code-Point Open (GB)", licence: "Open Government Licence v3.0 — Contains OS data © Crown copyright and database right; Royal Mail data © Royal Mail copyright and database right; National Statistics data © Crown copyright and database right", url: CPO_URL, sha256: sha, version, staged_at: new Date().toISOString(), postcodes: total, areas, partial: !!ONLY };
  writeFileSync(join(out, "meta.json"), JSON.stringify(meta, null, 1));
  rmSync(join(tmp, "cpo"), { recursive: true, force: true });
  return meta;
}

async function stageProviders() {
  const src = JSON.parse(readFileSync(join(ROOT, "config", "providers.json"), "utf8"));
  const providers = [];
  for (const p of src.providers) {
    let status = null, final_url = null, error = null;
    try { const r = await fetch(p.url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; OneTouchSwitch-link-check/1.0; +https://onetouchswitch.com)" }, signal: AbortSignal.timeout(15000) }); status = r.status; final_url = r.url; } catch (e) { error = String(e.message).slice(0, 120); }
    providers.push({ ...p, link_check: { status, final_url, error, checked_at: new Date().toISOString() } });
  }
  writeFileSync(join(DATA, "providers.json"), JSON.stringify({ staged_at: new Date().toISOString(), note: src.note, providers }, null, 1));
  return providers.filter((p) => p.link_check.status === 200).length + "/" + providers.length + " provider links OK";
}

const [pm, pv] = await Promise.all([stagePostcodes(), stageProviders()]);
writeFileSync(join(DATA, "STAGED.json"), JSON.stringify({ staged_at: new Date().toISOString(), postcodes: { count: pm.postcodes, areas: pm.areas.length, sha256: pm.sha256, version: pm.version, partial: pm.partial }, providers: pv }, null, 1));
console.log(`staged ${pm.postcodes} postcodes in ${pm.areas.length} areas (${pm.version}); ${pv}`);
