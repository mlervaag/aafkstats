import { all, one, open } from "@aafkstats/db";

export interface ArchiveMatch {
  matchId: string;
  date: string;
  competition: string;
  isHome: boolean;
  opponent: string;
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
  competition: string;
  is_home: number;
  opponent: string;
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
  matches: number;
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
  matches: number;
  seasons: number;
  opponents: number;
  first: string | null;
  last: string | null;
}

const matchColumns = `match_id, date, competition, is_home, opponent,
  aafk_score, opponent_score, result, after_extra_time, decided_on_penalties,
  won_on_penalties, url`;

function mapMatch(row: MatchRow): ArchiveMatch {
  return {
    matchId: row.match_id,
    date: row.date,
    competition: row.competition,
    isHome: row.is_home === 1,
    opponent: row.opponent,
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

export function loadOverview(): { recent: ArchiveMatch[]; totals: ArchiveTotals } {
  const db = open();
  try {
    const recent = all<MatchRow>(db, `SELECT ${matchColumns} FROM matches WHERE status = 'played' ORDER BY date DESC LIMIT 5`);
    const totals = one<ArchiveTotals>(
      db,
      `SELECT count(*) AS matches, count(DISTINCT season) AS seasons,
              count(DISTINCT opponent_club_id) AS opponents,
              min(date) AS first, max(date) AS last
       FROM matches`,
    );
    return { recent: recent.map(mapMatch), totals: totals ?? { matches: 0, seasons: 0, opponents: 0, first: null, last: null } };
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
       FROM matches`,
    );
    const byCompetition = all<{ competition: string; type: string; matches: number }>(
      db,
      `SELECT competition, competition_type AS type, count(*) AS matches
       FROM matches GROUP BY competition, competition_type ORDER BY matches DESC`,
    );
    // Hendelser ligger i sitt eget view, én rad per hendelse — derfor DISTINCT.
    const withEvents = one<{ n: number }>(db, `SELECT count(DISTINCT match_id) AS n FROM match_events`);
    const withAttendance = one<{ n: number }>(db, `SELECT count(*) AS n FROM matches WHERE attendance IS NOT NULL`);
    const withReport = one<{ n: number }>(db, `SELECT count(*) AS n FROM matches WHERE report_summary IS NOT NULL`);

    return {
      matches: base?.matches ?? 0,
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
