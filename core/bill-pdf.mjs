// Browser-only bill reading. Everything happens on this device: the file is never uploaded.
// PDFs with a text layer are read with pdf.js, which is self-hosted next to this bundle under /vendor/pdfjs/.
// Photos and scanned (image-only) PDFs would need OCR; that is deliberately not shipped (too heavy for a static page).
// The manual-entry form gives the same result.
import { extractBill } from "./bill-extract.mjs";

export const BILL_PRIVACY = "Your bill is read on this device only. Nothing is uploaded or stored.";
export const OCR_DEFERRED = "We can't read photos or scanned bills on this device yet. Please type the values from your bill into the form below; the comparison works exactly the same.";

let pdfjsP = null;
function loadPdfjs(base) {
  pdfjsP ??= import(/* @vite-ignore */ `${base}/vendor/pdfjs/pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `${base}/vendor/pdfjs/pdf.worker.min.mjs`; return m; });
  return pdfjsP;
}

export async function pdfToText(base, bytes) {
  const pdfjs = await loadPdfjs(base);
  const doc = await pdfjs.getDocument({ data: bytes, cMapUrl: `${base}/vendor/pdfjs/cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}/vendor/pdfjs/standard_fonts/`, isEvalSupported: false, useSystemFonts: false }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    let line = "", lines = [];
    for (const it of tc.items) { line += it.str; if (it.hasEOL) { lines.push(line); line = ""; } }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
  }
  await doc.destroy();
  return pages.join("\n");
}

/** @param file a File/Blob from <input type=file> */
export async function readBillFile(base, file) {
  const name = (file.name ?? "").toLowerCase(), type = file.type ?? "";
  if (type.startsWith("text/") || name.endsWith(".txt")) return { kind: "text", ...extractBill(await file.text()) };
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const text = await pdfToText(base, new Uint8Array(await file.arrayBuffer()));
    if (text.replace(/\s/g, "").length < 20) return { kind: "pdf-image-only", fields: {}, evidence: {}, missing: ["provider", "monthly_pence", "bill_total_pence", "contract_end", "exit_fee_pence"], note: OCR_DEFERRED };
    return { kind: "pdf", ...extractBill(text) };
  }
  if (type.startsWith("image/")) return { kind: "image", fields: {}, evidence: {}, missing: ["provider", "monthly_pence", "bill_total_pence", "contract_end", "exit_fee_pence"], note: OCR_DEFERRED };
  throw new Error("Please choose a PDF or text file, or type the values in.");
}

/** Whole months from `today` until a contract end date found on a bill ("14 March 2027" or "14/03/2027"). */
export function monthsUntil(dateText, today = new Date()) {
  if (!dateText) return null;
  let d;
  const m = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); else d = new Date(Date.parse(dateText + " UTC"));
  if (Number.isNaN(d.getTime())) return null;
  const months = (d.getUTCFullYear() - today.getUTCFullYear()) * 12 + (d.getUTCMonth() - today.getUTCMonth()) - (d.getUTCDate() < today.getUTCDate() ? 1 : 0);
  return Math.max(0, Math.min(36, months));
}
