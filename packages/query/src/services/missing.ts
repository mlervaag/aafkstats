import { PLAYED_SQL, all, one, open } from "@aafkstats/db";
import { slugify } from "@aafkstats/schema";

export interface MissingField { field: string; matches: number }
export interface HistoricalResultSeason { season: number; results: number }
export interface UnresolvedPerson { id: string; name: string; url: string; conflicts: number; fields: string[] }
export interface LineupReviewCandidate { id: string; page: string; season: number | null; names: string[]; personIds: string[] }
export interface LineupReviewSource { sourceId: string; title: string; url: string; sourceUrl: string | null; candidates: LineupReviewCandidate[] }
export interface IncompleteSeason { season: number; competition: string; coverage: string; played: number; expected: number | null; url: string }
export interface DerivedPlayer { id: string; personKey: string; name: string; appearances: number; starts: number; goals: number; firstSeason: number; lastSeason: number }
export interface PlayerWithoutMatches { id: string; name: string; url: string; position: string | null; squadSeasons: number[] }

export interface MissingOverview {
  playedMatches: number;
  matchFields: MissingField[];
  historicalResults: { total: number; seasons: HistoricalResultSeason[] };
  incompleteSeasons: IncompleteSeason[];
  unresolvedPeople: { people: number; conflicts: number; items: UnresolvedPerson[] };
  lineupReview: { candidates: number; sources: number; items: LineupReviewSource[] };
  identity: { playersWithoutFile: DerivedPlayer[]; filesWithoutMatches: PlayerWithoutMatches[] };
}

interface PersonConflictRow { person_id: string; name: string; url: string; field: string }
interface LineupReviewRow { source_id: string; source_title: string; url: string; source_url: string | null; id: string; page: string; season: number | null; names: string; person_ids: string }
interface DerivedRow { person_key: string; name: string; appearances: number; starts: number; goals: number; first_season: number; last_season: number }

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch { return []; }
}

function loadIdentity(): MissingOverview["identity"] {
  const db = open();
  try {
    const taken = new Set(all<{ id: string }>(db, "SELECT id FROM people").map((row) => row.id));
    const playersWithoutFile = all<DerivedRow>(db, `
      SELECT person_key, min(name) AS name, sum(appearances) AS appearances,
             sum(starts) AS starts, sum(goals) AS goals,
             min(season) AS first_season, max(season) AS last_season
        FROM squad WHERE person_id IS NULL GROUP BY person_key`)
      .map((row) => ({
        id: slugify(row.person_key), personKey: row.person_key, name: row.name,
        appearances: row.appearances, starts: row.starts, goals: row.goals,
        firstSeason: row.first_season, lastSeason: row.last_season,
      }))
      .filter((row) => row.id !== "" && !taken.has(row.id))
      .sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name, "nb"));
    const filesWithoutMatches = all<{ id: string; name: string; url: string; position: string | null; seasons: string | null }>(db, `
      SELECT p.id, p.name, p.url, p.position,
             (SELECT group_concat(s.season) FROM squad s WHERE s.person_id = p.id AND s.number IS NOT NULL) AS seasons
        FROM people p
       WHERE p.appearances = 0
         AND (p.position IS NOT NULL OR EXISTS (SELECT 1 FROM squad s WHERE s.person_id = p.id AND s.number IS NOT NULL))
       ORDER BY p.name COLLATE NOCASE`)
      .map((row) => ({
        id: row.id, name: row.name, url: row.url, position: row.position,
        squadSeasons: (row.seasons ?? "").split(",").filter(Boolean).map(Number).sort((a, b) => a - b),
      }));
    return { playersWithoutFile, filesWithoutMatches };
  } finally { db.close(); }
}

/** Offentlig arbeidsoversikt, utelukkende lest fra dokumenterte databaseviews. */
export function loadMissingOverview(): MissingOverview {
  const db = open();
  try {
    const playedMatches = one<{ n: number }>(db, `SELECT count(*) AS n FROM matches WHERE ${PLAYED_SQL}`)?.n ?? 0;
    const matchFields = all<MissingField>(db, `SELECT field.value AS field, count(*) AS matches FROM matches m JOIN json_each(m.missing_fields) field WHERE m.${PLAYED_SQL} AND field.value <> 'providers' GROUP BY field.value ORDER BY matches DESC, field.value`);
    const historicalSeasons = all<HistoricalResultSeason>(db, "SELECT season, count(*) AS results FROM source_results WHERE match_id IS NULL GROUP BY season ORDER BY season");
    const incompleteSeasons = all<IncompleteSeason>(db, "SELECT season, competition, coverage, played, expected_matches AS expected, url FROM seasons WHERE competition_type = 'league' AND coverage IN ('partial', 'unverified', 'isolated') ORDER BY season");
    const conflictRows = all<PersonConflictRow>(db, "SELECT person_id, name, url, field FROM person_conflicts WHERE decision = 'unresolved' GROUP BY person_id, name, url, field ORDER BY name COLLATE NOCASE, field");
    const peopleById = new Map<string, UnresolvedPerson>();
    for (const row of conflictRows) {
      const person = peopleById.get(row.person_id) ?? { id: row.person_id, name: row.name, url: row.url, conflicts: 0, fields: [] };
      person.conflicts += 1;
      person.fields.push(row.field);
      peopleById.set(row.person_id, person);
    }
    const lineupRows = all<LineupReviewRow>(db, "SELECT source_id, source_title, url, source_url, id, page, season, names, person_ids FROM resolved_lineups ORDER BY source_title COLLATE NOCASE, CAST(page AS INTEGER), id");
    const lineupSourcesById = new Map<string, LineupReviewSource>();
    for (const row of lineupRows) {
      const source = lineupSourcesById.get(row.source_id) ?? { sourceId: row.source_id, title: row.source_title, url: row.url, sourceUrl: row.source_url, candidates: [] };
      source.candidates.push({ id: row.id, page: row.page, season: row.season, names: parseStringArray(row.names), personIds: parseStringArray(row.person_ids) });
      lineupSourcesById.set(row.source_id, source);
    }
    const lineupSources = [...lineupSourcesById.values()].sort((a, b) => b.candidates.length - a.candidates.length || a.title.localeCompare(b.title, "nb"));
    return {
      playedMatches, matchFields,
      historicalResults: { total: historicalSeasons.reduce((sum, row) => sum + row.results, 0), seasons: historicalSeasons },
      incompleteSeasons,
      unresolvedPeople: { people: peopleById.size, conflicts: conflictRows.length, items: [...peopleById.values()] },
      lineupReview: { candidates: lineupRows.length, sources: lineupSources.length, items: lineupSources },
      identity: loadIdentity(),
    };
  } finally { db.close(); }
}
