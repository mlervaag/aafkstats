import { z } from "zod";
import { seasonYear, slug } from "./primitives.js";

/** Et kompakt, menneskelesbart resultat i én årsgruppe. */
const sourceResultEntry = z
  .object({
    no: z.number().int().min(1),
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
      page: result.page ?? season.page, opponent: result.opponent,
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
