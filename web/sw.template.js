// One Touch Switch offline service worker (same origin only; never touches other sites).
const VERSION = "__VERSION__"; const SHELL = `ots-shell-${VERSION}`; const DATA = "ots-data-v1";
const SCOPE = new URL(self.registration.scope); const PRECACHE = __PRECACHE__.map((p) => new URL(p, SCOPE).href);
self.addEventListener("install", (e) => e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ots-shell-") && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
const put = (name, req, res) => { if (res.ok) { const c = res.clone(); caches.open(name).then((x) => x.put(req, c)); } return res; };
const any = async (req) => (await caches.match(req, { ignoreSearch: true })) ?? null;
self.addEventListener("fetch", (e) => {
  const req = e.request; const u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== SCOPE.origin || !u.pathname.startsWith(SCOPE.pathname)) return;
  const p = u.pathname.slice(SCOPE.pathname.length);
  if (req.mode === "navigate") { e.respondWith(fetch(req).then((r) => put(SHELL, req, r)).catch(async () => (await any(req)) ?? (await caches.match(new URL("index.html", SCOPE).href)))); return; }
  if (/^(assets|engine|vendor)\//.test(p)) { e.respondWith(any(req).then((c) => c ?? fetch(req).then((r) => put(SHELL, req, r)))); return; }
  if (p.startsWith("api/v1/postcode/")) { e.respondWith(any(req).then((c) => { const net = fetch(req).then((r) => put(DATA, req, r)); if (c) { e.waitUntil(net.catch(() => {})); return c; } return net; })); return; }
  e.respondWith(fetch(req).then((r) => put(SHELL, req, r)).catch(async () => (await any(req)) ?? Response.error()));
});
