import { useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { ots, toPence, poundsOf, fmt, moneyErr, errMsg, UNAVAILABLE } from "./api.js";
import { Results } from "./Results.jsx";
import { BillPanel } from "./Bill.jsx";
import { ManualAddress } from "../../core/address.mjs";

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const PC_RX = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
const fieldErr = (f) => (f.state.meta.errors.length ? <p className="err" role="alert">{f.state.meta.errors.join(", ")}</p> : null);
const zodField = (key) => ({ onSubmit: ({ value }) => { const r = ManualAddress.shape[key].safeParse(value); return r.success ? undefined : r.error.issues[0].message; } });

function Field({ form, name, label, validators, ...rest }) {
  return (<form.Field name={name} validators={validators}>{(f) => (<div><label htmlFor={rest.id ?? name}>{label}</label>
    <input id={rest.id ?? name} value={f.state.value} onBlur={f.handleBlur} onChange={(e) => f.handleChange(e.target.value)} {...rest} />{fieldErr(f)}</div>)}</form.Field>);
}

const canCost = (o) => o.monthly_pence != null && o.contract_months != null;
const speed = (o) => [o.download_mbps != null ? `${o.download_mbps}Mbps down` : null, o.upload_mbps != null ? `${o.upload_mbps}Mbps up` : null].filter(Boolean).join(" / ") || "speed not stated";
const missing = { monthly_pence: "monthly price", contract_months: "contract length", download_mbps: "speed", upload_mbps: "upload speed", exit_fee_pence: "exit fee", annual_rise_pence: "£ price rise", upfront_pence: "one-off fees", price_is_from: "'from' price (depends on address)" };
/** Published offers grouped by provider with a filter. Offers without a published price or contract can't be costed. */
function OfferList({ offers, version, publishedAt, selected, onToggle, onEdit }) {
  const [prov, setProv] = useState("");
  const providers = [...new Map(offers.map((o) => [o.provider_id, o.provider?.name ?? o.provider_id])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const shown = offers.filter((o) => !prov || o.provider_id === prov);
  return (<>
    <div className="row"><div><label htmlFor="prov-filter">Filter by provider</label>
      <select id="prov-filter" value={prov} onChange={(e) => setProv(e.target.value)}><option value="">All providers ({offers.length} offers)</option>{providers.map(([id, n]) => <option key={id} value={id}>{n} ({offers.filter((o) => o.provider_id === id).length})</option>)}</select></div></div>
    <p className="mut" data-testid="catalogue-meta">Catalogue v{version}{publishedAt ? `, published ${publishedAt.slice(0, 10)}` : ""}. Prices were read from each provider's own website on the date shown. Anything a provider's page didn't state is marked, not guessed.</p>
    <ul data-testid="offers" className="offers">{shown.map((o) => (<li key={o.id} data-offer={o.id}>
      <label className="inline"><input type="checkbox" disabled={!canCost(o)} checked={selected.includes(o.id)} onChange={(e) => onToggle(o.id, e.target.checked)} />{" "}
        <b>{o.provider?.name ?? o.provider_id}: {o.name}</b>{", "}
        {o.monthly_pence == null ? "price not published" : `${o.price_is_from ? "from " : ""}${fmt(o.monthly_pence)}/month`}
        {o.intro_months ? ` (first ${o.intro_months} months ${fmt(o.intro_pence)})` : ""}
        {", "}{o.contract_months ? `${o.contract_months} month${o.contract_months > 1 ? "s" : ""}` : "contract length not stated"}
        {o.upfront_pence ? `, ${fmt(o.upfront_pence)} upfront` : ""}{o.annual_rise_pence ? `, +${fmt(o.annual_rise_pence)}/month each year` : ""}
        {o.social_tariff ? <> <span className="pill">Social tariff</span></> : null}{o.needs_review ? <> <span className="pill warn" title={(o.review_flags ?? []).map((f) => missing[f] ?? f).join(", ")}>Needs review</span></> : null}</label>
      <div className="mut">{speed(o)}{o.speed_note ? ` (${o.speed_note})` : ""}{o.technology ? ` · ${o.technology}` : ""}</div>
      {o.rise_rule ? <div className="mut">Price changes: {o.rise_rule}</div> : null}
      {o.exit_fee_pence != null || o.exit_fee_rule ? <div className="mut">Exit fee: {o.exit_fee_pence != null ? fmt(o.exit_fee_pence) : ""}{o.exit_fee_rule ? ` ${o.exit_fee_rule}` : ""}</div> : null}
      {o.one_off_fees?.length ? <div className="mut">One-off: {o.one_off_fees.map((f) => `${f.label} ${f.pence == null ? "not stated" : fmt(f.pence)}`).join("; ")}</div> : null}
      {o.eligibility_notes ? <div className="mut">{o.eligibility_notes}</div> : null}
      {o.needs_review ? <div className="mut" data-testid="review-flags">Not on the provider's page: {(o.review_flags ?? []).map((f) => missing[f] ?? f).join(", ")}.</div> : null}
      {!canCost(o) ? <div className="mut">Can't be costed until the provider publishes a price and contract length. Use "Edit costs" with the figures you're quoted.</div> : null}
      <div className="copy">{o.copy}</div>
      <div className="mut">Seen {(o.retrieved_at ?? o.observed_at).slice(0, 10)} at <a href={o.source_url} rel="nofollow noopener" target="_blank">source</a>{o.reviewed_by ? ` · reviewer: ${o.reviewed_by}` : ""} · catalogue v{version} · <button type="button" className="link" onClick={() => onEdit(o)}>Edit costs</button></div></li>))}</ul>
  </>);
}

function PostcodeStep({ onArea, onNotFound }) {
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const form = useForm({ defaultValues: { postcode: "" }, onSubmit: async ({ value }) => {
    setErr(null); setBusy(true);
    try { const r = await ots.offers(value.postcode); if (r.error) { setErr(r.error); onNotFound(r.status === 404 ? r.postcode : null); } else onArea(r); }
    catch { setErr("We couldn't load postcode data. If you're offline, enter your address manually or continue without a postcode."); onNotFound(null); }
    finally { setBusy(false); }
  } });
  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
      <Field form={form} name="postcode" label="Your postcode" autoComplete="postal-code" validators={{ onSubmit: ({ value }) => (PC_RX.test(value.trim()) ? undefined : "Enter a full UK postcode, e.g. SW1A 1AA") }} />
      <div className="btns"><button type="submit" disabled={busy}>Find my area</button>
        <button type="button" className="secondary" onClick={async () => { setErr(null); try { onArea(await ots.offers(null)); } catch { setErr(UNAVAILABLE); } }}>Continue without a postcode</button></div>
      {err ? <p className="err" role="alert">{err}</p> : null}
    </form>
  );
}

function AddressForm({ postcode, onDone, submitLabel }) {
  const [res, setRes] = useState(null);
  const form = useForm({ defaultValues: { line1: "", line2: "", town: "", postcode: postcode ?? "" }, onSubmit: async ({ value }) => { const r = ots.normaliseAddress(value); setRes(r); onDone(value, r); } });
  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
      <div className="row">
        <Field form={form} name="line1" label="Address line 1" autoComplete="address-line1" validators={zodField("line1")} />
        <Field form={form} name="line2" label="Address line 2 (optional)" autoComplete="address-line2" />
        <Field form={form} name="town" label="Town" autoComplete="address-level2" validators={zodField("town")} />
        <Field form={form} name="postcode" id="addr-postcode" label="Postcode" autoComplete="postal-code" validators={zodField("postcode")} />
      </div>
      <button type="submit" className="secondary">{submitLabel}</button>
      {res ? <p className="mut" data-testid="address-result">{[res.normalised.line1, res.normalised.line2, res.normalised.town, res.normalised.postcode].filter(Boolean).join(", ")}. {res.note}</p> : null}
    </form>
  );
}

const emptyQuote = { label: "", monthly: "", upfront: "0", months: "24", rise: "0", cashback: "0", provider_id: "", from_offer: "" };
function QuoteForm({ initial, editing, onSave, onCancel }) {
  const form = useForm({ defaultValues: initial, onSubmit: ({ value, formApi }) => {
    onSave({ label: value.label.trim(), provider_id: value.provider_id || undefined, from_offer: value.from_offer || undefined, monthly_pence: toPence(value.monthly), upfront_pence: toPence(value.upfront || "0"), contract_months: Number(value.months), annual_rise_pence: toPence(value.rise || "0"), rise_month: toPence(value.rise || "0") ? 4 : undefined, cashback_pence: toPence(value.cashback || "0") });
    formApi.reset(emptyQuote);
  } });
  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }} data-testid="quote-form">
      <h3>{editing ? "Edit costs" : "Add a quote you've been given"}</h3>
      <div className="row">
        <Field form={form} name="label" id="q-label" label="Provider / deal" validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : "Give it a name") }} />
        <Field form={form} name="monthly" id="q-monthly" label="Monthly (£)" inputMode="decimal" validators={{ onSubmit: ({ value }) => moneyErr(value, true) }} />
        <Field form={form} name="upfront" id="q-upfront" label="Upfront (£)" inputMode="decimal" validators={{ onSubmit: ({ value }) => moneyErr(value) }} />
        <form.Field name="months">{(f) => (<div><label htmlFor="q-months">Contract months</label><select id="q-months" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)}>{[1, 12, 18, 24, 36].map((m) => <option key={m} value={String(m)}>{m}</option>)}</select></div>)}</form.Field>
        <Field form={form} name="rise" id="q-rise" label="April rise (£/month)" inputMode="decimal" validators={{ onSubmit: ({ value }) => moneyErr(value) }} />
        <Field form={form} name="cashback" id="q-cashback" label="Cashback (£, not deducted)" inputMode="decimal" validators={{ onSubmit: ({ value }) => moneyErr(value) }} />
      </div>
      <div className="btns"><button type="submit" className="secondary">{editing ? "Save costs" : "Add quote"}</button>{editing ? <button type="button" className="secondary" onClick={onCancel}>Cancel</button> : null}</div>
    </form>
  );
}

