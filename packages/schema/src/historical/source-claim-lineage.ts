import { z } from "zod";
import { seasonYear, slug } from "../primitives.js";

export const sourceCoordinate = z.object({
  sourceId: slug,
  season: seasonYear,
  no: z.number().int().min(1),
  hypothesisId: z.string().optional(),
});

export type SourceCoordinate = z.infer<typeof sourceCoordinate>;

export const coordinateHistoryEntry = z.object({
  season: seasonYear,
  no: z.number().int().min(1),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  supersededBy: z
    .object({
      reason: z.string(),
      pr: z.number().int().optional(),
    })
    .optional(),
});

export type CoordinateHistoryEntry = z.infer<typeof coordinateHistoryEntry>;

export const sourceClaimLineageItem = z.object({
  claimId: z.string().regex(/^srcclaim-[a-f0-9]{32}$/),
  sourceId: slug,
  currentCoordinate: z.object({
    season: seasonYear,
    no: z.number().int().min(1),
    hypothesisId: z.string().optional(),
  }),
  coordinateHistory: z.array(coordinateHistoryEntry).default([]),
  legacyHypothesisIds: z.array(z.string()).default([]),
});

export type SourceClaimLineageItem = z.infer<typeof sourceClaimLineageItem>;

export const sourceClaimLineageManifest = z
  .object({
    contract: z.literal("source-claim-lineage@1"),
    generatedAt: z.string().optional(),
    claims: z.array(sourceClaimLineageItem),
  })
  .superRefine((val, ctx) => {
    const claimIds = new Set<string>();
    const currentCoords = new Set<string>();
    const oldCoords = new Map<string, string>();

    for (const [idx, item] of val.claims.entries()) {
      if (claimIds.has(item.claimId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["claims", idx, "claimId"],
          message: `Duplikat claimId «${item.claimId}» i lineage-manifest`,
        });
      }
      claimIds.add(item.claimId);

      const currentKey = `${item.sourceId}:${item.currentCoordinate.season}:${item.currentCoordinate.no}`;
      if (currentCoords.has(currentKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["claims", idx, "currentCoordinate"],
          message: `Duplikat currentCoordinate «${currentKey}» i lineage-manifest`,
        });
      }
      currentCoords.add(currentKey);

      for (const [hIdx, hist] of item.coordinateHistory.entries()) {
        const oldKey = `${item.sourceId}:${hist.season}:${hist.no}`;
        if (oldKey === currentKey) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["claims", idx, "coordinateHistory", hIdx],
            message: `Lineage-syklus funnet: koordinaten «${oldKey}» kan ikke være både historisk og nåværende koordinat samtidig`,
          });
        }
        if (oldCoords.has(oldKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["claims", idx, "coordinateHistory", hIdx],
            message: `Tvetydig koordinathistorikk: gammel koordinat «${oldKey}» peker til både «${oldCoords.get(oldKey)}» og «${item.claimId}»`,
          });
        }
        oldCoords.set(oldKey, item.claimId);
      }
    }
  });

export type SourceClaimLineageManifest = z.infer<typeof sourceClaimLineageManifest>;
