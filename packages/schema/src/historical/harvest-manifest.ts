import { z } from "zod";
import { isoDate, slug } from "../primitives.js";
import { harvestProfileEnum } from "./source-profile.js";
import { harvestFindingSchema, harvestUnresolvedSchema } from "./harvest-finding.js";

/**
 * Modus for en innhøstingsbatch.
 * - initial: Første systematiske review av materialet.
 * - reharvest: Kilden er tidligere behandlet, men gjennomgås på nytt etter gjeldende runbook. Eksisterende data bevares og berikes.
 * - supplement: Nytt materiale eller funn kompletterer en tidligere batch.
 */
export const harvestBatchModeEnum = z.enum(["initial", "reharvest", "supplement"]);
export type HarvestBatchMode = z.infer<typeof harvestBatchModeEnum>;

/**
 * Livssyklusstatus for en innhøstingsbatch.
 * - discovered: Batch opprettet og identifisert.
 * - preflighted: Source Inventory etablert og preflight utført.
 * - reviewing: Visuell sidegjennomgang og faksimilekontroll pågår.
 * - normalized: Alle funn har fått disposition og relevante targets er opprettet.
 * - audited: Cross-layer audit og bevaringssjekker passerer.
 * - complete: Alle steg, kilder, sider, funn og invariants er 100% fullført og verifisert.
 * - blocked: Arbeidet er midlertidig stoppet på grunn av kildemangler eller uløste blokkeringer.
 */
export const harvestBatchStatusEnum = z.enum([
  "discovered",
  "preflighted",
  "reviewing",
  "normalized",
  "audited",
  "complete",
  "blocked",
]);
export type HarvestBatchStatus = z.infer<typeof harvestBatchStatusEnum>;

/**
 * Det definerte omfanget for en innhøstingsbatch.
 */
export const harvestScopeSchema = z
  .object({
    years: z
      .object({
        from: z.number().int().min(1800).max(2100).optional(),
        to: z.number().int().min(1800).max(2100).optional(),
      })
      .strict()
      .optional(),
    sourceIds: z.array(slug).default([]),
    parentSourceId: slug.optional(),
  })
  .strict();

export type HarvestScope = z.infer<typeof harvestScopeSchema>;

/**
 * Frosset kildeinventar for batchen.
 */
export const harvestSourceInventoryItemSchema = z
  .object({
    sourceId: slug,
    title: z.string().optional(),
    year: z.number().int().optional(),
    reviewStatus: z.enum([
      "reviewed",
      "duplicate_or_reprint",
      "unavailable",
      "out_of_scope",
      "unknown",
    ]),
    duplicateOf: slug.optional(),
    reason: z.string().optional(),
  })
  .strict();

export type HarvestSourceInventoryItem = z.infer<typeof harvestSourceInventoryItemSchema>;

/**
 * Dekningsmodell for side- eller seksjonsvisuell kontroll.
 */
export const harvestCoverageSchema = z
  .object({
    mode: z.enum(["pages", "sections"]).default("pages"),
    expected: z.number().int().min(0),
    reviewed: z.number().int().min(0),
  })
  .strict();

export type HarvestCoverage = z.infer<typeof harvestCoverageSchema>;

/**
 * Status for en spesifikk innhøstingspass (f.eks. personer, organisasjon, terminlister).
 */
export const harvestPassStatusEnum = z.enum(["pending", "in_progress", "complete", "reviewed", "skipped"]);
export type HarvestPassStatus = z.infer<typeof harvestPassStatusEnum>;

export const harvestPassSchema = z
  .object({
    status: harvestPassStatusEnum.default("pending"),
    findings: z.number().int().min(0).default(0),
    note: z.string().optional(),
  })
  .strict();

export type HarvestPass = z.infer<typeof harvestPassSchema>;

/**
 * Tidligere arbeid som danner grunnlag for en re-harvest eller supplement.
 */
export const harvestPreviousWorkSchema = z
  .object({
    pullRequests: z.array(z.number().int().positive()).default([]),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type HarvestPreviousWork = z.infer<typeof harvestPreviousWorkSchema>;

/**
 * Autoritativt Zod-skjema for Harvest Batch Manifest (data/harvests/<batch-id>.yaml).
 */
export const harvestBatchManifest = z
  .object({
    version: z.literal(1).default(1),
    id: slug,
    title: z.string().min(1),
    profile: harvestProfileEnum,
    mode: harvestBatchModeEnum.default("initial"),
    status: harvestBatchStatusEnum.default("discovered"),
    scope: harvestScopeSchema.default({ sourceIds: [] }),
    sourceInventory: z.array(harvestSourceInventoryItemSchema).default([]),
    coverage: harvestCoverageSchema.optional(),
    passes: z.record(harvestPassSchema).default({}),
    reviewMethod: z
      .object({
        facsimile: z.enum(["required", "unavailable"]).default("required"),
        reason: z.string().optional(),
      })
      .strict()
      .refine(
        (val) => {
          if (val.facsimile === "unavailable") {
            return typeof val.reason === "string" && val.reason.trim().length > 0;
          }
          return true;
        },
        {
          message: "Når reviewMethod.facsimile er «unavailable», må en eksplisitt og ikke-tom «reason» oppgis.",
          path: ["reason"],
        },
      )
      .optional(),
    review: z
      .object({
        file: z.string().optional(),
      })
      .strict()
      .optional(),
    findings: z.array(harvestFindingSchema).default([]),
    unresolved: z.array(harvestUnresolvedSchema).default([]),
    previousWork: harvestPreviousWorkSchema.optional(),
    baseRevision: z.string().optional(),
    createdAt: isoDate.optional(),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type HarvestBatchManifest = z.infer<typeof harvestBatchManifest>;

/**
 * Filsti for et batchmanifest: `data/harvests/<id>.yaml`.
 */
export function harvestManifestPath(id: string): string {
  return `harvests/${id}.yaml`;
}
