import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { generateNewspaperVerificationCases } from "../src/newspaper-verification-candidates.js";

const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, "fixtures/newspaper-community-candidates.json"), "utf8")) as unknown;

describe("generator for avisverifisering", () => {
  it("lager stabile, atomiske utkast og krever eksplisitt publisering", () => {
    const first = generateNewspaperVerificationCases(manifest);
    const second = generateNewspaperVerificationCases(manifest);
    expect(first.cases).toEqual(second.cases);
    expect(first.cases).toHaveLength(8);
    expect(first.cases.filter((item) => item.status === "open")).toHaveLength(1);
    expect(first.cases.every((item) => item.question.endsWith("?") && item.newspaper?.communityReviewable)).toBe(true);
    expect(first.cases.find((item) => item.newspaper?.candidateId === "fixture-herd-1955-35")?.question).toContain("AaFK–Herd 4–3");
    expect(first.skipped).toContainEqual({ candidateId: "fixture-hidden-discovery-only", reason: "not_reviewable" });
  });

  it("dedupliserer kandidat og kilderesultat uten å overskrive en manuell sak", () => {
    const generated = generateNewspaperVerificationCases(manifest);
    const duplicateManifest = {
      ...(manifest as { contract: string; candidates: unknown[] }),
      candidates: [...(manifest as { candidates: unknown[] }).candidates, (manifest as { candidates: unknown[] }).candidates[0]],
    };
    const withDuplicate = generateNewspaperVerificationCases(duplicateManifest);
    expect(withDuplicate.skipped.some((item) => item.reason === "duplicate")).toBe(true);
    const protectedResult = generateNewspaperVerificationCases(manifest, [generated.cases[0]!]);
    expect(protectedResult.skipped.some((item) => item.reason === "manual_case_exists")).toBe(true);
  });

  it("parser og genererer saker for den faktiske produksjonskøen", () => {
    const queueFile = resolve(import.meta.dirname, "../../../data/discovery/community-candidate-queue.yaml");
    if (!existsSync(queueFile)) return;
    const raw = parse(readFileSync(queueFile, "utf8")) as unknown;
    const generation = generateNewspaperVerificationCases(raw);
    expect(generation.cases).toHaveLength(247);
    expect(generation.cases.filter((item) => item.status === "open")).toHaveLength(50);
    expect(generation.cases.filter((item) => item.status === "draft")).toHaveLength(197);
    expect(generation.skipped).toHaveLength(47);
    expect(generation.skipped.every((item) => item.reason === "not_reviewable")).toBe(true);
  });
});

