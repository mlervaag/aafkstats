import { fetchJson } from "../http.js";
import { readAccess } from "./nb-newspaper-access.js";
import type { NbAccessInfo, NewspaperAccess } from "./nb-newspaper-access.js";

const NB_ITEMS = "https://api.nb.no/catalog/v1/items";
const DEFAULT_NEWSPAPER = "Sunnmørsposten";
export const AAFK_ALIASES = ["Aalesund", "Aalesunds", "ÅFK", "AAFK"] as const;

export interface NewspaperMatchQuery {
  opponent: string;
  /**
   * Andre skrivemåter av motstanderen, typisk `nameVariants` fra klubbregisteret.
   * De brukes i poengsettingen, ikke i søket: avisa skriver «Lyn» der arkivet
   * skriver «Gjøvik/Lyn», og «K. F. K.» der arkivet skriver «Kristiansund
   * Fotballklubb».
   */
  opponentAliases?: string[];
  year: number;
  newspaper?: string;
  score?: string;
  competition?: string;
  round?: number;
  from?: string;
  to?: string;
  limit?: number;
  detailsLimit?: number;
  refresh?: boolean;
}

export interface NewspaperFragment {
  pageId?: string;
  pageNumber?: string;
  text: string;
  /** Hvor mye av kampfakta som står i akkurat dette tekstvinduet. */
  score: number;
  reasons: string[];
}

export interface NewspaperCandidate {
  id: string;
  urn?: string;
  title?: string;
  issued?: string;
  itemUrl: string;
  /** Hva NB sier om tilgang, lisens og kreditering for akkurat denne utgaven. */
  access: NewspaperAccess;
  score: number;
  reasons: string[];
  matchedQueries: string[];
  /** Sortert med det sterkeste tekstvinduet først. */
  fragments: NewspaperFragment[];
}

interface NbContentFragment {
  pageid?: string;
  pageNumber?: string;
  text?: string;
}

interface NbItem {
  id: string;
  accessInfo?: NbAccessInfo;
  metadata?: {
    title?: string;
    identifiers?: { urn?: string };
    originInfo?: { issued?: string };
  };
  contentFragments?: NbContentFragment[];
}

interface NbSearchResponse {
  _embedded?: { items?: NbItem[] };
}

interface NbContentFragmentsResponse {
  contentFragments?: NbContentFragment[];
}

/**
 * Lager små, robuste søk i stedet for ett avansert Lucene-uttrykk.
 * OCR i historiske aviser er ujevnt, og «Aalesund», «Aalesunds», «ÅFK» og
 * «AAFK» forekommer om hverandre. Separate søk gjør også hvert treff enklere
 * å forklare i rapporten.
 */
export function newspaperSearchQueries(opponent: string): string[] {
  return AAFK_ALIASES.map((alias) => `${opponent} ${alias}`);
}

/**
 * Avistittelen Nasjonalbiblioteket katalogfører årgangen under.
 *
 * Sunnmørsposten het «Søndmørsposten» til og med 1926, og NB katalogfører
 * årgangene under hvert sitt navn. Skillet er kontrollert mot API-et: 1926 gir
 * 308 utgaver under det gamle navnet og null under det nye, 1927 gir 308 under
 * det nye og null under det gamle. Digitaliseringen starter i 1914; 1910 og
 * tidligere gir ingen treff under noen av navnene.
 *
 * Et årstall er en dårlig ting å ha rett i alene. Søker man på feil navn får man
 * null treff, og null treff ser ut som «avisa skrev ikke om kampen» — ikke som
 * «vi spurte om feil avis». Derfor finnes `newspaperTitleCandidates`, og derfor
 * prøver oppslaget det andre navnet når det første ikke gir en eneste utgave.
 */
export const NEWSPAPER_TITLES = [
  { title: "Søndmørsposten", from: 1914, to: 1926 },
  { title: DEFAULT_NEWSPAPER, from: 1927, to: null },
] as const;

export function newspaperTitleForYear(year: number): string {
  return newspaperTitleCandidates(year)[0]!;
}

