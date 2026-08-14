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

export interface SearchPerson {
  personId: string;
  name: string;
  description: string;
  period: string | null;
  url: string;
}

export interface SearchSource {
  sourceId: string;
  title: string;
  description: string;
  url: string;
}

export interface SearchObservation {
  observationId: string;
  title: string;
  description: string;
  date: string | null;
  url: string;
}

interface PersonSearchRow {
  person_id: string;
  name: string;
  nationality: string | null;
  position: string | null;
  category: string | null;
  title: string | null;
  body: string | null;
  from_date: string | null;
  to_date: string | null;
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

interface SourceSearchRow {
  id: string;
  title: string;
  source_type: string;
  publisher: string | null;
  year: number | null;
  issue: string | null;
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

/**
 * Persondelen av direktesøket.
 *
 * Registeret er lite, så radene filtreres i JavaScript. Det gir samme robuste
 * søk etter «Jonsson» som etter «Jönsson», uten en egen normalisert indeks eller
 * brukerdata interpolert i SQL. Roller brukes som søkeord, men kandidaten vises
 * bare én gang selv om personen har flere verv.
 */
export function searchPeople(query: string, limit = 12): SearchPerson[] {
  const parsed = parseSearchQuery(query);
  if (parsed.years.length === 0 && parsed.terms.length === 0) return [];

  const db = open();
  try {
    const rows = all<PersonSearchRow>(
      db,
      `SELECT p.id AS person_id, p.name, p.nationality, p.position,
              r.category, r.title, r.body, r.from_date, r.to_date, p.url
         FROM (
           SELECT id, name, nationality, position, '/personer/' || id AS url
             FROM core_people
         ) p
         LEFT JOIN (
           SELECT person_id, category, title, body, from_date, to_date
             FROM core_person_roles
           UNION ALL
           SELECT person_id, 'coach', 'Hovedtrener', 'A-laget',
                  printf('%04d', from_season),
                  CASE WHEN to_season IS NULL THEN NULL ELSE printf('%04d', to_season) END
             FROM core_declared_coach_spells
         ) r ON r.person_id = p.id
        ORDER BY p.name COLLATE NOCASE, r.from_date`,
    );

    const grouped = new Map<string, PersonSearchRow[]>();
    for (const row of rows) {
      const current = grouped.get(row.person_id) ?? [];
      current.push(row);
      grouped.set(row.person_id, current);
    }

    const results: SearchPerson[] = [];
    for (const personRows of grouped.values()) {
      const first = personRows[0]!;
      const matchingRoles = personRows.filter((row) => {
        const haystack = searchable([row.title, row.body, row.category].filter(Boolean).join(" "));
        return parsed.terms.length === 0 || parsed.terms.every((term) => haystack.includes(searchable(term)));
      });
      const personHaystack = searchable(
        [first.name, first.nationality, first.position].filter(Boolean).join(" "),
      );
      const termsMatch = parsed.terms.every((term) => {
        const needle = searchable(term);
        return personHaystack.includes(needle) || personRows.some((row) =>
          searchable([row.title, row.body, row.category].filter(Boolean).join(" ")).includes(needle),
        );
      });
      if (!termsMatch) continue;

      const yearsMatch = parsed.years.length === 0 || parsed.years.some((year) =>
        personRows.some((row) => roleCoversYear(row, year)),
      );
      if (!yearsMatch) continue;

      const role = matchingRoles.find((row) => row.title !== null) ??
        personRows.find((row) => row.title !== null);
      const description = role?.title
        ? [role.title, role.body].filter(Boolean).join(" · ")
        : [first.position, first.nationality].filter(Boolean).join(" · ") || "Person i AaFK-arkivet";
      const from = role?.from_date?.slice(0, 4) ?? null;
      const to = role?.to_date?.slice(0, 4) ?? from;

      results.push({
        personId: first.person_id,
        name: first.name,
        description,
        period: from === null ? null : to && to !== from ? `${from}–${to}` : from,
        url: first.url,
      });
    }

    return results
      .sort((a, b) => rankPerson(a, parsed.terms) - rankPerson(b, parsed.terms) ||
        a.name.localeCompare(b.name, "nb"))
      .slice(0, Math.min(Math.max(limit, 1), 50));
  } finally {
    db.close();
  }
}

/** Historiske publikasjoner i det samme direktesøket som kamper og personer. */
export function searchSources(query: string, limit = 12): SearchSource[] {
  const parsed = parseSearchQuery(query);
  if (parsed.years.length === 0 && parsed.terms.length === 0) return [];

  const db = open();
  try {
    const rows = all<SourceSearchRow>(
      db,
      `SELECT id, title, source_type, publisher, year, issue
         FROM core_sources
        ORDER BY coalesce(year, 0) DESC, title COLLATE NOCASE`,
    );
    const results = rows.filter((row) => {
      const text = searchable([
        row.title,
        row.publisher,
        row.issue,
        row.source_type.replaceAll("_", " "),
      ].filter(Boolean).join(" "));
      const termsMatch = parsed.terms.every((term) => text.includes(searchable(term)));
      const yearsMatch = parsed.years.length === 0 ||
        (row.year !== null && parsed.years.includes(row.year));
      return termsMatch && yearsMatch;
    }).map((row) => ({
      sourceId: row.id,
      title: row.title,
      description: [
        row.year === null ? null : String(row.year),
        row.issue ? `nr. ${row.issue}` : null,
        row.publisher,
      ].filter(Boolean).join(" · ") || "Historisk kilde",
      url: `/kilder/${row.id}`,
    }));

    return results
      .sort((a, b) => rankTitle(a.title, parsed.terms) - rankTitle(b.title, parsed.terms) ||
        a.title.localeCompare(b.title, "nb"))
      .slice(0, Math.min(Math.max(limit, 1), 50));
  } finally {
    db.close();
  }
}

/** Kanoniske historiske fakta, med direkte lenke til person- eller sesongvisningen. */
export function searchHistoricalObservations(query: string, limit = 12): SearchObservation[] {
  const parsed = parseSearchQuery(query);
  if (parsed.years.length === 0 && parsed.terms.length === 0) return [];
  const db = open();
  try {
    const rows = all<{ id: string; title: string; text: string; date: string | null; url: string | null }>(
      db, "SELECT id, title, text, date, url FROM historical_observations",
    );
    return rows.filter((row) => {
      const text = searchable(`${row.title} ${row.text}`);
      const termsMatch = parsed.terms.every((term) => text.includes(searchable(term)));
      const yearsMatch = parsed.years.length === 0 || (row.date !== null && parsed.years.includes(Number(row.date.slice(0, 4))));
      return termsMatch && yearsMatch && row.url !== null;
    }).map((row) => ({
      observationId: row.id, title: row.title, description: row.text, date: row.date, url: row.url!,
    })).sort((a, b) => rankTitle(a.title, parsed.terms) - rankTitle(b.title, parsed.terms))
      .slice(0, Math.min(Math.max(limit, 1), 50));
  } finally { db.close(); }
}

function roleCoversYear(row: PersonSearchRow, year: number): boolean {
  if (!row.from_date) return false;
  const from = Number(row.from_date.slice(0, 4));
  const to = Number((row.to_date ?? row.from_date).slice(0, 4));
  return year >= from && year <= to;
}

function rankPerson(person: SearchPerson, terms: string[]): number {
  return rankTitle(person.name, terms);
}

function rankTitle(value: string, terms: string[]): number {
  const name = searchable(value);
  const joined = searchable(terms.join(" "));
  if (name === joined) return 0;
  if (name.startsWith(joined)) return 1;
  if (name.includes(joined)) return 2;
  return 3;
}

function searchable(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("nb");
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
