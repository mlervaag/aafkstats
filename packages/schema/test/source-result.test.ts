import { describe, expect, it } from "vitest";
import { findPossibleDuplicateSourceResults, flattenSourceResults, sourceResultCollection } from "../src/source-result.js";

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

  it("aksepterer og flater ut valgfri resultGroupId", () => {
    const collection = sourceResultCollection.parse({
      sourceId: "nff-arbok-1920",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1920,
          page: 79,
          results: [
            {
              no: 1,
              opponent: "Rollon",
              score: [4, 1],
              competitionId: "nm",
              resultGroupId: "nm-1920-rollon-kvalifisering",
            },
          ],
        },
      ],
    });
    const flattened = flattenSourceResults(collection);
    expect(flattened[0]?.resultGroupId).toBe("nm-1920-rollon-kvalifisering");
  });

  it("rapporterer mulige duplikater på sesong, motstanderklubb og score", () => {
    const sourceA = sourceResultCollection.parse({
      sourceId: "kilde-a",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1918,
          page: 100,
          results: [
            { no: 1, opponent: "Kristiansund", opponentClubId: "kfk", score: [4, 3], competitionId: "nm", round: 1 },
          ],
        },
      ],
    });
    const sourceB = sourceResultCollection.parse({
      sourceId: "kilde-b",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1918,
          page: 83,
          results: [
            { no: 1, opponent: "K. F. K.", opponentClubId: "kfk", score: [4, 3], competitionId: "nm" },
          ],
        },
      ],
    });

    const duplicates = findPossibleDuplicateSourceResults([sourceA, sourceB]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.season).toBe(1918);
    expect(duplicates[0]?.opponentClubId).toBe("kfk");
    expect(duplicates[0]?.scoreText).toBe("4–3");

    // Ignorerer når de allerede har samme resultGroupId
    const sourceBWithGroup = sourceResultCollection.parse({
      sourceId: "kilde-b",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1918,
          page: 83,
          results: [
            {
              no: 1,
              opponent: "K. F. K.",
              opponentClubId: "kfk",
              score: [4, 3],
              competitionId: "nm",
              resultGroupId: "1918-kfk-nm",
            },
          ],
        },
      ],
    });
    const sourceAWithGroup = sourceResultCollection.parse({
      sourceId: "kilde-a",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1918,
          page: 100,
          results: [
            {
              no: 1,
              opponent: "Kristiansund",
              opponentClubId: "kfk",
              score: [4, 3],
              competitionId: "nm",
              round: 1,
              resultGroupId: "1918-kfk-nm",
            },
          ],
        },
      ],
    });
    expect(findPossibleDuplicateSourceResults([sourceAWithGroup, sourceBWithGroup])).toHaveLength(0);
  });
});
