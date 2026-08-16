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

/**
 * Adapterversjon, ført i hver observasjon.
 *
 * Tallet skal opp når tolkningen endrer seg — ny feltlesing, rettet parsefeil —
 * ikke når en kommentar flyttes. Det er dette som gjør at en verdi hentet før en
 * rettelse kan skilles fra en hentet etter.
 */
export const FOTMOB_ADAPTER = "fotmob@5";
const BASE = "https://www.fotmob.com/api/data";
/**
 * Landkodene FotMob bruker på lagprofilen, oversatt til ISO 3166-1 alpha-2.
 *
 * FotMob blander to systemer: «NOR» og «UKR» er ISO alpha-3, mens «DEN» og
 * «GER» er FIFA-koder. Tabellen dekker derfor begge formene der de er ulike.
 * Står en kode ikke her, sier oppslaget fra seg framfor å gjette.
 */
const FOTMOB_COUNTRIES: Record<string, string> = {
  ALB: "AL", AUT: "AT", BEL: "BE", BIH: "BA", BLR: "BY", BUL: "BG", CHN: "CN",
  CRO: "HR", CYP: "CY", CZE: "CZ", DEN: "DK", DNK: "DK", ENG: "GB", ESP: "ES",
  EST: "EE", FIN: "FI", FRA: "FR", GER: "DE", GRE: "GR", HUN: "HU", IRL: "IE",
  ISL: "IS", ISR: "IL", ITA: "IT", KAZ: "KZ", LAT: "LV", LTU: "LT", LUX: "LU",
  MLT: "MT", MDA: "MD", MKD: "MK", NED: "NL", NIR: "GB", NOR: "NO", POL: "PL",
  POR: "PT", ROU: "RO", RUS: "RU", SCO: "GB", SRB: "RS", SUI: "CH", SVK: "SK",
  SVN: "SI", SWE: "SE", TUR: "TR", UKR: "UA", USA: "US", WAL: "GB",
};

interface RawTeamDetails {
  details?: { country?: string };
}

/**
 * Hjemlandet til ett FotMob-lag, hentet fra lagets egen profil.
 *
 * ## Feilen dette retter
 *
 * Her sto en håndskrevet tabell med lag-ID-er. Alt utenfor den fikk
 * `undefined`, og `reconcile` gjorde det om til «NO». Da treningskampene ble
 * importert, ga det utenlandske klubber norsk landkode: FC København,
 * Brøndby, Anzhi, Karpaty, Shandong Taishan og flere. Ingenting sa fra, fordi
 * en gjettet verdi ser nøyaktig ut som en hentet.
 *
 * En håndskrevet liste over hvilke lag som er utenlandske kan aldri bli
 * ferdig — neste ukjente motstander faller utenfor den igjen. Kilden vet det
 * selv, og ett oppslag per nytt lag er billig: `fetchJson` cacher og holder
 * fartsgrensa.
 */
export async function fetchFotmobTeamCountry(
  id: string,
  options: { refresh?: boolean } = {},
): Promise<string | undefined> {
  const raw = await fetchJson<RawTeamDetails>(`${BASE}/teams?id=${id}`, options);
  // FotMob svarer med null for en ID som ikke finnes, ikke med en feil.
  const code = raw?.details?.country?.toUpperCase();
  return code ? FOTMOB_COUNTRIES[code] : undefined;
}

/** Fyller ut land på lagene som mangler det, med ett oppslag per lag. */
export async function enrichTeamCountries(
  matches: SourceMatch[],
  options: { refresh?: boolean } = {},
): Promise<void> {
  const unknown = new Set<string>();
  for (const match of matches) {
    for (const team of [match.home, match.away]) {
      if (!team.country && team.externalId) unknown.add(team.externalId);
    }
  }
  const found = new Map<string, string>();
  for (const id of unknown) {
    const country = await fetchFotmobTeamCountry(id, options);
    if (country) found.set(id, country);
  }
  for (const match of matches) {
    for (const team of [match.home, match.away]) {
      const country = team.externalId ? found.get(team.externalId) : undefined;
      if (country) team.country = country;
    }
    match.venueCountry ??= match.home.country;
  }
}

