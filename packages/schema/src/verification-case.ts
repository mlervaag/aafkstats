import { createHash } from "node:crypto";
import { z } from "zod";
import { isoDate, slug } from "./primitives.js";

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

export const verificationCaseInput = z
  .object({
    id: slug,
    status: z.enum(["draft", "open", "paused", "resolved", "rejected", "superseded"]),
    category: z.enum(["role", "identity", "match", "source_reading", "club"]),
    claim: z.string().min(1).max(220),
    question: z.string().min(1).max(220),
    context: z.string().min(1).max(900),
    whyItMatters: z.string().min(1).max(500),
    yesMeaning: z.string().min(1).max(500),
    noMeaning: z.string().min(1).max(500),
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
  });

export type VerificationCaseInput = z.infer<typeof verificationCaseInput>;
export type VerificationSource = z.infer<typeof verificationSource>;
export type VerificationAnswer = "yes" | "no";
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
