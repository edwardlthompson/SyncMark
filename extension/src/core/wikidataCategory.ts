import type { DomainHit } from "./domainCatalog.js";

const SPARQL = "https://query.wikidata.org/sparql";

const INDUSTRY_MAP: Array<{ match: RegExp; category: string; tags: string[] }> = [
  { match: /software|internet|web|computer|technology|programmer|video game/i, category: "Development", tags: ["tech"] },
  { match: /news|journalism|newspaper|broadcast|media company/i, category: "News", tags: ["news"] },
  { match: /retail|ecommerce|e-commerce|marketplace|shopping/i, category: "Shopping", tags: ["shop"] },
  { match: /social network|social media|microblog/i, category: "Social", tags: ["social"] },
  { match: /film|television|music|streaming|entertainment|video hosting/i, category: "Media", tags: ["media"] },
  { match: /bank|finance|payment|insurance|investment/i, category: "Finance", tags: ["finance"] },
  { match: /travel|airline|hotel|tourism|map/i, category: "Travel", tags: ["travel"] },
  { match: /food|restaurant|recipe|grocery/i, category: "Food", tags: ["food"] },
  { match: /health|hospital|medical|pharmaceut/i, category: "Health", tags: ["health"] },
  { match: /education|university|school|encyclopedia|library/i, category: "Learning", tags: ["learn"] },
  { match: /productivity|office suite|collaboration/i, category: "Productivity", tags: ["work"] },
];

function escapeSparqlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Look up site industry via Wikidata official website (P856). User-initiated only. */
export async function lookupWikidataCategory(
  pageUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<DomainHit | null> {
  let host = "";
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  if (!host || host === "localhost") return null;

  const query = `
SELECT ?itemLabel ?industryLabel ?classLabel WHERE {
  ?item wdt:P856 ?site .
  FILTER(CONTAINS(LCASE(STR(?site)), "${escapeSparqlString(host)}"))
  OPTIONAL { ?item wdt:P452 ?industry . }
  OPTIONAL { ?item wdt:P31 ?class . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 8`.trim();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `${SPARQL}?format=json&query=${encodeURIComponent(query)}`;
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "SyncMark/0.1 (FOSS bookmark organizer; category suggestions)",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { bindings?: Array<Record<string, { value?: string }>> };
    };
    const rows = data.results?.bindings ?? [];
    for (const row of rows) {
      const labels = [row.industryLabel?.value, row.classLabel?.value, row.itemLabel?.value]
        .filter(Boolean)
        .join(" ");
      for (const rule of INDUSTRY_MAP) {
        if (rule.match.test(labels)) {
          return {
            category: rule.category,
            tags: rule.tags,
            reason: `Wikidata: ${row.itemLabel?.value ?? host} (${labels.slice(0, 80)})`,
          };
        }
      }
      if (row.itemLabel?.value) {
        // Specific org name as folder — never "General"
        return {
          category: row.itemLabel.value.slice(0, 48),
          tags: ["wikidata"],
          reason: `Wikidata entity: ${row.itemLabel.value}`,
        };
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
