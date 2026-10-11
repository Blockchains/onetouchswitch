import { useMemo, useState, Fragment } from "react";
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { fmt } from "./api.js";

const col = createColumnHelper();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ym = (s) => { const [y, m] = s.split("-"); return `${MONTHS[Number(m) - 1]} ${y}`; };
/** Group a monthly schedule into runs of the same price: "Oct 2026 – Mar 2027: 6 × £29.99". */
export function scheduleRuns(schedule = []) {
  const runs = [];
  for (const s of schedule) { const last = runs.at(-1); if (last && last.pence === s.pence) { last.to = s.ym; last.n++; } else runs.push({ from: s.ym, to: s.ym, n: 1, pence: s.pence }); }
  return runs.map((r) => `${ym(r.from)}${r.n > 1 ? ` – ${ym(r.to)}` : ""}: ${r.n} × ${fmt(r.pence)}`);
}
const vsText = (p) => (p == null ? "—" : p === 0 ? "Same as staying" : p < 0 ? `${fmt(-p)} less` : `${fmt(p)} more`);

export function Results({ data, readOnly = false }) {
  const [sorting, setSorting] = useState([{ id: "rank", desc: false }]);
  const [shortlist, setShortlist] = useState(() => new Set());
  const [view, setView] = useState("all");
  const [open, setOpen] = useState(() => new Set());
  const exitFee = data.stay?.exit_fee_pence ?? 0;
  const toggle = (set, setter, id) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n); };
  const columns = useMemo(() => [
    ...(readOnly ? [] : [col.display({ id: "star", header: "Shortlist", cell: (c) => { const on = shortlist.has(c.row.original.id); return <button type="button" className="star" aria-pressed={on} aria-label={`${on ? "Remove" : "Add"} ${c.row.original.label} ${on ? "from" : "to"} shortlist`} onClick={() => toggle(shortlist, setShortlist, c.row.original.id)}>{on ? "★" : "☆"}</button>; } })]),
    col.accessor("rank", { header: "#" }),
    col.accessor("label", { header: "Deal", cell: (c) => { const r = c.row.original; return (<><b>{r.label}</b><div className="copy">{r.copy}</div>{r.cashback_note ? <div className="mut">{r.cashback_note}</div> : null}{r.beyond_contract_note ? <div className="mut">{r.beyond_contract_note}</div> : null}</>); } }),
    col.accessor("contract_months", { header: "Contract", cell: (c) => `${c.getValue()} months${c.row.original.upfront_pence ? `, ${fmt(c.row.original.upfront_pence)} upfront` : ""}` }),
    col.accessor("first_month_pence", { header: "First month", cell: (c) => fmt(c.getValue()) }),
    col.accessor("total_pence", { header: `Total over ${data.horizon_months} months`, cell: (c) => fmt(c.getValue()) }),
    col.display({ id: "exit", header: "Your exit fee", cell: () => (data.stay ? fmt(exitFee) : "—") }),
    col.accessor("switch_total_pence", { header: "Total incl. exit fee", cell: (c) => fmt(c.getValue()) }),
    col.accessor("vs_stay_pence", { header: "vs staying", cell: (c) => vsText(c.getValue()) }),
    col.display({ id: "provider", header: "Provider", cell: (c) => { const r = c.row.original; const p = r.provider; const name = p?.name ?? r.provider_name; if (!name) return "—"; if (!p) return name;
      return (<><a href={p.handoff ?? p.url} target="_blank" rel="nofollow noopener">Check availability with {p.name}</a>{p.handoff && p.handoff_disclosure ? <div className="mut">{p.handoff_disclosure}</div> : null}</>); } }),
  ], [shortlist, data, readOnly]);
  const rows = useMemo(() => (view === "shortlist" ? data.results.filter((r) => shortlist.has(r.id)) : data.results), [view, shortlist, data]);
  const table = useReactTable({ data: rows, columns, getRowId: (r) => r.id, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  return (
    <>
      {readOnly ? null : <div className="tabs" role="group" aria-label="Which results">
        <button type="button" className={view === "all" ? "" : "secondary"} aria-pressed={view === "all"} onClick={() => setView("all")}>View all ({data.results.length})</button>
        <button type="button" className={view === "shortlist" ? "" : "secondary"} aria-pressed={view === "shortlist"} onClick={() => setView("shortlist")}>Shortlist ({shortlist.size})</button></div>}
      {view === "shortlist" && !rows.length ? <p className="mut" data-testid="shortlist-empty">Your shortlist is empty. Tap ☆ next to a deal to add it.</p> : null}
      <div className="scroll"><table data-testid="results"><thead>{table.getHeaderGroups().map((hg) => (<tr key={hg.id}>{hg.headers.map((h) => (<th key={h.id}>{h.column.getCanSort() ? <button type="button" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{{ asc: " ▲", desc: " ▼" }[h.column.getIsSorted()] ?? ""}</button> : flexRender(h.column.columnDef.header, h.getContext())}</th>))}</tr>))}</thead>
        <tbody>{table.getRowModel().rows.map((r) => (<Fragment key={r.id}>
          <tr data-row={r.id}>{r.getVisibleCells().map((c) => <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>
          {r.original.schedule ? <tr className="detail"><td colSpan={r.getVisibleCells().length}><button type="button" className="link" aria-expanded={open.has(r.id)} onClick={() => toggle(open, setOpen, r.id)}>{open.has(r.id) ? "Hide" : "Show"} how {r.original.label} adds up</button>
            {open.has(r.id) ? <ul className="mut" data-testid={`breakdown-${r.id}`}>{scheduleRuns(r.original.schedule).map((t) => <li key={t}>{t}</li>)}{r.original.upfront_pence ? <li>Upfront: {fmt(r.original.upfront_pence)}</li> : null}{data.stay ? <li>Your current exit fee if you switch now: {fmt(exitFee)}</li> : null}<li>Total incl. exit fee: {fmt(r.original.switch_total_pence)}</li></ul> : null}</td></tr> : null}
        </Fragment>))}</tbody></table></div>
      {data.stay ? <p className="mut" data-testid="stay">Staying for {data.horizon_months} months would cost {data.stay.total} ({data.stay.months_in_contract} in contract, {data.stay.months_out_of_contract} out of contract). Exit fee if you leave now: {data.stay.exit_fee}.</p> : <p className="mut">Add your current deal above to see how each option compares with staying.</p>}
      <p className="mut">{data.method}</p>
    </>
  );
}
