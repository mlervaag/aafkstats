import { PLAYED_SQL, all, one, open } from "@aafkstats/db";

export interface ArchiveMatch {
  matchId: string;
  date: string;
  /** Klokkeslett når kilden oppgir det. Bare interessant for kamper som ikke er spilt. */
  kickoff: string | null;
  competition: string;
  /**
   * Kampens tilstand.
   *
   * Terminlista ligger i arkivet på lik linje med resten, så uten dette feltet
   * rendres en kamp som ikke er spilt som et tomt resultat, og leseren har ingen
   * måte å se forskjell på «vi vet ikke» og «den er ikke spilt ennå».
   */
  status: string;
  isHome: boolean;
  opponent: string;
  opponentId: string;
  aafkScore: number | null;
  opponentScore: number | null;
  result: "S" | "U" | "T" | null;
  afterExtraTime: boolean;
  decidedOnPenalties: boolean;
  wonOnPenalties: boolean | null;
  url: string;
}

interface MatchRow {
  match_id: string;
  date: string;
  kickoff: string | null;
  competition: string;
  status: string;
  is_home: number;
  opponent: string;
  opponent_club_id: string;
  aafk_score: number | null;
  opponent_score: number | null;
  result: "S" | "U" | "T" | null;
  after_extra_time: number;
  decided_on_penalties: number;
  won_on_penalties: number | null;
  url: string;
}

export interface SeasonSummary {
  season: number;
  competitionId: string;
  competitionType: string;
  competition: string;
  competitionTier: number | null;
  /** Sluttplass i tabellen. Kun for serien, og bare der arkivet vet det. */
  finalPosition: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  /** Forbehold om sesongen, f.eks. at den er ufullstendig i arkivet. */
  note: string | null;
  /**
   * Hvor godt sesongen er dekket, utledet av rundenumrene i byggesteget.
   *
   * «85 sesonger» betyr 85 år med minst én registrert kamp. Uten dette feltet er
   * det umulig for en leser å se forskjell på en komplett serie og tre løsrevne
   * kamper fra 1951.
   */
  coverage: "complete" | "partial" | "isolated" | "not_applicable";
  /** Høyeste serierunde. For en komplett sesong: antall runder. */
  lastRound: number | null;
  /**
   * Kamper igjen på terminlista.
   *
   * Skiller en sesong som pågår fra en som mangler noe. Uten det står
   * inneværende år som «delvis» fra januar til desember, som om arkivet hadde
   * hull der det bare er kamper som ikke er spilt ennå.
   */
  scheduled: number;
  url: string;
}

interface SeasonRow {
  season: number;
  competition_id: string;
  competition_type: string;
  competition: string;
  competition_tier: number | null;
  final_position: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  note: string | null;
  coverage: "complete" | "partial" | "isolated" | "not_applicable";
  last_round: number | null;
  scheduled: number;
  url: string;
}

export interface OpponentSummary {
  id: string;
  opponent: string;
  city: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  firstMeeting: string;
  lastMeeting: string | null;
  url: string;
}

interface OpponentRow {
  opponent_club_id: string;
  opponent: string;
  city: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  first_meeting: string;
  last_meeting: string | null;
  url: string;
}

/**
 * Hva arkivet faktisk inneholder akkurat nå.
 *
 * Finnes fordi tallene ellers står som tekst i seks forskjellige sider, og hver
 * innhøsting gjør dem gale igjen. Et arkiv som lyver om sitt eget omfang er verre
 * enn et som ikke sier noe — særlig når hele poenget er etterprøvbarhet.
 */
export interface ArchiveCoverage {
  /** Kamper med kjent resultat. Se `SPILT`. */
  matches: number;
  /** Kamper på terminlista som ikke er spilt ennå. Telles aldri med i `matches`. */
  upcoming: number;
  seasons: number;
  firstSeason: number | null;
  lastSeason: number | null;
  /** Kamper per konkurranse, flest først. */
  byCompetition: { competition: string; type: string; matches: number }[];
  /** Kamper med minst én registrert hendelse — mål, kort eller bytte. */
  withEvents: number;
  withAttendance: number;
  withReport: number;
}

