import { useState, useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { api, toPence, fmt } from "./api.js";

const OFFER_COPY = "Published offer. Check availability with the provider.";
const thisMonth = () => new Date().toISOString().slice(0, 7);

function PostcodeStep({ onFound }) {
  const [err, setErr] = useState(null);
  const form = useForm({ defaultValues: { postcode: "" }, onSubmit: async ({ value }) => {
    setErr(null);
    try { const [loc, offers] = await Promise.all([api(`/api/location/postcode?postcode=${encodeURIComponent(value.postcode)}`), api(`/api/offers?postcode=${encodeURIComponent(value.postcode)}`)]); onFound({ ...loc, offers }); }
    catch (e) { setErr(e.message); onFound(null); }
  } });
  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
      <form.Field name="postcode" validators={{ onSubmit: ({ value }) => (/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(value.trim()) ? undefined : "Enter a full UK postcode, e.g. SW1A 1AA") }}>
        {(f) => (<><label htmlFor="postcode">Your postcode</label><input id="postcode" name="postcode" autoComplete="postal-code" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
          {f.state.meta.errors.length ? <p className="err" role="alert">{f.state.meta.errors.join(", ")}</p> : null}</>)}
      </form.Field>
      <button type="submit">Find my area</button>
      {err ? <p className="err" role="alert">{err}</p> : null}
    </form>
  );
}

function AddressStep({ postcode, onDone }) {
  const [res, setRes] = useState(null); const [err, setErr] = useState(null);
  const form = useForm({ defaultValues: { line1: "", line2: "", town: "", postcode }, onSubmit: async ({ value }) => {
    setErr(null); try { const r = await api("/api/address/normalise", { method: "POST", body: JSON.stringify(value) }); setRes(r); onDone(r.normalised); } catch (e) { setErr(e.message); }
  } });
  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
      <div className="row">{[["line1", "Address line 1", "address-line1"], ["line2", "Address line 2 (optional)", "address-line2"], ["town", "Town", "address-level2"]].map(([name, label, ac]) => (
        <form.Field key={name} name={name}>{(f) => (<div><label htmlFor={name}>{label}</label><input id={name} autoComplete={ac} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} /></div>)}</form.Field>))}</div>
      <button type="submit" className="secondary">Use this address</button>
      {err ? <p className="err">{err}</p> : null}
      {res ? <p className="mut" data-testid="address-result">{[res.normalised.line1, res.normalised.line2, res.normalised.town, res.normalised.postcode].filter(Boolean).join(", ")} — {res.note}</p> : null}
    </form>
  );
}

