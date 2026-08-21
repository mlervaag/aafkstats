import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../src/load.js";

describe("NB Source-Result Wide Retrieval (1945-1984)", () => {
  const candidatesPath = resolve(repoRoot(), "data/discovery/nb-source-result-wide-candidates-1945-1984.yaml");
  const reviewPath = resolve(repoRoot(), "data/discovery/nb-source-result-wide-review-1945-1984.yaml");

  it("generates deterministic candidates manifest with contract nb-source-result-wide-candidates@1", async () => {
    expect(existsSync(candidatesPath)).toBe(true);
    const content = await readFile(candidatesPath, "utf8");
    const manifest = parseYaml(content);

    expect(manifest.contract).toBe("nb-source-result-wide-candidates@1");
    expect(manifest.scope.fromYear).toBe(1945);
    expect(manifest.scope.toYear).toBe(1984);
    expect(manifest.hypotheses.length).toBeGreaterThan(600);

    const first = manifest.hypotheses[0];
    expect(first).toHaveProperty("hypothesisId");
    expect(first).toHaveProperty("season");
    expect(first).toHaveProperty("candidates");
  });

  it("generates structured visual review manifest with contract nb-source-result-wide-review@1", async () => {
    expect(existsSync(reviewPath)).toBe(true);
    const content = await readFile(reviewPath, "utf8");
    const review = parseYaml(content);

    expect(review.contract).toBe("nb-source-result-wide-review@1");
    expect(review.decisionGate).toBe("READY_FOR_WIDE_CANONICALIZATION");
    expect(review.summary.candidateCoverage).toBeGreaterThan(0.95);
    expect(review.summary.top3ResolutionRate).toBeGreaterThan(0.80);
    expect(review.summary.secondPassAudit.agreementRate).toBe(1);
    expect(review.summary.secondPassAudit.sampleSize).toBe(30);
    expect(review.cases.length).toBe(review.summary.unifiedHypotheses);
  });
});
