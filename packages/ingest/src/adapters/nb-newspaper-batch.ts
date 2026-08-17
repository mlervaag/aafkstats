import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchJson } from "../http.js";
import {
  AAFK_ALIASES,
  buildContentFragmentsUrl,
  buildNewspaperSearchUrl,
  newspaperTitleCandidates,
  newspaperTitleForYear,
  searchNewspaperForMatch,
} from "./nb-newspaper-search.js";
import { SEASON_MONTHS } from "./nb-newspaper-plan.js";
import { extractMatchFacts } from "./nb-newspaper-facts.js";
import { accessNote, newspaperPageUrl } from "./nb-newspaper-access.js";
import type { NewspaperAccess } from "./nb-newspaper-access.js";
import type { NewspaperCandidate } from "./nb-newspaper-search.js";
import type { ExtractedFacts } from "./nb-newspaper-facts.js";
import type { Archive } from "@aafkstats/schema/load";
import { AAFK_CLUB_ID, flattenSourceResults } from "@aafkstats/schema";
import type { Club, Match } from "@aafkstats/schema";

export const NB_NEWSPAPER_BATCH_ADAPTER = "nb-newspaper-batch@1";

/**
 * Avisdekning for én kamp av gangen, over en liste arkivet selv definerer.
 *
 * ## Hvorfor dette ikke er en crawler
 *
 * Den leser ikke avisa. Den slår opp de dagene arkivet allerede vet at det ble
 * spilt en kamp — kampdagen og de tre neste — og stopper der. En sesong på tjue
 * kamper er seksti avisdager av tre hundre. Listen kommer fra `data/`, ikke fra
 * lenker verktøyet finner underveis, og kjøringen kan ikke vokse forbi den.
 *
 * ## Hvorfor den er gjenopptakbar
 *
 * Rapporten skrives etter hver kamp. Faller kjøringen, eller stanser man den,
 * fortsetter neste kjøring der den slapp uten å spørre NB om det samme igjen.
 * Det er også det som gjør det trygt å kjøre den i småbiter: et tiår om gangen
 * koster noen minutter, og ingenting går tapt mellom øktene.
 */

/** Hva oppslaget endte med. Skillet mellom «ingen avis» og «ingen treff» er hele poenget. */
export type BatchOutcome =
  /** Utgaven er funnet, med kampfakta i teksten. */
  | "funnet"
  /** Kandidat finnes, men signalene er svake. Trenger et øye. */
  | "usikker"
  /** Avisa er søkbar disse dagene, men ingen kandidat nådde opp. */
  | "ingen_treff"
  /** Ingen digitaliserte utgaver i vinduet. Da er det ingenting å finne. */
  | "ikke_digitalisert";

export interface BatchEntry {
  matchId: string;
  date: string;
  opponent: string;
  /** Sluttresultatet slik arkivet har det, i rekkefølgen hjemme-borte. */
  score: string;
  newspaper: string;
  outcome: BatchOutcome;
  checkedAt: string;
  issue?: IssueRef;
  facts?: ExtractedFacts;
  /** Hva utgaven kan tilføre kampen i arkivet, felt for felt. */
  additions?: string[];
}

/**
 * Utgaven en kamp ble funnet i, med alt en leser trenger for å komme videre.
 *
 * `pageUrl` peker på siden, ikke bare utgaven — for en årgang som krever
 * innlogging er den lenka det eneste vi kan gi, og da bør den være presis.
 * `access` er NBs egne rettighetsopplysninger, og `fullText` fylles bare når de
 * sier at utgaven er åpen for alle.
 */
export interface IssueRef {
  id: string;
  urn?: string;
  issued?: string;
  itemUrl: string;
  pageUrl: string;
  page?: string;
  access: NewspaperAccess;
  accessNote: string;
  score: number;
  reasons: string[];
  /** Dager fra kampdato til utgaven. 1 er dagen etter. */
  dayOffset?: number;
  /** OCR-teksten, bare for årganger NB slipper alle inn i. */
  fullText?: string[];
}

export interface BatchReport {
  version: 1;
  adapter: string;
  createdAt: string;
  updatedAt: string;
  range: { from: number; to: number };
  entries: BatchEntry[];
}