const col = createColumnHelper();
function Results({ data }) {
  const [sorting, setSorting] = useState([{ id: "rank", desc: false }]);
  const columns = useMemo(() => [
    col.accessor("rank", { header: "#" }),
    col.accessor("label", { header: "Deal", cell: (c) => (<><b>{c.getValue()}</b><div className="copy">{c.row.original.copy}</div>{c.row.original.cashback_note ? <div className="mut">{c.row.original.cashback_note}</div> : null}</>) }),
    col.accessor("first_month_pence", { header: "First month", cell: (c) => fmt(c.getValue()) }),
    col.accessor("total_pence", { header: "Contract total", cell: (c) => fmt(c.getValue()) }),
    col.accessor("switch_total_pence", { header: "Total incl. exit fee", cell: (c) => fmt(c.getValue()) }),
    col.accessor("vs_stay_pence", { header: "vs staying", cell: (c) => (c.getValue() == null ? "—" : fmt(c.getValue())) }),
    col.display({ id: "provider", header: "Provider", cell: (c) => { const p = c.row.original.provider; return p ? <a href={p.handoff ?? p.url} target="_blank" rel="noopener nofollow">Check availability with {p.name}</a> : "—"; } }),
  ], []);
  const table = useReactTable({ data: data.results, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  return (
    <>
      <table data-testid="results"><thead>{table.getHeaderGroups().map((hg) => (<tr key={hg.id}>{hg.headers.map((h) => (<th key={h.id}>{h.column.getCanSort() ? <button onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}</button> : flexRender(h.column.columnDef.header, h.getContext())}</th>))}</tr>))}</thead>
        <tbody>{table.getRowModel().rows.map((r) => (<tr key={r.id}>{r.getVisibleCells().map((c) => <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>))}</tbody></table>
      {data.stay ? <p className="mut" data-testid="stay">Staying for {data.horizon_months} months would cost {data.stay.total} ({data.stay.months_in_contract} in contract, {data.stay.months_out_of_contract} out of contract). Exit fee if you leave now: {data.stay.exit_fee}.</p> : null}
      <p className="mut">{data.method}</p>
    </>
  );
}

export function App() {
  const [area, setArea] = useState(null);
  const [selected, setSelected] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [current, setCurrent] = useState({ monthly: "", ooc: "", months_left: "0", exit_fee: "0" });
  const [q, setQ] = useState({ label: "", monthly: "", upfront: "0", months: "24", rise: "0" });
  const [result, setResult] = useState(null); const [err, setErr] = useState(null); const [session, setSession] = useState(null);
  const offers = area?.offers?.offers ?? [];

  function addQuote(e) {
    e.preventDefault(); const m = toPence(q.monthly), u = toPence(q.upfront || "0"), r = toPence(q.rise || "0");
    if (!q.label.trim() || Number.isNaN(m) || Number.isNaN(u) || Number.isNaN(r)) { setErr("Quote needs a name and prices like 29.99"); return; }
    setErr(null); setQuotes([...quotes, { label: q.label.trim(), monthly_pence: m, upfront_pence: u, contract_months: Number(q.months), annual_rise_pence: r, rise_month: r ? 4 : undefined }]); setQ({ label: "", monthly: "", upfront: "0", months: "24", rise: "0" });
  }
  function body() {
    const cm = toPence(current.monthly);
    return { postcode: area?.location?.postcode, start: thisMonth(), offer_ids: selected, quotes,
      current: Number.isNaN(cm) ? undefined : { monthly_pence: cm, out_of_contract_monthly_pence: Number.isNaN(toPence(current.ooc)) ? undefined : toPence(current.ooc), months_left: Number(current.months_left || 0), exit_fee_pence: Number.isNaN(toPence(current.exit_fee)) ? 0 : toPence(current.exit_fee) } };
  }
  async function run() { setErr(null); setSession(null); try { setResult(await api("/api/compare", { method: "POST", body: JSON.stringify(body()) })); } catch (e) { setErr(e.message); } }
  async function save() { try { const s = await api("/api/sessions", { method: "POST", body: JSON.stringify(body()) }); setSession(s.id); } catch (e) { setErr(e.message); } }

  return (
    <main>
      <h1>Compare the real cost of broadband</h1>
      <p className="mut">Independent. We compare full contract costs from offers we have reviewed and published, plus any quotes you enter. We do not take orders and cannot confirm availability. The provider does that.</p>
      <section aria-labelledby="s1"><h2 id="s1">1. Your area</h2><PostcodeStep onFound={(a) => { setArea(a); setSelected([]); setResult(null); }} />
        {area ? (<div data-testid="area"><p><b>{area.location.postcode}</b>: {area.location.district}{area.location.ward ? `, ${area.location.ward}` : ""} ({area.location.country}) <span className="pill">{area.location.source}</span></p>
          {area.caveats.map((c) => <div className="caveat" key={c.code} data-caveat={c.code}>{c.text}</div>)}</div>) : null}
      </section>
      {area ? (<>
        <section aria-labelledby="s2"><h2 id="s2">2. Your address (optional)</h2><p className="mut">Type it yourself. We tidy the format but do not verify it.</p><AddressStep postcode={area.location.postcode} onDone={() => {}} /></section>
        <section aria-labelledby="s3"><h2 id="s3">3. Your current deal (optional)</h2>
          <div className="row">
            <div><label htmlFor="cur-monthly">Monthly price now (£)</label><input id="cur-monthly" value={current.monthly} onChange={(e) => setCurrent({ ...current, monthly: e.target.value })} /></div>
            <div><label htmlFor="cur-ooc">Price after contract ends (£)</label><input id="cur-ooc" value={current.ooc} onChange={(e) => setCurrent({ ...current, ooc: e.target.value })} /></div>
            <div><label htmlFor="cur-left">Months left in contract</label><input id="cur-left" value={current.months_left} onChange={(e) => setCurrent({ ...current, months_left: e.target.value })} /></div>
            <div><label htmlFor="cur-exit">Exit fee if you leave now (£)</label><input id="cur-exit" value={current.exit_fee} onChange={(e) => setCurrent({ ...current, exit_fee: e.target.value })} /></div>
          </div></section>
        <section aria-labelledby="s4"><h2 id="s4">4. Deals to compare</h2>
          {offers.length ? (<ul data-testid="offers">{offers.map((o) => (<li key={o.id}><label style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={selected.includes(o.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))} /> {o.provider?.name ?? o.provider_id}: {o.name}, {fmt(o.monthly_pence)}/month, {o.contract_months} months</label><div className="copy">{o.copy}</div><div className="mut">Seen {o.observed_at.slice(0, 10)} at <a href={o.source_url} rel="nofollow noopener" target="_blank">source</a> · catalogue v{area.offers.catalogue_version}</div></li>))}</ul>)
            : <p className="mut" data-testid="no-offers">{area.offers.empty_reason}</p>}
          <form onSubmit={addQuote}><h3>Add a quote you've been given</h3><div className="row">
            <div><label htmlFor="q-label">Provider / deal</label><input id="q-label" value={q.label} onChange={(e) => setQ({ ...q, label: e.target.value })} /></div>
            <div><label htmlFor="q-monthly">Monthly (£)</label><input id="q-monthly" value={q.monthly} onChange={(e) => setQ({ ...q, monthly: e.target.value })} /></div>
            <div><label htmlFor="q-upfront">Upfront (£)</label><input id="q-upfront" value={q.upfront} onChange={(e) => setQ({ ...q, upfront: e.target.value })} /></div>
            <div><label htmlFor="q-months">Contract months</label><select id="q-months" value={q.months} onChange={(e) => setQ({ ...q, months: e.target.value })}>{[1, 12, 18, 24].map((m) => <option key={m}>{m}</option>)}</select></div>
            <div><label htmlFor="q-rise">April rise (£/month)</label><input id="q-rise" value={q.rise} onChange={(e) => setQ({ ...q, rise: e.target.value })} /></div>
          </div><button type="submit" className="secondary">Add quote</button></form>
          {quotes.length ? <ul data-testid="quotes">{quotes.map((x, i) => <li key={i}>{x.label}: {fmt(x.monthly_pence)}/month, {x.contract_months} months</li>)}</ul> : null}
          <button onClick={run} disabled={!selected.length && !quotes.length}>Compare total cost</button>
          {err ? <p className="err" role="alert">{err}</p> : null}
        </section>
        {result ? (<section aria-labelledby="s5"><h2 id="s5">5. Results over {result.horizon_months} months</h2><Results data={result} />
          <button className="secondary" onClick={save}>Save this comparison</button>{session ? <p className="mut" data-testid="session">Saved. Reference: <code>{session}</code></p> : null}</section>) : null}
      </>) : null}
      <p className="mut">Postcode data: Contains OS data © Crown copyright and database right; Royal Mail data © Royal Mail copyright and database right; National Statistics data © Crown copyright and database right.</p>
    </main>
  );
}