/** Tittelen året hører til, og deretter de andre som sikkerhetsnett. */
export function newspaperTitleCandidates(year: number): string[] {
  const primary = NEWSPAPER_TITLES.find(({ from, to }) => year >= from && (to === null || year <= to));
  const rest = NEWSPAPER_TITLES.map(({ title }) => title).filter((title) => title !== primary?.title);
  return primary ? [primary.title, ...rest] : NEWSPAPER_TITLES.map(({ title }) => title);
}

export function buildNewspaperSearchUrl(
  query: string,
  options: Pick<NewspaperMatchQuery, "year" | "newspaper" | "from" | "to" | "limit">,
): string {
  const newspaper = options.newspaper ?? DEFAULT_NEWSPAPER;
  const from = compactDate(options.from ?? `${options.year}-01-01`);
  const to = compactDate(options.to ?? `${options.year}-12-31`);
  const params = new URLSearchParams();

  params.set("q", query);
  params.append("filter", "mediatype:aviser");
  params.append("filter", `api_title:${newspaper}`);
  params.append("filter", `date:[${from} TO ${to}]`);
  params.set("searchType", "FULL_TEXT_SEARCH");
  params.append("snippets", "aviser");
  params.set("fragments", "8");
  params.set("fragSize", "700");
  params.set("size", String(options.limit ?? 25));

  return `${NB_ITEMS}?${params.toString()}`;
}

export function buildContentFragmentsUrl(id: string, query: string): string {
  const params = new URLSearchParams({ q: query, fragments: "12", fragSize: "900" });
  return `${NB_ITEMS}/${encodeURIComponent(id)}/contentfragments?${params.toString()}`;
}

export async function searchNewspaperForMatch(options: NewspaperMatchQuery): Promise<NewspaperCandidate[]> {
  const byId = new Map<string, { item: NbItem; matchedQueries: string[]; fragments: NbContentFragment[] }>();

  for (const query of newspaperSearchQueries(options.opponent)) {
    const url = buildNewspaperSearchUrl(query, options);
    const response = await fetchJson<NbSearchResponse>(url, { refresh: options.refresh });

    for (const item of response._embedded?.items ?? []) {
      const current = byId.get(item.id) ?? { item, matchedQueries: [], fragments: [] };
      if (!current.matchedQueries.includes(query)) current.matchedQueries.push(query);
      current.fragments = mergeFragments(current.fragments, item.contentFragments ?? []);
      byId.set(item.id, current);
    }
  }

  const raw = new Map(
    [...byId].map(([id, entry]) => [id, { ...entry, candidate: rankNewspaperCandidate(entry.item, entry.matchedQueries, entry.fragments, options) }]),
  );
  const candidates = [...raw.values()].map((entry) => entry.candidate);
  candidates.sort(candidateSort);

  // Søk i OCR-en til bare de beste kandidatene. Dette gir sidepeker og større
  // tekstvindu uten å gjøre en hel avisårgang til en crawlerjobb.
  const detailsLimit = Math.max(0, Math.min(options.detailsLimit ?? 5, candidates.length));
  for (let index = 0; index < detailsLimit; index += 1) {
    const entry = raw.get(candidates[index]!.id)!;
    const details = await fetchJson<NbContentFragmentsResponse>(
      buildContentFragmentsUrl(entry.item.id, options.opponent),
      { refresh: options.refresh },
    );
    entry.fragments = mergeFragments(entry.fragments, details.contentFragments ?? []);
    candidates[index] = rankNewspaperCandidate(entry.item, entry.matchedQueries, entry.fragments, options);
  }

  candidates.sort(candidateSort);
  return candidates;
}

/**
 * Poengsetter én avisutgave mot kampfakta.
 *
 * ## Hvorfor nærhet er hele saken
 *
 * Første forsøk la all teksten i utgaven i én streng og spurte om motstanderen,
 * «Aalesund», resultatet og cupordet fantes. Det gjør de nesten alltid: en
 * Sunnmørsposten fra 1976 er tjue sider der Ålesund er stedet avisa kommer fra,
 * og seriestabellene på sportssidene inneholder hvert eneste sifferpar. Kjørt
 * mot NM-kampen mot Sunndal 29. juni 1976 ga det syv utgaver med «resultat:
 * 2-0» og «NM/cup-kontekst», og selve kampreferatet havnet på fjerdeplass bak
 * en notis om skiturer.
 *
 * Derfor poengsettes hvert tekstvindu for seg, og utgaven arver poengene til
 * sitt sterkeste vindu. Da teller det bare når kampfakta står i samme avsnitt —
 * «ÅFK til 3. runde med 2—0 … mot Sunndal» — som er nettopp det et kampreferat
 * gjør og en tilfeldig sidesammenstilling ikke gjør.
 */
