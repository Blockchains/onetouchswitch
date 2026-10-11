// Writes tests/fixtures/bill.pdf: a minimal text PDF (Helvetica, WinAnsi so £ works) of bill.txt. TEST FIXTURE.
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const lines = readFileSync(dir + "bill.txt", "utf8").trim().split("\n");
const esc = (s) => s.replace(/[\\()]/g, (c) => "\\" + c).replace(/£/g, "\\243").replace(/—/g, "-");
const content = "BT /F1 12 Tf 14 TL 50 780 Td\n" + lines.map((l) => `(${esc(l)}) Tj T*`).join("\n") + "\nET";
const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"];
let out = "%PDF-1.4\n"; const offs = [];
objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, "latin1")); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = Buffer.byteLength(out, "latin1");
out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(dir + "bill.pdf", Buffer.from(out, "latin1"));
console.log("wrote bill.pdf", out.length, "bytes");
