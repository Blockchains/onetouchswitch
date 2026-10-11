import { useEffect, useState } from "react";
import { ots } from "./api.js";

export function Guides({ slug }) {
  const [all, setAll] = useState(null); const [q, setQ] = useState(""); const [hits, setHits] = useState(null); const [g, setG] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => { ots.guides().then((x) => { setAll(x); setHits(x); }).catch(() => setErr("Guides couldn't load. If you're offline, open them once while online.")); }, []);
  useEffect(() => { setG(null); if (slug) ots.guide(slug).then(setG).catch(() => setErr("That guide couldn't load.")); }, [slug]);
  useEffect(() => { if (all) ots.searchGuides(q).then(setHits); }, [q, all]);
  if (slug) return (<article className="guide" data-testid="guide"><p><a href="#/guides">← All guides</a></p>{g ? <><h1>{g.title}</h1><p className="mut">Updated {g.updated}</p><div dangerouslySetInnerHTML={{ __html: g.html }} /></> : err ? <p className="err">{err}</p> : <p className="mut">Loading…</p>}</article>);
  return (
    <section aria-labelledby="g1"><h1 id="g1">Guides</h1>
      <label htmlFor="guide-search">Search guides</label><input id="guide-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. exit fee, Hull, social tariff" />
      {err ? <p className="err">{err}</p> : null}
      {hits ? (hits.length ? <ul className="guides" data-testid="guide-list">{hits.map((x) => <li key={x.slug}><a href={`#/guides/${x.slug}`}>{x.title}</a><div className="mut">{x.summary}</div></li>)}</ul> : <p className="mut" data-testid="guide-none">No guides match “{q}”.</p>) : null}
    </section>
  );
}
