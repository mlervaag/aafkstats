import { z } from "zod";
import { isoDate, seasonYear, slug } from "./primitives.js";

/** Et kompakt, menneskelesbart resultat i én årsgruppe. */
const sourceResultEntry = z
  .object({
    no: z.number().int().min(1),
    date: isoDate.optional(),
    opponent: z.string().min(1).nullable().default(null),
    /** Målene står alltid som [AaFK, motstander], uavhengig av hjemme/borte. */
    score: z.tuple([z.number().int().min(0), z.number().int().min(0)]).nullable().default(null),
    page: z.number().int().min(1).optional(),
    competitionId: slug.nullable().default(null),
    status: z.enum(["played", "walkover"]).default("played"),
    replay: z.boolean().default(false),
    extraTime: z.boolean().default(false),
    round: z.number().int().min(1).nullable().default(null),
    opponentClubId: slug.nullable().default(null),
    resultGroupId: slug.optional(),
    matchId: slug.nullable().default(null),
    note: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "played" && value.score === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["score"], message: "en spilt kamp må ha resultat" });
    }
    if (value.status === "walkover" && value.score !== null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["score"], message: "walkover lagres uten oppdiktet resultat" });
    }
  });

const sourceResultSeason = z
  .object({
    year: seasonYear,
    page: z.number().int().min(1),
    results: z.array(sourceResultEntry).min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const [index, result] of value.results.entries()) {
      if (result.no !== index + 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["results", index, "no"], message: `forventet ${index + 1}, fant ${result.no}` });
    }
  });

export const sourceResultCollection = z
  .object({ sourceId: slug, scorePerspective: z.literal("aafk"), seasons: z.array(sourceResultSeason).min(1) })
  .strict()
  .superRefine((value, ctx) => {
    const years = new Set<number>();
    for (const [index, season] of value.seasons.entries()) {
      if (years.has(season.year)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["seasons", index, "year"], message: `duplikat år ${season.year}` });
      years.add(season.year);
    }
  });

export type SourceResultCollection = z.infer<typeof sourceResultCollection>;

export interface SourceResult {
  id: string; sourceId: string; season: number; order: number; page: number;
  date?: string;
  opponent: string | null; opponentClubId: string | null;
  aafkGoals: number | null; opponentGoals: number | null;
  competitionId: string | null; status: "played" | "walkover";
  replay: boolean; extraTime: boolean; round: number | null;
  resultGroupId?: string;
  matchId: string | null; note?: string;
}

/** Flat form for database og visning. ID-en er stabil innen kilde og sesong. */
export function flattenSourceResults(collection: SourceResultCollection): SourceResult[] {
  let order = 0;
  return collection.seasons.flatMap((season) => season.results.map((result) => {
    order += 1;
    return {
      id: `${season.year}-${String(result.no).padStart(3, "0")}`,
      sourceId: collection.sourceId, season: season.year, order,
      page: result.page ?? season.page,
      ...(result.date === undefined ? {} : { date: result.date }),
      opponent: result.opponent,
      opponentClubId: result.opponentClubId,
      aafkGoals: result.score?.[0] ?? null, opponentGoals: result.score?.[1] ?? null,
      competitionId: result.competitionId, status: result.status,
      replay: result.replay, extraTime: result.extraTime, round: result.round,
      matchId: result.matchId,
      ...(result.resultGroupId === undefined ? {} : { resultGroupId: result.resultGroupId }),
      ...(result.note === undefined ? {} : { note: result.note }),
    };
  }));
}

export function sourceResultPath(sourceId: string): string {
  return `source-results/${sourceId}.yaml`;
}

export interface PossibleDuplicateSourceResult {
  season: number;
  opponentClubId: string;
  scoreText: string;
  first: SourceResult;
  second: SourceResult;
}

export interface PossibleCanonicalMatchLink {
  season: number;
  sourceResult: SourceResult;
  candidateMatch: {
    id: string;
    file: string;
    date: string;
    opponentClubId: string;
    scoreText: string;
    competitionId: string;
    round: number | null;
  };
}

/**
 * Finner kildedokumenterte resultater som kan være samme historiske oppgjør.
 *
 * Rapporterer par der:
 * - samme season
 * - samme opponentClubId
 * - samme score (eller begge er walkover)
 * - samme competitionId når oppgitt i begge (eller minst én ukjent)
 * - samme round når oppgitt i begge (eller minst én ukjent)
 * - ikke motstridende eksplisitte datoer (dersom begge har dato, må datoene være like)
 *
 * Par som allerede deler samme resultGroupId eller samme matchId hoppes over.
 * Setter aldri resultGroupId automatisk — dette krever manuell vurdering.
 */
export function findPossibleDuplicateSourceResults(
  collections: SourceResultCollection[],
): PossibleDuplicateSourceResult[] {
  const all = collections.flatMap(flattenSourceResults);
  const duplicates: PossibleDuplicateSourceResult[] = [];

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!;
      const b = all[j]!;

      if (a.season !== b.season) continue;
      if (!a.opponentClubId || !b.opponentClubId || a.opponentClubId !== b.opponentClubId) continue;

      // Forskjellige kjente datoer utelukker samme kamp
      if (a.date && b.date && a.date !== b.date) continue;

      const scoreMatch =
        (a.status === "walkover" && b.status === "walkover") ||
        (a.aafkGoals !== null && b.aafkGoals !== null && a.aafkGoals === b.aafkGoals && a.opponentGoals === b.opponentGoals);
      if (!scoreMatch) continue;

      if (a.competitionId && b.competitionId && a.competitionId !== b.competitionId) continue;
      if (a.round !== null && b.round !== null && a.round !== b.round) continue;

      // Allerede gruppert sammen
      if (a.resultGroupId && b.resultGroupId && a.resultGroupId === b.resultGroupId) continue;
      // Allerede koblet til samme kanoniske kamp
      if (a.matchId && b.matchId && a.matchId === b.matchId) continue;

      const scoreText = a.status === "walkover" ? "walkover" : `${a.aafkGoals}–${a.opponentGoals}`;

      duplicates.push({
        season: a.season,
        opponentClubId: a.opponentClubId,
        scoreText,
        first: a,
        second: b,
      });
    }
  }

  return duplicates;
}