export interface ArchiveTotals {
  /** Kamper med kjent resultat. Se `SPILT`. */
  matches: number;
  /** Kamper på terminlista som ikke er spilt ennå. */
  upcoming: number;
  seasons: number;
  opponents: number;
  first: string | null;
  /** Siste kamp med resultat, ikke siste dato i arkivet. */
  last: string | null;
}

/**
 * Kampene som faktisk har funnet sted.
 *
 * Terminlista for inneværende sesong ligger i arkivet på lik linje med resten, og
 * uten dette skillet blir «1039 AaFK-kamper» på forsiden 15 kamper som ikke er
 * spilt ennå, mens «fra 1917 til 2026» henter siste årstall fra en kamp i
 * desember. Ingen av delene er galt regnet, men ingen leser overskriften slik.
 *
 * Regelen er den samme som `core_played` i SQL-skjemaet, hentet fra ett sted
 * slik at nettstedet og aggregatene ikke kan telle forskjellig.
 */
const SPILT = PLAYED_SQL;

const matchColumns = `match_id, date, kickoff, competition, status, is_home, opponent,
  opponent_club_id, aafk_score, opponent_score, result, after_extra_time,
  decided_on_penalties, won_on_penalties, url`;

function mapMatch(row: MatchRow): ArchiveMatch {
  return {
    matchId: row.match_id,
    date: row.date,
    kickoff: row.kickoff,
    competition: row.competition,
    status: row.status,
    isHome: row.is_home === 1,
    opponent: row.opponent,
    opponentId: row.opponent_club_id,
    aafkScore: row.aafk_score,
    opponentScore: row.opponent_score,
    result: row.result,
    afterExtraTime: row.after_extra_time === 1,
    decidedOnPenalties: row.decided_on_penalties === 1,
    wonOnPenalties: row.won_on_penalties === null ? null : row.won_on_penalties === 1,
    url: row.url,
  };
}

function mapSeason(row: SeasonRow): SeasonSummary {
  return {
    season: row.season,
    competitionId: row.competition_id,
    competitionType: row.competition_type,
    competition: row.competition,
    competitionTier: row.competition_tier,
    finalPosition: row.final_position,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    goalDifference: row.goal_difference,
    note: row.note,
    coverage: row.coverage,
    lastRound: row.last_round,
    scheduled: row.scheduled,
    url: row.url,
  };
}

function mapOpponent(row: OpponentRow): OpponentSummary {
  return {
    id: row.opponent_club_id,
    opponent: row.opponent,
    city: row.city,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    firstMeeting: row.first_meeting,
    lastMeeting: row.last_meeting,
    url: row.url,
  };
}

/**
 * Neste kamp på terminlista.
 *
 * Terminlista har ligget i arkivet hele tiden uten å bli vist noe sted. For et
 * klubbarkiv er dette den ene opplysningen folk kommer tilbake for mellom
 * kampene, og den koster ingen nye data å vise.
 *
 * Datoen sammenlignes som tekst mot dagens dato, ikke mot et tidspunkt. En kamp
 * som spilles i kveld skal stå som neste kamp helt til dagen er omme.
 *
 * `today` finnes for testene. Et arkiv der svaret avhenger av når spørsmålet
 * stilles kan ellers ikke testes uten å fryse klokka.
 */
export function loadNextMatch(today = new Date().toISOString().slice(0, 10)): ArchiveMatch | undefined {
  const db = open();
  try {
    const row = one<MatchRow>(
      db,
      `SELECT ${matchColumns} FROM matches
        WHERE status = 'scheduled' AND date >= ? ORDER BY date LIMIT 1`,
      today,
    );
    return row ? mapMatch(row) : undefined;
  } finally {
    db.close();
  }
}

export function loadOverview(): { recent: ArchiveMatch[]; totals: ArchiveTotals } {
  const db = open();
  try {
    const recent = all<MatchRow>(db, `SELECT ${matchColumns} FROM matches WHERE ${SPILT} ORDER BY date DESC LIMIT 5`);
    const totals = one<ArchiveTotals>(
      db,
      `SELECT count(*) AS matches, count(DISTINCT season) AS seasons,
              count(DISTINCT opponent_club_id) AS opponents,
              min(date) AS first, max(date) AS last,
              (SELECT count(*) FROM matches WHERE status = 'scheduled') AS upcoming
       FROM matches WHERE ${SPILT}`,
    );
    return {
      recent: recent.map(mapMatch),
      totals: totals ?? { matches: 0, upcoming: 0, seasons: 0, opponents: 0, first: null, last: null },
    };
  } finally {
    db.close();
  }
}

