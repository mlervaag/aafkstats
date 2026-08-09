import { all, open } from "@aafkstats/db";

/**
 * Én rad i direktesøket.
 *
 * Feltene om status og avgjørelsesmåte er med fordi resultatlista ellers taper
 * nettopp det arkivet er nøye på ellers: en kamp som ikke er spilt så lik ut som
 * en kamp uten kjent resultat, og «3–3» i cupen sto uten at det var straffene
 * som avgjorde. Formatteringen deles nå med `readableScore`.
 */
export interface SearchMatch {
  matchId: string;
  date: string;
  kickoff: string | null;
  competition: string;
  status: string;
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
  kickoff: string | null;
  competition: string;
  status: string;
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

export interface ParsedSearch {
  years: number[];
  terms: string[];
}

/**
 * Tak på hvor mange ledd ett søk får bli.
 *
 * Hvert ord legger tre LIKE-tester med ledende jokertegn til spørringen, og hver
 * av dem er en full gjennomgang av tabellen. Endepunktet er åpent og uten
 * fartsgrense, så uten et tak bestemmer avsenderen hvor mye arbeid ett kall
 * koster oss. Et ekte søk er noen få ord.
 */
const MAX_TERMS = 6;
const MAX_YEARS = 6;

export function parseSearchQuery(query: string): ParsedSearch {
  const years: number[] = [];
  const terms: string[] = [];
  for (const token of query.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const year = /^\d{4}$/.test(token) ? Number(token) : null;
    if (year !== null && year >= 1914 && year <= 2100) years.push(year);
    else terms.push(token);
  }
  return { years: [...new Set(years)].slice(0, MAX_YEARS), terms: terms.slice(0, MAX_TERMS) };
}

export function searchMatches(query: string, limit = 200): SearchMatch[] {
  const parsed = parseSearchQuery(query);
  if (parsed.years.length === 0 && parsed.terms.length === 0) return [];
  // Direktesøket er navigasjon, ikke statistikk: framtidige og utsatte kamper skal
  // også finnes når noen søker på år eller motstander.
  const where = ["1 = 1"];
  const params: (string | number | null)[] = [];

  if (parsed.years.length > 0) {
    where.push(`season IN (${parsed.years.map(() => "?").join(", ")})`);
    params.push(...parsed.years);
  }
  for (const term of parsed.terms) {
    where.push("(lower(opponent) LIKE ? ESCAPE '\\' OR lower(opponent_club_id) LIKE ? ESCAPE '\\' OR lower(competition) LIKE ? ESCAPE '\\')");
    const pattern = `%${escapeLike(term)}%`;
    params.push(pattern, pattern, pattern);
  }
  params.push(Math.min(Math.max(limit, 1), 200));

  const db = open();
  try {
    const rows = all<MatchRow>(
      db,
      `SELECT match_id, date, kickoff, competition, status, is_home, opponent,
              aafk_score, opponent_score, result,
              after_extra_time, decided_on_penalties, won_on_penalties, url
       FROM matches
       WHERE ${where.join(" AND ")}
       ORDER BY date DESC
       LIMIT ?`,
      ...params,
    );
    return rows.map((row) => ({
      matchId: row.match_id,
      date: row.date,
      kickoff: row.kickoff,
      competition: row.competition,
      status: row.status,
      isHome: row.is_home === 1,
      opponent: row.opponent,
      aafkScore: row.aafk_score,
      opponentScore: row.opponent_score,
      result: row.result,
      afterExtraTime: row.after_extra_time === 1,
      decidedOnPenalties: row.decided_on_penalties === 1,
      wonOnPenalties: row.won_on_penalties === null ? null : row.won_on_penalties === 1,
      url: row.url,
    }));
  } finally {
    db.close();
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
