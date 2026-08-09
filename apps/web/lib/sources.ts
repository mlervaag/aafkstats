import { all, one, open } from "@aafkstats/db";
import { cache } from "react";

interface SourceProvider {
  providerId: string;
  url?: string;
}

export interface Source {
  id: string;
  parent_source_id: string | null;
  title: string;
  source_type: string;
  issue: string | null;
  volume: string | null;
  publisher: string | null;
  year: number | null;
  urn: string | null;
  author: string | null;
  description: string | null;
  cover_url: string | null;
  access_url: string | null;
  providers: SourceProvider[];
}

interface SourceRow extends Omit<Source, "providers"> {
  providers: string;
}

export interface SourceUsage {
  id: string;
  source_id: string;
  source_title: string;
  date: string;
  opponent: string;
  competition: string;
  is_home: number;
  aafk_score: number | null;
  opponent_score: number | null;
  page: string | null;
  note: string | null;
}

const sourceColumns = `id, parent_source_id, title, source_type, issue, volume,
  publisher, year, urn, author, description, cover_url, access_url, providers`;

function parseProviders(value: string): SourceProvider[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SourceProvider => {
      if (typeof entry !== "object" || entry === null) return false;
      const provider = entry as Record<string, unknown>;
      return typeof provider.providerId === "string" &&
        (provider.url === undefined || typeof provider.url === "string");
    });
  } catch {
    return [];
  }
}

function mapSource(row: SourceRow): Source {
  return { ...row, providers: parseProviders(row.providers) };
}

export function getSources(): Source[] {
  const db = open();
  try {
    return all<SourceRow>(
      db,
      `SELECT ${sourceColumns}
       FROM core_sources
       ORDER BY coalesce(year, 0) DESC, title COLLATE NOCASE`,
    ).map(mapSource);
  } finally {
    db.close();
  }
}

/**
 * Bare ID-ene, til `generateStaticParams()`.
 *
 * Kildesidene ble bygget per forespørsel, selv om de leser det samme bygde
 * SQLite-arkivet som kamp- og sesongsidene, som alle er forhåndsgenererte. Én
 * spørring for lista er billigere enn å lese hele katalogen for å kaste alt annet.
 */
export function getSourceIds(): string[] {
  const db = open();
  try {
    return all<{ id: string }>(db, "SELECT id FROM core_sources ORDER BY id").map((row) => row.id);
  } finally {
    db.close();
  }
}

/**
 * Visningsnavnet på hver dataleverandør, fra `core_providers`.
 *
 * Kildesiden hadde «Nasjonalbiblioteket» skrevet inn i JSX-en, med ID-en som
 * reserveløsning for alle andre. Navnet står allerede i providerfila, og det er
 * det ene stedet det skal stå — ellers får kildesiden og kampsiden hver sitt navn
 * på samme leverandør.
 */
export function getProviderNames(): Map<string, string> {
  const db = open();
  try {
    return new Map(
      all<{ id: string; name: string }>(db, "SELECT id, name FROM core_providers").map(
        (row) => [row.id, row.name],
      ),
    );
  } finally {
    db.close();
  }
}

export const getSourceById = cache(function getSourceById(id: string): Source | undefined {
  const db = open();
  try {
    const row = one<SourceRow>(
      db,
      `SELECT ${sourceColumns} FROM core_sources WHERE id = ?`,
      id,
    );
    return row ? mapSource(row) : undefined;
  } finally {
    db.close();
  }
});

export function getSourceChildren(parentId: string): Source[] {
  const db = open();
  try {
    return all<SourceRow>(
      db,
      `SELECT ${sourceColumns}
       FROM core_sources
       WHERE parent_source_id = ?
       -- Nyeste årgang først, men utgavene innenfor et år i den rekkefølgen de kom.
       -- Nr. 1 til 6 lest baklengs er ikke slik noen leser et blad.
       --
       -- Ikke alle utgaver har et tall: noen heter «Jul» eller «Jubelnr.». De
       -- sorteres bakerst i året framfor å bli CAST-et til 0 og havne foran nr. 1.
       ORDER BY coalesce(year, 0) DESC,
                CASE WHEN issue GLOB '[0-9]*' THEN 0 ELSE 1 END,
                CAST(issue AS INTEGER),
                issue COLLATE NOCASE`,
      parentId,
    ).map(mapSource);
  } finally {
    db.close();
  }
}

export function getParentSource(parentId: string): Pick<Source, "id" | "title"> | undefined {
  const db = open();
  try {
    return one<Pick<Source, "id" | "title">>(
      db,
      "SELECT id, title FROM core_sources WHERE id = ?",
      parentId,
    );
  } finally {
    db.close();
  }
}

export function getSourceUsages(sourceId: string): SourceUsage[] {
  const db = open();
  try {
    return all<SourceUsage>(
      db,
      `SELECT
         m.id,
         source.id AS source_id,
         source.title AS source_title,
         m.match_date AS date,
         c.name AS opponent,
         comp.name AS competition,
         m.home_club_id = 'aalesunds-fk' AS is_home,
         CASE WHEN m.home_club_id = 'aalesunds-fk' THEN m.home_score ELSE m.away_score END AS aafk_score,
         CASE WHEN m.home_club_id = 'aalesunds-fk' THEN m.away_score ELSE m.home_score END AS opponent_score,
         json_extract(ref.value, '$.page') AS page,
         json_extract(ref.value, '$.note') AS note
       FROM core_matches m
       JOIN json_each(m.sources) ref
       JOIN core_sources source ON source.id = json_extract(ref.value, '$.sourceId')
       LEFT JOIN core_clubs c ON c.id = CASE
         WHEN m.home_club_id = 'aalesunds-fk' THEN m.away_club_id
         ELSE m.home_club_id
       END
       LEFT JOIN core_competitions comp ON comp.id = m.competition_id
       WHERE source.id = ? OR source.parent_source_id = ?
       ORDER BY m.match_date DESC`,
      sourceId,
      sourceId,
    );
  } finally {
    db.close();
  }
}
