import { z } from "zod";
import { isoDate, slug } from "./primitives.js";

export const factCandidateKind = z.enum([
  "person_mention",
  "person_role",
  "match_result",
  "lineup_or_squad",
  "organization",
  "season_fact",
]);

export const factCandidate = z.object({
  id: slug,
  kind: factCandidateKind,
  page: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  keywords: z.array(z.string().min(1)).default([]),
  names: z.array(z.string().min(1)).default([]),
  years: z.array(z.number().int().min(1914).max(2100)).default([]),
  scores: z.array(z.string().regex(/^\d{1,2}-\d{1,2}$/)).default([]),
  personIds: z.array(slug).default([]),
  matchIds: z.array(z.string().min(1)).default([]),
}).strict();
export type FactCandidate = z.infer<typeof factCandidate>;

/**
 * Resultatet av én maskinell gjennomgang av én publikasjon.
 *
 * Rå OCR og sammenhengende prosa er uttrykkelig utelatt. Fila inneholder bare
 * proveniens, dekningsmål og korte faktatokens som må vurderes før de løftes inn
 * i kanoniske person-, sesong- eller kampfiler.
 */
export const publicationExtraction = z.object({
  sourceId: slug,
  providerId: slug,
  adapter: z.string().min(1),
  retrievedAt: isoDate,
  ocrAccess: z.enum(["alto", "search_only", "unavailable"]),
  pagesExpected: z.number().int().nonnegative(),
  pagesProcessed: z.number().int().nonnegative(),
  pagesFailed: z.array(z.string().min(1)).default([]),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  candidates: z.array(factCandidate).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.pagesProcessed + value.pagesFailed.length > value.pagesExpected) {
    ctx.addIssue({ code: "custom", path: ["pagesProcessed"], message: "behandlede og feilede sider overstiger forventet sidetall" });
  }
  const ids = new Set<string>();
  for (const [index, candidate] of value.candidates.entries()) {
    if (ids.has(candidate.id)) ctx.addIssue({ code: "custom", path: ["candidates", index, "id"], message: "duplikat kandidat-ID" });
    ids.add(candidate.id);
  }
});

export type PublicationExtraction = z.infer<typeof publicationExtraction>;
