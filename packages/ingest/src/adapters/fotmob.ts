import type { MatchEvent } from "@aafkstats/schema";
import { fetchJson } from "../http.js";
import type {
  FetchResult,
  SeasonFetchOptions,
  SourceLineup,
  SourceMatch,
  SourceTeamStats,
} from "../types.js";

export const AAFK_FOTMOB_ID = "8404";
const BASE = "https://www.fotmob.com/api/data";

/**
 * Henter én eksplisitt turneringssesong. Adapteren kan ikke oppdage eller starte en
 * hel klubb-backfill på egen hånd; omfanget må stå i CLI-kallet.
 */
export async function fetchFotmobSeason(options: SeasonFetchOptions): Promise<FetchResult> {
  let requests = 0;
  const request = <T>(url: string) =>
    fetchJson<T>(url, {
      refresh: options.refresh,
      onNetworkRequest: () => { requests += 1; },
    });

  const failures: FetchResult["failures"] = [];
  let league: RawLeague;
  try {
    league = await request(`${BASE}/leagues?id=${options.leagueId}&season=${options.season}`);
  } catch (error) {
    return {
      matches: [],
      failures: [{ scope: "season", externalId: options.leagueId, message: message(error) }],
      requests,
    };
  }
  if (String(league.details?.selectedSeason ?? "") !== String(options.season)) {
    return {
      matches: [],
      failures: [{
        scope: "season",
        externalId: options.leagueId,
        message: `kilden returnerte sesong ${league.details?.selectedSeason ?? "ukjent"}, ikke ${options.season}`,
      }],
      requests,
    };
  }

  const candidates = (league.fixtures?.allMatches ?? [])
    .filter(isAafkMatch)
    .slice(0, options.limit);
  const matches: SourceMatch[] = [];

  for (const [index, raw] of candidates.entries()) {
    const normalized = normalizeLeagueMatch(raw, options.leagueId, options.season, league.details?.name);
    if (!normalized) {
      failures.push({ scope: "match", externalId: String(raw.id ?? "mangler-id"), message: "mangler ID, lag eller gyldig dato" });
      continue;
    }
    // Detaljvinduet er [offset, offset + limit). Uten offset ville hver kjøring
    // hentet de samme første kampene om igjen, og en sesong kunne aldri bli
    // ferdig detaljert med et tak på ti per kjøring.
    const from = options.detailsOffset ?? 0;
    const to = from + (options.detailsLimit ?? candidates.length);
    if (options.withDetails && index >= from && index < to) {
      options.onProgress?.(`detaljer ${index + 1}/${candidates.length}: ${normalized.date}`);
      try {
        const detail = await request<RawMatchDetails>(`${BASE}/matchDetails?matchId=${normalized.externalId}`);
        enrichFromDetails(normalized, detail);
      } catch (error) {
        failures.push({ scope: "match", externalId: normalized.externalId, message: message(error) });
      }
    }
    matches.push(normalized);
  }

  matches.sort((a, b) => a.date.localeCompare(b.date));
  return { matches, failures, requests };
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

function isAafkMatch(raw: RawLeagueMatch): boolean {
  return String(raw.home?.id ?? "") === AAFK_FOTMOB_ID || String(raw.away?.id ?? "") === AAFK_FOTMOB_ID;
}

export function normalizeLeagueMatch(
  raw: RawLeagueMatch,
  leagueId: string,
  season: number,
  leagueName?: string,
): SourceMatch | null {
  const externalId = raw.id === undefined || raw.id === null ? "" : String(raw.id);
  const homeId = raw.home?.id === undefined || raw.home.id === null ? "" : String(raw.home.id);
  const awayId = raw.away?.id === undefined || raw.away.id === null ? "" : String(raw.away.id);
  const utc = raw.status?.utcTime;
  if (!externalId || !homeId || !awayId || !raw.home?.name || !raw.away?.name || !utc) return null;

  const local = osloDateTime(utc);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(local.date)) return null;
  const [parsedHomeScore, parsedAwayScore] = parseScore(raw.status?.scoreStr);
  const homeScore = raw.status?.finished ? parsedHomeScore : undefined;
  const awayScore = raw.status?.finished ? parsedAwayScore : undefined;
  const fields = ["date", "kickoff", "status", "competition", "home.clubId", "away.clubId"];
  if (homeScore !== undefined && awayScore !== undefined) fields.push("home.score", "away.score");

  const match: SourceMatch = {
    externalId,
    date: local.date,
    kickoff: local.kickoff,
    status: normalizeStatus(raw.status),
    rawStatus: raw.status?.reason?.short,
    home: { externalId: homeId, name: raw.home.name },
    away: { externalId: awayId, name: raw.away.name },
    homeScore,
    awayScore,
    competitionExternalId: leagueId,
    competitionName: raw.tournament?.name ?? leagueName ?? String(leagueId),
    season,
    url: raw.pageUrl ? `https://www.fotmob.com${raw.pageUrl}` : undefined,
    fields,
  };
  const { round, stage } = readRound(raw.round);
  if (round !== undefined) {
    match.round = round;
    fields.push("competition.round");
  }
  if (stage) {
    match.stage = stage;
    fields.push("competition.stage");
  }
  return match;
}