/**
 * Konkurranse-ID-ene som faktisk finnes i arkivet.
 *
 * Brukes av bidragspromptene, som tidligere hadde lista skrevet av for hånd og
 * derfor manglet «tredjedivisjon» fra det øyeblikket RSSSF-innhøstingen la den
 * inn. En bidragsyter som fulgte prompten fikk laget en fil valideringen avviste.
 */
export function loadCompetitionIds(): string[] {
  const db = open();
  try {
    return all<{ id: string }>(db, `SELECT id FROM core_competitions ORDER BY id`).map((row) => row.id);
  } finally {
    db.close();
  }
}

export function loadCoverage(): ArchiveCoverage {
  const db = open();
  try {
    const base = one<{ matches: number; seasons: number; first: number | null; last: number | null }>(
      db,
      `SELECT count(*) AS matches, count(DISTINCT season) AS seasons,
              min(season) AS first, max(season) AS last
       FROM matches WHERE ${SPILT}`,
    );
    const upcoming = one<{ n: number }>(db, `SELECT count(*) AS n FROM matches WHERE status = 'scheduled'`);
    const byCompetition = all<{ competition: string; type: string; matches: number }>(
      db,
      `SELECT competition, competition_type AS type, count(*) AS matches
       FROM matches WHERE ${SPILT} GROUP BY competition, competition_type ORDER BY matches DESC`,
    );
    // Hendelser ligger i sitt eget view, én rad per hendelse — derfor DISTINCT.
    const withEvents = one<{ n: number }>(db, `SELECT count(DISTINCT match_id) AS n FROM match_events`);
    const withAttendance = one<{ n: number }>(db, `SELECT count(*) AS n FROM matches WHERE ${SPILT} AND attendance IS NOT NULL`);
    const withReport = one<{ n: number }>(db, `SELECT count(*) AS n FROM matches WHERE ${SPILT} AND report_summary IS NOT NULL`);

    return {
      matches: base?.matches ?? 0,
      upcoming: upcoming?.n ?? 0,
      seasons: base?.seasons ?? 0,
      firstSeason: base?.first ?? null,
      lastSeason: base?.last ?? null,
      byCompetition,
      withEvents: withEvents?.n ?? 0,
      withAttendance: withAttendance?.n ?? 0,
      withReport: withReport?.n ?? 0,
    };
  } finally {
    db.close();
  }
}

/**
 * Ett år, med den konkurransen som bærer sesongen og resten ved siden av.
 *
 * Et år er ikke lenger én konkurranse. Serien er sesongen i vanlig forstand — det
 * er den tabellen og plasseringen hører til — mens cup og treningskamper er noe
 * som skjer i tillegg. Grensesnittet må vise begge uten å blande dem, og uten å
 * la et cupexit på én kamp se ut som en hel sesong.
 */
export interface SeasonYear {
  year: number;
  /** Serien når den finnes, ellers den konkurransen med flest kamper. */
  primary: SeasonSummary;
  /** Øvrige konkurranser samme år, flest kamper først. */
  others: SeasonSummary[];
  totalMatches: number;
}

/** Serien først, deretter etter antall kamper. */
function seasonRank(a: SeasonSummary, b: SeasonSummary): number {
  const league = (s: SeasonSummary) => (s.competitionType === "league" ? 0 : 1);
  return league(a) - league(b) || b.played - a.played;
}

export function loadSeasons(): SeasonSummary[] {
  const db = open();
  try {
    return all<SeasonRow>(db, "SELECT * FROM seasons ORDER BY season DESC").map(mapSeason);
  } finally {
    db.close();
  }
}

export function loadSeasonYears(): SeasonYear[] {
  const byYear = new Map<number, SeasonSummary[]>();
  for (const row of loadSeasons()) {
    const list = byYear.get(row.season);
    if (list) list.push(row);
    else byYear.set(row.season, [row]);
  }

  return [...byYear.entries()]
    .map(([year, rows]) => {
      const sorted = [...rows].sort(seasonRank);
      return {
        year,
        primary: sorted[0]!,
        others: sorted.slice(1),
        totalMatches: rows.reduce((sum, r) => sum + r.played, 0),
      };
    })
    .sort((a, b) => b.year - a.year);
}