export interface BatchOptions {
  from: number;
  to: number;
  limit?: number;
  /** Bare kamper som mangler kildehenvisning fra før. */
  onlyMissingSources?: boolean;
  /** Hent kampfakta fra resultatboksen. Koster to oppslag per kamp. */
  facts?: boolean;
  refresh?: boolean;
  reportFile: string;
  onProgress?: (entry: BatchEntry) => void;
}

/** Terskelen en kandidat må over for å regnes som funnet, ikke bare mulig. */
const FOUND_SCORE = 70;
/** Dager etter kampen avisa kan ha referatet. Mandagskamper står i tirsdagsavisa. */
const WINDOW_DAYS = 3;

export function matchesForBatch(archive: Archive, options: Pick<BatchOptions, "from" | "to" | "onlyMissingSources">): Match[] {
  return archive.matches
    .filter((match) => {
      const year = Number(match.date.slice(0, 4));
      if (year < options.from || year > options.to) return false;
      if (match.status !== "played") return false;
      // Uten eksakt dato finnes det ikke noe søkevindu, og uten resultat finnes
      // det ikke noe å kjenne igjen boksen på.
      if (match.dateConfidence !== "exact") return false;
      if (match.home.score === null || match.away.score === null) return false;
      if (options.onlyMissingSources && match.sources.length > 0) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Alle skrivemåter av en klubb, slik avisa kan ha skrevet den.
 *
 * Både forkortelsen og de historiske navnene må med. Resultatboksen skriver
 * «ÅFK-HØDD», ikke «Aalesunds FK-Hødd», og en boks som ikke kjennes igjen på
 * lagnavnet gir ingen fakta i det hele tatt.
 */
export function clubNames(club: Club | undefined): string[] {
  if (!club) return [];
  const names = [
    club.name,
    ...(club.shortName ? [club.shortName] : []),
    ...club.nameVariants,
    ...club.names.map((historical) => historical.name),
    ...(club.id === AAFK_CLUB_ID ? AAFK_ALIASES : []),
  ];
  return [...new Set(names.map((name) => name.trim()).filter((name) => name !== ""))];
}

export function searchWindow(date: string, days = WINDOW_DAYS): { from: string; to: string } {
  const to = new Date(`${date}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + days);
  return { from: date, to: to.toISOString().slice(0, 10) };
}

export function dayOffset(date: string, issued: string | undefined): number | undefined {
  if (!issued || !/^\d{8}$/.test(issued)) return undefined;
  const issuedDate = Date.UTC(Number(issued.slice(0, 4)), Number(issued.slice(4, 6)) - 1, Number(issued.slice(6, 8)));
  return Math.round((issuedDate - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
}

/**
 * Hva utgaven kan tilføre kampen slik den står i arkivet.
 *
 * Rapporten skal kunne leses som en arbeidsliste, ikke som en logg. Står det
 * ingenting her, er kampen alt like godt dokumentert som avisa kan gjøre den.
 */
export function additionsFor(match: Match, facts: ExtractedFacts | undefined): string[] {
  const additions: string[] = [];
  if (match.sources.length === 0) additions.push("kildehenvisning");
  if (!facts) return additions;

  if (facts.attendance !== undefined && match.attendance === undefined) additions.push(`tilskuere: ${facts.attendance}`);
  if (facts.referee !== undefined && match.referee === undefined) additions.push(`dommer: ${facts.referee}`);
  if (facts.venue !== undefined && match.venueId === undefined) additions.push(`arena: ${facts.venue}`);
  if (facts.halfTime && match.home.halfTimeScore === null && match.away.halfTimeScore === null) {
    additions.push(`pausestilling: ${facts.halfTime.home}-${facts.halfTime.away}`);
  }
  if (facts.goals.length > 0 && match.events.length === 0) additions.push(`${facts.goals.length} målhendelser`);
  if (facts.lineups.length > 0 && match.lineups === undefined) additions.push(`${facts.lineups.length} laguppstillinger (ukontrollert OCR)`);
  return additions;
}

export async function runNewspaperBatch(archive: Archive, options: BatchOptions): Promise<BatchReport> {
  const report = await readReport(options.reportFile, options);
  const done = new Set(options.refresh ? [] : report.entries.map((entry) => entry.matchId));
  const clubs = new Map(archive.clubs.map((club) => [club.id, club]));
  const digitized = new Map<string, string | null>();

  const pending = matchesForBatch(archive, options).filter((match) => !done.has(match.id));
  for (const match of pending.slice(0, options.limit ?? pending.length)) {
    const entry = await checkMatch(match, { clubs, digitized, ...options });
    report.entries = [...report.entries.filter((existing) => existing.matchId !== entry.matchId), entry]
      .sort((a, b) => a.date.localeCompare(b.date));
    report.updatedAt = new Date().toISOString();
    await writeReport(options.reportFile, report);
    options.onProgress?.(entry);
  }

  return report;
}

async function checkMatch(
  match: Match,
  context: BatchOptions & { clubs: Map<string, Club>; digitized: Map<string, string | null> },
): Promise<BatchEntry> {
  const year = Number(match.date.slice(0, 4));
  const window = searchWindow(match.date);
  const newspaper = (await resolveNewspaperTitle(year, window, context)) ?? newspaperTitleForYear(year);
  const opponentClubId = match.home.clubId === AAFK_CLUB_ID ? match.away.clubId : match.home.clubId;
  const names = clubNames(context.clubs.get(opponentClubId));
  const opponent = names[0] ?? opponentClubId;
  const score = `${match.home.score}-${match.away.score}`;
  const base: BatchEntry = {
    matchId: match.id,
    date: match.date,
    opponent,
    score,
    newspaper,
    outcome: "ingen_treff",
    checkedAt: new Date().toISOString(),
  };

  if ((await resolveNewspaperTitle(year, window, context)) === null) {
    return { ...base, outcome: "ikke_digitalisert" };
  }

  const candidates = await searchNewspaperForMatch({
    opponent,
    opponentAliases: names.slice(1),
    year,
    newspaper,
    score,
    from: window.from,
    to: window.to,
    detailsLimit: 2,
    ...(context.refresh ? { refresh: true } : {}),
  });

  const best = candidates[0];
  if (!best) return base;

  const facts = context.facts === false ? undefined : await factsFor(best, match, context, names);
  const entry: BatchEntry = {
    ...base,
    outcome: best.score >= FOUND_SCORE ? "funnet" : "usikker",
    // Sida i resultatboksen er den leseren skal til, ikke den best rangerte
    // treffsida. For en stengt årgang er lenka alt vi kan gi.
    issue: issueRef(best, dayOffset(match.date, best.issued), facts?.sources[0]?.page ?? best.fragments[0]?.pageNumber),
    ...(facts ? { facts } : {}),
  };
  return { ...entry, additions: additionsFor(match, facts) };
}

/**
 * Utgaven slik den skal stå i rapporten: lenke til siden, rettigheter, og — når
 * NB slipper alle inn — teksten selv.
 */
export function issueRef(candidate: NewspaperCandidate, offset?: number, page = candidate.fragments[0]?.pageNumber): IssueRef {
  const fullText = candidate.access.mayStoreFullText
    ? candidate.fragments.map((fragment) => fragment.text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()).filter((text) => text !== "")
    : undefined;

  return {
    id: candidate.id,
    ...(candidate.urn ? { urn: candidate.urn } : {}),
    ...(candidate.issued ? { issued: candidate.issued } : {}),
    itemUrl: candidate.itemUrl,
    pageUrl: newspaperPageUrl(candidate.id, page),
    ...(page ? { page } : {}),
    access: candidate.access,
    accessNote: accessNote(candidate.access),
    score: candidate.score,
    reasons: candidate.reasons,
    ...(offset === undefined ? {} : { dayOffset: offset }),
    ...(fullText && fullText.length > 0 ? { fullText } : {}),
  };
}

/**
 * Kampfakta fra resultatboksen i den utgaven som ble funnet.
 *
 * De to ekstra oppslagene spør OCR-en om «tilskuere» og «Dommer», som er ordene
 * boksen alltid har og referatet sjelden har. Vinduene rundt dem inneholder hele
 * boksen. Alt som kommer tilbake går gjennom ankerkravet i uttrekket, så bokser
 * fra andre kamper på samme side faller fra av seg selv.
 */
async function factsFor(
  candidate: NewspaperCandidate,
  match: Match,
  context: BatchOptions & { clubs: Map<string, Club> },
  opponentNames: string[],
): Promise<ExtractedFacts | undefined> {
  const fragments = [...candidate.fragments];
  for (const term of ["tilskuere", "Dommer"]) {
    const response = await fetchJson<{ contentFragments?: Array<{ pageNumber?: string; pageid?: string; text?: string }> }>(
      buildContentFragmentsUrl(candidate.id, term),
      { ...(context.refresh ? { refresh: true } : {}) },
    );
    for (const fragment of response.contentFragments ?? []) {
      if (typeof fragment.text === "string") {
        fragments.push({
          ...(fragment.pageid ? { pageId: fragment.pageid } : {}),
          ...(fragment.pageNumber ? { pageNumber: fragment.pageNumber } : {}),
          text: fragment.text,
          score: 0,
          reasons: [],
        });
      }
    }
  }

  const aafkNames = clubNames(context.clubs.get(AAFK_CLUB_ID));
  const isHome = match.home.clubId === AAFK_CLUB_ID;
  return extractMatchFacts(fragments, {
    homeNames: isHome ? aafkNames : opponentNames,
    awayNames: isHome ? opponentNames : aafkNames,
    score: `${match.home.score}-${match.away.score}`,
  }) ?? undefined;
}

/**
 * Avistittelen som faktisk har utgaver i vinduet.
 *
 * Årstallet for navneskiftet er kontrollert mot API-et, men et årstall er en
 * dårlig ting å ha rett i alene: tar det feil, svarer søket null treff, og null
 * treff ser ut som «avisa skrev ikke om kampen». Her prøves derfor det andre
 * navnet før det konkluderes, og svaret huskes for resten av kjøringen.
 *
 * Uten dette blir 1932 og krigsårene rapportert som «ingen treff», og det er
 * feil svar: 1932 har én digitalisert utgave av tre hundre. Forskjellen avgjør
 * om kampen er verdt et nytt forsøk senere eller ikke.
 */
export async function resolveNewspaperTitle(
  year: number,
  window: { from: string; to: string },
  context: { digitized: Map<string, string | null>; refresh?: boolean },
): Promise<string | null> {
  const key = `${year}|${window.from}|${window.to}`;
  const cached = context.digitized.get(key);
  if (cached !== undefined) return cached;

  for (const newspaper of newspaperTitleCandidates(year)) {
    const url = buildNewspaperSearchUrl("*", { year, newspaper, from: window.from, to: window.to, limit: 1 });
    const response = await fetchJson<{ page?: { totalElements?: number } }>(url, { ...(context.refresh ? { refresh: true } : {}) });
    if ((response.page?.totalElements ?? 0) > 0) {
      context.digitized.set(key, newspaper);
      return newspaper;
    }
  }

  context.digitized.set(key, null);
  return null;
}

/**
 * Kamper der arkivet vet motstander og resultat, men ikke dato.
 *
 * ## Hvorfor årssøk ikke duger, og månedssøk gjør det
 *
 * Med dato er søkevinduet fire dager, og riktig utgave er nesten alltid den
 * beste kandidaten. Uten dato er vinduet en hel årgang på tre hundre utgaver,
 * og NB leverer 25 treff per spørring. Da ser vi 25 av 300, valgt av
 * søketjenestens egen relevans — og målt på ni kjente kamper lå riktig utgave i
 * det utvalget bare én gang.
 *
 * Én måned er derimot rundt 25 utgaver. Da dekker ett søk hele måneden, og på
 * de samme ni kampene lå riktig utgave blant de fire beste i måneden sin hver
 * eneste gang, 1935 så vel som 1987.
 *
 * ## Hva som blir automatisk, og hva som ikke blir det
 *
 * Fra midten av 1970-tallet har avisa resultatboksen, og da avgjør ankeret
 * saken selv: står «MJØLNER-ÅFK 0-3» på trykk, er kampen funnet. Før den tid
 * finnes ingen boks, og alle kandidatene i en måned ser like ut for en maskin —
 * omtrent 65 poeng hver, «motstander og AaFK i samme avsnitt». Da er svaret en
 * kandidatliste med sitat, ikke en dato. Det er en ærligere leveranse enn å
 * kåre en vinner blant like: lista tar et menneske noen minutter, en gal dato
 * står i arkivet til noen oppdager den.
 */
export interface DatelessQuery {
  id: string;
  season: number;
  opponent: string;
  opponentAliases?: string[];
  /** Målene som i kildene: [AaFK, motstander]. Hjemme eller borte er ukjent. */
  score: [number, number];
  competitionId?: string | null;
  round?: number | null;
  /** Datoen til nærmeste daterte kamp før og etter i kildens egen rekkefølge. */
  after?: string;
  before?: string;
}

export type DatelessOutcome = "dato_funnet" | "kandidatliste" | "ingen_treff" | "ikke_digitalisert";

export interface DatelessEntry {
  id: string;
  season: number;
  opponent: string;
  score: string;
  newspaper: string;
  outcome: DatelessOutcome;
  checkedAt: string;
  /** Hvorfor månedene ble prøvd i denne rekkefølgen. Begrunnelsen fra steg 0. */
  plan?: string;
  /** Bare satt når resultatboksen navngir begge lagene med denne stillingen. */
  confirmed?: IssueRef & {
    issued: string;
    /** Kampen er spilt før utgaven. Dagen før er vanligst, to dager forekommer. */
    likelyDate: string;
    dateRange: { from: string; to: string };
    facts: ExtractedFacts;
  };
  shortlist: Array<IssueRef & { month: string; quote: string }>;
}

export function monthWindows(season: number, months = SEASON_MONTHS): Array<{ month: string; from: string; to: string }> {
  return months.map((month) => {
    const padded = String(month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(season, month, 0)).getUTCDate();
    return { month: `${season}-${padded}`, from: `${season}-${padded}-01`, to: `${season}-${padded}-${lastDay}` };
  });
}

/** Begge lesemåtene av et resultat ført fra AaFK-perspektiv. */
export function scoreVariants(score: [number, number]): string[] {
  return [...new Set([`${score[0]}-${score[1]}`, `${score[1]}-${score[0]}`])];
}

export interface DatelessOptions {
  /** Månedene, i den rekkefølgen steg 0 vil ha dem prøvd. */
  months?: number[];
  /** Overstyrer avistittelen året ellers ville valgt. */
  newspaper?: string;
  /** Begrunnelsen fra steg 0, som følger med i rapporten. */
  planReason?: string;
  /**
   * Kandidater per måned som blir med på lista. Målt på ni kamper med kjent
   * dato lå riktig utgave på plass én til fire i sin måned — aldri lenger nede.
   * Fire koster ingenting ekstra: de kommer fra søket som alt er gjort.
   */
  shortlistPerMonth?: number;
  /** Kandidater per måned som får et OCR-oppslag. Hver koster én forespørsel. */
  probesPerMonth?: number;
  refresh?: boolean;
}

export async function discoverMatchDate(
  query: DatelessQuery,
  aafkNames: string[],
  options: DatelessOptions = {},
): Promise<DatelessEntry> {
  const newspaper = options.newspaper ?? newspaperTitleForYear(query.season);
  const names = [query.opponent, ...(query.opponentAliases ?? [])];
  const entry: DatelessEntry = {
    id: query.id,
    season: query.season,
    opponent: query.opponent,
    score: `${query.score[0]}-${query.score[1]}`,
    newspaper,
    outcome: "ingen_treff",
    checkedAt: new Date().toISOString(),
    ...(options.planReason ? { plan: options.planReason } : {}),
    shortlist: [],
  };

  let anyIssues = false;
  for (const window of monthWindows(query.season, options.months)) {
    const candidates = await searchNewspaperForMatch({
      opponent: query.opponent,
      ...(query.opponentAliases ? { opponentAliases: query.opponentAliases } : {}),
      year: query.season,
      newspaper,
      from: window.from,
      to: window.to,
      detailsLimit: 0,
      ...(options.refresh ? { refresh: true } : {}),
    });
    if (candidates.length > 0) anyIssues = true;

    for (const [index, candidate] of candidates.slice(0, options.shortlistPerMonth ?? 4).entries()) {
      entry.shortlist.push({
        ...issueRef(candidate),
        month: window.month,
        quote: plain(candidate.fragments[0]?.text ?? "").slice(0, 200),
      });

      if (index >= (options.probesPerMonth ?? 2)) continue;
      if (index >= (options.probesPerMonth ?? 2)) continue;
      const facts = await anchoredFacts(candidate, query, names, aafkNames, options);
      if (facts && candidate.issued) {
        entry.outcome = "dato_funnet";
        entry.confirmed = {
          ...issueRef(candidate, undefined, facts.sources[0]?.page ?? candidate.fragments[0]?.pageNumber),
          issued: candidate.issued,
          likelyDate: shiftDate(candidate.issued, -1),
          dateRange: { from: shiftDate(candidate.issued, -3), to: shiftDate(candidate.issued, 0) },
          facts,
        };
        return entry;
      }
    }
  }

  entry.shortlist.sort((a, b) => b.score - a.score);
  if (entry.shortlist.length > 0) entry.outcome = "kandidatliste";
  else if (!anyIssues) entry.outcome = "ikke_digitalisert";
  return entry;
}

/** Resultatboksen i én kandidat, prøvd i begge lagrekkefølger. */
async function anchoredFacts(
  candidate: NewspaperCandidate,
  query: DatelessQuery,
  opponentNames: string[],
  aafkNames: string[],
  options: DatelessOptions,
): Promise<ExtractedFacts | undefined> {
  const response = await fetchJson<{ contentFragments?: Array<{ pageNumber?: string; text?: string }> }>(
    buildContentFragmentsUrl(candidate.id, query.opponent),
    { ...(options.refresh ? { refresh: true } : {}) },
  );
  const fragments = [
    ...candidate.fragments,
    ...(response.contentFragments ?? [])
      .filter((fragment): fragment is { pageNumber?: string; text: string } => typeof fragment.text === "string")
      .map((fragment) => ({
        ...(fragment.pageNumber ? { pageNumber: fragment.pageNumber } : {}),
        text: fragment.text,
        score: 0,
        reasons: [],
      })),
  ];

  for (const score of scoreVariants(query.score)) {
    for (const [homeNames, awayNames] of [[aafkNames, opponentNames], [opponentNames, aafkNames]] as const) {
      const facts = extractMatchFacts(fragments, { homeNames: [...homeNames], awayNames: [...awayNames], score });
      if (facts) return facts;
    }
  }
  return undefined;
}

function shiftDate(compact: string, days: number): string {
  const date = new Date(Date.UTC(Number(compact.slice(0, 4)), Number(compact.slice(4, 6)) - 1, Number(compact.slice(6, 8))));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function plain(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function readReport(file: string, options: BatchOptions): Promise<BatchReport> {
  if (existsSync(file)) {
    const report = JSON.parse(await readFile(file, "utf8")) as BatchReport;
    if (report.version === 1) return report;
  }
  const now = new Date().toISOString();
  return {
    version: 1,
    adapter: NB_NEWSPAPER_BATCH_ADAPTER,
    createdAt: now,
    updatedAt: now,
    range: { from: options.from, to: options.to },
    entries: [],
  };
}

async function writeReport(file: string, report: BatchReport): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

/**
 * De kildeførte resultatene som mangler dato.
 *
 * Klubbens egne sesongoppstillinger — «Våre kamper gjennom 50 år», medlemsbladets
 * årsliste — parer aldri dato og resultat. De er derfor rike på kamper arkivet
 * ikke kan kanonisere: motstander og resultat er kjent, datoen er ikke det.
 */
export function datelessQueries(
  archive: Archive,
  options: { season?: number; from?: number; to?: number },
): DatelessQuery[] {
  const clubs = new Map(archive.clubs.map((club) => [club.id, club]));
  const matchDates = new Map(archive.matches.map((match) => [match.id, match.date]));
  const queries: DatelessQuery[] = [];

  for (const collection of archive.sourceResults) {
    const results = flattenSourceResults(collection);
    // Kilden er kronologisk og nummerert, så en kamp uten dato ligger mellom de
    // to nærmeste som har en. Det er en hardere opplysning enn noen statistikk
    // over når runder pleier å spilles.
    const known = results.map((result) => result.date ?? (result.matchId ? matchDates.get(result.matchId) : undefined));

    for (const [index, result] of results.entries()) {
      // Et resultat som alt er koblet til en kamp er ferdig, også når koblingen
      // peker på en kamp uten dato. Da er det kampen som skal dateres, ikke
      // kilderaden.
      if (result.date !== undefined || result.matchId !== null) continue;
      if (result.status !== "played" || result.aafkGoals === null || result.opponentGoals === null) continue;
      if (options.season !== undefined && result.season !== options.season) continue;
      if (options.from !== undefined && result.season < options.from) continue;
      if (options.to !== undefined && result.season > options.to) continue;

      const club = result.opponentClubId ? clubs.get(result.opponentClubId) : undefined;
      const names = club ? clubNames(club) : (result.opponent ? [result.opponent] : []);
      if (names.length === 0) continue;

      queries.push({
        id: `${collection.sourceId}#${result.id}`,
        season: result.season,
        opponent: names[0]!,
        ...(names.length > 1 ? { opponentAliases: names.slice(1) } : {}),
        score: [result.aafkGoals, result.opponentGoals],
        ...(result.competitionId === null ? {} : { competitionId: result.competitionId }),
        ...(result.round === null ? {} : { round: result.round }),
        ...neighbourDates(results, known, index, result.season),
      });
    }
  }

  return queries.sort((a, b) => a.season - b.season || a.id.localeCompare(b.id));
}

