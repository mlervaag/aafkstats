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
 * Småstoff hentet ut av arkivet, til visning mens spørrefunksjonen tenker.
 *
 * Poenget er at disse linjene ikke kan bli gale eller utdaterte: de regnes ut av
 * de samme dataene svaret bygger på. Blir en kamp rettet, retter linja seg selv.
 * Det er også den eneste sjangeren her som ikke reiser et eneste
 * opphavsrettsspørsmål — det er våre egne tall, om vår egen klubb.
 */
export function loadTrivia(): string[] {
  const db = open();
  try {
    const lines: string[] = [];
    const add = (line: string | undefined | null) => { if (line) lines.push(line); };

    const oldest = one<{ date: string; opponent: string; is_home: number; aafk: number; opp: number }>(
      db,
      `SELECT date, opponent, is_home, aafk_score AS aafk, opponent_score AS opp
       FROM matches WHERE status = 'played' ORDER BY date LIMIT 1`,
    );
    if (oldest) {
      add(
        `Eldste kamp i arkivet er ${norwegianDate(oldest.date)}: ` +
          `${oldest.is_home === 1 ? "AaFK" : oldest.opponent} ${oldest.aafk}–${oldest.opp} ` +
          `${oldest.is_home === 1 ? oldest.opponent : "AaFK"}.`,
      );
    }

    const biggestWin = one<{ date: string; opponent: string; aafk: number; opp: number }>(
      db,
      `SELECT date, opponent, aafk_score AS aafk, opponent_score AS opp
       FROM matches WHERE result = 'S' ORDER BY goal_difference DESC, date LIMIT 1`,
    );
    if (biggestWin) {
      add(
        `Største seier i arkivet: ${biggestWin.aafk}–${biggestWin.opp} mot ` +
          `${biggestWin.opponent}, ${norwegianDate(biggestWin.date)}.`,
      );
    }

    const mostPlayed = one<{ opponent: string; n: number }>(
      db,
      `SELECT opponent, count(*) AS n FROM matches
       WHERE status = 'played' GROUP BY opponent_club_id ORDER BY n DESC LIMIT 1`,
    );
    if (mostPlayed) {
      add(`AaFK har møtt ${mostPlayed.opponent} ${mostPlayed.n} ganger. Ingen oftere.`);
    }

    const bestCrowd = one<{ attendance: number; opponent: string; date: string }>(
      db,
      `SELECT attendance, opponent, date FROM matches
       WHERE is_home = 1 AND attendance IS NOT NULL ORDER BY attendance DESC LIMIT 1`,
    );
    if (bestCrowd) {
      add(
        `Best besøkte hjemmekamp i arkivet: ${bestCrowd.attendance.toLocaleString("nb-NO")} ` +
          `mot ${bestCrowd.opponent}, ${norwegianDate(bestCrowd.date)}.`,
      );
    }

    const totals = one<{ matches: number; goals: number; seasons: number }>(
      db,
      `SELECT count(*) AS matches, coalesce(sum(aafk_score), 0) AS goals,
              count(DISTINCT season) AS seasons
       FROM matches WHERE status = 'played'`,
    );
    if (totals) {
      add(`${totals.matches} kamper og ${totals.goals} mål fordelt på ${totals.seasons} sesonger.`);
    }

    const topScorer = one<{ player: string; n: number }>(
      db,
      `SELECT player, count(*) AS n FROM match_events
       WHERE event_type IN ('goal', 'penalty_goal') AND team = 'aafk' AND player IS NOT NULL
       GROUP BY player ORDER BY n DESC LIMIT 1`,
    );
    if (topScorer && topScorer.n > 1) {
      add(`Flest registrerte mål i arkivet: ${topScorer.player}, ${topScorer.n} stykker.`);
    }

    // Spillere arkivet faktisk har hendelser på. Tallene er med vilje merket
    // «i arkivet»: detaljdataene begynner i 2010, så en spiller kan ha en langt
    // lengre fasit enn den vi kan vise. Å skrive «X mål for AaFK» ville vært feil.
    for (const name of TRACKED_PLAYERS) {
      const stats = one<{ goals: number; cards: number; fra: string; til: string }>(
        db,
        `SELECT
           sum(CASE WHEN event_type IN ('goal', 'penalty_goal') THEN 1 ELSE 0 END) AS goals,
           sum(CASE WHEN event_type LIKE '%card' THEN 1 ELSE 0 END) AS cards,
           min(date) AS fra, max(date) AS til
         FROM match_events WHERE player = ? AND team = 'aafk'`,
        name,
      );
      if (!stats?.fra) continue;

      const span = stats.fra.slice(0, 4) === stats.til.slice(0, 4)
        ? stats.fra.slice(0, 4)
        : `${stats.fra.slice(0, 4)}–${stats.til.slice(0, 4)}`;

      if (stats.goals > 0) {
        add(`${name} står med ${stats.goals} mål i arkivet, ${span}.`);
      }
      if (stats.cards > 2) {
        add(`${name} står med ${stats.cards} kort i arkivet. Noen tar plass.`);
      }
    }

    return lines;
  } catch {
    // Småstoff er pynt. Feiler det, skal siden fortsatt svare.
    return [];
  } finally {
    db.close();
  }
}

/**
 * Spillere vi lager egne linjer om.
 *
 * Lista er kort og håndplukket. Å generere en linje om hver eneste spiller ville
 * gitt hundrevis av like setninger, og de fleste av dem uinteressante.
 */
const TRACKED_PLAYERS = ["Amund Skiri", "Magnus Sylling Olsen", "Mostafa Abdellaoue"];

const MONTHS = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];

/** «1917-08-26» → «26. august 1917». */
function norwegianDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const name = MONTHS[Number(month) - 1];
  if (!name) return iso;
  return `${Number(day)}. ${name} ${year}`;
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
