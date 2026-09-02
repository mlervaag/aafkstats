import { personKey } from "@aafkstats/schema";
import { buildNewspaperSearchUrl, stripSearchMarkup } from "./nb-newspaper-search.js";
import { fetchJson } from "../http.js";

/**
 * Overgangskandidater for 2000–2012 fra Sunnmørsposten hos Nasjonalbiblioteket.
 *
 * ## Hva Wikidata er, og hva den ikke er
 *
 * Arkivet mangler spilleroverganger for perioden. Wikidata har dem — men bare
 * som «imported from English Wikipedia» på 122 av 153 kildehenvisninger, altså
 * ikke en kilde i det hele tatt. Wikidata brukes derfor BARE som målliste: hvilke
 * spillere, og hvilke år, skal vi lete etter i avisa. Ingenting av det Wikidata
 * sier om overgangen — klubb, dato, retning — skrives til arkivet eller oppgis
 * som kilde. Bare et navn og et årstall styrer søket videre.
 *
 * ## Hvorfor en poengsetting med en hard sperre
 *
 * Et søk på et etternavn i tjue sider avis gir mest støy: «Trond Fredriksen»
 * i 2010 fant «lett overgang til bussrutene» — ordet «overgang» og et navn i
 * samme utgave, uten at det har noe med fotball å gjøre. Uten et krav om at
 * etternavnet og et overgangsord faktisk står i samme tekstvindu, drukner hvert
 * ekte treff i alt det andre en avis skriver om. Se `scoreTransferFragment`.
 *
 * ## Hva denne fila ikke gjør
 *
 * Den skriver ingenting. Den kaller ikke NBs API for OCR-tekst utover det
 * søketreffet allerede gir (`item.contentFragments` når `snippets=aviser` er
 * satt — ikke et eget kall mot /contentfragments). Og den avgjør ikke om et
 * treff er sant; det er nettopp det redaksjonell kontroll skal gjøre.
 */

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const AAFK_QID = "Q214992";

export interface TransferTarget {
  qid: string;
  player: string;
  direction: "in" | "out";
  /** Året Wikidata knytter perioden til. Alltid årspresisjon, aldri en eksakt dag. */
  year: number;
}

interface WikidataBinding {
  player: { value: string };
  playerLabel: { value: string };
  start?: { value: string };
  end?: { value: string };
}

interface WikidataSparqlResponse {
  results: { bindings: WikidataBinding[] };
}

/**
 * Årstall fra en Wikidata-dato.
 *
 * P580/P582 lagres nesten alltid med årspresisjon, som SPARQL likevel skriver
 * ut som `ÅÅÅÅ-01-01T00:00:00Z` — en dag som ikke betyr noe. Bare årstallet
 * hentes ut; en eksakt dag herfra ville vært en påstand vi ikke har dekning for.
 */
function wikidataYear(value: string | undefined): number | undefined {
  const match = value?.match(/^(\d{4})-\d{2}-\d{2}/);
  return match ? Number(match[1]) : undefined;
}

/**
 * Målliste: spillere med en periode i AaFK, og hvilket år overgangen inn
 * og/eller ut faller i. Bare mål med år innenfor `[from, to]` beholdes.
 */
