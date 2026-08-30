import { all, open } from "@aafkstats/db";
import { slugify } from "@aafkstats/schema";

export interface DerivedPlayer {
  id: string;
  personKey: string;
  name: string;
  appearances: number;
  starts: number;
  goals: number;
  firstSeason: number;
  lastSeason: number;
}

export interface PlayerWithoutMatches {
  id: string;
  name: string;
  url: string;
  position: string | null;
  squadSeasons: number[];
}

interface DerivedRow {
  person_key: string;
  name: string;
  appearances: number;
  starts: number;
  goals: number;
  first_season: number;
  last_season: number;
}

const DERIVED_SQL = `
  SELECT person_key,
         min(name)         AS name,
         sum(appearances)  AS appearances,
         sum(starts)       AS starts,
         sum(goals)        AS goals,
         min(season)       AS first_season,
         max(season)       AS last_season
    FROM squad
   WHERE person_id IS NULL
   GROUP BY person_key`;

/** Spillere arkivet kjenner fra kampene, men som ikke har en personfil. */
export function getDerivedPlayers(): DerivedPlayer[] {
  const db = open();
  try {
    const taken = new Set(all<{ id: string }>(db, "SELECT id FROM people").map((row) => row.id));
    return all<DerivedRow>(db, DERIVED_SQL)
      .map((row) => ({
        id: slugify(row.person_key),
        personKey: row.person_key,
        name: row.name,
        appearances: row.appearances,
        starts: row.starts,
        goals: row.goals,
        firstSeason: row.first_season,
        lastSeason: row.last_season,
      }))
      .filter((player) => player.id !== "" && !taken.has(player.id))
      .sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name, "nb"));
  } finally {
    db.close();
  }
}

/**
 * Personfiler ført som spillere, men uten en koblet kamp.
 *
 * Draktnumrene må leses fra `core_squad_numbers`: det offentlige `squad`-viewet
 * er utledet fra kampopptredener og har derfor ingen rad for nettopp disse
 * personene. Dette er intern identitetslogikk; returtypen er den offentlige
 * kontrakten.
 */
export function getPlayersWithoutMatches(): PlayerWithoutMatches[] {
  const db = open();
  try {
    const rows = all<{
      id: string;
      name: string;
      url: string;
      position: string | null;
      seasons: string | null;
    }>(
      db,
      `SELECT p.id, p.name, p.url, p.position,
              (SELECT group_concat(n.season) FROM core_squad_numbers n WHERE n.person_id = p.id) AS seasons
         FROM people p
        WHERE p.appearances = 0
          AND (p.position IS NOT NULL
               OR EXISTS (SELECT 1 FROM core_squad_numbers n WHERE n.person_id = p.id))
        ORDER BY p.name COLLATE NOCASE`,
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      position: row.position,
      squadSeasons: (row.seasons ?? "")
        .split(",")
        .filter(Boolean)
        .map(Number)
        .sort((a, b) => a - b),
    }));
  } finally {
    db.close();
  }
}
