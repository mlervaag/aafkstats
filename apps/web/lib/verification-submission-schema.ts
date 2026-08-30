import { nbCommunityResearchSubmission } from "@aafkstats/schema";
import { z } from "zod4";

export const verificationEvidenceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("listed_source"),
    sourceKey: z.string().min(1).max(240),
    reference: z.string().max(500).optional(),
  }).strict(),
  z.object({
    kind: z.literal("new_url"),
    url: z.url("Skriv inn en gyldig lenke.").max(500)
      .refine((url) => /^https?:\/\//i.test(url), "Lenken må starte med http:// eller https://."),
    reference: z.string().max(500).optional(),
  }).strict(),
  z.object({
    kind: z.literal("bibliographic"),
    reference: z.string().min(3, "Oppgi publikasjon, dato og side.").max(500),
  }).strict(),
]);

/**
 * Zod 4-speil for MCP-SDK-en, kontrollert mot det kanoniske Zod 3-skjemaet.
 * `passthrough` gjør at nye kanoniske felt ikke blir strippet på MCP-veien før
 * speilet er oppdatert; superRefine sørger for at bare den delte kontrakten
 * faktisk godtas.
 */
export const researchSubmissionSchema = z.object({
  verificationSubmissionVersion: z.literal(2),
  category: z.enum(["sibling_resolution", "date_research", "score_conflict", "competition_conflict", "source_reconciliation"]),
  answer: z.string().min(1).max(80),
  selectedSourceResult: z.object({
    sourceId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    no: z.number().int().positive(),
  }).strict().optional(),
  structuredFindings: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period: z.string().trim().min(1).max(120).optional(),
    homeAway: z.enum(["home", "away", "neutral", "unknown"]).optional(),
    competition: z.string().trim().min(1).max(120).optional(),
    score: z.object({
      aafk: z.number().int().nonnegative(),
      opponent: z.number().int().nonnegative(),
    }).strict().optional(),
  }).strict().optional(),
  evidenceNote: z.string().trim().max(1500).optional(),
}).passthrough().superRefine((value, ctx) => {
  const parsed = nbCommunityResearchSubmission.safeParse(value);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
});

export const verificationSubmissionSchema = z.object({
  caseId: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  revision: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  answer: z.enum(["yes", "no", "inconclusive"]),
  evidence: verificationEvidenceSchema,
  finding: z.string().trim().max(1500),
  communityFinding: z.object({
    scoreAgreement: z.enum(["yes", "no", "uncertain"]).optional(),
    matchDate: z.iso.date().optional(),
    dateReadable: z.enum(["yes", "no", "uncertain"]).optional(),
    homeAway: z.enum(["home", "away", "neutral", "uncertain"]).optional(),
    competition: z.string().trim().max(120).optional(),
    reasons: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  }).strict().optional(),
  researchSubmission: researchSubmissionSchema.optional(),
  comment: z.string().trim().max(1000).optional(),
  contributor: z.string().trim().max(100).optional(),
  clientSubmissionId: z.uuid(),
  company: z.string().max(0).optional(),
}).strict();

/** MCP har bare den smale researchinngangen, utledet fra browserkontrakten. */
export const mcpResearchFindingSchema = verificationSubmissionSchema.omit({
  communityFinding: true,
  company: true,
});
