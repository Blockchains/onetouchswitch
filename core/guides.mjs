// Client-side guide search over the static index (/api/v1/guides/index.json). No search service.
const tok = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9£ ]+/g, " ").split(/\s+/).filter((w) => w.length > 1);
export function searchGuides(index, query) {
  const q = tok(query); if (!q.length) return index;
  return index.map((g) => {
    const t = tok(g.title), tags = tok((g.tags ?? []).join(" ")), body = tok(`${g.summary} ${g.text}`);
    let score = 0;
    for (const w of q) {
      const pre = (xs) => xs.some((x) => x.startsWith(w));
      if (pre(t)) score += 5; if (pre(tags)) score += 3; if (pre(body)) score += 1; else if (!pre(t) && !pre(tags)) return { g, score: 0 };
    }
    return { g, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.g.title.localeCompare(b.g.title)).map((x) => x.g);
}