/** Datoen til nærmeste daterte kamp før og etter, innenfor samme sesong. */
function neighbourDates(
  results: Array<{ season: number }>,
  known: Array<string | undefined>,
  index: number,
  season: number,
): { after?: string; before?: string } {
  let after: string | undefined;
  let before: string | undefined;

  for (let step = index - 1; step >= 0; step -= 1) {
    if (results[step]!.season !== season) break;
    if (known[step] !== undefined) { after = known[step]; break; }
  }
  for (let step = index + 1; step < results.length; step += 1) {
    if (results[step]!.season !== season) break;
    if (known[step] !== undefined) { before = known[step]; break; }
  }

  return { ...(after ? { after } : {}), ...(before ? { before } : {}) };
}

/** Rapporten som tabell, til å lese i terminalen eller lime inn i en sak. */
export function formatBatchReport(report: BatchReport): string {
  const counts = new Map<BatchOutcome, number>();
  for (const entry of report.entries) counts.set(entry.outcome, (counts.get(entry.outcome) ?? 0) + 1);

  const lines = [
    `# Avisdekning ${report.range.from}–${report.range.to}`,
    "",
    `${report.entries.length} kamper sjekket · ${[...counts].map(([outcome, count]) => `${outcome}: ${count}`).join(" · ")}`,
    "",
  ];

  for (const entry of report.entries) {
    const issue = entry.issue ? `${entry.issue.issued ?? "?"} (score ${entry.issue.score})` : "—";
    lines.push(`## ${entry.date} ${entry.opponent} ${entry.score} · ${entry.outcome} · ${issue}`);
    if (entry.issue) lines.push(`  ${entry.issue.itemUrl}`);
    if (entry.additions?.length) lines.push(`  kan tilføre: ${entry.additions.join(", ")}`);
    if (entry.facts) {
      const goals = entry.facts.goals.map((goal) => `${goal.standing} ${goal.scorer}${goal.minute === undefined ? "" : ` (${goal.minute})`}`);
      if (goals.length > 0) lines.push(`  mål: ${goals.join(", ")}`);
    }
  }
  return lines.join("\n");
}