export async function fetchWikidataTransferTargets(
  from: number,
  to: number,
  options: { refresh?: boolean } = {},
): Promise<TransferTarget[]> {
  const query = `SELECT ?player ?playerLabel ?start ?end WHERE {
  ?player p:P54 ?st . ?st ps:P54 wd:${AAFK_QID} .
  OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "nb,en". } }`;
  const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetchJson<WikidataSparqlResponse>(url, { refresh: options.refresh });

  const targets: TransferTarget[] = [];
  const seen = new Set<string>();
  const add = (target: TransferTarget) => {
    const key = `${target.qid}|${target.direction}|${target.year}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  };

  for (const row of response.results.bindings) {
    const qid = row.player.value.split("/").pop() ?? row.player.value;
    const player = row.playerLabel.value;
    const startYear = wikidataYear(row.start?.value);
    const endYear = wikidataYear(row.end?.value);
    if (startYear !== undefined && startYear >= from && startYear <= to) {
      add({ qid, player, direction: "in", year: startYear });
    }
    if (endYear !== undefined && endYear >= from && endYear <= to) {
      add({ qid, player, direction: "out", year: endYear });
    }
  }

  targets.sort((a, b) => a.year - b.year || a.direction.localeCompare(b.direction) || a.player.localeCompare(b.player, "nb"));
  return targets;
}

/**
 * Søkespørringen for ett mål: spillerens navn i anførselstegn, kombinert med
 * overgangsord. Egne søk per overgangsord ville tredoblet kallbudsjettet uten
 * å gi noe nytt — `OR` i selve Lucene-uttrykket gjør jobben i ett kall.
 */
export function buildTransferSearchQuery(player: string): string {
  return `"${player}" AND (overgang OR "klar for" OR signerte OR "går til" OR hentet OR solgt OR lånes)`;
}

/**
 * Søkevinduet for ett mål: året før, året selv, og året etter.
 *
 * Wikidata-datoen er årspresisjon, ikke en dag. Et vintervindu — overgangen
 * skjer i januar, spelet Wikidata teller fra 1. januar — krysser årsskiftet,
 * og et rent enkeltårssøk ville hoppet over akkurat den utgaven.
 */
export function transferSearchWindow(year: number): { from: string; to: string } {
  return { from: `${year - 1}-01-01`, to: `${year + 1}-12-31` };
}

const TRANSFER_PHRASES = [
  "overgang",
  "klar for",
  "signert",
  "går til",
  "gikk til",
  "hentet",
  "solgt",
  "kjøpt",
  "lånes ut",
  "på lån",
  "forlater",
  "meldt overgang",
  "ny klubb",
  "tilbake til",
] as const;

/** Overgangsordet «signert» dekker «signerte» som delstreng, jf. TRANSFER_PHRASES. */
const NEAR_WINDOW_CHARS = 200;
const TRANSFER_WINDOW_MONTHS = new Set([1, 2, 3, 4, 7, 8]);

export interface FragmentScore {
  /** Sann bare når etternavnet og et overgangsord begge finnes, og står nær hverandre. */
  matched: boolean;
  score: number;
  reasons: string[];
}

/** Siste ord i navnet. Fornavn og mellomnavn skiller ikke en avisnotis; etternavnet gjør. */
function surnameOf(player: string): string {
  const parts = player.trim().split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? player.trim();
}

/**
 * Alle posisjoner i teksten der et ord normaliserer til samme nøkkel som
 * `target` (allerede kjørt gjennom `personKey`). Bruker `personKey` — den
 * regelen arkivet allerede har for at «ø»/«ö» og «æ»/«ae» er samme bokstav —
 * slik at OCR-slurv i etternavnet ikke skjuler et ekte treff.
 */
function findNamePositions(text: string, targetKey: string): number[] {
  const positions: number[] = [];
  const wordPattern = /\p{L}[\p{L}'-]*/gu;
  let match: RegExpExecArray | null;
  while ((match = wordPattern.exec(text)) !== null) {
    if (personKey(match[0]) === targetKey) positions.push(match.index);
  }
  return positions;
}

/** Alle posisjoner der `phrase` forekommer i `lowerText`, case-insensitivt. */
function findPhrasePositions(lowerText: string, phrase: string): number[] {
  const positions: number[] = [];
  let from = 0;
  for (;;) {
    const index = lowerText.indexOf(phrase, from);
    if (index === -1) return positions;
    positions.push(index);
    from = index + phrase.length;
  }
}

/** Utgavedatoen (NBs `issued`, ÅÅÅÅMMDD) faller i et typisk overgangsvindu. */
function isTransferWindowEdition(issued: string | undefined): boolean {
  if (!issued || !/^\d{8}$/.test(issued)) return false;
  return TRANSFER_WINDOW_MONTHS.has(Number(issued.slice(4, 6)));
}

/**
 * Poengsetter ett tekstvindu mot ett mål.
 *
 * Sperren er absolutt: uten etternavnet OG et overgangsord innenfor 200 tegn
 * er `matched` usann, uansett hva annet fragmentet inneholder. Se filens
 * toppkommentar for hvorfor — dette er forskjellen mellom et kampreferat om
 * spilleren og en tilfeldig sidestilling av navnet og et vanlig ord.
 */
export function scoreTransferFragment(
  text: string,
  player: string,
  options: { issued?: string; clubNames?: string[] } = {},
): FragmentScore {
  const clean = stripSearchMarkup(text);
  const surnameKey = personKey(surnameOf(player));
  if (surnameKey === "") return { matched: false, score: 0, reasons: [] };

  const namePositions = findNamePositions(clean, surnameKey);
  if (namePositions.length === 0) return { matched: false, score: 0, reasons: [] };

  const lower = clean.toLocaleLowerCase("nb");
  const phraseHits = TRANSFER_PHRASES.flatMap((phrase) =>
    findPhrasePositions(lower, phrase).map((index) => ({ phrase, index })));
  if (phraseHits.length === 0) return { matched: false, score: 0, reasons: [] };

  let bestDistance = Infinity;
  let bestPhrase: string | undefined;
  for (const namePos of namePositions) {
    for (const hit of phraseHits) {
      const distance = Math.abs(hit.index - namePos);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPhrase = hit.phrase;
      }
    }
  }
  if (bestPhrase === undefined || bestDistance > NEAR_WINDOW_CHARS) return { matched: false, score: 0, reasons: [] };

  const reasons: string[] = [`etternavn og «${bestPhrase}» ${bestDistance} tegn fra hverandre`];
  let score = 30 + Math.max(0, 15 - Math.floor(bestDistance / 15));

  const distinctPhrases = new Set(phraseHits.map((hit) => hit.phrase));
  if (distinctPhrases.size > 1) {
    score += Math.min(10, (distinctPhrases.size - 1) * 5);
    reasons.push(`${distinctPhrases.size} ulike overgangsord i teksten`);
  }

  const matchedClub = (options.clubNames ?? []).find((club) => club.length > 3 && lower.includes(club.toLocaleLowerCase("nb")));
  if (matchedClub) {
    score += 15;
    reasons.push(`klubbnavn: ${matchedClub}`);
  }

  if (isTransferWindowEdition(options.issued)) {
    score += 10;
    reasons.push("utgave i typisk overgangsvindu (jan–apr eller jul–aug)");
  }

  return { matched: true, score, reasons };
}

export interface TransferCandidate {
  itemId: string;
  itemUrl: string;
  title?: string;
  issued?: string;
  pageNumber?: string;
  text: string;
  score: number;
  reasons: string[];
}

interface NbContentFragmentLike {
  pageid?: string;
  pageNumber?: string;
  text?: string;
}

export interface NbItemLike {
  id: string;
  metadata?: {
    title?: string;
    originInfo?: { issued?: string };
  };
  contentFragments?: NbContentFragmentLike[];
}

interface NbSearchResponseLike {
  _embedded?: { items?: NbItemLike[] };
}

/**
 * Rangerer alle fragmentene i et sett NB-treff mot ett mål, og holder bare de
 * som består sperren i `scoreTransferFragment`. Sterkeste øverst, maks 5.
 */
export function rankTransferCandidates(
  items: NbItemLike[],
  player: string,
  clubNames: string[] = [],
): TransferCandidate[] {
  const candidates: TransferCandidate[] = [];
  for (const item of items) {
    const issued = item.metadata?.originInfo?.issued;
    for (const fragment of item.contentFragments ?? []) {
      if (typeof fragment.text !== "string") continue;
      const scored = scoreTransferFragment(fragment.text, player, { issued, clubNames });
      if (!scored.matched) continue;
      candidates.push({
        itemId: item.id,
        itemUrl: `https://www.nb.no/items/${item.id}`,
        ...(item.metadata?.title ? { title: item.metadata.title } : {}),
        ...(issued ? { issued } : {}),
        ...(fragment.pageNumber ? { pageNumber: fragment.pageNumber } : {}),
        text: stripSearchMarkup(fragment.text).trim(),
        score: scored.score,
        reasons: scored.reasons,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score
    || (a.issued ?? "").localeCompare(b.issued ?? "")
    || a.itemId.localeCompare(b.itemId));
  return candidates.slice(0, 5);
}