/**
 * Finner uavklarte kildedokumenterte resultater som har en sterk kandidatmatch i eksisterende kanoniske kamper.
 *
 * Rapporterer kandidater der:
 * - samme season
 * - samme opponentClubId
 * - samme score
 * - samme competitionId når oppgitt i begge (eller minst én ukjent)
 * - samme round når oppgitt i begge (eller minst én ukjent)
 * - samme date dersom sourceResult har oppgitt en eksplisitt dato
 *
 * Setter aldri matchId automatisk — dette krever manuell kildekontroll.
 */
export function findPossibleCanonicalMatchLinks(
  collections: SourceResultCollection[],
  matches: Array<{
    id: string;
    file: string;
    date: string;
    competition: { id: string; season: number; round?: number | null };
    home: { clubId: string; goals?: number | null };
    away: { clubId: string; goals?: number | null };
  }>,
  aafkClubId = "aalesunds-fk",
): PossibleCanonicalMatchLink[] {
  const all = collections.flatMap(flattenSourceResults);
  const links: PossibleCanonicalMatchLink[] = [];

  for (const res of all) {
    if (res.matchId !== null) continue;
    if (!res.opponentClubId) continue;

    for (const match of matches) {
      if (match.competition.season !== res.season) continue;
      if (res.date && match.date !== res.date) continue;

      const isHome = match.home.clubId === aafkClubId;
      const oppClubId = isHome ? match.away.clubId : match.home.clubId;
      if (oppClubId !== res.opponentClubId) continue;

      if (res.status === "played") {
        if (res.aafkGoals === null || res.opponentGoals === null) continue;
        const matchAafkGoals = isHome ? match.home.goals : match.away.goals;
        const matchOppGoals = isHome ? match.away.goals : match.home.goals;
        if (matchAafkGoals !== res.aafkGoals || matchOppGoals !== res.opponentGoals) continue;
      }

      if (res.competitionId && match.competition.id && res.competitionId !== match.competition.id) continue;
      if (res.round !== null && match.competition.round !== undefined && match.competition.round !== null && res.round !== match.competition.round) continue;

      const isAafkHome = match.home.clubId === aafkClubId;
      const scoreText = `${isAafkHome ? match.home.goals : match.away.goals}–${isAafkHome ? match.away.goals : match.home.goals}`;

      links.push({
        season: res.season,
        sourceResult: res,
        candidateMatch: {
          id: match.id,
          file: match.file,
          date: match.date,
          opponentClubId: oppClubId,
          scoreText,
          competitionId: match.competition.id,
          round: match.competition.round ?? null,
        },
      });
    }
  }

  return links;
}

export function parseCompetitionHint(note?: string | null, season?: number | null): string | null {
  if (!note) return null;
  const n = note.toLowerCase();

  // Cup / NM
  if (n.includes("nm") || n.includes("n.m.") || n.includes("norgesmesterskap") || n.includes("cup") || n.includes("cupen")) {
    return "nm";
  }

  // Friendly / tournament
  if (n.includes("jubileum") || n.includes("pokal") || n.includes("privat") || n.includes("treningskamp")) {
    return "treningskamp";
  }

  // Historical division names based on season year:
  const year = season ?? null;

  if (n.includes("3. div") || n.includes("3.div") || n.includes("3. divisjon") || n.includes("3. division")) {
    return "andredivisjon";
  }

  if (n.includes("2. div") || n.includes("2.div") || n.includes("2. divisjon") || n.includes("2. division")) {
    if (year !== null && year < 1963) {
      return "andredivisjon";
    }
    return "forstedivisjon";
  }

  if (n.includes("1. div") || n.includes("1.div") || n.includes("1. divisjon") || n.includes("1. division") || n.includes("landsdelsserie")) {
    if (year !== null && year >= 1963 && year <= 1990) {
      return "eliteserien";
    }
    return "forstedivisjon";
  }

  return null;
}

export function parseHomeAwayHint(note?: string | null, opponent?: string | null): "home" | "away" | null {
  if (note) {
    const n = note.toLowerCase();
    if (n.includes("hjemmekamp") || n.includes("hjemme") || n.includes("(h)") || n.includes("på nørve") || n.includes("på aksla") || n.includes("i ålesund")) {
      return "home";
    }
    if (n.includes("bortekamp") || n.includes("borte") || n.includes("(b)") || n.includes("i trondheim") || n.includes("i oslo") || n.includes("i fosnavåg") || n.includes("i mo i rana") || n.includes("på veblungsnes") || n.includes("på straumgjerde") || n.includes("på vigra")) {
      return "away";
    }
  }
  if (opponent && opponent.includes("*")) {
    return "away";
  }
  return null;
}