export interface TeamHistoryFetchOptions {
  from: string;
  to: string;
  maxPages?: number;
  matchIds?: string[];
  withDetails?: boolean;
  refresh?: boolean;
  onProgress?: (message: string) => void;
}

/**
 * Leser den eksplisitt avgrensede klubbhistorikken FotMob selv bruker på
 * kampsiden. Dette er discovery, ikke en skjult «hent alt»-modus: både fra- og
 * tildato er obligatoriske, antall sider har et hardt tak, og detaljoppslag kan
 * begrenses til en eksplisitt liste med kamp-ID-er.
 */
export async function fetchFotmobTeamHistory(options: TeamHistoryFetchOptions): Promise<FetchResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.from) || !/^\d{4}-\d{2}-\d{2}$/.test(options.to) || options.from > options.to) {
    throw new Error("FotMob-historikk krever gyldig --from og --to");
  }
  const maxPages = options.maxPages ?? 40;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 40) {
    throw new Error("maxPages må være 1–40");
  }

  let requests = 0;
  const request = <T>(url: string) => fetchJson<T>(url, {
    refresh: options.refresh,
    onNetworkRequest: () => { requests += 1; },
  });
  const exclusiveEnd = Math.floor(new Date(`${options.to}T23:59:59Z`).getTime() / 1000) + 1;
  const initialCursor = `/prod/db/api/team/${AAFK_FOTMOB_ID}/fixture-by-date?beforetimestamp=${exclusiveEnd}`;
  let url: string | undefined = `${BASE}/pageableFixtures?teamId=${AAFK_FOTMOB_ID}&cursor=${encodeURIComponent(initialCursor)}`;
  const rawMatches = new Map<string, RawTeamFixture>();
  const failures: FetchResult["failures"] = [];

  for (let page = 1; page <= maxPages && url; page++) {
    options.onProgress?.(`historikkside ${page}/${maxPages}`);
    let payload: RawPageableFixtures;
    try {
      payload = await request<RawPageableFixtures>(url);
    } catch (error) {
      failures.push({ scope: "season", externalId: AAFK_FOTMOB_ID, message: message(error) });
      break;
    }
    const pageMatches = payload.matches ?? [];
    for (const raw of pageMatches) {
      if (raw.id !== undefined && isAafkMatch(raw)) rawMatches.set(String(raw.id), raw);
    }
    const dates = pageMatches.flatMap((raw) => raw.status?.utcTime ? [raw.status.utcTime.slice(0, 10)] : []);
    if (dates.length === 0 || dates.some((date) => date <= options.from) || !payload.previous) break;
    url = new URL(payload.previous, "https://www.fotmob.com").href;
    if (page === maxPages) {
      failures.push({ scope: "season", externalId: AAFK_FOTMOB_ID, message: `historikken traff sidetaket ${maxPages}` });
    }
  }

  const wanted = options.matchIds ? new Set(options.matchIds) : undefined;
  const matches = [...rawMatches.values()]
    .filter((raw) => {
      const date = raw.status?.utcTime?.slice(0, 10) ?? "";
      return date >= options.from && date <= options.to && (!wanted || wanted.has(String(raw.id)));
    })
    .flatMap((raw) => {
      const leagueId = String(raw.tournament?.leagueId ?? "unknown");
      const year = Number(raw.status?.utcTime?.slice(0, 4));
      const normalized = normalizeLeagueMatch(raw, leagueId, year, raw.tournament?.name);
      return normalized ? [normalized] : [];
    });

  if (wanted) {
    for (const id of wanted) {
      if (!matches.some((match) => match.externalId === id)) {
        failures.push({ scope: "match", externalId: id, message: "kamp-ID-en finnes ikke i det avgrensede historikkvinduet" });
      }
    }
  }

  if (options.withDetails) {
    for (const [index, match] of matches.entries()) {
      options.onProgress?.(`detaljer ${index + 1}/${matches.length}: ${match.externalId}`);
      try {
        const detail = await request<RawMatchDetails>(`${BASE}/matchDetails?matchId=${match.externalId}`);
        enrichFromDetails(match, detail);
        if (match.competitionExternalId === "489" && match.venueName) {
          match.venueReliable = false;
          match.fields = match.fields.filter((field) => field !== "venueId");
          match.note = "FotMob viser et standardspillested for treningskampen; spillestedet er ikke arkivert uten uavhengig bekreftelse.";
        }
      } catch (error) {
        failures.push({ scope: "match", externalId: match.externalId, message: message(error) });
      }
    }
  }
  matches.sort((a, b) => a.date.localeCompare(b.date) || a.externalId.localeCompare(b.externalId));
  await enrichTeamCountries(matches, { refresh: options.refresh });
  return { matches, failures, requests };
}

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

  // Det kilden spørres om, som ikke alltid er årstallet kampene arkiveres under.
  const askedFor = options.sourceSeason ?? String(options.season);

  const failures: FetchResult["failures"] = [];
  let league: RawLeague;
  try {
    league = await request(
      `${BASE}/leagues?id=${options.leagueId}&season=${encodeURIComponent(askedFor)}`,
    );
  } catch (error) {
    return {
      matches: [],
      failures: [{ scope: "season", externalId: options.leagueId, message: message(error) }],
      requests,
    };
  }
  if (String(league.details?.selectedSeason ?? "") !== askedFor) {
    return {
      matches: [],
      failures: [{
        scope: "season",
        externalId: options.leagueId,
        message: `kilden returnerte sesong ${league.details?.selectedSeason ?? "ukjent"}, ikke ${askedFor}`,
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
    //
    // En eksplisitt datoliste går foran vinduet. Den som vet hvilken kamp som er
    // ny, vet det som en dato — ikke som en indeks i kildens liste.
    const from = options.detailsOffset ?? 0;
    const to = from + (options.detailsLimit ?? candidates.length);
    const wanted = options.detailsDates
      ? options.detailsDates.includes(normalized.date)
      : index >= from && index < to;
    if (options.withDetails && wanted) {
      options.onProgress?.(`detaljer ${index + 1}/${candidates.length}: ${normalized.date}`);
      try {
        const detail = await request<RawMatchDetails>(`${BASE}/matchDetails?matchId=${normalized.externalId}`);
        enrichFromDetails(normalized, detail);
        const report = normalized.statsReport;
        if (report) {
          const found = report.foundFields.length > 0 ? report.foundFields.join(", ") : "ingen";
          const unknown = report.unknownTitles.length > 0 ? `; ukjente titler: ${report.unknownTitles.join(", ")}` : "";
          const rejected = report.rejectedReason ? `; avvist: ${report.rejectedReason}` : "";
          options.onProgress?.(`statistikk ${normalized.externalId}: ${found} (${report.foundFields.length}/7)${unknown}${rejected}`);
        }
      } catch (error) {
        failures.push({ scope: "match", externalId: normalized.externalId, message: message(error) });
      }
    }
    matches.push(normalized);
  }

  matches.sort((a, b) => a.date.localeCompare(b.date));
  await enrichTeamCountries(matches, { refresh: options.refresh });
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
    home: { externalId: homeId, name: raw.home.name, country: homeId === AAFK_FOTMOB_ID ? "NO" : undefined },
    away: { externalId: awayId, name: raw.away.name, country: awayId === AAFK_FOTMOB_ID ? "NO" : undefined },
    homeScore,
    awayScore,
    competitionExternalId: leagueId,
    competitionName: raw.tournament?.name ?? leagueName ?? String(leagueId),
    season,
    venueReliable: leagueId === "489" ? false : undefined,
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
  } else if (/qualif/i.test(match.competitionName)) {
    match.stage = "qualifying";
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
  const detailRound = readRound(detail.general?.matchRound);
  if (detailRound.round !== undefined && match.round === undefined) {
    match.round = detailRound.round;
    match.fields.push("competition.round");
  }
  if (detailRound.stage !== undefined && match.stage === undefined) {
    match.stage = detailRound.stage;
    match.fields.push("competition.stage");
  }
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
    match.venueCountry ??= match.home.country;
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
  const statsReport = readStatsReport(detail);
  match.statsReport = statsReport;
  if (statsReport.stats) {
    match.stats = statsReport.stats;
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
    const player = cleanName(raw.player?.name ?? raw.nameStr);

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

function cleanName(value: string | undefined): string | undefined {
  const name = value?.trim();
  return !name || /^<?tbd>?$/i.test(name) || name === "–" || name === "-" ? undefined : name;
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
 * Straffesparkkonkurransen.
 *
 * FotMob oppgir den to måter, og den ene er lett å overse. Vanligst er én
 * oppsummerende hendelse av typen `PenaltyShootout` med `penaltyScore: [hjemme,
 * borte]`. Noen kamper har i stedet ett straffespark per hendelse, merket med
 * `isPenaltyShootoutEvent`. Vi leser oppsummeringen først og teller enkeltspark
 * bare når den mangler.
 *
 * Uten dette blir en cupkamp stående som uavgjort uten at noe forteller hvem som
 * gikk videre — og en cupkamp kan ikke ende uavgjort.
 */
export function readShootout(match: SourceMatch, detail: RawMatchDetails): void {
  const events = detail.content?.matchFacts?.events?.events ?? [];

  const summary = events.find((event) => event.type === "PenaltyShootout");
  const pair = summary?.penaltyScore;
  if (Array.isArray(pair) && pair.length === 2) {
    const home = toInt(pair[0]);
    const away = toInt(pair[1]);
    if (home !== undefined && away !== undefined) {
      match.penaltyShootout = { home, away };
      match.fields.push("penaltyShootout");
      return;
    }
  }

  const shots = events.filter((event) => event.isPenaltyShootoutEvent);
  if (shots.length === 0) {
    const penalties = detail.header?.status?.reason?.penalties;
    if (Array.isArray(penalties) && penalties.length === 2) {
      const home = toInt(penalties[0]);
      const away = toInt(penalties[1]);
      if (home !== undefined && away !== undefined) {
        match.penaltyShootout = { home, away };
        match.fields.push("penaltyShootout");
      }
    }
    return;
  }

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

export interface StatsReadReport {
  stats?: { home?: SourceTeamStats; away?: SourceTeamStats };
  foundFields: (keyof SourceTeamStats)[];
  unknownTitles: string[];
  rejectedReason?: string;
}

export function readStatsReport(detail: RawMatchDetails): StatsReadReport {
  const rows: RawStatItem[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
    } else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.title === "string" && Array.isArray(record.stats) && record.stats.length === 2 &&
          record.stats.every((item) => typeof item !== "object")) {
        rows.push({ title: record.title, key: typeof record.key === "string" ? record.key : undefined, stats: record.stats });
      } else {
        for (const child of Object.values(record)) visit(child);
      }
    }
  };
  visit(detail.content?.stats?.Periods?.All?.stats);

  const home: SourceTeamStats = {};
  const away: SourceTeamStats = {};
  let any = false;
  const foundFields: (keyof SourceTeamStats)[] = [];
  const pick = (titles: RegExp, keys: RegExp, key: keyof SourceTeamStats, float = false) => {
    const row = rows.find((candidate) => keys.test(candidate.key ?? "") || titles.test(candidate.title));
    if (!row) return;
    const parse = float ? toFloat : toInt;
    const homeValue = parse(row.stats[0]);
    const awayValue = parse(row.stats[1]);
    if (homeValue !== undefined) { home[key] = homeValue; any = true; }
    if (awayValue !== undefined) { away[key] = awayValue; any = true; }
    if (homeValue !== undefined || awayValue !== undefined) foundFields.push(key);
  };
  pick(/^Ball possession$/i, /^BallPossesion$/i, "possession");
  pick(/^Total shots$/i, /^total_shots$/i, "shots");
  pick(/^Shots on target$/i, /^ShotsOnTarget$/i, "shotsOnTarget");
  pick(/^Corners$/i, /^corners$/i, "corners");
  pick(/^Fouls committed$|^Fouls$/i, /^fouls$/i, "fouls");
  pick(/^Offsides$/i, /^offsides$/i, "offsides");
  pick(/^Expected goals/i, /^expected_goals|^xg$/i, "xg", true);
  const known = (row: RawStatItem) =>
    /^Ball possession$|^Total shots$|^Shots on target$|^Corners$|^Fouls committed$|^Fouls$|^Offsides$|^Expected goals/i.test(row.title)
    || /^BallPossesion$|^total_shots$|^ShotsOnTarget$|^corners$|^fouls$|^offsides$|^expected_goals|^xg$/i.test(row.key ?? "");
  const totalCorners = (home.corners ?? 0) + (away.corners ?? 0);
  const invalidShots = home.shots !== undefined && home.shotsOnTarget !== undefined && home.shotsOnTarget > home.shots
    || away.shots !== undefined && away.shotsOnTarget !== undefined && away.shotsOnTarget > away.shots;
  const rejectedReason = invalidShots
    ? "FotMob oppgir flere skudd på mål enn totale skudd; statistikken er ikke skrevet"
    : totalCorners > 30
      ? `FotMob oppgir et urimelig høyt samlet cornertall (${totalCorners}); statistikken er ikke skrevet`
      : undefined;
  return {
    stats: any && !rejectedReason ? { home, away } : undefined,
    foundFields,
    unknownTitles: [...new Set(rows.filter((row) => !known(row)).map((row) => row.title))].sort(),
    ...(rejectedReason ? { rejectedReason } : {}),
  };
}

export function readStats(detail: RawMatchDetails): { home?: SourceTeamStats; away?: SourceTeamStats } | undefined {
  return readStatsReport(detail).stats;
}

function readLineups(detail: RawMatchDetails): { home?: SourceLineup; away?: SourceLineup } | undefined {
  const raw = detail.content?.lineup;
  const team = (value: RawLineupTeam | undefined): SourceLineup | undefined => {
    if (!value) return undefined;
    const starters = (value.starters ?? []).flatMap((player) => cleanName(player.name) ? [cleanName(player.name)!] : []);
    const subs = (value.subs ?? []).flatMap((player) => cleanName(player.name) ? [cleanName(player.name)!] : []);
    const coach = cleanName(value.coach?.name);
    if (!value.formation && starters.length === 0 && subs.length === 0 && !coach) return undefined;
    return {
      formation: value.formation,
      starters,
      subs,
      coach,
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
  tournament?: { name?: string; stage?: string; leagueId?: string | number };
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
  general?: { matchRound?: string | number | null };
  header?: { status?: { reason?: { penalties?: unknown[] } } };
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
export type RawTeamFixture = RawLeagueMatch;
interface RawPageableFixtures { matches?: RawTeamFixture[]; previous?: string }
interface RawEvent {
  type?: string;
  time?: number | string;
  overloadTime?: number | string | null;
  isHome?: boolean;
  ownGoal?: boolean;
  isPenalty?: boolean;
  goalDescription?: string;
  isPenaltyShootoutEvent?: boolean;
  /** Oppsummert straffesparkkonkurranse: [hjemme, borte]. */
  penaltyScore?: unknown[];
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
interface RawStatItem { title: string; key?: string; stats: unknown[] }
interface RawLineupTeam {
  formation?: string;
  starters?: { name?: string }[];
  subs?: { name?: string }[];
  coach?: { name?: string };
}
