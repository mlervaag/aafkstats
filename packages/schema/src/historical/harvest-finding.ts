import { z } from "zod";
import { isoDate, slug } from "../primitives.js";

/**
 * Autoritativt, sentralisert disposisjonsvokabular for all historisk innhøsting.
 */
export const historicalDispositionEnum = z.enum([
  // Kamp- og resultatdisposisjoner
  "source_result_created",
  "canonical_created",
  "canonical_enriched",
  "fixture_only",
  "outcome_only",
  "result_without_date",
  "date_without_result",
  "already_documented",
  "duplicate_publication",
  "reprint",
  "identity_uncertain",
  "not_a_team",
  "no_structured_action",

  // Person- og rolledisposisjoner
  "person_created",
  "person_enriched",
  "role_created",
  "role_enriched",
  // Overganger er hendelser med retning og motpart, ikke perioder i et verv.
  // Ført som role_created ville kilden si noe annet enn den gjorde.
  "transfer_created",
  "honor_created",
  "honor_enriched",
  "honorary_role_created",
  "milestone_created",
  "mention_linked",
  "observation_created",
  "historical_observation_created",
  "organization_snapshot_created",
  "conflict_registered",
  "conflict_resolved",
  "verified_correct",
  "non_senior",

  // Prosess- og inventarstatuser
  "reviewed",
  "in_scope",
  "out_of_scope",
  "unavailable",
  "source_unavailable",
  "duplicate_or_reprint",
  "duplicate",
]);

export type HistoricalDisposition = z.infer<typeof historicalDispositionEnum>;

/**
 * Disposisjoner som KREVER minst ett gyldig target i arkivet.
 */
export const TARGET_REQUIRED_DISPOSITIONS = new Set<HistoricalDisposition>([
  "person_created",
  "person_enriched",
  "role_created",
  "role_enriched",
  // Overganger er hendelser med retning og motpart, ikke perioder i et verv.
  // Ført som role_created ville kilden si noe annet enn den gjorde.
  "transfer_created",
  "honor_created",
  "honor_enriched",
  "honorary_role_created",
  "source_result_created",
  "canonical_created",
  "canonical_enriched",
  "observation_created",
  "historical_observation_created",
  "organization_snapshot_created",
  "conflict_registered",
  "conflict_resolved",
]);

/**
 * Disposisjoner som lovlig kan ha null targets (f.eks. usikker identitet, junior/B-lag, reprints, ingen handling).
 */
export const ZERO_TARGET_DISPOSITIONS = new Set<HistoricalDisposition>([
  "identity_uncertain",
  "non_senior",
  "not_a_team",
  "out_of_scope",
  "no_structured_action",
  "duplicate_publication",
  "reprint",
  "already_documented",
  "verified_correct",
  "fixture_only",
  "outcome_only",
  "result_without_date",
  "date_without_result",
  "mention_linked",
  "milestone_created",
  "reviewed",
  "in_scope",
  "unavailable",
  "source_unavailable",
  "duplicate_or_reprint",
  "duplicate",
]);

/**
 * Tillatte funnkategorier som dekker all historisk observasjon.
 */
export const harvestFindingTypeEnum = z.enum([
  "match_result",
  "fixture",
  "season_fact",
  "table",
  "person",
  "person_role",
  "transfer",
  "honor",
  "organization",
  "meeting",
  "historical_observation",
  "venue",
  "milestone",
  "retrospective_claim",
  "source_conflict",
  "identity_candidate",
  "non_senior",
  "other",
]);

export type HarvestFindingType = z.infer<typeof harvestFindingTypeEnum>;

/**
 * Entitetstyper som kan adresseres av targets.
 */
export const harvestTargetEntityEnum = z.enum([
  "person",
  "match",
  "source_result",
  "organization_snapshot",
  "observation",
  "source",
  "competition",
  "venue",
]);

export type HarvestTargetEntity = z.infer<typeof harvestTargetEntityEnum>;

/**
 * Måladresse for en normalisert handling.
 */
export const harvestTargetSchema = z
  .object({
    entity: harvestTargetEntityEnum,
    id: z.string().min(1),
    path: z.string().optional(),
  })
  .strict();

export type HarvestTarget = z.infer<typeof harvestTargetSchema>;

/**
 * Kildeangivelse for et funn.
 */
export const harvestFindingSourceSchema = z
  .object({
    sourceId: slug,
    page: z.union([z.number().int().min(1), z.string().min(1)]).nullable().optional(),
  })
  .strict();

export type HarvestFindingSource = z.infer<typeof harvestFindingSourceSchema>;

/**
 * Tillatt tillitsgrad i kildeavlesning/claim.
 */
export const harvestConfidenceEnum = z.enum(["certain", "probable", "uncertain"]);
export type HarvestConfidence = z.infer<typeof harvestConfidenceEnum>;

/**
 * Behandlingsstatus for et funn innen en batch.
 */
export const harvestFindingStatusEnum = z.enum(["observed", "reviewed", "normalized", "unresolved"]);
export type HarvestFindingStatus = z.infer<typeof harvestFindingStatusEnum>;

/**
 * Maskinlesbart review-funn (Source Claim).
 */
export const harvestFindingSchema = z
  .object({
    id: z.string().min(1),
    source: harvestFindingSourceSchema.optional(),
    sources: z.array(harvestFindingSourceSchema).default([]),
    type: harvestFindingTypeEnum,
    subject: z
      .object({
        text: z.string().optional(),
        id: slug.optional(),
      })
      .strict()
      .optional(),
    claim: z
      .object({
        text: z.string().min(1),
        details: z.record(z.any()).optional(),
      })
      .strict(),
    confidence: harvestConfidenceEnum.default("certain"),
    disposition: historicalDispositionEnum,
    targets: z.array(harvestTargetSchema).default([]),
    status: harvestFindingStatusEnum.default("observed"),
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.source && val.sources.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source"],
        message: "Et funn må ha minst én kildeangivelse (source eller sources)",
      });
    }
  });

export type HarvestFinding = z.infer<typeof harvestFindingSchema>;

/**
 * Strukturert oppføring i batch-manifestets unresolved-kø.
 */
export const harvestUnresolvedSchema = z
  .object({
    findingId: z.string().min(1),
    type: z.string().min(1),
    note: z.string().min(1),
    resolvedAt: isoDate.optional(),
    resolutionNote: z.string().optional(),
  })
  .strict();

export type HarvestUnresolved = z.infer<typeof harvestUnresolvedSchema>;