export function Compare() {
  const [area, setArea] = useState(null);
  const [notFound, setNotFound] = useState(undefined);
  const [address, setAddress] = useState(null);
  const [offline, setOffline] = useState(null);
  const [selected, setSelected] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [editIdx, setEditIdx] = useState(null);
  const [draft, setDraft] = useState(emptyQuote);
  const [horizon, setHorizon] = useState("");
  const [result, setResult] = useState(null); const [lastReq, setLastReq] = useState(null);
  const [err, setErr] = useState(null); const [saved, setSaved] = useState(null);
  const current = useForm({ defaultValues: { monthly: "", ooc: "", months_left: "0", exit_fee: "0" } });
  const cur = useStore(current.store, (s) => s.values);
  const offers = area?.offers ?? [];
  const loc = area?.location ?? null;

  function pickArea(a) { setArea(a); setNotFound(undefined); setSelected([]); setResult(null); setOffline(null); }
  function editOffer(o) { setEditIdx(-1); setDraft({ ...emptyQuote, label: `${o.provider?.name ?? o.provider_id} — ${o.name} (my costs)`.slice(0, 120), monthly: o.monthly_pence == null ? "" : poundsOf(o.monthly_pence), upfront: poundsOf(o.upfront_pence ?? 0), months: String(o.contract_months ?? 24), rise: poundsOf(o.annual_rise_pence ?? 0), cashback: poundsOf(o.cashback_pence ?? 0), provider_id: o.provider_id, from_offer: o.id }); }
  function saveQuote(q) { if (editIdx != null && editIdx >= 0) setQuotes(quotes.map((x, i) => (i === editIdx ? q : x))); else setQuotes([...quotes, q]); setEditIdx(null); setDraft(emptyQuote); setResult(null); }
  function currentDeal() {
    const m = toPence(cur.monthly); if (Number.isNaN(m)) return undefined;
    const ooc = toPence(cur.ooc), ex = toPence(cur.exit_fee), ml = Number(cur.months_left || 0);
    return { monthly_pence: m, out_of_contract_monthly_pence: Number.isNaN(ooc) ? undefined : ooc, months_left: Number.isInteger(ml) && ml >= 0 ? Math.min(ml, 36) : 0, exit_fee_pence: Number.isNaN(ex) ? 0 : ex };
  }
  function request() { return { postcode: loc?.postcode, start: thisMonth(), horizon_months: horizon ? Number(horizon) : undefined, offer_ids: selected, quotes: quotes.map(({ from_offer, ...q }) => q), current: currentDeal() }; }
  async function run() {
    setErr(null); setSaved(null); setResult(null);
    const req = request();
    try { setResult(await ots.compare(req)); setLastReq(req); }
    catch (e) { setErr(e?.issues || /published catalogue|at least one/.test(e?.message) ? errMsg(e) : UNAVAILABLE); }
  }
  function save() { const rec = ots.saved.save(result, lastReq, { outward: loc?.outward ?? null, catalogue_version: area?.catalogue_version ?? null }); setSaved(rec.id); }
  async function keepOffline() { setOffline("Saving…"); try { const r = await ots.keepAreaOffline(loc.area); setOffline(`${r.files} postcode files for ${r.area} are kept on this device.`); } catch { setOffline("Couldn't save postcode files. Try again when you're online."); } }
  const longest = Math.max(0, ...quotes.map((q) => q.contract_months), ...offers.filter((o) => selected.includes(o.id)).map((o) => o.contract_months ?? 0));

  return (
    <>
      <h1>Compare the real cost of broadband</h1>
      <p className="mut">Independent. We compare full contract costs from offers we have reviewed and published, plus any quotes you enter. No account or email needed. We do not take orders and cannot confirm availability. The provider does that.</p>

      <section aria-labelledby="s1"><h2 id="s1">1. Your area</h2>
        <PostcodeStep onArea={pickArea} onNotFound={(pc) => { setArea(null); setNotFound(pc); }} />
        {notFound !== undefined && !area ? (<div data-testid="manual-fallback"><h3>Enter your address manually</h3><p className="mut">We tidy the format but do not verify your address.</p>
          <AddressForm postcode={notFound ?? ""} submitLabel="Continue with this address" onDone={async (v, r) => { setAddress(r); try { pickArea(await ots.offers(ots.manualLocation(v))); setAddress(r); } catch { setErr(UNAVAILABLE); } }} /></div>) : null}
        {area ? (<div data-testid="area">
          {loc ? <p><b>{loc.postcode}</b>: {[loc.district, loc.ward].filter(Boolean).join(", ") || "district not looked up"}{loc.country ? ` (${loc.country})` : ""} <span className="pill">{loc.source}</span></p> : <p><b>No postcode.</b> Showing offers that aren't limited to an area.</p>}
          {area.caveats.map((c) => <div className="caveat" key={c.code} data-caveat={c.code}>{c.text}</div>)}
          {loc && !loc.partial ? <p><button type="button" className="secondary small" onClick={keepOffline}>Keep {loc.area} postcodes on this device</button> {offline ? <span className="mut" data-testid="offline-area">{offline}</span> : null}</p> : null}
        </div>) : null}
      </section>

      {area ? (<>
        {loc && !loc.partial ? <section aria-labelledby="s2"><h2 id="s2">2. Your address (optional)</h2><p className="mut">Type it yourself. We tidy the format but do not verify it, and we never store it.</p>
          <AddressForm key={loc.postcode} postcode={loc.postcode} submitLabel="Use this address" onDone={(v, r) => setAddress(r)} /></section>
          : address ? <section><h2>2. Your address</h2><p className="mut" data-testid="address-result">{[address.normalised.line1, address.normalised.line2, address.normalised.town, address.normalised.postcode].filter(Boolean).join(", ")}. {address.note}</p></section> : null}

        <section aria-labelledby="s3"><h2 id="s3">3. Your current deal (optional)</h2>
          <BillPanel onConfirm={(v) => { for (const [k, val] of Object.entries(v)) if (val != null) current.setFieldValue(k, val); setResult(null); }} />
          <div className="row">
            <Field form={current} name="monthly" id="cur-monthly" label="Monthly price now (£)" inputMode="decimal" />
            <Field form={current} name="ooc" id="cur-ooc" label="Price after contract ends (£)" inputMode="decimal" />
            <Field form={current} name="months_left" id="cur-left" label="Months left in contract" inputMode="numeric" />
            <Field form={current} name="exit_fee" id="cur-exit" label="Exit fee if you leave now (£)" inputMode="decimal" />
          </div>
          <p className="mut">The exit fee is added to every switching option, because you'd pay it whichever deal you pick. Staying doesn't include it.</p>
        </section>

        <section aria-labelledby="s4"><h2 id="s4">4. Deals to compare</h2>
          {offers.length ? (<OfferList offers={offers} version={area.catalogue_version} publishedAt={area.published_at} selected={selected}
            onToggle={(id, on) => { setResult(null); setSelected(on ? [...selected, id] : selected.filter((x) => x !== id)); }} onEdit={editOffer} />)
            : <p className="mut" data-testid="no-offers">{area.empty_reason}</p>}
          <QuoteForm key={`${editIdx}:${JSON.stringify(draft)}`} initial={draft} editing={editIdx != null} onSave={saveQuote} onCancel={() => { setEditIdx(null); setDraft(emptyQuote); }} />
          {quotes.length ? <ul data-testid="quotes">{quotes.map((x, i) => <li key={i}>{x.label}: {fmt(x.monthly_pence)}/month, {x.contract_months} months{x.upfront_pence ? `, ${fmt(x.upfront_pence)} upfront` : ""}{x.annual_rise_pence ? `, +${fmt(x.annual_rise_pence)} each April` : ""}{" "}
            <button type="button" className="link" onClick={() => { setEditIdx(i); setDraft({ label: x.label, monthly: poundsOf(x.monthly_pence), upfront: poundsOf(x.upfront_pence), months: String(x.contract_months), rise: poundsOf(x.annual_rise_pence), cashback: poundsOf(x.cashback_pence), provider_id: x.provider_id ?? "", from_offer: x.from_offer ?? "" }); }}>Edit</button>{" "}
            <button type="button" className="link" onClick={() => { setQuotes(quotes.filter((_, j) => j !== i)); setResult(null); }}>Remove</button></li>)}</ul> : null}
          <div className="row"><div><label htmlFor="horizon">Comparison period</label>
            <select id="horizon" value={horizon} onChange={(e) => { setHorizon(e.target.value); setResult(null); }}><option value="">Longest contract{longest ? ` (${longest} months)` : ""}</option>{[12, 18, 24, 36].map((m) => <option key={m} value={m}>{m} months</option>)}</select></div></div>
          <button onClick={run} disabled={!selected.length && !quotes.length}>Compare total cost</button>
          {err ? <p className="err" role="alert" data-testid="compare-error">{err}</p> : null}
        </section>

        {result ? (<section aria-labelledby="s5"><h2 id="s5">5. Results over {result.horizon_months} months</h2><Results data={result} />
          <button className="secondary" onClick={save}>Save this comparison</button>{saved ? <p className="mut" data-testid="session">Saved on this device only (no address stored). Reference: <code>{saved}</code>. <a href="#/saved">See saved comparisons</a></p> : null}</section>) : null}
      </>) : null}
    </>
  );
}