/**
 * Tolker FotMobs `round` til enten et rundenummer eller et sluttspillstadium.
 *
 * I serien er verdien et tall. I cupen er den en brøk eller et ord: «1/4», «1/2»,
 * «final». Det er verdt en egen funksjon fordi den naive tolkningen er farlig
 * stille: en generisk «strip alt som ikke er siffer» gjør «1/4» til rundenummer
 * **14** og «1/8» til 18. Kampen blir da skrevet uten at noe klager, og feilen
 * oppdages først når noen lurer på hvorfor cupfinalen ligger i runde 14.
 */
export function readRound(value: unknown): { round?: number; stage?: SourceMatch["stage"] } {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return { round: value };
  }
  if (typeof value !== "string") return {};

  const text = value.trim().toLowerCase();
  if (text === "") return {};

  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return n > 0 ? { round: n } : {};
  }

  const fractions: Record<string, SourceMatch["stage"]> = {
    "1/2": "semi_final",
    "1/4": "quarter_final",
    "1/8": "round_of_16",
    "1/16": "round_of_32",
  };
  const fraction = fractions[text.replace(/\s+/g, "")];
  if (fraction) return { stage: fraction };

  if (/^final$/.test(text)) return { stage: "final" };
  if (/(semi|semifinal)/.test(text)) return { stage: "semi_final" };
  if (/(quarter|kvartfinale)/.test(text)) return { stage: "quarter_final" };
  if (/(3rd place|third place|bronse)/.test(text)) return { stage: "third_place" };
  if (/(group|gruppe)/.test(text)) return { stage: "group" };
  if (/(qualif|kvalif|play-?off round)/.test(text)) return { stage: "qualifying" };

  // Ukjent form. Bedre å la runde og stadium stå tomt enn å gjette et tall.
  return {};
}

export function enrichFromDetails(match: SourceMatch, detail: RawMatchDetails): void {
  const facts = detail.content?.matchFacts;
  const info = facts?.infoBox;
  add(match, "attendance", toInt(info?.Attendance));

  const stadium = info?.Stadium;
  const venueName = typeof stadium === "string" ? stadium : stadium?.name;
  if (venueName) {
    match.venueName = venueName;
    if (typeof stadium === "object") {
      match.venueCity = stadium.city;
      match.venueCapacity = toInt(stadium.capacity);
    }
    match.fields.push("venueId");
  }

  const referee = info?.Referee;
  const refereeName = typeof referee === "string" ? referee : referee?.text;
  if (refereeName) add(match, "referee", refereeName);

  const halfEvent = (facts?.events?.events ?? []).find(
    (event) => event.type === "Half" && (event.halfStrShort === "HT" || event.time === 45),
  );
  if (halfEvent?.homeScore !== undefined && halfEvent.awayScore !== undefined) {
    match.homeHalfTime = halfEvent.homeScore;
    match.awayHalfTime = halfEvent.awayScore;
    match.fields.push("home.halfTimeScore", "away.halfTimeScore");
  }

  splitExtraTime(match, detail);
  readShootout(match, detail);

  const events = readEvents(detail);
  if (events.length > 0) {
    match.events = events;
    match.fields.push("events");
  }
  const stats = readStats(detail);
  if (stats) {
    match.stats = stats;
    match.fields.push("stats");
  }
  const lineups = readLineups(detail);
  if (lineups) {
    match.lineups = lineups;
    match.fields.push("lineups");
  }
  match.fields = [...new Set(match.fields)];
}

