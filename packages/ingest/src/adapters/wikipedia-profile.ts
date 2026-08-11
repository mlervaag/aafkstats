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
  return decodeEntities(readHtmlText(value))
    .replace(/\s*\/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Leser tekstnoder i ett pass i stedet for å «rense» HTML med flere regex-er.
 *
 * Flere erstatninger kan lage en ny farlig tegnfølge når den første fjerner et
 * indre element. Her kopieres aldri taggtegn til resultatet, så en tag kan ikke
 * dukke opp igjen etter at nabotekst er satt sammen. Innhold i script, style og
 * fotnoter utelates; linjeskift i infoboksen beholdes som skilletegn.
 */
function readHtmlText(value: string): string {
  let output = "";
  let hiddenDepth = 0;

  for (let index = 0; index < value.length;) {
    if (value[index] !== "<") {
      if (hiddenDepth === 0) output += value[index];
      index += 1;
      continue;
    }

    const end = value.indexOf(">", index + 1);
    if (end === -1) break;
    const tag = value.slice(index + 1, end).trim();
    const closing = tag.startsWith("/");
    const name = /^\/?\s*([a-z0-9-]+)/i.exec(tag)?.[1]?.toLowerCase();
    const hidden = name === "script" || name === "style" || name === "sup";

    if (hidden) {
      hiddenDepth = closing ? Math.max(0, hiddenDepth - 1) : hiddenDepth + 1;
    } else if (name === "br" && hiddenDepth === 0) {
      output += " / ";
    }
    index = end + 1;
  }

  return output;
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
