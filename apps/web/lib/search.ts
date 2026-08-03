import { all, open } from "@aafkstats/db";

export interface SearchMatch {
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

export interface ParsedSearch {
  years: number[];
  terms: string[];
}

export function parseSearchQuery(query: string): ParsedSearch {
  const years: number[] = [];
  const terms: string[] = [];
  for (const token of query.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const year = /^\d{4}$/.test(token) ? Number(token) : null;
    if (year !== null && year >= 1914 && year <= 2100) years.push(year);
    else terms.push(token);
  }
  return { years: [...new Set(years)], terms };
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
      `SELECT match_id, date, competition, is_home, opponent,
              aafk_score, opponent_score, result, url
       FROM matches
       WHERE ${where.join(" AND ")}
       ORDER BY date DESC
       LIMIT ?`,
      ...params,
    );
    return rows.map((row) => ({
      matchId: row.match_id,
      date: row.date,
      competition: row.competition,
      isHome: row.is_home === 1,
      opponent: row.opponent,
      aafkScore: row.aafk_score,
      opponentScore: row.opponent_score,
      result: row.result,
      url: row.url,
    }));
  } finally {
    db.close();
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
