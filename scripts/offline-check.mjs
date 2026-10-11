// Exits 0 only if the internet is unreachable (used in CI after staging to prove tests run offline).
const targets = ["https://api.os.uk", "https://api.postcodes.io", "https://1.1.1.1", "https://registry.npmjs.org"];
const reach = await Promise.all(targets.map((u) => fetch(u, { signal: AbortSignal.timeout(4000) }).then(() => u, () => null)));
const ok = reach.filter(Boolean);
if (ok.length) { console.error("NETWORK REACHABLE:", ok.join(", ")); process.exit(1); }
console.log("offline confirmed:", targets.join(", "), "unreachable");
