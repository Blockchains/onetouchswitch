import { useEffect, useState } from "react";
import { ots } from "./api.js";
import { Compare } from "./Compare.jsx";
import { Guides } from "./Guides.jsx";
import { Saved } from "./Saved.jsx";

const route = () => (location.hash.replace(/^#/, "") || "/");
export const BRIDGE_URL = "https://blockchains.github.io/onetouchswitch-bridge/";

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => { const u = () => setOn(navigator.onLine); addEventListener("online", u); addEventListener("offline", u); return () => { removeEventListener("online", u); removeEventListener("offline", u); }; }, []);
  return on;
}

export function App() {
  const [r, setR] = useState(route());
  const [idx, setIdx] = useState(null);
  const [swReady, setSwReady] = useState(false);
  const online = useOnline();
  useEffect(() => { const h = () => { setR(route()); window.scrollTo(0, 0); }; addEventListener("hashchange", h); return () => removeEventListener("hashchange", h); }, []);
  useEffect(() => { ots.index().then(setIdx).catch(() => {}); navigator.serviceWorker?.ready.then(() => setSwReady(true)).catch(() => {}); }, []);
  const tab = r.startsWith("/guides") ? "guides" : r.startsWith("/saved") ? "saved" : "compare";
  return (
    <>
      <header><nav aria-label="Main">
        <a className="brand" href="#/">One Touch Switch</a>
        <a href="#/" aria-current={tab === "compare" ? "page" : undefined}>Compare</a>
        <a href="#/guides" aria-current={tab === "guides" ? "page" : undefined}>Guides</a>
        <a href="#/saved" aria-current={tab === "saved" ? "page" : undefined}>Saved</a>
        <span className="net" data-testid="net">{online ? (swReady ? "Ready to work offline" : "Online") : "Offline: using data on this device"}</span>
      </nav></header>
      <main>
        <div hidden={tab !== "compare"}><Compare /></div>
        {tab === "guides" ? <Guides slug={r.split("/")[2] ?? null} /> : null}
        {tab === "saved" ? <Saved /> : null}
        <footer className="mut">
          <p>No account, no email. Calculations run in your browser. We don't take orders and can't confirm availability; the provider does that.</p>
          <p>Postcode data: Contains OS data © Crown copyright and database right; Royal Mail data © Royal Mail copyright and database right; National Statistics data © Crown copyright and database right.</p>
          {idx ? <p data-testid="versions">Postcode data {idx.postcodes.data_version} · offer catalogue v{idx.catalogue.version} ({idx.catalogue.offers} offers) · engine {idx.engine_version ?? ""}</p> : null}
          <p>Operator link: provider/partner settlement runs in a <a href={BRIDGE_URL} rel="noopener" target="_blank">separate back-office app</a>. It is not part of this comparison and never touches your data.</p>
        </footer>
      </main>
    </>
  );
}
