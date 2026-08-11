import { PLAYED_SQL, all, one, open } from "@aafkstats/db";

export interface MissingField {
  field: string;
  matches: number;
}

export interface HistoricalResultSeason {
  season: number;
  results: number;
}

export interface UnresolvedPerson {
  id: string;
  name: string;
  url: string;
  conflicts: number;
  fields: string[];
}

export interface LineupReviewSource {
  sourceId: string;
  title: string;
  url: string;
  candidates: number;
}

export interface MissingOverview {
  playedMatches: number;
  matchFields: MissingField[];
  historicalResults: {
    total: number;
    seasons: HistoricalResultSeason[];
  };
  unresolvedPeople: {
    people: number;
    conflicts: number;
    items: UnresolvedPerson[];
  };
  lineupReview: {
    candidates: number;
    sources: number;
    items: LineupReviewSource[];
  };
}

interface PersonConflictRow {
  person_id: string;
  name: string;
  url: string;
  field: string;
}

/**
 * Den offentlige arbeidskøen, regnet fra de samme viewene som resten av siden.
 *
 * Den viser bare tilstander en leser kan forstå og handle på. Rå OCR-treff og
 * navnelikhet fra duplikatrapporten blir bevisst ikke publisert som oppgaver:
 * de er maskinelle forslag, ikke mangler arkivet har slått fast.
 */
export function loadMissingOverview(): MissingOverview {
  const db = open();
  try {
    const playedMatches = one<{ n: number }>(
      db,
      `SELECT count(*) AS n FROM matches WHERE ${PLAYED_SQL}`,
    )?.n ?? 0;

    const matchFields = all<MissingField>(
      db,
      `SELECT field.value AS field, count(*) AS matches
         FROM matches m
         JOIN json_each(m.missing_fields) field
        WHERE m.${PLAYED_SQL}
          AND field.value <> 'providers'
        GROUP BY field.value
        ORDER BY matches DESC, field.value`,
    );

    const historicalSeasons = all<HistoricalResultSeason>(
      db,
      `SELECT season, count(*) AS results
         FROM source_results
        WHERE match_id IS NULL
        GROUP BY season
        ORDER BY season`,
    );

    const conflictRows = all<PersonConflictRow>(
      db,
      `SELECT person_id, name, url, field
         FROM person_conflicts
        WHERE decision = 'unresolved'
        GROUP BY person_id, name, url, field
        ORDER BY name COLLATE NOCASE, field`,
    );
    const peopleById = new Map<string, UnresolvedPerson>();
    for (const row of conflictRows) {
      const person = peopleById.get(row.person_id) ?? {
        id: row.person_id,
        name: row.name,
        url: row.url,
        conflicts: 0,
        fields: [],
      };
      person.conflicts += 1;
      person.fields.push(row.field);
      peopleById.set(row.person_id, person);
    }

    const lineupSources = all<{
      source_id: string;
      source_title: string;
      url: string;
      candidates: number;
    }>(
      db,
      `SELECT source_id, source_title, url, count(*) AS candidates
         FROM resolved_lineups
        GROUP BY source_id, source_title, url
        ORDER BY candidates DESC, source_title COLLATE NOCASE`,
    ).map((row) => ({
      sourceId: row.source_id,
      title: row.source_title,
      url: row.url,
      candidates: row.candidates,
    }));

    return {
      playedMatches,
      matchFields,
      historicalResults: {
        total: historicalSeasons.reduce((sum, row) => sum + row.results, 0),
        seasons: historicalSeasons,
      },
      unresolvedPeople: {
        people: peopleById.size,
        conflicts: conflictRows.length,
        items: [...peopleById.values()],
      },
      lineupReview: {
        candidates: lineupSources.reduce((sum, row) => sum + row.candidates, 0),
        sources: lineupSources.length,
        items: lineupSources,
      },
    };
  } finally {
    db.close();
  }
}
