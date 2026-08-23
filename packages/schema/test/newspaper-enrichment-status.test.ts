import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../src/load.js";
import type { NewspaperEnrichmentStatus } from "../src/historical/newspaper-enrichment-status.js";

describe("newspaper enrichment status", () => {
  it("gjør alle 39 daterte 1979-kampene til en deterministisk pilotkø", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    const status = parseYaml(raw, { schema: "core" }) as NewspaperEnrichmentStatus;
    const entries = status.entries.filter((entry) => entry.season === 1979);

    expect(status.contract).toBe("newspaper-enrichment-status@1");
    expect(status.searchPolicy).toEqual({
      initialWindowDays: 2,
      expandedWindowDays: 3,
      resultIsRequired: false,
      visualReviewRequired: true,
    });
    expect(entries).toHaveLength(39);
    expect(status.pilot1979.canonicalMatchesInScope).toBe(39);
    expect(entries.every((entry) => status.queue.includes(entry.matchId))).toBe(true);
    expect(entries.find((entry) => entry.matchId === "1979-04-29-aalesunds-fk-hodd")).toMatchObject({
      date: "1979-04-29",
      opponent: "Hødd",
      competition: "andredivisjon",
      homeAway: "home",
      score: "0-1",
      existingSmpSource: false,
      reviewStatus: "pending",
    });
  });

  it("den versjonerte køen inneholder ikke avis-OCR", async () => {
    const raw = await readFile(join(repoRoot(), "data", "discovery", "newspaper-enrichment-status.yaml"), "utf8");
    expect(raw).not.toMatch(/fullText|rawOcr|quote:/u);
  });
});
