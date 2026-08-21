import { z } from "zod";
import { flattenSourceResults } from "./source-result.js";
import { verificationCaseInput, type VerificationCase, type VerificationCaseInput } from "./verification-case.js";
import type { Archive } from "./load.js";

export const NEWSPAPER_VERIFICATION_PAYLOAD_MARKER = "<!-- newspaper-verification-payload:v1 -->";

const sourceResultPayload = z.object({
  sourceId: z.string().min(1),
  year: z.number().int(),
  no: z.number().int().positive(),
  opponent: z.string().min(1),
  expectedScore: z.object({ aafk: z.number().int().nonnegative(), opponent: z.number().int().nonnegative() }).strict(),
  homeAway: z.enum(["home", "away", "neutral", "unknown"]).optional(),
  competition: z.string().min(1).optional(),
}).strict();

export const newspaperVerificationIssuePayload = z.object({
  verificationCaseId: z.string().min(1).regex(/^[a-z0-9-]+$/),
  revision: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  answer: z.enum(["yes", "no", "inconclusive"]),
  candidate: z.object({ candidateId: z.string().min(1).regex(/^[a-z0-9-]+$/) }).strict(),
  sourceResult: sourceResultPayload,
  hypothesis: z.object({
    id: z.string().min(1),
    discoveryStatus: z.enum(["confirmed", "probable", "ambiguous", "conflict", "not_found"]),
    matchDate: z.string().date().optional(),
  }).strict(),
  newspaper: z.object({
    title: z.string().min(1),
    issueDate: z.string().date(),
    page: z.string().min(1),
    pageUrl: z.string().url(),
  }).strict(),
  communityFinding: z.object({
    answer: z.enum(["yes", "no", "inconclusive"]),
    scoreConfirmed: z.boolean().optional(),
    matchDate: z.string().date().optional(),
    homeAway: z.enum(["home", "away", "neutral", "uncertain"]).optional(),
    competition: z.string().min(1).max(120).optional(),
    reason: z.string().max(1000).optional(),
    comment: z.string().max(1500).optional(),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  if (value.answer !== value.communityFinding.answer) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["communityFinding", "answer"], message: "svaret må være likt i toppnivå og communityFinding" });
  }
});

export type NewspaperVerificationIssuePayload = z.infer<typeof newspaperVerificationIssuePayload>;

export function formatNewspaperVerificationIssuePayload(payload: NewspaperVerificationIssuePayload): string {
  const parsed = newspaperVerificationIssuePayload.parse(payload);
  return [NEWSPAPER_VERIFICATION_PAYLOAD_MARKER, "```json", JSON.stringify(parsed, null, 2), "```"].join("\n");
}

export function parseNewspaperVerificationIssue(body: string): NewspaperVerificationIssuePayload {
  const marker = body.indexOf(NEWSPAPER_VERIFICATION_PAYLOAD_MARKER);
  if (marker < 0) throw new Error("GitHub-saken mangler newspaper-verification-payload:v1.");
  const payloadBody = body.slice(marker + NEWSPAPER_VERIFICATION_PAYLOAD_MARKER.length);
  const fenceStart = payloadBody.indexOf("```json");
  const jsonStart = fenceStart < 0 ? -1 : fenceStart + "```json".length;
  const fenceEnd = jsonStart < 0 ? -1 : payloadBody.indexOf("```", jsonStart);
  const json = jsonStart < 0 || fenceEnd < 0 ? "" : payloadBody.slice(jsonStart, fenceEnd).trim();
  if (!json) throw new Error("GitHub-saken mangler maskinlesbar JSON etter payload-markøren.");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Payloaden i GitHub-saken er ikke gyldig JSON.");
  }
  return newspaperVerificationIssuePayload.parse(raw);
}

export type NewspaperEditorialDisposition = "reviewed_yes" | "reviewed_no" | "reviewed_inconclusive";

