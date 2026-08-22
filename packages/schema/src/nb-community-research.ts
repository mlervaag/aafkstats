import { z } from "zod";
import { isoDate, slug } from "./primitives.js";

export const nbResearchCategory = z.enum([
  "sibling_resolution",
  "date_research",
  "score_conflict",
  "competition_conflict",
  "source_reconciliation",
]);

export const nbResearchSourceResult = z.object({
  sourceClaimId: z.string().regex(/^srcclaim-[a-f0-9]{32}$/).optional(),
  sourceId: slug,
  year: z.number().int().min(1900).max(2100),
  no: z.number().int().positive(),
  opponent: z.string().min(1).max(120),
  expectedScore: z.object({ aafk: z.number().int().nonnegative(), opponent: z.number().int().nonnegative() }).strict(),
  homeAway: z.enum(["home", "away", "neutral", "unknown"]).optional(),
  competition: z.string().min(1).max(120).optional(),
  label: z.string().min(1).max(220),
}).strict();

export const nbActualVisualSource = z.object({
  title: z.string().min(1).max(120),
  issueDate: isoDate,
  printedPage: z.string().min(1).max(40),
  viewerPage: z.string().min(1).max(40),
  pageUrl: z.string().url().refine((url) => /^https:\/\/www\.nb\.no\//i.test(url), "avislenken må peke til nb.no"),
}).strict();

export const nbObservedEvent = z.object({
  opponent: z.string().min(1).max(120).optional(),
  matchDate: isoDate.optional(),
  homeAway: z.enum(["home", "away", "neutral", "unknown"]).optional(),
  score: z.object({ aafk: z.number().int().nonnegative(), opponent: z.number().int().nonnegative() }).strict().optional(),
  competition: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(700),
}).strict();

export const nbCommunityResearchTask = z.object({
  contract: z.literal("nb-community-research-task@1"),
  hypothesisId: z.string().min(1).max(220),
  season: z.number().int().min(1900).max(2100),
  category: nbResearchCategory,
  sourceResults: z.array(nbResearchSourceResult).min(1).max(30),
  observedEvent: nbObservedEvent,
  actualVisualSource: nbActualVisualSource,
  candidateOptions: z.array(nbResearchSourceResult).max(30),
  expectedAnswerShape: z.array(z.string().min(1).max(80)).min(2).max(12),
}).strict();

export const nbCommunityResearchItem = z.object({
  id: slug,
  hypothesisId: z.string().min(1).max(220),
  season: z.number().int().min(1900).max(2100),
  category: nbResearchCategory,
  status: z.enum(["draft", "open"]),
  question: z.string().min(1).max(220),
  context: z.string().min(1).max(900),
  whyItMatters: z.string().min(1).max(500),
  sourceResults: z.array(nbResearchSourceResult).min(1).max(30),
  observedEvent: nbObservedEvent,
  actualVisualSource: nbActualVisualSource,
  candidateOptions: z.array(nbResearchSourceResult).max(30),
  instructions: z.array(z.string().min(1).max(500)).min(1).max(6),
  expectedAnswerShape: z.array(z.string().min(1).max(80)).min(2).max(12),
  priority: z.number().int().min(0).max(100),
  published: z.boolean(),
  publishedAt: isoDate.optional(),
  resolution: z.null(),
}).strict().superRefine((item, ctx) => {
  if (item.published && (!item.publishedAt || item.status !== "open")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishedAt"], message: "publiserte saker må være åpne og ha publiseringsdato" });
  }
});

export const nbCommunityResearchManifest = z.object({
  contract: z.literal("nb-community-research-wave@1"),
  generatedFrom: z.object({
    canonicalizationManifest: z.literal("data/discovery/nb-source-result-canonicalization-1945-1984.yaml"),
    visualReviewManifest: z.literal("data/discovery/nb-source-result-visual-review-1945-1984.yaml"),
  }).strict(),
  generatedAt: isoDate,
  summary: z.object({
    sibling_resolution: z.number().int().nonnegative(),
    date_research: z.number().int().nonnegative(),
    score_conflict: z.number().int().nonnegative(),
    competition_conflict: z.number().int().nonnegative(),
    source_reconciliation: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }).strict(),
  items: z.array(nbCommunityResearchItem),
}).strict().superRefine((manifest, ctx) => {
  const ids = new Set<string>();
  for (const [index, item] of manifest.items.entries()) {
    if (ids.has(item.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items", index, "id"], message: "duplikat research-ID" });
    ids.add(item.id);
  }
  if (manifest.summary.total !== manifest.items.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["summary", "total"], message: "total må stemme med antall saker" });
  }
});

export const nbCommunityResearchSubmission = z.object({
  verificationSubmissionVersion: z.literal(2),
  category: nbResearchCategory,
  answer: z.string().min(1).max(80),
  selectedSourceResult: z.object({ sourceId: slug, no: z.number().int().positive() }).strict().optional(),
  structuredFindings: z.object({
    date: isoDate.optional(),
    period: z.string().trim().min(1).max(120).optional(),
    homeAway: z.enum(["home", "away", "neutral", "unknown"]).optional(),
    competition: z.string().trim().min(1).max(120).optional(),
    score: z.object({ aafk: z.number().int().nonnegative(), opponent: z.number().int().nonnegative() }).strict().optional(),
  }).strict().optional(),
  evidenceNote: z.string().trim().max(1500).optional(),
}).strict();

export type NbResearchCategory = z.infer<typeof nbResearchCategory>;
export type NbResearchSourceResult = z.infer<typeof nbResearchSourceResult>;
export type NbCommunityResearchTask = z.infer<typeof nbCommunityResearchTask>;
export type NbCommunityResearchItem = z.infer<typeof nbCommunityResearchItem>;
export type NbCommunityResearchManifest = z.infer<typeof nbCommunityResearchManifest>;
export type NbCommunityResearchSubmission = z.infer<typeof nbCommunityResearchSubmission>;