/** Søker NB for ett mål, og rangerer treffene. Ett nettverkskall (`snippets=aviser`). */
export async function findTransferCandidatesForTarget(
  target: TransferTarget,
  options: { clubNames?: string[]; refresh?: boolean } = {},
): Promise<TransferCandidate[]> {
  const window = transferSearchWindow(target.year);
  const url = buildNewspaperSearchUrl(buildTransferSearchQuery(target.player), {
    year: target.year,
    from: window.from,
    to: window.to,
    limit: 25,
  });
  const response = await fetchJson<NbSearchResponseLike>(url, { refresh: options.refresh });
  return rankTransferCandidates(response._embedded?.items ?? [], target.player, options.clubNames ?? []);
}

export interface TransferTargetResult {
  target: TransferTarget;
  candidates: TransferCandidate[];
}

/**
 * Søker NB for hvert mål, maks `concurrency` samtidig.
 *
 * Selve fartsgrensen mot api.nb.no håndheves allerede av `fetchJson` (minst
 * 1,1 sekund mellom kall til samme vert, uansett hvor mange kall som står i
 * kø her). `concurrency` avgjør bare hvor mange mål som er «underveis»
 * samtidig — et lite tall holder rekkefølgen forutsigbar og feilmeldinger
 * lette å knytte til riktig mål.
 */
export async function findTransferCandidates(
  targets: TransferTarget[],
  options: { clubNames?: string[]; refresh?: boolean; concurrency?: number } = {},
): Promise<TransferTargetResult[]> {
  const results = new Array<TransferTargetResult>(targets.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= targets.length) return;
      const target = targets[index]!;
      const candidates = await findTransferCandidatesForTarget(target, options);
      results[index] = { target, candidates };
    }
  }
  const workerCount = Math.max(1, Math.min(options.concurrency ?? 3, targets.length || 1));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
