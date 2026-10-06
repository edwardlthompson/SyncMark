import { suggestCategory } from "./suggest.js";
import { lookupWikidataCategory } from "./wikidataCategory.js";
import type { Bookmark, Suggestion } from "./types.js";

export interface ScanSignals {
  finalUrl?: string;
  title?: string;
  description?: string;
  siteName?: string;
  keywords?: string;
  ok: boolean;
  wikidataReason?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractMeta(html: string): {
  title?: string;
  description?: string;
  siteName?: string;
  keywords?: string;
} {
  const title =
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ||
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const siteName =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const keywords = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const h1 = html.match(/<h1[^>]*>([^<]{2,120})<\/h1>/i)?.[1]?.trim();
  return {
    title: title ? decodeEntities(title).slice(0, 200) : h1 ? decodeEntities(h1) : undefined,
    description: description ? decodeEntities(description).slice(0, 280) : undefined,
    siteName: siteName ? decodeEntities(siteName).slice(0, 120) : undefined,
    keywords: keywords ? decodeEntities(keywords).slice(0, 200) : undefined,
  };
}

/** Fetch page signals for category hints (advisory only). */
export async function scanLinkSignals(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<ScanSignals> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    const finalUrl = res.url || url;
    const ctype = res.headers.get("content-type") || "";
    let meta: ReturnType<typeof extractMeta> = {};
    if (ctype.includes("html") || ctype.includes("text") || !ctype) {
      const reader = res.body?.getReader?.();
      let text = "";
      if (reader) {
        const dec = new TextDecoder();
        while (text.length < 64_000) {
          const { done, value } = await reader.read();
          if (done) break;
          text += dec.decode(value, { stream: true });
          if (/<\/head>/i.test(text) && /<h1/i.test(text)) break;
        }
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
      } else {
        text = await res.text();
      }
      meta = extractMeta(text.slice(0, 64_000));
    }
    return { finalUrl, ok: res.ok, ...meta };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Full precision pass: page signals + Wikidata industry lookup. */
export async function enrichCategorySignals(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ScanSignals> {
  const page = await scanLinkSignals(url, fetchImpl, 10_000);
  const wiki = await lookupWikidataCategory(page.finalUrl || url, fetchImpl, 10_000);
  if (!wiki) return page;
  return {
    ...page,
    wikidataReason: wiki.reason,
    // Prefer Wikidata category via keywords channel for suggestFromScan
    keywords: [wiki.category, wiki.reason, page.keywords].filter(Boolean).join(", "),
  };
}

export function suggestFromScan(
  bookmark: Pick<Bookmark, "url" | "title"> & Partial<Pick<Bookmark, "folderPath" | "category">>,
  signals: ScanSignals,
  known: Bookmark[] = [],
): Suggestion {
  const titleBits = [
    signals.title,
    signals.siteName,
    signals.description,
    signals.keywords,
    bookmark.title,
  ]
    .filter(Boolean)
    .join(" · ");
  const url = signals.finalUrl || bookmark.url;

  // If Wikidata put a concrete category in keywords first token, prefer catalog/wiki path
  let suggestion = suggestCategory(
    { ...bookmark, title: titleBits, url, siteName: signals.siteName },
    known,
  );

  if (signals.wikidataReason) {
    // Re-run with wiki category as stronger title signal
    const wikiCat = signals.keywords?.split(",")[0]?.trim();
    if (wikiCat && !/general/i.test(wikiCat)) {
      const mapped = suggestCategory(
        { ...bookmark, title: `${wikiCat} ${titleBits}`, url, siteName: signals.siteName || wikiCat },
        known,
      );
      suggestion = {
        ...mapped,
        reason: `${mapped.reason} · ${signals.wikidataReason}`,
      };
    } else {
      suggestion = { ...suggestion, reason: `${suggestion.reason} · ${signals.wikidataReason}` };
    }
  }

  if (/^general$/i.test(suggestion.category)) {
    suggestion = suggestCategory(
      { ...bookmark, title: titleBits, url, siteName: signals.siteName },
      known,
    );
  }

  const extras: string[] = [];
  if (signals.siteName) extras.push(`site:${signals.siteName}`);
  if (signals.title && signals.title !== bookmark.title) extras.push("page title");
  if (signals.description) extras.push("meta");
  if (signals.wikidataReason) extras.push("Wikidata");
  if (signals.finalUrl && signals.finalUrl !== bookmark.url) extras.push("redirect");
  if (!extras.length) return suggestion;
  return { ...suggestion, reason: `${suggestion.reason} (${extras.join(", ")})` };
}
