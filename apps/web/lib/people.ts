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
                  -- Datoen når kilden oppgir den: Rekdal ble ansatt 4. september
                  -- 2008, ikke ved nyttår.
                  coalesce(d.from_date, printf('%04d', d.from_season)) AS from_date,
                  CASE WHEN d.to_season IS NULL THEN NULL
                       ELSE coalesce(d.to_date, printf('%04d', d.to_season)) END AS to_date,
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

/** Årstallet i en dato som «1948» eller «1948-05-03». */
function year(value: string): number {
  return Number(value.slice(0, 4));
}

/**
 * Organet et verv hører til, normalisert.
 *
 * Et tomt organ og «Hovedstyret» er det samme vervet: begge betyr klubben som
 * helhet. Kildene skriver det ulikt — jubileumsboka sier «formann», medlemsbladet
 * «formann i hovedstyret» — og uten denne likheten sto Lauritz Giske med
 * «1953–1954 Hovedstyret» og «1954» som to verv. En navngitt komité er derimot
 * noe annet enn hovedstyret, og slås aldri sammen med det.
 */
const CLUB_WIDE = new Set(["hovedstyret", "a-laget"]);

function organ(body: string | null): string {
  const value = (body ?? "").trim().toLowerCase();
  return CLUB_WIDE.has(value) ? "" : value;
}

/**
 * Tittelen, med de synonymene kildene faktisk bruker om hverandre.
 *
 * «Trener» og «Hovedtrener» er samme jobb: aafk.no og Wikipedia sier det ene,
 * bøkene det andre, og Kjetil Rekdal sto derfor med begge deler for de samme
 * årene. Det samme gjelder «Formann» og «Styreleder» — ordet skiftet et sted på
 * veien, og Peder Puck sto med begge for perioder som møtes i 1945.
 * «Assistenttrener» og «Keepertrener» er noe annet og røres ikke.
 */
const SAME_OFFICE: Record<string, string> = {
  trener: "hovedtrener",
  styreleder: "formann",
  nestleder: "nestformann",
  varaformann: "nestformann",
};

function office(title: string): string {
  const value = title.trim().toLowerCase();
  return SAME_OFFICE[value] ?? value;
}

/** Slutten på en periode. Ukjent slutt telles som året den begynte. */
function endYear(role: PersonRole): number {
  return year(role.to_date ?? role.from_date);
}

/**
 * Slår sammen perioder som er samme verv for samme person.
 *
 * ## Hvorfor
 *
 * Kildene oppgir det samme vervet på ulikt vis. Én bok gir perioden
 * «1946–1949», en annen nevner bare året 1948 — og arkivet lagrer begge, som
 * seg hør og bør. Men i lista sto Sigurd Nørve to ganger på rad, én gang for
 * 1946–1949 og én gang for 1948, som om han hadde hatt vervet to ganger. Verre
 * for trenerne, der kildene lister år for år: Kjetil Rekdal fikk fire rader,
 * 2009, 2010, 2011 og 2012.
 *
 * Sammenslåingen skjer i visningen, ikke i dataene. Hver kilde beholder sin
 * egen registrering; raden viser ytterpunktene og alle kildene bak dem.
 *
 * ## Hva som ikke slås sammen
 *
 * Nøkkelen er person, tittel **og** organ. Erling Bjørge var formann i
 * hovedstyret 1967–1968 og formann i redaksjonskomiteen fra 1968 — to verv i
 * samme år, ikke ett langt. Perioder med et hull i mellom står også hver for
 * seg: et opphold er en opplysning.
 */
export function mergeRoleSpells(roles: PersonRole[]): PersonRole[] {
  const groups = new Map<string, PersonRole[]>();
  for (const role of roles) {
    const key = `${role.person_id}|${role.category}|${office(role.title)}|${organ(role.body)}`;
    const group = groups.get(key);
    if (group) group.push(role);
    else groups.set(key, [role]);
  }

  const merged: PersonRole[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.from_date.localeCompare(b.from_date));
    let spell: PersonRole[] = [sorted[0]!];
    let reach = endYear(sorted[0]!);
    for (const role of sorted.slice(1)) {
      // Sammenhengende, ikke bare overlappende: 1938–1939 og 1940–1945 er én
      // sammenhengende periode delt av to kilder, ikke to verv.
      if (year(role.from_date) <= reach + 1) {
        spell.push(role);
        reach = Math.max(reach, endYear(role));
        continue;
      }
      merged.push(spell.length === 1 ? spell[0]! : combine(spell, reach));
      spell = [role];
      reach = endYear(role);
    }
    merged.push(spell.length === 1 ? spell[0]! : combine(spell, reach));
  }
  return merged.sort((a, b) => a.from_date.localeCompare(b.from_date) || a.name.localeCompare(b.name, "nb"));
}

/** Én rad av flere perioder: ytterpunktene, alle kildene, alle merknadene. */
function combine(roles: PersonRole[], reach: number): PersonRole {
  const first = roles[0]!;
  const last = roles.reduce((a, b) => (endYear(b) > endYear(a) ? b : a));
  const sources: PersonRoleSource[] = [];
  const seen = new Set<string>();
  for (const role of roles) {
    for (const source of role.sources) {
      const key = `${source.sourceId}|${source.page ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push(source);
    }
  }
  const notes = [...new Set(roles.map((role) => role.note).filter((note): note is string => Boolean(note)))];
  return {
    ...first,
    // Ordet fra den kilden som dekker mest: den oppgitte perioden 2008-2012 sier
    // «Hovedtrener», bøkenes enkeltår sier «Trener», og da er det den lange
    // perioden som har navngitt jobben. Samme regel gir «Formann» framfor
    // «Styreleder» der en lang formannsperiode møter et enkeltår.
    title: roles.reduce((a, b) => (endYear(b) - year(b.from_date) > endYear(a) - year(a.from_date) ? b : a)).title,
    body: roles.find((role) => role.body)?.body ?? null,
    // Slutten er den seneste kilden rekker, uansett hvilken rad den kom fra.
    to_date: last.to_date ?? (reach > year(first.from_date) ? String(reach) : null),
    sources,
    note: notes.length > 0 ? notes.join(" ") : null,
  };
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
