import { db } from "./db";

export interface Source {
  id: string;
  parent_source_id: string | null;
  title: string;
  source_type: string;
  issue: string | null;
  volume: string | null;
  publisher: string | null;
  year: number | null;
  cover_url: string | null;
  access_url: string | null;
  providers: { providerId: string; url?: string }[];
}

export interface SourceUsage {
  id: string;
  date: string;
  opponent: string;
  competition: string;
  is_home: number;
  aafk_score: number | null;
  opponent_score: number | null;
  page: number | null;
  note: string | null;
}

export function getSources(): Source[] {
  return db
    .prepare(
      `SELECT *
       FROM core_sources
       ORDER BY coalesce(year, 0) DESC, title ASC`,
    )
    .all() as any;
}

export function getSourceById(id: string): Source | undefined {
  const row = db
    .prepare(
      `SELECT *
       FROM core_sources
       WHERE id = ?`,
    )
    .get(id) as any;

  if (row && typeof row.providers === 'string') {
    try {
      row.providers = JSON.parse(row.providers);
    } catch {
      row.providers = [];
    }
  }
  return row;
}

export function getSourceChildren(parentId: string): Source[] {
  return db
    .prepare(
      `SELECT *
       FROM core_sources
       WHERE parent_source_id = ?
       ORDER BY coalesce(year, 0) DESC, issue DESC`,
    )
    .all() as any;
}

export function getParentSource(parentId: string): Pick<Source, "id" | "title"> | undefined {
  return db
    .prepare(`SELECT id, title FROM core_sources WHERE id = ?`)
    .get(parentId) as any;
}

export function getSourceUsages(sourceId: string): SourceUsage[] {
  return db
    .prepare(
      `SELECT
         m.id,
         m.match_date as date,
         c.name as opponent,
         comp.name as competition,
         m.home_club_id = 'aalesunds-fk' as is_home,
         CASE WHEN m.home_club_id = 'aalesunds-fk' THEN m.home_score ELSE m.away_score END as aafk_score,
         CASE WHEN m.home_club_id = 'aalesunds-fk' THEN m.away_score ELSE m.home_score END as opponent_score,
         json_extract(s.value, '$.page') as page,
         json_extract(s.value, '$.note') as note
       FROM core_matches m
       JOIN json_each(m.sources) s
       LEFT JOIN core_clubs c ON c.id = (CASE WHEN m.home_club_id = 'aalesunds-fk' THEN m.away_club_id ELSE m.home_club_id END)
       LEFT JOIN core_competitions comp ON comp.id = m.competition_id
       WHERE json_extract(s.value, '$.sourceId') = ?
       ORDER BY m.match_date DESC`,
    )
    .all(sourceId) as any;
}
