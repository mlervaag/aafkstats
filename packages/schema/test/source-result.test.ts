import { describe, expect, it } from "vitest";
import { flattenSourceResults, sourceResultCollection } from "../src/source-result.js";

describe("kildedokumenterte resultater", () => {
  it("bevarer AaFK-perspektiv og lager stabile ID-er", () => {
    const collection = sourceResultCollection.parse({
      sourceId: "jubileumsbok",
      scorePerspective: "aafk",
      seasons: [{ year: 1915, page: 83, results: [
        { no: 1, opponent: "Rollon", score: [2, 2] },
        { no: 2, opponent: null, score: null, status: "walkover", competitionId: "nm", round: 1 },
      ] }],
    });
    expect(flattenSourceResults(collection)).toMatchObject([
      { id: "1915-001", aafkGoals: 2, opponentGoals: 2, page: 83 },
      { id: "1915-002", status: "walkover", competitionId: "nm", round: 1 },
    ]);
  });

  it("avviser hull i nummereringen og spilte kamper uten score", () => {
    const parsed = sourceResultCollection.safeParse({
      sourceId: "jubileumsbok", scorePerspective: "aafk",
      seasons: [{ year: 1915, page: 83, results: [{ no: 2, opponent: "Rollon", score: null }] }],
    });
    expect(parsed.success).toBe(false);
  });
});
