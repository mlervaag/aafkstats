import { all, open } from "@aafkstats/db";
import type { CitedRef } from "@/components/SourceChips";

export interface HistoricalObservation {
  id: string; title: string; text: string; date: string | null; note: string | null; sources: CitedRef[];
}
interface ObservationRow extends Omit<HistoricalObservation, "sources"> { sources: string }

function parseSources(value: string): CitedRef[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((ref): ref is CitedRef =>
      typeof ref === "object" && ref !== null && typeof (ref as CitedRef).sourceId === "string") : [];
  } catch { return []; }
}

function read(sql: string, value: string | number): HistoricalObservation[] {
  const db = open();
  try { return all<ObservationRow>(db, sql, value).map((row) => ({ ...row, sources: parseSources(row.sources) })); }
  finally { db.close(); }
}

/**
 * Observasjonene leses kronologisk overalt.
 *
 * Personsiden sorterte nyest først og sesongsiden eldst først, som gjorde at
 * samme to funn sto i motsatt rekkefølge på to sider. En observasjonsliste er en
 * liten tidslinje, og en tidslinje leses framover.
 */
const ORDER = "ORDER BY o.date NULLS LAST, o.id";
const COLUMNS = "SELECT o.id, o.title, o.text, o.date, o.note, o.sources FROM core_historical_observations o";

export function getPersonObservations(personId: string): HistoricalObservation[] {
  return read(`${COLUMNS} JOIN observation_people p ON p.observation_id = o.id
    WHERE p.person_id = ? ${ORDER}`, personId);
}

export function getSeasonObservations(year: number): HistoricalObservation[] {
  return read(`${COLUMNS} JOIN observation_seasons s ON s.observation_id = o.id
    WHERE s.season = ? ${ORDER}`, year);
}

export function getMatchObservations(matchId: string): HistoricalObservation[] {
  return read(`${COLUMNS} JOIN observation_matches m ON m.observation_id = o.id
    WHERE m.match_id = ? ${ORDER}`, matchId);
}

export function getVenueObservations(venueId: string): HistoricalObservation[] {
  return read(`${COLUMNS} JOIN observation_venues v ON v.observation_id = o.id
    WHERE v.venue_id = ? ${ORDER}`, venueId);
}

export function getSeasonSources(year: number): CitedRef[] {
  const db = open();
  try { return all<{ sources: string }>(db, "SELECT sources FROM core_seasons WHERE year = ?", year).flatMap((row) => parseSources(row.sources)); }
  finally { db.close(); }
}