function add<K extends "attendance" | "referee">(match: SourceMatch, key: K, value: SourceMatch[K]): void {
  if (value === undefined) return;
  match[key] = value;
  match.fields.push(key);
}

export function readEvents(detail: RawMatchDetails): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (const raw of detail.content?.matchFacts?.events?.events ?? []) {
    if (raw.isPenaltyShootoutEvent) continue;
    const clock = parseMinute(raw.time, raw.overloadTime);
    if (!clock) continue;
    const base = { ...clock, team: raw.isHome ? "home" as const : "away" as const };
    const player = raw.player?.name ?? raw.nameStr;

    if (raw.type === "Goal") {
      events.push({
        ...base,
        type: raw.ownGoal ? "own_goal" : (raw.isPenalty || raw.goalDescription === "Penalty") ? "penalty_goal" : "goal",
        player,
        assist: readAssist(raw),
      });
    } else if (raw.type === "Card") {
      const card = raw.card?.toLowerCase() ?? "";
      const type = card.includes("second")
        ? "second_yellow_card"
        : card.includes("red") ? "red_card" : "yellow_card";
      events.push({ ...base, type, player });
    } else if (raw.type === "Substitution" && raw.swap?.length) {
      events.push({ ...base, type: "substitution", player: raw.swap[0]?.name, playerOff: raw.swap[1]?.name });
    } else if (raw.type === "MissedPenalty") {
      events.push({ ...base, type: "missed_penalty", player });
    } else if (raw.type === "VAR") {
      events.push({ ...base, type: "var_decision", player, note: raw.varDescription });
    }
  }
  return events.sort((a, b) => a.minute - b.minute || (a.stoppage ?? 0) - (b.stoppage ?? 0));
}

/**
 * Deler et AET-resultat i stillingen etter 90 minutter og det som kom i ekstraomgangene.
 *
 * Nødvendig fordi de to sidene mener forskjellige ting med «resultatet». Arkivets
 * `home.score` er stillingen etter ordinær tid, og `extraTime` er det som kom i
 * tillegg — det er den formen straffesparkinvarianten i skjemaet hviler på.
 * FotMobs `scoreStr` er derimot sluttresultatet inklusive ekstraomganger. Skrives
 * det rett inn, får en cupkamp feil ordinærresultat, og en påfølgende
 * straffesparkkonkurranse ser ut som om den fulgte på et ikke-uavgjort resultat.
 *
 * Payloaden oppgir ingen stilling ved 90. Den utledes derfor fra måltidspunktene.
 * Går ikke regnestykket opp mot sluttresultatet — typisk fordi hendelseslista er
 * ufullstendig på eldre kamper — skrives ingenting. Da er det bedre å mangle
 * ekstraomgangen enn å finne på en stilling.
 */
export function splitExtraTime(match: SourceMatch, detail: RawMatchDetails): void {
  if (match.rawStatus !== "AET" && match.rawStatus !== "Pen") return;
  if (match.homeScore === undefined || match.awayScore === undefined) return;

  const goals = (detail.content?.matchFacts?.events?.events ?? []).filter(
    (event) => event.type === "Goal" && !event.isPenaltyShootoutEvent,
  );

  let home90 = 0;
  let away90 = 0;
  let homeTotal = 0;
  let awayTotal = 0;
  for (const goal of goals) {
    const clock = parseMinute(goal.time, goal.overloadTime);
    if (!clock) return void warn(match, "mål uten lesbart tidspunkt; ekstraomgang ikke utledet");
    // Selvmål står oppført på laget som scoret imot, ikke på laget som fikk målet.
    const forHome = goal.ownGoal ? !goal.isHome : goal.isHome;
    if (forHome) homeTotal++;
    else awayTotal++;
    if (clock.minute <= 90) {
      if (forHome) home90++;
      else away90++;
    }
  }

  // Kontrollsum: klarer ikke hendelsene å forklare sluttresultatet, er de ufullstendige.
  if (homeTotal !== match.homeScore || awayTotal !== match.awayScore) {
    warn(
      match,
      `hendelsene forklarer ikke sluttresultatet (${homeTotal}–${awayTotal} mot ${match.homeScore}–${match.awayScore}); ekstraomgang må settes manuelt`,
    );
    return;
  }

  const extraHome = match.homeScore - home90;
  const extraAway = match.awayScore - away90;
  match.homeScore = home90;
  match.awayScore = away90;
  if (extraHome > 0 || extraAway > 0) {
    match.extraTime = { home: extraHome, away: extraAway };
    match.fields.push("extraTime");
  }
}

