// Starts the real server against staged data with an isolated data dir. mode=fixture uses the TEST FIXTURE catalogue; mode=empty = production default (nothing published).
import { mkdtempSync, symlinkSync, cpSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [port, mode] = process.argv.slice(2);
const ROOT = new URL("..", import.meta.url).pathname;
const data = mkdtempSync(join(tmpdir(), `ots-e2e-${mode}-`));
symlinkSync(join(ROOT, "data", "postcodes"), join(data, "postcodes"));
if (existsSync(join(ROOT, "data", "providers.json"))) copyFileSync(join(ROOT, "data", "providers.json"), join(data, "providers.json"));
const cat = join(data, "catalogue");
if (mode === "fixture") cpSync(join(ROOT, "tests", "fixtures", "catalogue"), cat, { recursive: true });
Object.assign(process.env, { PORT: port, OTS_DATA_DIR: data, OTS_CATALOGUE_DIR: cat });
await import("../server/index.mjs");