export interface NewspaperEditorialPreparation {
  disposition: NewspaperEditorialDisposition;
  canonicalAction: "editorial_candidate" | "none";
  canonicalBlockers: string[];
  verificationCase: VerificationCaseInput;
  sourceResult: { id: string; matchId: string | null; opponentClubId: string | null; competitionId: string | null };
  matchingCanonicalMatchIds: string[];
  existingObservationIds: string[];
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function manualResolutionCase(item: VerificationCase, payload: NewspaperVerificationIssuePayload, issueUrl: string, resolvedAt: string): VerificationCaseInput {
  const { revision: _revision, file: _file, ...input } = item;
  const answerLabel = payload.answer === "yes" ? "JA" : payload.answer === "no" ? "NEI" : "KAN IKKE BESTEMMES";
  const detail = payload.communityFinding.reason || payload.communityFinding.comment;
  return verificationCaseInput.parse({
    ...input,
    status: "resolved",
    resolution: {
      answer: payload.answer,
      reason: detail ? `${answerLabel}: ${detail}` : `${answerLabel}: Kandidatsiden er redaksjonelt behandlet.`,
      resolvedAt,
      issueUrl,
    },
  });
}

export function prepareNewspaperVerificationReview(
  payload: NewspaperVerificationIssuePayload,
  archive: Archive,
  options: { issueUrl: string; resolvedAt: string },
): NewspaperEditorialPreparation {
  const item = archive.verificationCases.find((entry) => entry.id === payload.verificationCaseId);
  if (!item?.newspaper) throw new Error(`Fant ikke en avisverifisering med ID ${payload.verificationCaseId}.`);
  if (item.status !== "open") throw new Error(`Verifiseringssaken er ${item.status}, ikke open.`);
  if (item.revision !== payload.revision) throw new Error("STALE_REVISION: Saken er endret etter community-svaret.");
  if (
    item.newspaper.candidateId !== payload.candidate.candidateId
    || !sameJson(item.newspaper.sourceResult, payload.sourceResult)
    || !sameJson(item.newspaper.hypothesis, payload.hypothesis)
    || !sameJson(item.newspaper.newspaper, payload.newspaper)
  ) throw new Error("Issue-payloaden stemmer ikke med dagens verification-case.");

  const collection = archive.sourceResults.find((entry) => entry.sourceId === payload.sourceResult.sourceId);
  const sourceResult = collection
    ? flattenSourceResults(collection).find((entry) => entry.season === payload.sourceResult.year && entry.id.endsWith(`-${String(payload.sourceResult.no).padStart(3, "0")}`))
    : undefined;
  if (!sourceResult) throw new Error("Fant ikke source-resultet som issue-payloaden peker på.");
  if (
    sourceResult.opponent !== payload.sourceResult.opponent
    || sourceResult.aafkGoals !== payload.sourceResult.expectedScore.aafk
    || sourceResult.opponentGoals !== payload.sourceResult.expectedScore.opponent
  ) throw new Error("Source-result-claimet er endret etter community-svaret.");

  const blockers: string[] = [];
  if (payload.answer === "yes") {
    if (sourceResult.matchId) blockers.push("source-resultet er allerede koblet til en kamp");
    if (payload.communityFinding.scoreConfirmed !== true) blockers.push("sluttresultatet er ikke uttrykkelig bekreftet");
    if (!payload.communityFinding.matchDate) blockers.push("eksakt kampdato mangler");
    if (!payload.communityFinding.homeAway || payload.communityFinding.homeAway === "uncertain") blockers.push("hjemme/borte er ikke sikkert");
    if (!sourceResult.opponentClubId) blockers.push("motstanderklubben er ikke sikkert normalisert");
    if (!sourceResult.competitionId) blockers.push("konkurransen er ikke sikkert normalisert");
  }

  const matchingCanonicalMatchIds = payload.communityFinding.matchDate && sourceResult.opponentClubId
    ? archive.matches.filter((match) => match.date === payload.communityFinding.matchDate
      && [match.home.clubId, match.away.clubId].includes("aalesunds-fk")
      && [match.home.clubId, match.away.clubId].includes(sourceResult.opponentClubId!)).map((match) => match.id)
    : [];
  const existingObservationIds = archive.observations
    .filter((observation) => observation.providerId === "nasjonalbiblioteket" && (
      observation.externalId === payload.candidate.candidateId || observation.raw.pageUrl === payload.newspaper.pageUrl
    )).map((observation) => observation.externalId);

  return {
    disposition: payload.answer === "yes" ? "reviewed_yes" : payload.answer === "no" ? "reviewed_no" : "reviewed_inconclusive",
    canonicalAction: payload.answer === "yes" && blockers.length === 0 ? "editorial_candidate" : "none",
    canonicalBlockers: blockers,
    verificationCase: manualResolutionCase(item, payload, options.issueUrl, options.resolvedAt),
    sourceResult: { id: sourceResult.id, matchId: sourceResult.matchId, opponentClubId: sourceResult.opponentClubId, competitionId: sourceResult.competitionId },
    matchingCanonicalMatchIds,
    existingObservationIds,
  };
}
