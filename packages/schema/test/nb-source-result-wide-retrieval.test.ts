import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../src/load.js";

describe("NB Source-Result Wide Retrieval (1945-1984)", () => {
  const candidatesPath = resolve(repoRoot(), "data/discovery/nb-source-result-wide-candidates-1945-1984.yaml");

  it("generates deterministic candidates manifest with contract nb-source-result-wide-candidates@1", async () => {
    expect(existsSync(candidatesPath)).toBe(true);
    const content = await readFile(candidatesPath, "utf8");
    const manifest = parseYaml(content);

    expect(manifest.contract).toBe("nb-source-result-wide-candidates@1");
    expect(manifest.decisionGate).toBe("READY_FOR_TRUE_VISUAL_REVIEW");
    expect(manifest.scope.fromYear).toBe(1945);
    expect(manifest.scope.toYear).toBe(1984);
    expect(manifest.scope.totalUnlinkedSourceResults).toBe(744);
    expect(manifest.scope.totalHypotheses).toBe(636);
    expect(manifest.scope.singletonHypotheses).toBe(160);
    expect(manifest.scope.siblingHypotheses).toBe(476);
    expect(manifest.scope.siblingGroups).toBe(166);
    expect(manifest.retrievalSummary.candidateCoverage).toBeGreaterThan(0.95);
    expect(manifest.hypotheses.length).toBe(636);
  });

  it("ensures every candidate has concrete page URL and adheres to top-N bounds without raw OCR persistence", async () => {
    const content = await readFile(candidatesPath, "utf8");
    const manifest = parseYaml(content);

    for (const hyp of manifest.hypotheses) {
      expect(hyp).toHaveProperty("hypothesisId");
      expect(hyp).toHaveProperty("season");
      expect(hyp).toHaveProperty("sourceResults");
      expect(hyp).toHaveProperty("siblingGroup");
      expect(hyp.candidates.length).toBeLessThanOrEqual(5);

      for (const cand of hyp.candidates) {
        expect(cand.candidateId).toMatch(/^nb-cand-/);
        expect(cand.rank).toBeGreaterThanOrEqual(1);
        expect(cand.newspaper.pageUrl).toMatch(/^https:\/\/www\.nb\.no\/items\/[a-f0-9]+(\?page=\d+)?$/);
        expect(cand.newspaper.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(cand.newspaper.page).toBeDefined();
        expect(cand.retrieval.reasonCodes.length).toBeGreaterThan(0);
        expect(cand.retrieval).not.toHaveProperty("rawTextSnippet");
        expect(cand.retrieval).not.toHaveProperty("fullText");
        expect(cand.retrieval).not.toHaveProperty("ocrText");
      }
    }
  });

  it("preserves sibling groups across hypotheses with matching group IDs", async () => {
    const content = await readFile(candidatesPath, "utf8");
    const manifest = parseYaml(content);

    const siblingHypotheses = manifest.hypotheses.filter((h: { isSingleton: boolean }) => !h.isSingleton);
    expect(siblingHypotheses.length).toBe(476);

    const groupIds = new Set(siblingHypotheses.map((h: { siblingGroup: { id: string } }) => h.siblingGroup.id));
    expect(groupIds.size).toBe(166);
  });
});
