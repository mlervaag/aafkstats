import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { generateNewspaperVerificationCases } from "../src/newspaper-verification-candidates.js";
import { loadArchive } from "../src/load.js";

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

  it("lar en manuell sak overstyre både stabil ID og kilderesultat-claim", () => {
    const generated = generateNewspaperVerificationCases(manifest);
    const first = generated.cases[0]!;
    const sameId = generateNewspaperVerificationCases(manifest, [first]);
    expect(sameId.cases).not.toContainEqual(first);
    expect(sameId.skipped).toContainEqual({ candidateId: first.newspaper!.candidateId, reason: "manual_case_exists" });
    const sameTarget = generateNewspaperVerificationCases(manifest, [{ id: "manuell-avisvurdering", target: first.target }]);
    expect(sameTarget.skipped).toContainEqual({ candidateId: first.newspaper!.candidateId, reason: "manual_case_exists" });
  });

  it("lar loaderen bruke en manuell sak framfor kandidaten i manifestet", async () => {
    const root = mkdtempSync(join(tmpdir(), "aafk-manual-newspaper-case-"));
    try {
      mkdirSync(join(root, "discovery"), { recursive: true });
      mkdirSync(join(root, "verification-cases"), { recursive: true });
      writeFileSync(join(root, "discovery", "community-candidate-queue.yaml"), stringify(manifest), "utf8");
      const generated = generateNewspaperVerificationCases(manifest).cases[0]!;
      const manual = { ...generated, context: "Manuell redaksjonell vurdering vinner." };
      writeFileSync(join(root, "verification-cases", `${manual.id}.yaml`), stringify(manual), "utf8");
      const archive = await loadArchive(root);
      expect(archive.issues).toEqual([]);
      expect(archive.verificationCases.filter((item) => item.id === manual.id)).toHaveLength(1);
      expect(archive.verificationCases.find((item) => item.id === manual.id)?.context).toBe("Manuell redaksjonell vurdering vinner.");
      expect(archive.verificationCases.find((item) => item.id === manual.id)?.file).toBe(`verification-cases/${manual.id}.yaml`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

