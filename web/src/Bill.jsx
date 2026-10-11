import { useState } from "react";
import { ots, poundsOf, toPence, fmt } from "./api.js";
import { BILL_PRIVACY, monthsUntil } from "../../core/static-client.mjs";

const LABELS = { provider: "Provider", monthly_pence: "Monthly price (£)", bill_total_pence: "Bill total (£)", contract_end: "Contract ends", exit_fee_pence: "Exit fee (£)" };
const show = (k, v) => (k.endsWith("_pence") ? poundsOf(v) : String(v ?? ""));

export function BillPanel({ onConfirm }) {
  const [res, setRes] = useState(null); const [vals, setVals] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [paste, setPaste] = useState(""); const [done, setDone] = useState(null);
  function load(r) { setRes(r); setDone(null); setVals(Object.fromEntries(Object.keys(LABELS).map((k) => [k, r.fields[k] != null ? show(k, r.fields[k]) : ""]))); }
  async function onFile(e) { const f = e.target.files?.[0]; if (!f) return; setErr(null); setBusy(true); try { load(await ots.readBill(f)); } catch (x) { setErr(x.message || "We couldn't read that file. Type the values in instead."); } finally { setBusy(false); e.target.value = ""; } }
  function confirm() {
    const months = monthsUntil(vals.contract_end);
    const v = { monthly: vals.monthly_pence && !Number.isNaN(toPence(vals.monthly_pence)) ? vals.monthly_pence : null, exit_fee: vals.exit_fee_pence && !Number.isNaN(toPence(vals.exit_fee_pence)) ? vals.exit_fee_pence : null, months_left: months != null ? String(months) : null };
    onConfirm(v); setDone(v);
  }
  return (
    <details className="bill" data-testid="bill">
      <summary>Fill this in from your bill (optional)</summary>
      <p className="mut">{BILL_PRIVACY} PDFs with text and text files work. For photos or scanned bills, type the values into the form below.</p>
      <div className="row"><div><label htmlFor="bill-file">Choose your bill (PDF or text)</label><input id="bill-file" type="file" accept=".pdf,.txt,application/pdf,text/plain,image/*" onChange={onFile} /></div></div>
      <label htmlFor="bill-text">Or paste the text of your bill</label>
      <textarea id="bill-text" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} />
      <button type="button" className="secondary" onClick={() => load(ots.extractBillText(paste))} disabled={!paste.trim()}>Read pasted text</button>
      {busy ? <p className="mut">Reading on this device…</p> : null}
      {err ? <p className="err" role="alert">{err}</p> : null}
      {res ? (<div data-testid="bill-confirm">
        <p className="mut">{res.note}</p>
        <table><thead><tr><th>Field</th><th>Value (check and correct)</th><th>Found on your bill</th></tr></thead><tbody>
          {Object.entries(LABELS).map(([k, l]) => (<tr key={k}><td><label htmlFor={`bill-${k}`}>{l}</label></td><td><input id={`bill-${k}`} value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></td><td className="mut">{res.evidence?.[k] ?? "Not found. Type it in if you know it."}</td></tr>))}
        </tbody></table>
        {vals.contract_end && monthsUntil(vals.contract_end) != null ? <p className="mut">That's about {monthsUntil(vals.contract_end)} months left on your contract.</p> : null}
        <button type="button" onClick={confirm}>Use these values</button>
        {done ? <p className="mut" data-testid="bill-used">Copied to your current deal{done.monthly ? `: ${fmt(toPence(done.monthly))}/month` : ""}{done.exit_fee ? `, exit fee ${fmt(toPence(done.exit_fee))}` : ""}{done.months_left != null ? `, ${done.months_left} months left` : ""}. Add the price after your contract ends if you know it.</p> : null}
      </div>) : null}
    </details>
  );
}
