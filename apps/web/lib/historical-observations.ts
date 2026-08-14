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

export function getPersonObservations(personId: string): HistoricalObservation[] {
  return read(`SELECT o.id, o.title, o.text, o.date, o.note, o.sources
    FROM core_historical_observations o JOIN observation_people p ON p.observation_id = o.id
    WHERE p.person_id = ? ORDER BY o.date DESC NULLS LAST, o.id`, personId);
}

export function getSeasonObservations(year: number): HistoricalObservation[] {
  return read(`SELECT o.id, o.title, o.text, o.date, o.note, o.sources
    FROM core_historical_observations o JOIN observation_seasons s ON s.observation_id = o.id
    WHERE s.season = ? ORDER BY o.date, o.id`, year);
}

export function getSeasonSources(year: number): CitedRef[] {
  const db = open();
  try { return all<{ sources: string }>(db, "SELECT sources FROM core_seasons WHERE year = ?", year).flatMap((row) => parseSources(row.sources)); }
  finally { db.close(); }
}
