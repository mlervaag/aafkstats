import { fetchJson } from "./http.js";
import { parseTransferRows, windowFromTitle } from "./adapters/wikipedia-transfers.js";
import type { WikipediaTransferRow } from "./adapters/wikipedia-transfers.js";
import type { WikipediaArticle } from "./transfer-lookup.js";

/**
 * Henting av Wikipedias norske overgangslister.
 *
 * Skilt fra parseren, som er ren, og fra `transfer-lookup`, som bygger
 * overganger av rader. Her ligger bare nettverket: hvilke artikler som finnes,
 * og wikiteksten i dem.
 */

const API = "https://en.wikipedia.org/w/api.php";

interface SearchResponse {
  query: { search: { title: string }[] };
}

interface ParseResponse {
  parse: { title: string; pageid: number; revid?: number; wikitext: { "*": string } };
}

/** Artiklene som finnes, spurt opp i stedet for skrevet ned. Nye vinduer kommer til. */
export async function listTransferArticles(): Promise<string[]> {
  const url = `${API}?${new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: 'intitle:"List of Norwegian football transfers"',
    srlimit: "50",
    format: "json",
  })}`;
  const response = await fetchJson<SearchResponse>(url);
  return response.query.search.map((entry) => entry.title).sort();
}

export async function articleWikitext(title: string): Promise<ParseResponse["parse"]> {
  // `prop=wikitext` alene svarer uten revisjonsnummer, og en permalenke uten det
  // peker ingen steder. `prop=wikitext|revid` gir nummeret vi faktisk leste.
  const url = `${API}?${new URLSearchParams({
    action: "parse", page: title, prop: "wikitext|revid", format: "json",
  })}`;
  return (await fetchJson<ParseResponse>(url)).parse;
}

export interface ParsedTransferArticle extends WikipediaArticle {
  windowSeason: number;
  rows: WikipediaTransferRow[];
}

/**
 * Overgangsvinduene som kan forklare en debut i disse sesongene.
 *
 * Vinterartikkelen «winter 2025–26» hører til sesongen 2026, og det er den som
 * forklarer at en spiller var med fra første kamp. Sesongen leses derfor av
 * tittelen, ikke av årstallet i den.
 */
export async function fetchTransferArticles(
  seasons: Set<number>,
  onProgress?: (line: string) => void,
): Promise<{ articles: ParsedTransferArticle[]; issues: string[] }> {
  const issues: string[] = [];
  const articles: ParsedTransferArticle[] = [];
  if (seasons.size === 0) return { articles, issues };

  const titles = (await listTransferArticles()).filter((title) => {
    const window = windowFromTitle(title);
    return window !== null && seasons.has(window.season);
  });

  for (const title of titles) {
    try {
      const article = await articleWikitext(title);
      const window = windowFromTitle(article.title);
      if (!window) continue;
      const rows = parseTransferRows(article.wikitext["*"]);
      onProgress?.(`${article.title}: ${rows.length} rad(er) i AaFK-seksjonen`);
      articles.push({
        title: article.title,
        revid: article.revid,
        wikitext: article.wikitext["*"],
        windowSeason: window.season,
        rows,
      });
    } catch (error) {
      issues.push(`${title}: kunne ikke hentes (${String(error)})`);
    }
  }

  return { articles, issues };
}
