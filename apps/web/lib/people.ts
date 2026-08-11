import { all, one, open } from "@aafkstats/db";
import { cache } from "react";

export interface PersonSummary {
  id: string;
  name: string;
  nationality: string | null;
  position: string | null;
  first_season: number | null;
  last_season: number | null;
  appearances: number;
  starts: number;
  role_count: number;
  first_role_year: string | null;
  last_role_year: string | null;
  role_categories: string[];
}

export interface PersonRoleSource {
  sourceId: string;
  page?: string;
  fields?: string[];
  note?: string;
}

export interface PersonRole {
  person_id: string;
  name: string;
  role_id: string;
  category: string;
  title: string;
  body: string | null;
  from_date: string;
  to_date: string | null;
  sources: PersonRoleSource[];
  note: string | null;
}

/** En publikasjon som omtaler personen. */
export interface PersonMention {
  sourceId: string;
  page?: string;
  note?: string;
}

/**
 * Kilder som er uenige om et verv.
 *
 * At de er uenige er en opplysning i seg selv. Ingen avgjøres maskinelt, og
 * leseren skal se begge navnene — ikke det ene arkivet tilfeldigvis skrev først.
 */
export interface PersonConflict {
  field: string;
  values: { value: string | number | null; providerId: string; note?: string }[];
  resolved: boolean;
  chosen?: string | number | null;
  decision: string;
  reason?: string;
}

export interface PersonDetail extends PersonSummary {
  wikidata: string | null;
  note: string | null;
  mentions: PersonMention[];
  conflicts: PersonConflict[];
}

export interface PersonSeason {
  season: number;
  number: number | null;
  position: string | null;
  appearances: number;
  starts: number;
  goals: number;
}

/** JSON-kolonner fra databasen. En ødelagt kolonne skal ikke felle en side. */
function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function parseRoleSources(value: string): PersonRoleSource[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as PersonRoleSource[] : [];
  } catch {
    return [];
  }
}

type PersonSummaryRow = Omit<PersonSummary, "role_categories"> & { role_categories: string | null };

function mapSummary(row: PersonSummaryRow): PersonSummary {
  return { ...row, role_categories: parseStringArray(row.role_categories) };
}

export function getPeople(): PersonSummary[] {
  const db = open();
  try {
    return all<PersonSummaryRow>(
      db,
      `SELECT id, name, nationality, position, first_season, last_season,
              appearances, starts, role_count, first_role_year, last_role_year,
              role_categories
         FROM people
        ORDER BY name COLLATE NOCASE`,
    ).map(mapSummary);
  } finally {
    db.close();
  }
}

export function getPersonIds(): string[] {
  const db = open();
  try {
    return all<{ id: string }>(db, "SELECT id FROM people ORDER BY id").map((row) => row.id);
  } finally {
    db.close();
  }
}

export const getPersonById = cache(function getPersonById(id: string): PersonDetail | undefined {
  const db = open();
  try {
    const row = one<PersonSummaryRow & {
      wikidata: string | null;
      note: string | null;
      sources: string;
      conflicts: string;
    }>(
      db,
      `SELECT id, name, nationality, position, wikidata, note, sources, conflicts,
              first_season, last_season, appearances, starts, role_count,
              first_role_year, last_role_year, role_categories
         FROM people WHERE id = ?`,
      id,
    );
    if (!row) return undefined;
    return {
      ...row,
      role_categories: parseStringArray(row.role_categories),
      mentions: parseJson<PersonMention[]>(row.sources, []),
      conflicts: parseJson<PersonConflict[]>(row.conflicts, []),
    };
  } finally {
    db.close();
  }
});

export function getPersonRoles(personId?: string): PersonRole[] {
  const db = open();
  try {
    const rows = all<Omit<PersonRole, "sources"> & { sources: string }>(
      db,
      `SELECT person_id, name, role_id, category, title, body, from_date, to_date, sources, note
         FROM (
           SELECT person_id, name, role_id, category, title, body, from_date, to_date, sources, note
             FROM person_roles
           UNION ALL
           SELECT d.person_id, p.name,
                  'oppgitt-hovedtrener-' || d.from_season AS role_id,
                  'coach' AS category, 'Hovedtrener' AS title, 'A-laget' AS body,
                  printf('%04d', d.from_season) AS from_date,
                  CASE WHEN d.to_season IS NULL THEN NULL ELSE printf('%04d', d.to_season) END AS to_date,
                  '[]' AS sources,
                  'Oppgitt trenerperiode; eksakte kampdatoer finnes i trenerstatistikken fra 2010.' AS note
             FROM core_declared_coach_spells d
             JOIN core_people p ON p.id = d.person_id
         )
        ${personId ? "WHERE person_id = ?" : ""}
        ORDER BY from_date, name COLLATE NOCASE`,
      ...(personId ? [personId] : []),
    );
    return rows.map((row) => ({ ...row, sources: parseRoleSources(row.sources) }));
  } finally {
    db.close();
  }
}

export function getPersonSeasons(personId: string): PersonSeason[] {
  const db = open();
  try {
    return all<PersonSeason>(
      db,
      `SELECT season, number, position, appearances, starts, goals
         FROM squad WHERE person_id = ? ORDER BY season DESC`,
      personId,
    );
  } finally {
    db.close();
  }
}

export function getSourceTitles(): Map<string, string> {
  const db = open();
  try {
    return new Map(all<{ id: string; title: string }>(db, "SELECT id, title FROM core_sources").map((row) => [row.id, row.title]));
  } finally {
    db.close();
  }
}
