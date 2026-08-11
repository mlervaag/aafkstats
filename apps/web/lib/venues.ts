import { all, open } from "@aafkstats/db";
import { cache } from "react";
import type { CitedRef } from "@/components/SourceChips";

export interface HomePeriod {
  clubId: string;
  from: number;
  to: number | null;
  sources: CitedRef[];
}

export interface SurfacePeriod {
  surface: string;
  from?: string;
  to: string | null;
  sources: CitedRef[];
  note?: string;
}

export interface AttendanceRecord {
  attendance: number;
  approximate: boolean;
  opponent: string;
  year?: number;
  context?: string;
  sources: CitedRef[];
}

export interface VenueEvent {
  id: string;
  date: string;
  kind: string;
  title: string;
  attendance?: number;
  approximateAttendance: boolean;
  score?: { homeTeam: string; awayTeam: string; home: number; away: number };
  participants: { name: string; affiliation?: string }[];
  sources: CitedRef[];
  note?: string;
}

export interface HomeVenue {
  id: string;
  name: string;
  city: string | null;
  capacity: number | null;
  opened: number | null;
  closed: number | null;
  surface: string | null;
  note: string | null;
  homePeriods: HomePeriod[];
  surfaceHistory: SurfacePeriod[];
  attendanceRecords: AttendanceRecord[];
  events: VenueEvent[];
  sources: CitedRef[];
  matches: number;
}

interface VenueRow {
  id: string;
  name: string;
  city: string | null;
  capacity: number | null;
  opened: number | null;
  closed: number | null;
  surface: string | null;
  note: string | null;
  home_periods: string;
  surface_history: string;
  attendance_records: string;
  events: string;
  sources: string;
  matches: number;
}

function parse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Banene klubben har spilt hjemmekampene sine på.
 *
 * Utvalget er `homePeriods`, ikke alle stadioner arkivet kjenner: de 92 andre
 * er motstandernes baner, og de hører hjemme på kampsidene. De fire her er
 * klubbens egne, og de er de eneste med dekkehistorikk, publikumsrekord og
 * milepæler.
 */
export const getHomeVenues = cache(function getHomeVenues(): HomeVenue[] {
  const db = open();
  try {
    const rows = all<VenueRow>(
      db,
      `SELECT v.id, v.name, v.city, v.capacity, v.opened, v.closed, v.surface, v.note,
              v.home_periods, v.surface_history, v.attendance_records, v.events, v.sources,
              (SELECT count(*) FROM matches m WHERE m.venue = v.name) AS matches
         FROM venues v
        WHERE json_array_length(v.home_periods) > 0`,
    );
    return rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        city: row.city,
        capacity: row.capacity,
        opened: row.opened,
        closed: row.closed,
        surface: row.surface,
        note: row.note,
        matches: row.matches,
        homePeriods: parse<HomePeriod[]>(row.home_periods, []),
        surfaceHistory: parse<SurfacePeriod[]>(row.surface_history, []),
        attendanceRecords: parse<AttendanceRecord[]>(row.attendance_records, []),
        events: parse<VenueEvent[]>(row.events, []),
        sources: parse<CitedRef[]>(row.sources, []),
      }))
      // Eldste bane først: sida leses som klubbens flytting gjennom hundre år.
      .sort((a, b) => (a.homePeriods[0]?.from ?? 0) - (b.homePeriods[0]?.from ?? 0));
  } finally {
    db.close();
  }
});
