import { createHash } from "node:crypto";
import { z } from "zod";
import { verificationCaseInput, type VerificationCaseInput } from "./verification-case.js";

const candidate = z.object({
  candidateId: z.string().min(1).regex(/^[a-z0-9-]+$/),
  communityReviewable: z.boolean(),
  visibility: z.enum(["community_reviewable", "discovery_only"]),
  publication: z.object({
    status: z.enum(["draft", "open"]).default("draft"),
    approvedAt: z.string().date().optional(),
  }).strict().default({ status: "draft" }),
  sourceResult: z.object({
    sourceId: z.string().min(1).regex(/^[a-z0-9-]+$/),
    year: z.number().int().min(1900).max(2100),
    no: z.number().int().positive(),
    opponent: z.string().min(1).max(120),
    expectedScore: z.object({ aafk: z.number().int().nonnegative(), opponent: z.number().int().nonnegative() }).strict(),
    homeAway: z.enum(["home", "away", "neutral", "unknown"]).optional(),
    competition: z.string().min(1).max(120).optional(),
  }).strict(),
  hypothesis: z.object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/),
    discoveryStatus: z.enum(["confirmed", "probable", "ambiguous", "conflict", "not_found"]),
    matchDate: z.string().date().optional(),
  }).strict(),
  newspaper: z.object({
    title: z.string().min(1).max(120),
    issueDate: z.string().date(),
    page: z.string().min(1).max(40),
    pageUrl: z.string().url().refine((url) => /^https:\/\/www\.nb\.no\//i.test(url), "avislenken må peke til nb.no"),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  if (value.publication.status === "open" && !value.publication.approvedAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publication", "approvedAt"], message: "åpne saker må være eksplisitt godkjent" });
  }
});

export const newspaperVerificationCandidateManifest = z.object({
  contract: z.literal("nb-newspaper-community-candidates@1"),
  candidates: z.array(candidate),
}).strict();

export type NewspaperVerificationCandidate = z.infer<typeof candidate>;

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

export function newspaperVerificationCaseId(value: NewspaperVerificationCandidate): string {
  const key = `${value.candidateId}|${value.sourceResult.sourceId}|${value.sourceResult.year}|${value.sourceResult.no}`;
  return `nb-avis-${value.sourceResult.year}-${value.sourceResult.no}-${shortHash(key)}`;
}

export interface NewspaperCandidateGeneration {
  cases: VerificationCaseInput[];
  skipped: { candidateId: string; reason: "not_reviewable" | "duplicate" | "manual_case_exists" }[];
}

export function generateNewspaperVerificationCases(
  raw: unknown,
  existing: Pick<VerificationCaseInput, "id" | "target">[] = [],
): NewspaperCandidateGeneration {
  const manifest = newspaperVerificationCandidateManifest.parse(raw);
  const seen = new Set<string>();
  const existingIds = new Set(existing.map((item) => item.id));
  const existingTargets = new Set(existing.map((item) => `${item.target.type}|${item.target.id}|${item.target.field}`));
  const cases: VerificationCaseInput[] = [];
  const skipped: NewspaperCandidateGeneration["skipped"] = [];

  for (const value of [...manifest.candidates].sort((a, b) => a.sourceResult.year - b.sourceResult.year || a.sourceResult.no - b.sourceResult.no || a.candidateId.localeCompare(b.candidateId))) {
    if (!value.communityReviewable || value.visibility === "discovery_only") {
      skipped.push({ candidateId: value.candidateId, reason: "not_reviewable" });
      continue;
    }
    const dedupeKey = `${value.candidateId}|${value.sourceResult.sourceId}|${value.sourceResult.year}|${value.sourceResult.no}`;
    if (seen.has(dedupeKey)) {
      skipped.push({ candidateId: value.candidateId, reason: "duplicate" });
      continue;
    }
    seen.add(dedupeKey);
    const id = newspaperVerificationCaseId(value);
    const target = {
      type: "source" as const,
      id: value.sourceResult.sourceId,
      field: `seasons.${value.sourceResult.year}.results.${value.sourceResult.no}.matchIdentity`,
    };
    const targetKey = `${target.type}|${target.id}|${target.field}`;
    if (existingIds.has(id) || existingTargets.has(targetKey)) {
      skipped.push({
        candidateId: value.candidateId,
        reason: existing.some((item) => item.id === id || `${item.target.type}|${item.target.id}|${item.target.field}` === targetKey)
          ? "manual_case_exists"
          : "duplicate",
      });
      continue;
    }
    const score = `${value.sourceResult.expectedScore.aafk}–${value.sourceResult.expectedScore.opponent}`;
    const generatedCase = verificationCaseInput.parse({
      id,
      status: value.publication.status,
      category: "match",
      claim: `Kilderesultatet oppgir AaFK–${value.sourceResult.opponent} ${score} i ${value.sourceResult.year}.`,
      question: `Dokumenterer denne avissiden AaFK–${value.sourceResult.opponent} ${score}?`,
      context: `Kontroller om avissiden beskriver akkurat denne kampen og sluttresultatet. Ikke bruk andre kampnotiser på samme side.`,
      whyItMatters: "Svaret hjelper redaksjonen å vurdere en NB-kandidat, men endrer aldri kampdata automatisk.",
      yesMeaning: "Siden dokumenterer samme lagpar og sluttresultat.",
      noMeaning: "Siden dokumenterer en annen kamp eller et annet sluttresultat.",
      inconclusiveMeaning: "Siden kan ikke leses sikkert nok til å avgjøre påstanden.",
      instructions: ["Åpne avissiden hos Nasjonalbiblioteket.", "Finn lagparet og sluttresultatet i samme kampomtale.", "Svar bare på spørsmålet over."],
      target,
      sources: [{ providerId: "nasjonalbiblioteket", page: value.newspaper.page, role: "context", note: `${value.newspaper.title} ${value.newspaper.issueDate}.` }],
      estimatedMinutes: 3,
      priority: 85,
      ...(value.publication.status === "open" ? { publishedAt: value.publication.approvedAt } : {}),
      newspaper: {
        candidateId: value.candidateId,
        communityReviewable: true,
        sourceResult: value.sourceResult,
        hypothesis: value.hypothesis,
        newspaper: value.newspaper,
      },
    });
    cases.push(generatedCase);
    existingIds.add(id);
    existingTargets.add(targetKey);
  }
  return { cases, skipped };
}
