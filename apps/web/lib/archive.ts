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
  url: string;
}

export interface SeasonSummary {
  season: number;
  competition: string;
  competitionTier: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  url: string;
}

interface SeasonRow {
  season: number;
  competition: string;
  competition_tier: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
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

export interface ArchiveTotals {
  matches: number;
  seasons: number;
  opponents: number;
  first: string | null;
  last: string | null;
}

const matchColumns = `match_id, date, competition, is_home, opponent,
  aafk_score, opponent_score, result, url`;

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
    url: row.url,
  };
}

function mapSeason(row: SeasonRow): SeasonSummary {
  return {
    season: row.season,
    competition: row.competition,
    competitionTier: row.competition_tier,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    goalDifference: row.goal_difference,
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

export function loadSeasons(): SeasonSummary[] {
  const db = open();
  try {
    return all<SeasonRow>(db, "SELECT * FROM seasons ORDER BY season DESC").map(mapSeason);
  } finally {
    db.close();
  }
}

export function loadSeason(year: number): { summary: SeasonSummary; matches: ArchiveMatch[] } | undefined {
  const db = open();
  try {
    const summary = one<SeasonRow>(db, "SELECT * FROM seasons WHERE season = ?", year);
    if (!summary) return undefined;
    const matches = all<MatchRow>(db, `SELECT ${matchColumns} FROM matches WHERE season = ? ORDER BY date`, year);
    return { summary: mapSeason(summary), matches: matches.map(mapMatch) };
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
