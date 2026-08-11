import type { PlayingPosition } from "@aafkstats/schema";
import { fetchJson } from "../http.js";

/** Ett eksplisitt spilleroppslag, aldri søk eller gjennomgang av en navneliste. */
export interface WikipediaProfile {
  language: "no" | "en";
  title: string;
  revisionId: number;
  timestamp: string;
  url: string;
  wikidata?: string;
  position?: PlayingPosition;
  nationality?: string;
  rawPosition?: string;
}

interface QueryResponse {
  query?: {
    pages?: {
      missing?: boolean;
      title: string;
      pageprops?: { wikibase_item?: string };
      revisions?: { revid: number; timestamp: string }[];
    }[];
  };
}

interface ParseResponse {
  parse?: { text?: string };
}

/**
 * Leser bare de navngitte faktaradene fra den ferdig rendra infoboksen.
 *
 * Norsk Wikipedias spillerinfoboks fyller ofte posisjon og nasjonalitet fra
 * Wikidata selv om feltene ikke står i rå wikitekst. Derfor leser vi HTML-en
 * som MediaWiki selv har rendret for den festede revisjonen. Artikkelbrødtekst,
 * fødselsdato, klubbhistorikk og løpende draktnummer blir bevisst ikke lest.
 */
export function parseProfileInfobox(html: string): Pick<WikipediaProfile, "position" | "nationality" | "rawPosition"> {
  const rows = new Map<string, string>();
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1]!.matchAll(/<t([hd])\b[^>]*>([\s\S]*?)<\/t\1>/gi)]
      .map((match) => plainText(match[2]!));
    if (cells.length < 2) continue;
    rows.set(normalizeLabel(cells[0]!), cells.at(-1)!);
  }

  const rawPosition = firstRow(rows, ["posisjon", "position"]);
  const nationality = firstRow(rows, ["nasjonalitet", "nationality", "citizenship"]);
  const position = rawPosition ? mapPosition(rawPosition) : undefined;

  return {
    ...(position ? { position } : {}),
    ...(nationality ? { nationality } : {}),
    ...(rawPosition ? { rawPosition } : {}),
  };
}

/** Henter én eksakt side og følger bare Wikipedias eventuelle omdirigering. */
export async function fetchWikipediaProfile(
  language: "no" | "en",
  title: string,
  options: { refresh?: boolean } = {},
): Promise<WikipediaProfile> {
  const api = `https://${language}.wikipedia.org/w/api.php`;
  const queryUrl = `${api}?${new URLSearchParams({
    action: "query",
    prop: "revisions|pageprops",
    titles: title,
    redirects: "1",
    rvlimit: "1",
    rvprop: "ids|timestamp",
    format: "json",
    formatversion: "2",
  })}`;
  const query = await fetchJson<QueryResponse>(queryUrl, options);
  const page = query.query?.pages?.[0];
  const revision = page?.revisions?.[0];
  if (!page || page.missing || !revision) {
    throw new Error(`fant ikke Wikipedia-siden «${title}» på ${language}.wikipedia.org`);
  }

  // oldid gjør at fakta og kildelenke alltid viser samme revisjon.
  const parseUrl = `${api}?${new URLSearchParams({
    action: "parse",
    oldid: String(revision.revid),
    prop: "text",
    format: "json",
    formatversion: "2",
  })}`;
  const parsed = await fetchJson<ParseResponse>(parseUrl, options);
  const facts = parseProfileInfobox(parsed.parse?.text ?? "");

  return {
    language,
    title: page.title,
    revisionId: revision.revid,
    timestamp: revision.timestamp.slice(0, 10),
    url: `https://${language}.wikipedia.org/w/index.php?${new URLSearchParams({
      title: page.title,
      oldid: String(revision.revid),
    })}`,
    ...(page.pageprops?.wikibase_item?.match(/^Q[1-9]\d*$/)
      ? { wikidata: page.pageprops.wikibase_item }
      : {}),
    ...facts,
  };
}

function firstRow(rows: Map<string, string>, labels: string[]): string | undefined {
  for (const label of labels) {
    const value = rows.get(label);
    if (value) return value;
  }
  return undefined;
}

function normalizeLabel(value: string): string {
  return value.toLocaleLowerCase("nb-NO").replace(/\s+/g, " ").trim();
}

function mapPosition(value: string): PlayingPosition | undefined {
  const normalized = normalizeLabel(value);
  const matches = new Set<PlayingPosition>();
  if (/\b(keeper|goalkeeper|målvakt)\b/.test(normalized)) matches.add("keeper");
  if (/\b(forsvar|forsvarsspiller|defender|centre-back|center-back|full-back)\b/.test(normalized)) matches.add("forsvar");
  if (/\b(midtbanespiller|midtbane|midfielder)\b/.test(normalized)) matches.add("midtbane");
  if (/\b(angriper|angrep|spiss|forward|striker|winger)\b/.test(normalized)) matches.add("angrep");
  return matches.size === 1 ? [...matches][0] : undefined;
}

function plainText(value: string): string {
  return decodeEntities(
    value
      .replace(/<(script|style|sup)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, " / ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s*\/\s*\/\s*/g, " / ").replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: "\"", ndash: "–", mdash: "—",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return named[key.toLowerCase()] ?? entity;
  });
}
