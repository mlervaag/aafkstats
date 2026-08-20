import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { repoRoot } from "@aafkstats/schema/load";
import { filterHypotheses, readHypothesisIdsFile } from "../src/newspaper/selection-filter.js";
import type { PlannedHypothesis } from "../src/newspaper/source-result-query.js";

const makePopItem = (id: string, groupKey: string): PlannedHypothesis => ({
  groupKey,
  siblingGroupSize: 1,
  groupHypotheses: [],
  hypothesis: {
    id,
    order: 1,
    queries: [{
      ref: { sourceId: "test-src", file: "test.yaml", season: 1960, no: 1 },
      year: 1960,
      printedOpponent: "Rollon",
      hints: { keywords: [] },
      groupKey,
      linked: false,
      replay: false,
      extraTime: false,
    }],
  },
});

describe("selection-filter", () => {
  const population: PlannedHypothesis[] = [
    makePopItem("h-1", "1960|rollon"),
    makePopItem("h-2", "1960|rollon"),
    makePopItem("h-3", "1960|herd"),
    makePopItem("h-4", "1961|molde-fk"),
  ];

  it("filtrerer korrekt på oppgitte hypothesisIds", () => {
    const result = filterHypotheses(population, { hypothesisIds: ["h-1", "h-3"] });
    expect(result.map((h) => h.hypothesis.id)).toEqual(["h-1", "h-3"]);
  });

  it("kaster feil ved duplikate hypothesisIds", () => {
    expect(() => filterHypotheses(population, { hypothesisIds: ["h-1", "h-1"] })).toThrowError(/Dupliserte hypothesisId-er/);
  });

  it("kaster feil ved ukjente hypothesisIds", () => {
    expect(() => filterHypotheses(population, { hypothesisIds: ["h-1", "ukjent-id"] })).toThrowError(/Ukjente hypothesisId-er/);
  });

  it("filtrerer korrekt på groupKeys", () => {
    const result = filterHypotheses(population, { groupKeys: ["1960|rollon"] });
    expect(result.map((h) => h.hypothesis.id)).toEqual(["h-1", "h-2"]);
  });

  it("kaster feil ved ukjente groupKeys", () => {
    expect(() => filterHypotheses(population, { groupKeys: ["1999|ukjent"] })).toThrowError(/Ukjente groupKey-er/);
  });

  it("leser ID-fil linje for linje og ignorerer kommentarer", async () => {
    const fixturePath = resolve(repoRoot(), "packages/ingest/test/fixtures/nb-newspaper-batch-03-ids.txt");
    const ids = await readHypothesisIdsFile(fixturePath);
    expect(ids.length).toBe(180);
    expect(ids[0]).toBe("medlemsblad-for-aalesunds-fotb-1965-a2c9#1949-10");
  });
});
