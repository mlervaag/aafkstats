import { z } from "zod";
import { foundingYear, historicalName, httpUrl, isoDate, seasonYear, slug } from "./primitives.js";

/** AaFKs egen klubb-ID. Brukt overalt der arkivet må vite «hvilken side er oss». */
export const AAFK_CLUB_ID = "aalesunds-fk";

/**
 * En klubb — AaFK selv eller en motstander.
 *
 * `names` er tidsavhengig fordi klubber bytter navn (Lyn, Bodø/Glimt, Kristiansund).
 * En kamp fra 1975 skal vise navnet som gjaldt i 1975, ikke dagens.
 */
export const club = z
  .object({
    id: slug,
    name: z.string().min(1),
    shortName: z.string().min(1).optional(),
    names: z.array(historicalName).default([]),
    country: z.string().length(2).default("NO"),
    city: z.string().optional(),
    founded: foundingYear.optional(),
    aliases: z.record(z.union([z.string(), z.number()])).default({}),
    note: z.string().optional(),
  })
  .strict();

export type Club = z.infer<typeof club>;

/** Stadion eller bane. Navn er tidsavhengig av samme grunn som for klubber. */
export const venue = z
  .object({
    id: slug,
    name: z.string().min(1),
    names: z.array(historicalName).default([]),
    city: z.string().optional(),
    country: z.string().length(2).default("NO"),
    capacity: z.number().int().positive().optional(),
    opened: foundingYear.optional(),
    closed: foundingYear.optional(),
    note: z.string().optional(),
  })
  .strict();

export type Venue = z.infer<typeof venue>;

/**
 * Konkurransetype. Dette feltet driver hele navigasjonen på nettstedet
 * (Liga / Cup / Europa / Treningskamper) — derfor er det en lukket enum og ikke fritekst.
 */
export const competitionType = z.enum([
  "league",
  "national_cup",
  "european",
  "friendly",
  "playoff",
]);

export type CompetitionType = z.infer<typeof competitionType>;

/**
 * En konkurranse. `names` dekker navnebyttene: 1. divisjon → Tippeligaen → Eliteserien
 * er samme konkurranse, og en kamp fra 1998 skal si «Tippeligaen».
 */
export const competition = z
  .object({
    id: slug,
    name: z.string().min(1),
    names: z.array(historicalName).default([]),
    type: competitionType,
    /** Nivå i seriepyramiden. 1 = øverste. Kun for `league`. */
    tier: z.number().int().min(1).max(10).optional(),
    organizer: z.string().optional(),
    country: z.string().length(2).nullable().default("NO"),
    note: z.string().optional(),
  })
  .strict();

export type Competition = z.infer<typeof competition>;

/** En kildekatalogoppføring — hvem leverer data, under hvilken lisens, og hvor mye vi stoler på den. */
export const source = z
  .object({
    id: slug,
    name: z.string().min(1),
    url: httpUrl.optional(),
    /** Høyere tall vinner når to kilder er uenige om samme felt. */
    priority: z.number().int().min(0).max(100),
    license: z.string().optional(),
    /** Kort notat om hva kilden dekker og hvilke forbehold som gjelder. */
    note: z.string().optional(),
  })
  .strict();

export type Source = z.infer<typeof source>;

/** Sesongmeta: hvilken divisjon AaFK spilte i, hvordan det gikk, og hvem som ledet laget. */
export const season = z
  .object({
    year: seasonYear,
    competitionId: slug,
    finalPosition: z.number().int().positive().nullable().default(null),
    teamsInLeague: z.number().int().positive().optional(),
    headCoach: z.string().optional(),
    promoted: z.boolean().default(false),
    relegated: z.boolean().default(false),
    note: z.string().optional(),
  })
  .strict();

export type Season = z.infer<typeof season>;

export const seasonFile = season;

/** Kalenderdato brukt av CLI-en for å avgjøre hvilket navn som gjaldt. */
export function nameAt(names: { name: string; from: string | null; to: string | null }[], fallback: string, date: string): string {
  for (const entry of names) {
    const afterStart = entry.from === null || date >= entry.from;
    const beforeEnd = entry.to === null || date <= entry.to;
    if (afterStart && beforeEnd) return entry.name;
  }
  return fallback;
}

export { isoDate };