/**
 * Straffesparkkonkurransen, som FotMob legger som egne hendelser med
 * `isPenaltyShootoutEvent`. Bare de som ble scoret telles — bommene ligger i samme
 * liste og skal ikke inn i sluttsifferet.
 */
export function readShootout(match: SourceMatch, detail: RawMatchDetails): void {
  const shots = (detail.content?.matchFacts?.events?.events ?? []).filter(
    (event) => event.isPenaltyShootoutEvent,
  );
  if (shots.length === 0) return;

  let home = 0;
  let away = 0;
  for (const shot of shots) {
    if (shot.type !== "Goal") continue;
    if (shot.isHome) home++;
    else away++;
  }
  match.penaltyShootout = { home, away };
  match.fields.push("penaltyShootout");
}

function warn(match: SourceMatch, message: string): void {
  (match.warnings ??= []).push(message);
}

/**
 * Målgiverens navn, uten FotMobs visningstekst.
 *
 * `assistStr` er ferdig formatert for skjerm og lyder «assist by Janus Seehusen».
 * `assistInput` har det rene navnet, men mangler i noen kamper. Vi foretrekker
 * derfor det rene feltet og skreller prefikset av det andre — ellers havner
 * «assist by » inni verdien og følger med videre i arkivet, API-et og svarene
 * fra spørrefunksjonen.
 */
export function readAssist(raw: { assistStr?: string; assistInput?: string }): string | undefined {
  const clean = raw.assistInput?.trim();
  if (clean) return clean;

  const display = raw.assistStr;
  if (!display) return undefined;
  // Både engelsk og norsk form, siden språket følger kildens lokalisering.
  // Prefikset skrelles før trimming: «assist by » uten navn skal bli undefined,
  // ikke den nakne etiketten.
  const stripped = display.replace(/^\s*(assist(ed)? by|målgivende av|assist av)\s*/i, "").trim();
  return stripped === "" ? undefined : stripped;
}

export function parseMinute(value: unknown, overload: unknown): { minute: number; stoppage?: number } | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const stoppage = toInt(overload);
    return stoppage && stoppage > 0 ? { minute: Math.trunc(value), stoppage } : { minute: Math.trunc(value) };
  }
  if (typeof value !== "string") return undefined;
  const found = /^\s*(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/.exec(value);
  if (!found) return undefined;
  const minute = Number(found[1]);
  const stoppage = found[2] === undefined ? toInt(overload) : Number(found[2]);
  return stoppage && stoppage > 0 ? { minute, stoppage } : { minute };
}

export function readStats(detail: RawMatchDetails): { home?: SourceTeamStats; away?: SourceTeamStats } | undefined {
  const rows: RawStatItem[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
    } else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.title === "string" && Array.isArray(record.stats) && record.stats.length === 2 &&
          record.stats.every((item) => typeof item !== "object")) {
        rows.push({ title: record.title, stats: record.stats });
      } else {
        for (const child of Object.values(record)) visit(child);
      }
    }
  };
  visit(detail.content?.stats?.Periods?.All?.stats);

  const home: SourceTeamStats = {};
  const away: SourceTeamStats = {};
  let any = false;
  const pick = (titles: RegExp, key: keyof SourceTeamStats, float = false) => {
    const row = rows.find((candidate) => titles.test(candidate.title));
    if (!row) return;
    const parse = float ? toFloat : toInt;
    const homeValue = parse(row.stats[0]);
    const awayValue = parse(row.stats[1]);
    if (homeValue !== undefined) { home[key] = homeValue; any = true; }
    if (awayValue !== undefined) { away[key] = awayValue; any = true; }
  };
  pick(/^Ball possession$/i, "possession");
  pick(/^Total shots$/i, "shots");
  pick(/^Shots on target$/i, "shotsOnTarget");
  pick(/^Corners$/i, "corners");
  pick(/^Fouls committed$|^Fouls$/i, "fouls");
  pick(/^Offsides$/i, "offsides");
  pick(/^Expected goals/i, "xg", true);
  return any ? { home, away } : undefined;
}

