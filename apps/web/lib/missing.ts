import { PLAYED_SQL, all, one, open } from "@aafkstats/db";
import { getDerivedPlayers, getPlayersWithoutMatches } from "./derived-players.js";
import type { DerivedPlayer, PlayerWithoutMatches } from "./derived-players.js";

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
  sourceUrl: string | null;
  candidates: LineupReviewCandidate[];
}

export interface LineupReviewCandidate {
  id: string;
  page: string;
  season: number | null;
  names: string[];
  personIds: string[];
}

/**
 * En seriesesong arkivet ikke kan si er hel.
 *
 * `coverage` skiller allerede mellom hvorfor. «partial» betyr at runder mangler
 * eller at kampantallet ikke stemmer med omfanget, «unverified» at rundene
 * henger sammen uten at noen kilde sier hvor mange det skulle vært, og
 * «isolated» at kampene ikke har rundenummer i det hele tatt. Alle tre er noe en
 * kilde kan løse, og de er derfor forskjellige oppgaver, ikke samme hull.
 */
export interface IncompleteSeason {
  season: number;
  competition: string;
  coverage: string;
  played: number;
  expected: number | null;
  url: string;
}

export interface MissingOverview {
  playedMatches: number;
  matchFields: MissingField[];
  historicalResults: {
    total: number;
    seasons: HistoricalResultSeason[];
  };
  incompleteSeasons: IncompleteSeason[];
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
  /**
   * Identitetsjobben, begge veier.
   *
   * `playersWithoutFile` er spillere arkivet kjenner godt fra kampene, men som
   * ingen har skrevet en personfil for. Sida deres finnes, og den er utledet;
   * en fil ville lagt til nasjonalitet, posisjon og Wikidata med kilde.
   *
   * `filesWithoutMatches` er det motsatte: en fil ført som spiller, uten at én
   * eneste kamp er koblet til den. Som regel fordi kilden skriver navnet
   * annerledes enn fila, og da løses det med `names[]`.
   *
   * De to hører sammen, og et par av dem er ofte samme person sett fra hver sin
   * side. Derfor står de ved siden av hverandre framfor hver for seg.
   */
  identity: {
    playersWithoutFile: DerivedPlayer[];
    filesWithoutMatches: PlayerWithoutMatches[];
  };
}

interface PersonConflictRow {
  person_id: string;
  name: string;
  url: string;
  field: string;
}

interface LineupReviewRow {
  source_id: string;
  source_title: string;
  url: string;
  source_url: string | null;
  id: string;
  page: string;
  season: number | null;
  names: string;
  person_ids: string;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
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

    // En sesong som pågår mangler ingenting ennå, og en komplett sesong er
    // ferdig. Cup og treningskamper har ingen runder å måle mot og står som
    // «not_applicable». Det som blir igjen er de tre som faktisk er en oppgave.
    const incompleteSeasons = all<IncompleteSeason>(
      db,
      `SELECT season, competition, coverage, played, expected_matches AS expected, url
         FROM seasons
        WHERE competition_type = 'league'
          AND coverage IN ('partial', 'unverified', 'isolated')
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

    const lineupRows = all<LineupReviewRow>(
      db,
      `SELECT source_id, source_title, url, source_url, id, page, season,
              names, person_ids
         FROM resolved_lineups
        ORDER BY source_title COLLATE NOCASE, CAST(page AS INTEGER), id`,
    );
    const lineupSourcesById = new Map<string, LineupReviewSource>();
    for (const row of lineupRows) {
      const source = lineupSourcesById.get(row.source_id) ?? {
        sourceId: row.source_id,
        title: row.source_title,
        url: row.url,
        sourceUrl: row.source_url,
        candidates: [],
      };
      source.candidates.push({
        id: row.id,
        page: row.page,
        season: row.season,
        names: parseStringArray(row.names),
        personIds: parseStringArray(row.person_ids),
      });
      lineupSourcesById.set(row.source_id, source);
    }
    const lineupSources = [...lineupSourcesById.values()].sort((a, b) =>
      b.candidates.length - a.candidates.length || a.title.localeCompare(b.title, "nb"),
    );

    return {
      playedMatches,
      matchFields,
      historicalResults: {
        total: historicalSeasons.reduce((sum, row) => sum + row.results, 0),
        seasons: historicalSeasons,
      },
      incompleteSeasons,
      unresolvedPeople: {
        people: peopleById.size,
        conflicts: conflictRows.length,
        items: [...peopleById.values()],
      },
      lineupReview: {
        candidates: lineupRows.length,
        sources: lineupSources.length,
        items: lineupSources,
      },
      identity: {
        playersWithoutFile: getDerivedPlayers(),
        filesWithoutMatches: getPlayersWithoutMatches(),
      },
    };
  } finally {
    db.close();
  }
}
