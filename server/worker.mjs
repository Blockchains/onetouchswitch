// Stage 2 worker: the ONLY component that calls docling-serve (DOCLING_URL, private network). Deletes the file after processing.
import { Worker } from "bullmq";
import { readFileSync, rmSync } from "node:fs";
import { extractBill } from "../core/bill-extract.mjs";
const DOCLING = process.env.DOCLING_URL; const REDIS = process.env.REDIS_URL;
if (!DOCLING || !REDIS) { console.error("Set DOCLING_URL and REDIS_URL"); process.exit(1); }
export async function doclingConvert(path, name, type) {
  const fd = new FormData(); fd.append("files", new Blob([readFileSync(path)], { type }), name || "bill");
  fd.append("to_formats", "md"); fd.append("do_ocr", "true");
  const r = await fetch(`${DOCLING.replace(/\/$/, "")}/v1/convert/file`, { method: "POST", body: fd, signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error(`docling-serve ${r.status}`);
  const j = await r.json(); return j.document?.md_content ?? "";
}
new Worker("bills", async (job) => {
  try { const md = await doclingConvert(job.data.path, job.data.name, job.data.type); return { ...extractBill(md), chars: md.length }; }
  finally { rmSync(job.data.path, { force: true }); }
}, { connection: { url: REDIS }, concurrency: 2 });
console.log("bill worker running");
