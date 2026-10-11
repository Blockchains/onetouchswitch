import { useState } from "react";
import { ots, fmt } from "./api.js";
import { Results } from "./Results.jsx";

export function Saved() {
  const [list, setList] = useState(() => ots.saved.list()); const [open, setOpen] = useState(null);
  const refresh = () => setList(ots.saved.list());
  if (!list.length) return <section><h1>Saved comparisons</h1><p className="mut" data-testid="saved-empty">Nothing saved on this device yet. Run a comparison and choose “Save this comparison”.</p></section>;
  return (
    <section><h1>Saved comparisons</h1><p className="mut">Kept in this browser only. We store the first half of your postcode and the numbers you entered, never your address.</p>
      <ul data-testid="saved-list">{list.map((s) => (<li key={s.id}>
        <b>{new Date(s.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</b> · {s.outward ?? "no postcode"} · {s.results.length} deals over {s.horizon_months} months · best {fmt(s.results[0].switch_total_pence)} ({s.results[0].label}){" "}
        <button type="button" className="link" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Close" : "Open"}</button>{" "}
        <button type="button" className="link" onClick={() => { ots.saved.remove(s.id); refresh(); }}>Delete</button>
        {open === s.id ? <div data-testid="saved-open"><Results data={{ ...s, method: "Saved result. Totals as calculated when saved." }} readOnly /></div> : null}
      </li>))}</ul>
      <button type="button" className="secondary" onClick={() => { ots.saved.clear(); refresh(); }}>Delete all saved comparisons</button>
    </section>
  );
}