export function rankNewspaperCandidate(
  item: NbItem,
  matchedQueries: string[],
  fragments: NbContentFragment[],
  options: NewspaperMatchQuery,
): NewspaperCandidate {
  const title = item.metadata?.title?.trim();
  const issued = item.metadata?.originInfo?.issued;
  const urn = item.metadata?.identifiers?.urn;

  const scored = toFragments(fragments)
    .map((fragment) => ({ ...fragment, ...scoreFragment(fragment.text, options) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const reasons = [...(best?.reasons ?? [])];
  let score = best?.score ?? 0;

  const newspaper = normalize(options.newspaper ?? DEFAULT_NEWSPAPER);
  if (title && normalize(title).includes(newspaper)) {
    score += 3;
    reasons.push(`avis: ${options.newspaper ?? DEFAULT_NEWSPAPER}`);
  }

  if (issued?.startsWith(String(options.year))) {
    score += 2;
    reasons.push(`år: ${options.year}`);
  }

  score += Math.min(6, matchedQueries.length * 2);
  if (matchedQueries.length > 1) reasons.push(`${matchedQueries.length} søkevarianter traff`);

  return {
    id: item.id,
    ...(urn ? { urn } : {}),
    ...(title ? { title } : {}),
    ...(issued ? { issued } : {}),
    itemUrl: `https://www.nb.no/items/${item.id}`,
    access: readAccess(item.accessInfo, options.newspaper ?? DEFAULT_NEWSPAPER, issued),
    score,
    reasons,
    matchedQueries: [...matchedQueries],
    fragments: scored,
  };
}

/**
 * Kampfaktaene som står i ett enkelt tekstvindu.
 *
 * Vektene sier hva som skiller et kampreferat fra støy: motstander og AaFK i
 * samme avsnitt er grunnkravet, og resultatet er det sterkeste enkeltsignalet —
 * men bare når det står i tekst, ikke i en tabellrad.
 */
export function scoreFragment(text: string, options: NewspaperMatchQuery): { score: number; reasons: string[] } {
  const normalized = normalize(text);
  const reasons: string[] = [];
  let score = 0;

  const opponentName = [options.opponent, ...(options.opponentAliases ?? [])]
    .find((name) => name.trim() !== "" && normalized.includes(normalize(name)));
  const opponent = opponentName !== undefined;
  if (opponent) {
    score += 20;
    reasons.push(`motstander: ${opponentName}`);
  }

  const alias = AAFK_ALIASES.find((value) => normalized.includes(normalize(value)));
  if (alias) {
    score += 20;
    reasons.push(`AaFK-navn: ${alias}`);
  }

  if (opponent && alias) {
    score += 15;
    reasons.push("motstander og AaFK i samme avsnitt");
  }

  // Et sifferpar er bare et resultat når det står sammen med et lagnavn og ikke
  // i en tabellrad. Uten begge kravene treffer «2 0» i hver eneste serietabell.
  if (options.score && (opponent || alias) && !looksLikeTable(normalized) && containsScore(normalized, options.score)) {
    score += 25;
    reasons.push(`resultat: ${options.score}`);
  }

  if (isNm(options.competition) && hasCupContext(normalized)) {
    score += 10;
    reasons.push("NM/cup-kontekst");
  }

  if (options.round !== undefined && containsRound(normalized, options.round)) {
    score += 10;
    reasons.push(`runde: ${options.round}`);
  }

  return { score, reasons };
}

function candidateSort(a: NewspaperCandidate, b: NewspaperCandidate): number {
  return b.score - a.score || (a.issued ?? "").localeCompare(b.issued ?? "") || a.id.localeCompare(b.id);
}

function toFragments(fragments: NbContentFragment[]): Array<{ pageId?: string; pageNumber?: string; text: string }> {
  return fragments
    .filter((fragment): fragment is NbContentFragment & { text: string } => typeof fragment.text === "string")
    .map((fragment) => ({
      ...(fragment.pageid ? { pageId: fragment.pageid } : {}),
      ...(fragment.pageNumber ? { pageNumber: fragment.pageNumber } : {}),
      text: fragment.text,
    }));
}

function mergeFragments(left: NbContentFragment[], right: NbContentFragment[]): NbContentFragment[] {
  const seen = new Map<string, NbContentFragment>();
  for (const fragment of [...left, ...right]) {
    const key = `${fragment.pageid ?? ""}|${fragment.pageNumber ?? ""}|${fragment.text ?? ""}`;
    seen.set(key, fragment);
  }
  return [...seen.values()];
}

function compactDate(value: string): string {
  const compact = value.replace(/-/g, "");
  if (!/^\d{8}$/.test(compact)) throw new Error(`Ugyldig dato: ${value}. Bruk ÅÅÅÅ-MM-DD.`);
  return compact;
}

/**
 * Uthevingen søketjenesten legger rundt treffordene, fjernet.
 *
 * NB merker treffene med `<em>`, og ingenting annet. Et generelt uttrykk for
 * «fjern alle tagger» ville sett ut som en HTML-vask og blitt lest som en — det
 * er en helt annen påstand enn den vi kan stå for, og en regex holder den
 * påstanden dårlig. Her fjernes bare de merkene vi vet at kilden setter.
 */
export function stripSearchMarkup(value: string): string {
  return value.replace(/<\/?(?:em|strong|b|i)>/gi, " ");
}

/**
 * Teksten uten det som varierer mellom OCR-lesninger: store bokstaver,
 * aksenter, tankestreker, uthevingen fra søketjenesten og skilletegn.
 * Igjen står ord og tall skilt med enkle mellomrom.
 */
function normalize(value: string): string {
  return stripSearchMarkup(value)
    .toLocaleLowerCase("nb")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[‐‑‒–—−-]/gu, " ")
    .replace(/[^a-z0-9æøå]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsScore(normalized: string, score: string): boolean {
  const match = score.match(/^(\d+)\s*[-:–—]\s*(\d+)$/u);
  if (!match) return false;
  return new RegExp(`(?:^|\\s)${match[1]} ${match[2]}(?:\\s|$)`, "u").test(normalized);
}

/**
 * Sant for tabellrader og resultatbørser.
 *
 * Sportssidene er fulle av «5 113 4-11 3 Bryn 4 0 1 3 3- 9 1 Sunndal», og der
 * står hvert tenkelig sifferpar. Slike vinduer er nesten bare tall, mens et
 * referat er nesten bare ord — andelen tall skiller dem uten å måtte kjenne
 * formatet på tabellen.
 */
function looksLikeTable(normalized: string): boolean {
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length < 8) return false;
  const numbers = tokens.filter((token) => /^\d+$/.test(token)).length;
  return numbers / tokens.length >= 0.35;
}

/**
 * Cupkontekst i teksten.
 *
 * «nm» må stå som eget ord. Med ordgrense fra regexen traff det inne i
 * «Sunnmørsposten» — æ, ø og å er ikke ordtegn for `\b` — så hver eneste utgave
 * av avisa fikk cuppoeng.
 */
function hasCupContext(normalized: string): boolean {
  const tokens = new Set(normalized.split(" "));
  return tokens.has("nm") || /(norgesmesterskap|cup)/u.test(normalized);
}

function containsRound(normalized: string, round: number): boolean {
  return new RegExp(`(?:^|\\s)${round} (?:runde|r)(?:\\s|$)`, "u").test(normalized)
    || normalized.includes(`${ordinalWord(round)} runde`);
}

function ordinalWord(round: number): string {
  const words: Record<number, string> = {
    1: "første",
    2: "andre",
    3: "tredje",
    4: "fjerde",
    5: "femte",
    6: "sjette",
  };
  return words[round] ?? `${round}`;
}

function isNm(competition: string | undefined): boolean {
  if (!competition) return false;
  const value = normalize(competition);
  return value === "nm" || value.includes("norgesmesterskap") || value.includes("cup");
}
