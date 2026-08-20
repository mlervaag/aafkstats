import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import { enrichIssue, enrichmentTerms } from "../src/newspaper/discovery.js";
import { sourceResultPopulation } from "../src/newspaper/source-result-query.js";
import { batchPolicyFor } from "../src/newspaper/batch-policy.js";
import type { DiscoveredIssue } from "../src/newspaper/discovery.js";
import type { SourceResultQuery } from "../src/newspaper/source-result-query.js";

vi.mock("../src/http.js", () => ({ fetchJson: vi.fn() }));
const { fetchJson } = await import("../src/http.js");
const fetched = vi.mocked(fetchJson);

const result = (
  no: number,
  opponent: string,
  opponentClubId: string | null,
  score: [number, number],
  overrides: Record<string, unknown> = {},
) => ({
  no,
  opponent,
  opponentClubId,
  score,
  status: "played",
  replay: false,
  extraTime: false,
  round: null,
  competitionId: null,
  matchId: null,
  ...overrides,
});

const archiveWith = (results: ReturnType<typeof result>[], sourceId = "kontroll", year = 1963): Archive => ({
  clubs: [{ id: "raufoss-il", name: "Raufoss IL", shortName: "Raufoss", nameVariants: [], names: [] }],
  sourceResults: [{
    sourceId,
    file: "source-results/kontroll.yaml",
    scorePerspective: "aafk",
    seasons: [{ year, page: 1, results }],
  }],
} as unknown as Archive);

describe("v1-populasjon", () => {
  it("slår flere source assertions med samme resultGroupId til én singleton-hypotese", () => {
    const archive = archiveWith([
      result(1, "Raufoss", "raufoss-il", [1, 0], { resultGroupId: "samme-kamp" }),
      result(2, "Raufoss IL", "raufoss-il", [1, 0], { resultGroupId: "samme-kamp" }),
    ]);

    const population = sourceResultPopulation(archive, { sourceId: "kontroll" });

    expect(population.summary).toMatchObject({
      rawSourceResults: 2,
      hypotheses: 1,
      singletonHypotheses: 1,
      siblingHypotheses: 0,
      siblingGroups: 0,
    });
    expect(population.hypotheses[0]!.hypothesis.queries).toHaveLength(2);
  });

  it("bruker klubb-ID og full populasjon til å merke valgte rader som siblings", () => {
    const archive = archiveWith([
      result(1, "Raufoss", "raufoss-il", [1, 0]),
      result(2, "Raufoss IL", "raufoss-il", [0, 2]),
    ]);

    const all = sourceResultPopulation(archive, { sourceId: "kontroll" });
    expect(all.summary).toMatchObject({
      hypotheses: 2,
      singletonHypotheses: 0,
      siblingHypotheses: 2,
      siblingGroups: 1,
      siblingGroupsBySize: { "2": 1 },
      siblingGroupsWithDistinctScores: 1,
    });

    const oneRow = sourceResultPopulation(archive, { sourceId: "kontroll", season: 1963, no: 1 });
    expect(oneRow.summary.hypotheses).toBe(1);
    expect(oneRow.hypotheses[0]!.siblingGroupSize).toBe(2);
    expect(oneRow.hypotheses[0]!.groupHypotheses).toHaveLength(2);
  });

  it("holder en reell singleton på automatisk hovedsti", () => {
    const population = sourceResultPopulation(
      archiveWith([result(1, "Raufoss", "raufoss-il", [1, 0])]),
      { sourceId: "kontroll" },
    );

    expect(population.summary).toMatchObject({ hypotheses: 1, singletonHypotheses: 1, siblingHypotheses: 0 });
    expect(population.hypotheses[0]!.siblingGroupSize).toBe(1);
  });

  it("låser kontrollsakene til sikker v1-policy", () => {
    const sourceId = "medlemsblad-for-aalesunds-fotb-1965-a2c9";
    const sarpsborgArchive = archiveWith([result(10, "Sarpsborg", "sarpsborg", [1, 0])], sourceId, 1948);
    const clausenengenArchive = archiveWith([
      result(16, "Clausenengen", "clausenengen", [1, 0]),
      result(22, "Clausenengen", "clausenengen", [0, 0]),
    ], sourceId, 1952);
    const sarpsborg = sourceResultPopulation(sarpsborgArchive, { sourceId, no: 10 }).hypotheses[0]!;
    const clausenengen = sourceResultPopulation(clausenengenArchive, { sourceId, no: 16 }).hypotheses[0]!;

    expect(batchPolicyFor(sarpsborg.hypothesis, sarpsborg.siblingGroupSize)).toMatchObject({ policy: "manual", reviewReason: "sibling_group" });
    expect(batchPolicyFor(clausenengen.hypothesis, clausenengen.siblingGroupSize).policy).toBe("automatic");
  });
});

describe("v1-berikelse", () => {
  beforeEach(() => fetched.mockReset());

  it("bruker historiske søkeformer uavhengig av aliasrekkefølgen", async () => {
    const query = {
      year: 1963,
      opponent: "Raufoss",
      opponentAliases: [],
      aafkAliases: ["Aalesunds FK", "AaFK"],
      groupKey: "1963|raufoss-il",
      linked: false,
      printedOpponent: "Raufoss",
      replay: false,
      extraTime: false,
      hints: { keywords: [] },
      ref: { sourceId: "kontroll", file: "f", season: 1963, no: 1 },
    } as SourceResultQuery;
    const issue: DiscoveredIssue = {
      id: "utgave",
      issued: "19630615",
      itemUrl: "https://www.nb.no/items/utgave",
      newspaper: "Sunnmørsposten",
      mayStoreFullText: false,
      fragments: [],
    };
    fetched
      .mockResolvedValueOnce({ contentFragments: [{ text: "Raufoss fabrikker og Aalesund by" }] })
      .mockResolvedValueOnce({ contentFragments: [{ text: "Raufoss møter ÅFK i morgen i en viktig kamp" }] })
      .mockResolvedValueOnce({ contentFragments: [] });

    await enrichIssue(issue, query);

    expect(enrichmentTerms("Raufoss")).toEqual(["Raufoss Aalesund", "Raufoss ÅFK", "Raufoss"]);
    expect(fetched.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("q")))
      .toEqual(["Raufoss Aalesund", "Raufoss ÅFK", "Raufoss"]);
  });
});
