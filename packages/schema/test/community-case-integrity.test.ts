import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditCommunityCases } from "../src/community-case-integrity.js";
import { generateNewspaperVerificationCases } from "../src/newspaper-verification-candidates.js";
import type { SourceResultCollection } from "../src/source-result.js";
import type { VerificationCase } from "../src/verification-case.js";

const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, "fixtures/newspaper-community-candidates.json"), "utf8")) as {
  contract: string;
  candidates: { candidateId: string; publication?: { status: string; approvedAt?: string } }[];
};

function publishAll(): { contract: string; candidates: unknown[] } {
  return {
    ...manifest,
    candidates: manifest.candidates.map((candidate) => ({
      ...candidate,
      communityReviewable: true,
      visibility: "community_reviewable",
      publication: { status: "open", approvedAt: "2026-08-24" },
    })),
  };
}

function asCases(input: ReturnType<typeof generateNewspaperVerificationCases>): VerificationCase[] {
  return input.cases.map((item) => ({ ...item, revision: "sha256:0", file: "discovery/test.yaml" })) as VerificationCase[];
}

function collectionFor(cases: VerificationCase[], overrides: Partial<Record<string, unknown>> = {}): SourceResultCollection[] {
  const bySource = new Map<string, SourceResultCollection>();
  for (const item of cases) {
    const snapshot = item.newspaper!.sourceResult;
    const collection = bySource.get(snapshot.sourceId) ?? { sourceId: snapshot.sourceId, scorePerspective: "aafk", seasons: [] } as unknown as SourceResultCollection;
    const season = collection.seasons.find((entry) => entry.year === snapshot.year)
      ?? { year: snapshot.year, results: [] } as unknown as SourceResultCollection["seasons"][number];
    if (!collection.seasons.includes(season)) collection.seasons.push(season);
    season.results.push({
      claimId: `srcclaim-${snapshot.no.toString().padStart(32, "0")}`,
      no: snapshot.no,
      opponent: snapshot.opponent,
      score: [snapshot.expectedScore.aafk, snapshot.expectedScore.opponent],
      ...overrides,
    } as unknown as SourceResultCollection["seasons"][number]["results"][number]);
    bySource.set(snapshot.sourceId, collection);
  }
  return [...bySource.values()];
}

describe("integritet i community-køen", () => {
  it("melder ingen avvik når øyeblikksbildet stemmer med arkivet", () => {
    const cases = asCases(generateNewspaperVerificationCases(publishAll()));
    expect(cases.length).toBeGreaterThan(0);
    expect(auditCommunityCases({ verificationCases: cases, sourceResults: collectionFor(cases) })).toEqual([]);
  });

  it("fanger kilderesultat som er endret eller borte etter publisering", () => {
    const cases = asCases(generateNewspaperVerificationCases(publishAll()));
    const sourceResults = collectionFor(cases);
    const first = sourceResults[0]!.seasons[0]!.results[0]!;
    first.opponent = "En helt annen motstander";
    const stale = auditCommunityCases({ verificationCases: cases, sourceResults });
    expect(stale.map((finding) => finding.kind)).toContain("stale_snapshot");

    const empty = auditCommunityCases({ verificationCases: cases, sourceResults: [] });
    expect(empty.every((finding) => finding.kind === "missing_claim")).toBe(true);
    expect(empty).toHaveLength(cases.length);
  });

  it("fanger kilderesultat som allerede er koblet til en kamp", () => {
    const cases = asCases(generateNewspaperVerificationCases(publishAll()));
    const sourceResults = collectionFor(cases, { matchId: "1955-05-01-aalesunds-fk-herd" });
    const findings = auditCommunityCases({ verificationCases: cases, sourceResults });
    expect(findings.every((finding) => finding.kind === "already_canonicalized")).toBe(true);
  });

  it("ser bort fra saker som ikke ligger ute til svar", () => {
    const cases = asCases(generateNewspaperVerificationCases(publishAll())).map((item) => ({ ...item, status: "resolved" as const }));
    expect(auditCommunityCases({ verificationCases: cases, sourceResults: [] })).toEqual([]);
  });

  it("holder pensjonerte kandidater ute av community-køen", () => {
    const published = publishAll();
    const retired = {
      ...published,
      candidates: published.candidates.map((candidate, index) => index === 0
        ? { ...(candidate as Record<string, unknown>), retirement: { reason: "already_canonicalized", retiredAt: "2026-08-24", note: "Kanonisert etter publisering." } }
        : candidate),
    };
    const before = generateNewspaperVerificationCases(published);
    const after = generateNewspaperVerificationCases(retired);
    expect(after.cases).toHaveLength(before.cases.length - 1);
    expect(after.skipped.some((item) => item.reason === "retired")).toBe(true);
  });
});
