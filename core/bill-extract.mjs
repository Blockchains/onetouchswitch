// Stage 2: deterministic field extraction from Docling markdown/text of a broadband bill.
// Returns only what is literally present; every field carries the matched snippet. Nothing is guessed.
const money = (s) => { const m = s.match(/£\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/); return m ? Math.round(Number(m[1].replace(/,/g, "")) * 100) : null; };
const PROVIDERS = ["BT", "Sky", "Virgin Media", "TalkTalk", "Vodafone", "EE", "Plusnet", "NOW", "Hyperoptic", "Community Fibre", "Zen", "Cuckoo", "YouFibre", "Trooli", "Gigaclear", "KCOM", "Lit Fibre", "Three", "Utility Warehouse"];
export function extractBill(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const find = (rx) => lines.find((l) => rx.test(l)) ?? null;
  const out = { fields: {}, evidence: {} };
  const set = (k, v, ev) => { if (v !== null && v !== undefined) { out.fields[k] = v; out.evidence[k] = ev; } };
  const prov = PROVIDERS.find((p) => new RegExp(`\\b${p.replace(" ", "\\s")}\\b`, "i").test(lines.slice(0, 15).join(" ")));
  set("provider", prov ?? null, prov ? lines.slice(0, 15).find((l) => new RegExp(prov, "i").test(l)) : null);
  const monthly = find(/(monthly|per month|a month|broadband).*£\s?\d/i); set("monthly_pence", monthly ? money(monthly) : null, monthly);
  const total = find(/(total (amount )?(due|to pay)|amount due|bill total).*£\s?\d/i); set("bill_total_pence", total ? money(total) : null, total);
  const end = find(/(contract|minimum term).*(end|until|expires?)/i);
  const d = end?.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  set("contract_end", d ? d[1] : null, end);
  const etc = find(/(early (termination|exit)|leave early|cancellation charge).*£\s?\d/i); set("exit_fee_pence", etc ? money(etc) : null, etc);
  const speed = find(/(\d{2,4})\s?(Mb|Mbps|Mbit)/i); const sm = speed?.match(/(\d{2,4})\s?(Mb|Mbps|Mbit)/i); set("speed_mbps", sm ? Number(sm[1]) : null, speed);
  out.missing = ["provider", "monthly_pence", "bill_total_pence", "contract_end", "exit_fee_pence"].filter((k) => !(k in out.fields));
  out.note = "Extracted from your bill text. Please confirm each value. Anything missing must be entered manually.";
  return out;
}