function readLineups(detail: RawMatchDetails): { home?: SourceLineup; away?: SourceLineup } | undefined {
  const raw = detail.content?.lineup;
  const team = (value: RawLineupTeam | undefined): SourceLineup | undefined => {
    if (!value) return undefined;
    return {
      formation: value.formation,
      starters: (value.starters ?? []).flatMap((player) => player.name ? [player.name] : []),
      subs: (value.subs ?? []).flatMap((player) => player.name ? [player.name] : []),
      coach: value.coach?.name,
    };
  };
  const home = team(raw?.homeTeam);
  const away = team(raw?.awayTeam);
  return home || away ? { home, away } : undefined;
}

function normalizeStatus(status: RawStatus | undefined): SourceMatch["status"] {
  const reason = `${status?.reason?.short ?? ""} ${status?.reason?.long ?? ""}`.toLowerCase();
  if (status?.cancelled) return reason.includes("postpon") ? "postponed" : reason.includes("abandon") ? "abandoned" : "cancelled";
  if (status?.awarded) return "awarded";
  return status?.finished ? "played" : "scheduled";
}

function osloDateTime(utc: string): { date: string; kickoff?: string } {
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return { date: "" };
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date).split(" ");
  return { date: parts[0] ?? "", kickoff: parts[1] };
}

function parseScore(value: string | undefined): [number | undefined, number | undefined] {
  const found = value ? /(\d+)\s*[-–]\s*(\d+)/.exec(value) : null;
  return found ? [Number(found[1]), Number(found[2])] : [undefined, undefined];
}

function toInt(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : undefined;
  if (typeof value !== "string" || !/\d/.test(value)) return undefined;
  const parsed = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function toFloat(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !/\d/.test(value)) return undefined;
  const parsed = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export interface RawLeague {
  details?: { selectedSeason?: string | number; name?: string };
  fixtures?: { allMatches?: RawLeagueMatch[] };
}
export interface RawLeagueMatch {
  id?: string | number;
  round?: string | number;
  pageUrl?: string;
  tournament?: { name?: string };
  home?: { id?: string | number; name?: string };
  away?: { id?: string | number; name?: string };
  status?: RawStatus;
}
interface RawStatus {
  utcTime?: string;
  finished?: boolean;
  cancelled?: boolean;
  awarded?: boolean;
  scoreStr?: string;
  reason?: { short?: string; long?: string };
}
export interface RawMatchDetails {
  content?: {
    matchFacts?: {
      infoBox?: {
        Attendance?: string | number;
        Stadium?: string | { name?: string; city?: string; capacity?: number };
        Referee?: string | { text?: string };
      };
      events?: { events?: RawEvent[] };
    };
    stats?: { Periods?: { All?: { stats?: unknown } } };
    lineup?: { homeTeam?: RawLineupTeam; awayTeam?: RawLineupTeam };
  };
}
interface RawEvent {
  type?: string;
  time?: number | string;
  overloadTime?: number | string | null;
  isHome?: boolean;
  ownGoal?: boolean;
  isPenalty?: boolean;
  goalDescription?: string;
  isPenaltyShootoutEvent?: boolean;
  card?: string;
  nameStr?: string;
  assistStr?: string;
  assistInput?: string;
  player?: { name?: string };
  swap?: { name?: string }[];
  varDescription?: string;
  homeScore?: number;
  awayScore?: number;
  halfStrShort?: string;
}
interface RawStatItem { title: string; stats: unknown[] }
interface RawLineupTeam {
  formation?: string;
  starters?: { name?: string }[];
  subs?: { name?: string }[];
  coach?: { name?: string };
}