export function loadSeason(
  year: number,
): { summaries: SeasonSummary[]; matches: ArchiveMatch[] } | undefined {
  const db = open();
  try {
    const rows = all<SeasonRow>(db, "SELECT * FROM seasons WHERE season = ?", year);
    if (rows.length === 0) return undefined;
    const matches = all<MatchRow>(db, `SELECT ${matchColumns} FROM matches WHERE season = ? ORDER BY date`, year);
    return { summaries: rows.map(mapSeason).sort(seasonRank), matches: matches.map(mapMatch) };
  } finally {
    db.close();
  }
}

/**
 * Året før og året etter, blant de årene arkivet faktisk har.
 *
 * Ikke `year - 1`: arkivet hopper over år, og en lenke til 1953 som ikke finnes
 * er verre enn ingen lenke. Sesongsiden var ellers en blindvei — eneste vei
 * videre var tilbakeknappen.
 */
export function loadNeighbourSeasons(year: number): { previous: number | null; next: number | null } {
  const db = open();
  try {
    const previous = one<{ season: number }>(
      db, "SELECT max(season) AS season FROM seasons WHERE season < ?", year,
    );
    const next = one<{ season: number }>(
      db, "SELECT min(season) AS season FROM seasons WHERE season > ?", year,
    );
    return { previous: previous?.season ?? null, next: next?.season ?? null };
  } finally {
    db.close();
  }
}

export function loadOpponents(): OpponentSummary[] {
  const db = open();
  try {
    return all<OpponentRow>(db, "SELECT * FROM opponents ORDER BY opponent COLLATE NOCASE").map(mapOpponent);
  } finally {
    db.close();
  }
}

export function loadOpponent(id: string): { summary: OpponentSummary; matches: ArchiveMatch[] } | undefined {
  const db = open();
  try {
    const summary = one<OpponentRow>(db, "SELECT * FROM opponents WHERE opponent_club_id = ?", id);
    if (!summary) return undefined;
    const matches = all<MatchRow>(db, `SELECT ${matchColumns} FROM matches WHERE opponent_club_id = ? ORDER BY date DESC`, id);
    return { summary: mapOpponent(summary), matches: matches.map(mapMatch) };
  } finally {
    db.close();
  }
}

export interface StandingsRow {
  position: number;
  team: string;
  clubId: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  outcome: string;
  note: string | null;
  url: string | null;
}

export interface ProgressionPoint {
  round: number;
  position: number;
  points: number;
  played: number;
  goalDifference: number;
}

/**
 * Sluttabellen og plasseringskurven for én sesong.
 *
 * De to har ulik status og holdes derfor fra hverandre: tabellen er hentet fra
 * kilden, kurven er regnet ut av oss. Mangler kurven, er det fordi utregningen
 * ikke lot seg forene med tabellen — se `standings.ts` i skjemapakka.
 */
export function loadStandings(competitionId: string, season: number): {
  table: StandingsRow[];
  progression: ProgressionPoint[];
} {
  const db = open();
  try {
    const table = all<{
      position: number; team: string; club_id: string | null;
      played: number; wins: number; draws: number; losses: number;
      goals_for: number; goals_against: number; goal_difference: number;
      points: number; outcome: string; note: string | null; url: string | null;
    }>(
      db,
      `SELECT position, team, club_id, played, wins, draws, losses, goals_for,
              goals_against, goal_difference, points, outcome, note, url
         FROM standings WHERE competition_id = ? AND season = ? ORDER BY position`,
      competitionId, season,
    );
    const progression = all<ProgressionPoint>(
      db,
      `SELECT round, position, points, played, goal_difference AS goalDifference
         FROM standings_progression WHERE competition_id = ? AND season = ? ORDER BY round`,
      competitionId, season,
    );
    return {
      table: table.map((row) => ({
        position: row.position,
        team: row.team,
        clubId: row.club_id,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goals_for,
        goalsAgainst: row.goals_against,
        goalDifference: row.goal_difference,
        points: row.points,
        outcome: row.outcome,
        note: row.note,
        url: row.url,
      })),
      progression,
    };
  } finally {
    db.close();
  }
}

