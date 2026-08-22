import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { repoRoot } from "@aafkstats/schema/load";
import { generateNbCommunityResearchCases } from "@aafkstats/schema";
import {
  buildNbCommunityResearchManifest,
  compareCommunityResearchManifests,
} from "../src/newspaper/community-research.js";

describe("NB community research wave 1", () => {
  let manifest: Awaited<ReturnType<typeof buildNbCommunityResearchManifest>>;

  beforeAll(async () => {
    manifest = await buildNbCommunityResearchManifest();
  }, 30_000);

  it("bygger nøyaktig PR200-restkøen og holder ikke-community-saker ute", async () => {
    expect(manifest.contract).toBe("nb-community-research-wave@1");
    expect(manifest.summary).toEqual({
      sibling_resolution: 20,
      date_research: 1,
      score_conflict: 1,
      competition_conflict: 1,
      source_reconciliation: 1,
      total: 24,
    });
    expect(manifest.items).toHaveLength(24);
    expect(manifest.items.every((item) => item.status === "open" && item.published)).toBe(true);
    expect(JSON.stringify(manifest)).not.toMatch(/rawOcr|fullText|alto|unreviewed_awaiting_visual_batch|non_senior|"category":"different_event"/);
  });

  it("viser alle seks Rollon-alternativene uten å forhåndsvelge scoretreffet", async () => {
    const rollon = manifest.items.find((item) =>
      item.hypothesisId === "medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-013",
    );

    expect(rollon?.category).toBe("sibling_resolution");
    expect(rollon?.candidateOptions.map((option) => option.no)).toEqual([2, 4, 6, 9, 13, 36]);
    expect(rollon?.candidateOptions.find((option) => option.no === 9)?.label).toContain("3–1 mot Rollon");
    expect(rollon?.expectedAnswerShape).toContain("none_of_these");
    expect(rollon?.expectedAnswerShape).toContain("inconclusive");
  });

  it("publiserer PR200-invaliden som research og bruker faktisk visuell kilde", async () => {
    const invalid = manifest.items.find((item) =>
      item.hypothesisId === "sunnmore-fotballkrets-arsrapport-1976#1976-002",
    );

    expect(invalid).toMatchObject({
      category: "source_reconciliation",
      sourceResults: [{ opponent: "Skarbøvik", expectedScore: { aafk: 2, opponent: 1 } }],
      observedEvent: { opponent: "Clausenengen", score: { aafk: 2, opponent: 0 } },
      actualVisualSource: {
        issueDate: "1976-06-17",
        printedPage: "9",
        viewerPage: "6",
        pageUrl: expect.stringContaining("page=6"),
      },
    });
  });

  it("er idempotent mot allerede generert manifest", async () => {
    const generated = manifest;
    expect(compareCommunityResearchManifests(undefined, generated)).toMatchObject({ created: 24, updated: 0, unchanged: 0 });
    expect(compareCommunityResearchManifests(generated, generated)).toMatchObject({ created: 0, updated: 0, unchanged: 24 });

    const raw = await readFile(`${repoRoot()}/data/discovery/nb-source-result-canonicalization-1945-1984.yaml`, "utf8");
    expect(parse(raw, { schema: "core" }).communityRestQueue.candidateCount).toBe(generated.items.length);
  });

  it("lar en eksisterende manuelt redigert sak vinne ved regenerering", () => {
    const generated = generateNbCommunityResearchCases(manifest);
    const protectedCase = generated.cases[0]!;
    const regenerated = generateNbCommunityResearchCases(manifest, [{
      ...protectedCase,
      question: "Manuell redaksjonell formulering som ikke skal overskrives.",
    }]);
    expect(regenerated.manualProtected).toContain(protectedCase.id);
    expect(regenerated.cases).toHaveLength(23);
  });
});
