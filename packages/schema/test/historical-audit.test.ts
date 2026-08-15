import { describe, expect, it } from "vitest";
import { auditSourceInventory } from "../src/historical/source-inventory.js";
import { calculateHarvestMetrics } from "../src/historical/harvest-diff.js";
import { markdownV1Parser } from "../src/historical/review-parser.js";
import type { Source } from "../src/source.js";
import type { Provider } from "../src/entities.js";
import type { PublicationExtraction } from "../src/extraction.js";
import type { SourceResultCollection } from "../src/source-result.js";
import type { Person } from "../src/person.js";

describe("Historical Harvest Audit (PR #158)", () => {
  it("filtrerer kilder korrekt i Source Inventory etter parentSourceId og årstall", () => {
    const sources = new Map<string, Source>([
      [
        "medlemsblad-1953",
        {
          id: "medlemsblad-1953",
          parentSourceId: "aafk-medlemsblad",
          title: "AaFK Medlemsblad 1953",
          sourceType: "member_magazine",
          year: 1953,
          providers: [{ providerId: "nasjonalbiblioteket" }],
        },
      ],
      [
        "medlemsblad-1954",
        {
          id: "medlemsblad-1954",
          parentSourceId: "aafk-medlemsblad",
          title: "AaFK Medlemsblad 1954",
          sourceType: "member_magazine",
          year: 1954,
          providers: [{ providerId: "nasjonalbiblioteket" }],
        },
      ],
      [
        "jubileumsbok-1964",
        {
          id: "jubileumsbok-1964",
          title: "AaFK 50 år",
          sourceType: "anniversary_book",
          year: 1964,
          providers: [{ providerId: "nasjonalbiblioteket" }],
        },
      ],
    ]);

    const providers = new Map<string, Provider>([
      ["nasjonalbiblioteket", { id: "nasjonalbiblioteket", name: "Nasjonalbiblioteket", kind: "archive" }],
    ]);

    const extractions = new Map<string, PublicationExtraction>([
      [
        "medlemsblad-1953",
        {
          sourceId: "medlemsblad-1953",
          providerId: "nasjonalbiblioteket",
          adapter: "nb",
          retrievedAt: "2026-08-15",
          ocrAccess: "alto",
          pagesExpected: 40,
          pagesProcessed: 40,
          pagesFailed: [],
          candidates: [],
          resolvedRoles: [],
          resolvedLineups: [],
        },
      ],
      [
        "medlemsblad-1954",
        {
          sourceId: "medlemsblad-1954",
          providerId: "nasjonalbiblioteket",
          adapter: "nb",
          retrievedAt: "2026-08-15",
          ocrAccess: "search_only",
          pagesExpected: 44,
          pagesProcessed: 0,
          pagesFailed: [],
          candidates: [],
          resolvedRoles: [],
          resolvedLineups: [],
        },
      ],
    ]);

    const sourceResults = new Map<string, SourceResultCollection>([
      [
        "medlemsblad-1953",
        {
          sourceId: "medlemsblad-1953",
          scorePerspective: "aafk",
          seasons: [{ year: 1953, page: 12, results: [{ no: 1, opponent: "Rollon", score: [2, 1], status: "played", replay: false, extraTime: false, round: null, opponentClubId: null, matchId: null }] }],
        },
      ],
    ]);

    const result = auditSourceInventory(sources, providers, extractions, sourceResults, {
      parentSourceId: "aafk-medlemsblad",
      yearFrom: 1953,
      yearTo: 1954,
    });

    expect(result.allSourcesPassed).toBe(true);
    expect(result.summary.inScope).toBe(2);
    expect(result.summary.altoComplete).toBe(1);
    expect(result.summary.manualOrNoAlto).toBe(1);
  });

  it("beregner presise semantiske batch-metrikker mellom BASE og HEAD", () => {
    const basePerson: Person = {
      id: "ola-nordmann",
      name: "Ola Nordmann",
      names: [],
      roles: [
        {
          id: "formann-1950",
          category: "board",
          title: "Formann",
          from: "1950",
          to: null,
          sources: [{ sourceId: "medlemsblad-1950", page: "1", fields: ["roles"] }],
        },
      ],
      sources: [],
      conflicts: [],
      coachSpells: [],
      squadNumbers: [],
      providers: [],
    };

    const headPerson: Person = {
      ...basePerson,
      roles: [
        {
          id: "formann-1950",
          category: "board",
          title: "Formann",
          from: "1950",
          to: "1951",
          sources: [
            { sourceId: "medlemsblad-1950", page: "1", fields: ["roles"] },
            { sourceId: "medlemsblad-1951", page: "2", fields: ["roles"] },
          ],
        },
        {
          id: "aeresmedlem-1955",
          category: "honorary",
          title: "Æresmedlem",
          from: "1955",
          to: null,
          sources: [{ sourceId: "medlemsblad-1955", page: "5", fields: ["roles"] }],
        },
      ],
      sources: [{ sourceId: "medlemsblad-1955", page: "5", fields: ["roles"] }],
    };

    const newPerson: Person = {
      id: "per-spiller",
      name: "Per Spiller",
      names: [],
      roles: [],
      sources: [{ sourceId: "medlemsblad-1955", page: "10", fields: ["sources"] }],
      conflicts: [],
      coachSpells: [],
      squadNumbers: [],
      providers: [],
    };

    const metrics = calculateHarvestMetrics({
      basePeople: new Map([["ola-nordmann", basePerson]]),
      headPeople: new Map([
        ["ola-nordmann", headPerson],
        ["per-spiller", newPerson],
      ]),
      baseSourceResults: new Map(),
      headSourceResults: new Map([
        [
          "medlemsblad-1955",
          {
            sourceId: "medlemsblad-1955",
            scorePerspective: "aafk",
            seasons: [
              {
                year: 1955,
                page: 10,
                results: [
                  { no: 1, opponent: "Molde", score: [3, 2], status: "played", replay: false, extraTime: false, round: null, opponentClubId: "molde-fk", matchId: "1955-05-16-molde" },
                  { no: 2, opponent: "Kristiansund", score: [1, 1], status: "played", replay: false, extraTime: false, round: null, opponentClubId: "kristiansund-fk", matchId: null },
                ],
              },
            ],
          },
        ],
      ]),
      baseSnapshots: new Map(),
      headSnapshots: new Map([["1955", { date: "1955", organizationId: "aalesunds-fk", sources: [{ sourceId: "medlemsblad-1955", page: "2", fields: ["board"] }], people: [] }]]),
      baseObservations: new Map(),
      headObservations: new Map([["1955-klubbhus", { id: "1955-klubbhus", date: "1955-06-01", dateConfidence: "exact", sources: [{ sourceId: "medlemsblad-1955", page: "8", fields: ["events"] }], category: "club", title: "Klubbhus åpnet", note: "Åpningsfest", seasonYears: [1955], personIds: [], matchIds: [], competitionIds: [] }]]),
      baseMatches: new Map(),
      headMatches: new Map(),
    });

    expect(metrics.newPeople).toBe(1);
    expect(metrics.existingPeopleEnriched).toBe(1);
    expect(metrics.rolesCreated).toBe(1);
    expect(metrics.rolesSourceEnriched).toBe(1);
    expect(metrics.honoraryRolesCreated).toBe(1);
    expect(metrics.personSourceRefsAdded).toBe(2);
    expect(metrics.sourceResultCollectionsAdded).toBe(1);
    expect(metrics.sourceResultEntriesAdded).toBe(2);
    expect(metrics.sourceResultEntriesLinked).toBe(1);
    expect(metrics.snapshotsAdded).toBe(1);
    expect(metrics.historicalObservationsAdded).toBe(1);
  });

  it("avviser uferdige mal-placeholders og ufullstendig sidekontroll i review-dokumenter", () => {
    const invalidReviewDoc = `
# Review: AaFK Medlemsblad 1953

Sider visuelt kontrollert: 12/24

## Resultater
| Side | Kamp | Score | Disposisjon |
|---|---|---|---|
| 4 | AaFK - Rollon | 2-1 | \`source_result_created\` |
| 5 | <PLACEHOLDER> | TODO | \`fixture_only\` |

## Definition of Done
- [x] **Source inventory er komplett:** Ferdig.
- [ ] **Full visuell kontroll:** Ikke ferdig.
`;

    const result = markdownV1Parser.parseReview(invalidReviewDoc, {
      knownSourceIds: new Set(["medlemsblad-1953"]),
    });

    expect(result.passed).toBe(false);
    expect(result.placeholdersFound.length).toBeGreaterThan(0);
    expect(result.pagesReviewedClaim?.isFull).toBe(false);
    expect(result.uncheckedDodCount).toBe(1);
    expect(result.dispositionsFound).toContain("source_result_created");
  });

  it("godkjenner et komplett og feilfritt review-dokument", () => {
    const validReviewDoc = `
# Review: AaFK Medlemsblad 1953

Sider visuelt kontrollert: 24/24

## Funn
| Side | Funn | Disposisjon |
|---|---|---|
| 2 | Lauritz Giske formann | \`role_created\` |
| 4 | AaFK - Rollon 2-1 | \`source_result_created\` |

## Definition of Done
- [x] **Source inventory er komplett:** Ferdig.
- [x] **Full visuell kontroll:** 24/24 sider.
`;

    const result = markdownV1Parser.parseReview(validReviewDoc, {
      knownSourceIds: new Set(["medlemsblad-1953"]),
    });

    expect(result.passed).toBe(true);
    expect(result.pagesReviewedClaim?.isFull).toBe(true);
    expect(result.uncheckedDodCount).toBe(0);
    expect(result.issues.length).toBe(0);
  });
});