export interface SquadPlayer {
  personKey: string;
  name: string;
  /** Fra personregisteret. Null når personen ikke har en fil der. */
  number: number | null;
  position: string | null;
  nationality: string | null;
  wikidata: string | null;
  appearances: number;
  starts: number;
  goals: number;
  firstMatch: string;
  lastMatch: string;
  /** Spilte ikke for klubben sesongen før. Se `loadSquad`. */
  isNew: boolean;
}

export interface CoachSpell {
  name: string;
  fromDate: string;
  toDate: string;
  fromSeason: number;
  toSeason: number;
  matches: number;
}

/**
 * Stallen for én sesong, med hvem som var ny.
 *
 * «Ny» betyr at spilleren ikke var med sesongen før, ikke at han ble kjøpt. En
 * spiller som var skadet hele fjoråret ser like ny ut som en nysignering, og
 * arkivet vet ikke forskjellen. Derfor står det «ny i stallen» og ikke «hentet».
 *
 * Den motsatte veien er utelatt med vilje. «Sluttet» ville vært en påstand om
 * hva som skjedde med spilleren, og alt vi vet er at han ikke står i en
 * oppstilling året etter.
 */
export function loadSquad(season: number): SquadPlayer[] {
  const db = open();
  try {
    const rows = all<{
      person_key: string; name: string; appearances: number; starts: number;
      goals: number; first_match: string; last_match: string;
      number: number | null; position: string | null;
      nationality: string | null; wikidata: string | null;
    }>(
      db,
      `SELECT person_key, name, appearances, starts, goals, first_match, last_match,
              number, position, nationality, wikidata
         FROM squad WHERE season = ? ORDER BY appearances DESC, name COLLATE NOCASE`,
      season,
    );
    // Fjoråret hentes bare når vi faktisk har det. Oppstillingene starter i
    // 2010, og uten denne sjekken ville hele stallen i 2010 stått som ny.
    const previous = one<{ n: number }>(
      db, "SELECT count(*) AS n FROM squad WHERE season = ?", season - 1,
    );
    const before = new Set(
      previous && previous.n > 0
        ? all<{ person_key: string }>(
            db, "SELECT person_key FROM squad WHERE season = ?", season - 1,
          ).map((row) => row.person_key)
        : [],
    );
    const knowPrevious = (previous?.n ?? 0) > 0;

    return rows.map((row) => ({
      personKey: row.person_key,
      name: row.name,
      appearances: row.appearances,
      starts: row.starts,
      goals: row.goals,
      number: row.number,
      position: row.position,
      nationality: row.nationality,
      wikidata: row.wikidata,
      firstMatch: row.first_match,
      lastMatch: row.last_match,
      isNew: knowPrevious && !before.has(row.person_key),
    }));
  } finally {
    db.close();
  }
}

/**
 * Trenerperioder oppgitt av en kilde, for årene kampdataene ikke rekker.
 *
 * Holdt atskilt fra de utledede med vilje. Disse har bare årstall og mangler
 * vikarene; de utledede har eksakte datoer og har med hver eneste en, men bare
 * fra 2010.
 */
export function loadDeclaredCoaches(season: number): { name: string; fromSeason: number; toSeason: number | null }[] {
  const db = open();
  try {
    return all<{ name: string; from_season: number; to_season: number | null }>(
      db,
      `SELECT name, from_season, to_season FROM declared_coach_spells
        WHERE from_season <= ? AND (to_season IS NULL OR to_season >= ?)
        ORDER BY from_season`,
      season, season,
    ).map((row) => ({ name: row.name, fromSeason: row.from_season, toSeason: row.to_season }));
  } finally {
    db.close();
  }
}

/** Trenerne som hadde laget i løpet av sesongen, i rekkefølge. */
export function loadSeasonCoaches(season: number): CoachSpell[] {
  const db = open();
  try {
    return all<{
      name: string; from_date: string; to_date: string;
      from_season: number; to_season: number; matches: number;
    }>(
      db,
      `SELECT name, from_date, to_date, from_season, to_season, matches
         FROM coach_spells WHERE from_season <= ? AND to_season >= ? ORDER BY from_date`,
      season, season,
    ).map((row) => ({
      name: row.name,
      fromDate: row.from_date,
      toDate: row.to_date,
      fromSeason: row.from_season,
      toSeason: row.to_season,
      matches: row.matches,
    }));
  } finally {
    db.close();
  }
}
