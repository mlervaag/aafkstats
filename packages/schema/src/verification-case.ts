import { createHash } from "node:crypto";
import { z } from "zod";
import { isoDate, slug } from "./primitives.js";
import { nbCommunityResearchTask } from "./nb-community-research.js";

const verificationSource = z
  .object({
    sourceId: slug.optional(),
    providerId: slug.optional(),
    page: z.string().min(1).optional(),
    role: z.enum(["supports", "contradicts", "context", "independent_wanted"]),
    note: z.string().min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.sourceId && !value.providerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceId"],
        message: "kilden må ha sourceId eller providerId",
      });
    }
    if (value.sourceId && value.providerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["providerId"],
        message: "bruk enten sourceId eller providerId, ikke begge",
      });
    }
  });

export const newspaperVerification = z.object({
  candidateId: slug,
  communityReviewable: z.literal(true),
  sourceResult: z.object({
    sourceClaimId: z.string().regex(/^srcclaim-[a-f0-9]{32}$/).optional(),
    sourceId: slug,
    year: z.number().int().min(1900).max(2100),
    no: z.number().int().positive(),
    opponent: z.string().min(1).max(120),
    expectedScore: z.object({
      aafk: z.number().int().nonnegative(),
      opponent: z.number().int().nonnegative(),
    }).strict(),
    homeAway: z.enum(["home", "away", "neutral", "unknown"]).optional(),
    competition: z.string().min(1).max(120).optional(),
  }).strict(),
  hypothesis: z.object({
    id: slug,
    discoveryStatus: z.enum(["confirmed", "probable", "ambiguous", "conflict", "not_found"]),
    matchDate: isoDate.optional(),
  }).strict(),
  newspaper: z.object({
    title: z.string().min(1).max(120),
    issueDate: isoDate,
    page: z.string().min(1).max(40),
    pageUrl: z.string().url().refine((url) => /^https:\/\/www\.nb\.no\//i.test(url), "avislenken må peke til nb.no"),
  }).strict(),
}).strict();

export const verificationCaseInput = z
  .object({
    id: slug,
    sourceClaimId: z.string().regex(/^srcclaim-[a-f0-9]{32}$/).optional(),
    status: z.enum(["draft", "open", "paused", "resolved", "rejected", "superseded"]),
    category: z.enum(["role", "identity", "match", "source_reading", "club"]),
    claim: z.string().min(1).max(220),
    question: z.string().min(1).max(220),
    context: z.string().min(1).max(900),
    whyItMatters: z.string().min(1).max(500),
    yesMeaning: z.string().min(1).max(500),
    noMeaning: z.string().min(1).max(500),
    inconclusiveMeaning: z.string().min(1).max(500).optional(),
    instructions: z.array(z.string().min(1).max(500)).min(1).max(6),
    target: z
      .object({
        type: z.enum(["person", "match", "season", "club", "source"]),
        id: slug,
        field: z.string().min(1).max(120),
      })
      .strict(),
    sources: z.array(verificationSource).max(10).default([]),
    searchHint: z.string().min(1).max(700).optional(),
    newspaper: newspaperVerification.optional(),
    researchTask: nbCommunityResearchTask.optional(),
    estimatedMinutes: z.number().int().min(1).max(60),
    priority: z.number().int().min(0).max(100),
    publishedAt: isoDate.optional(),
    resolution: z
      .object({
        answer: z.enum(["yes", "no", "inconclusive"]),
        reason: z.string().min(1),
        resolvedAt: isoDate,
        issueUrl: z.string().url().optional(),
        pullRequestUrl: z.string().url().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.question.trim().endsWith("?")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question"],
        message: "spørsmålet må ende med spørsmålstegn",
      });
    }
    if (value.sources.length === 0 && !value.searchHint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sources"],
        message: "saken må ha en kilde eller en konkret søkeinstruks",
      });
    }
    const resolved = value.status === "resolved" || value.status === "rejected";
    if (resolved !== (value.resolution !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resolution"],
        message: "løste og avviste saker må ha resolution; aktive saker skal ikke ha det",
      });
    }
    if (value.status === "open" && !value.publishedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishedAt"],
        message: "en åpen sak må ha publiseringsdato",
      });
    }
    if (value.newspaper) {
      if (value.category !== "match") ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category"], message: "avisverifisering må ha kategorien match" });
      if (value.target.type !== "source" || value.target.id !== value.newspaper.sourceResult.sourceId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "avisverifisering må peke på kilderesultatets kilde" });
      }
      if (value.estimatedMinutes < 2 || value.estimatedMinutes > 5) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["estimatedMinutes"], message: "avisverifisering skal ta 2–5 minutter" });
      }
    }
    if (value.researchTask) {
      if (value.category !== "match") ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category"], message: "avisresearch må ha kategorien match" });
      if (value.newspaper) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["researchTask"], message: "bruk enten vanlig avisverifisering eller research-oppgave" });
      if (value.target.type !== "source" || value.target.id !== value.researchTask.sourceResults[0]?.sourceId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "avisresearch må peke på første kildedokumenterte oppføring" });
      }
    }
  });

export type VerificationCaseInput = z.infer<typeof verificationCaseInput>;
export type VerificationSource = z.infer<typeof verificationSource>;
export type NewspaperVerification = z.infer<typeof newspaperVerification>;
export type VerificationAnswer = "yes" | "no" | "inconclusive";
export type VerificationStatus = VerificationCaseInput["status"];
export type VerificationCategory = VerificationCaseInput["category"];

export interface VerificationCase extends VerificationCaseInput {
  /** Innholdshash. Et svar på en gammel formulering må ikke gjelde en ny. */
  revision: `sha256:${string}`;
  file: string;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

export function verificationRevision(value: VerificationCaseInput): `sha256:${string}` {
  const digest = createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
  return `sha256:${digest}`;
}
