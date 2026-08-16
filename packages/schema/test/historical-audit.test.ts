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

  it("Source Inventory uten review gir reviewStatus unknown og teller ikke som reviewed", () => {
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
    ]);

    const result = auditSourceInventory(sources, providers, extractions, new Map(), {
      sourceIds: ["medlemsblad-1953"],
    });

    expect(result.summary.inScope).toBe(1);
    expect(result.summary.reviewed).toBe(0);
    expect(result.summary.unknownReviewStatus).toBe(1);
    expect(result.sources[0]?.reviewStatus).toBe("unknown");
  });

  it("Source Inventory feiler ved ukjent eksplisitt sourceId", () => {
    const providers = new Map<string, Provider>();
    const result = auditSourceInventory(new Map(), providers, new Map(), new Map(), {
      sourceIds: ["ikke-eksisterende-kilde-1955"],
    });

    expect(result.allSourcesPassed).toBe(false);
    expect(result.sources[0]?.errors.length).toBeGreaterThan(0);
  });

  it("ALTO med processed < expected teller ikke som altoComplete", () => {
    const sources = new Map<string, Source>([
      [
        "medlemsblad-1953",
        {
          id: "medlemsblad-1953",
          title: "AaFK Medlemsblad 1953",
          sourceType: "member_magazine",
          providers: [],
        },
      ],
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
          pagesProcessed: 30, // processed < expected
          pagesFailed: [],
          candidates: [],
          resolvedRoles: [],
          resolvedLineups: [],
        },
      ],
    ]);

    const result = auditSourceInventory(sources, new Map(), extractions, new Map(), {});
    expect(result.summary.altoComplete).toBe(0);
  });

  it("review-parser forveksler ikke kildeantall '5/5 sources' med sidekontroll", () => {
    const reviewWithSourcesFirst = `
# Review
Sources i scope / reviewed | 5/5
Sider visuelt kontrollert: 420/420
`;
    const result = markdownV1Parser.parseReview(reviewWithSourcesFirst);
    expect(result.pagesReviewedClaim?.reviewed).toBe(420);
    expect(result.pagesReviewedClaim?.total).toBe(420);
    expect(result.pagesReviewedClaim?.isFull).toBe(true);
  });

  it("review-parser feller ukjent sourceId, ugyldig disposisjon og mal-placeholders", () => {
    const badReview = `
# Review
Sider visuelt kontrollert: 10/10

Total for <År>: <Antall> funn

| SourceId | Funn | Disposisjon |
|---|---|---|
| \`medlemsblad-1999-feil\` | Noe | \`ugyldig_disposisjon_verdi\` |
`;
    const result = markdownV1Parser.parseReview(badReview, {
      knownSourceIds: new Set(["medlemsblad-1953"]),
    });

    expect(result.passed).toBe(false);
    const types = result.issues.map((i) => i.type);
    expect(types).toContain("placeholder");
    expect(types).toContain("invalid_disposition");
    expect(types).toContain("unknown_source");
  });

  it("source-result renummerering (innsetting) teller kun faktisk nye claims", () => {
    const baseCol: SourceResultCollection = {
      sourceId: "medlemsblad-1955",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1955,
          page: 10,
          results: [
            { no: 1, opponent: "Molde", score: [3, 2], status: "played", replay: false, extraTime: false, round: null, opponentClubId: "molde-fk", matchId: null },
            { no: 2, opponent: "Kristiansund", score: [1, 1], status: "played", replay: false, extraTime: false, round: null, opponentClubId: "kristiansund-fk", matchId: null },
          ],
        },
      ],
    };

    // Ny kamp satt inn som #1, så Molde blir #2 og Kristiansund blir #3
    const headCol: SourceResultCollection = {
      sourceId: "medlemsblad-1955",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1955,
          page: 10,
          results: [
            { no: 1, opponent: "Rollon", score: [2, 0], status: "played", replay: false, extraTime: false, round: null, opponentClubId: "sk-rollon", matchId: null },
            { no: 2, opponent: "Molde", score: [3, 2], status: "played", replay: false, extraTime: false, round: null, opponentClubId: "molde-fk", matchId: null },
            { no: 3, opponent: "Kristiansund", score: [1, 1], status: "played", replay: false, extraTime: false, round: null, opponentClubId: "kristiansund-fk", matchId: null },
          ],
        },
      ],
    };

    const metrics = calculateHarvestMetrics({
      basePeople: new Map(),
      headPeople: new Map(),
      baseSourceResults: new Map([["medlemsblad-1955", baseCol]]),
      headSourceResults: new Map([["medlemsblad-1955", headCol]]),
      baseSnapshots: new Map(),
      headSnapshots: new Map(),
      baseObservations: new Map(),
      headObservations: new Map(),
      baseMatches: new Map(),
      headMatches: new Map(),
    });

    // Skal kun telle 1 ny source-result entry (Rollon), ikke 3!
    expect(metrics.sourceResultEntriesAdded).toBe(1);
  });

  it("kaster feil dersom git-ref ikke eksisterer", async () => {
    const { resolveGitSha } = await import("../src/historical/git.js");
    await expect(resolveGitSha("does-not-exist-commit-ref")).rejects.toThrow(/Ugyldig git-referanse/);
  });

  describe("Security regression tests (CodeQL / GHAS)", () => {
    it("avviser git-refs som starter med option-flagg (--upload-pack osv.)", async () => {
      const { resolveGitSha, validateGitRef } = await import("../src/historical/git.js");
      expect(() => validateGitRef("--upload-pack=touch /tmp/pwn")).toThrow(/kan ikke starte med «-»/);
      expect(() => validateGitRef("-v")).toThrow(/kan ikke starte med «-»/);
      await expect(resolveGitSha("--upload-pack=evil")).rejects.toThrow(/kan ikke starte med «-»/);
    });

    it("avviser git-refs med linjeskift, NUL eller ugyldige tegn", async () => {
      const { validateGitRef } = await import("../src/historical/git.js");
      expect(() => validateGitRef("main\nHEAD")).toThrow(/linjeskift/);
      expect(() => validateGitRef("main\r\nHEAD")).toThrow(/linjeskift/);
      expect(() => validateGitRef("main\0HEAD")).toThrow(/linjeskift/);
      expect(() => validateGitRef("main; rm -rf /")).toThrow(/ugyldige tegn/);
    });

    it("avviser path traversal og option-lignende filstier", async () => {
      const { validateRepoRelativePath } = await import("../src/historical/git.js");
      expect(() => validateRepoRelativePath("../../../etc/passwd")).toThrow(/path traversal/);
      expect(() => validateRepoRelativePath("data/../../secrets")).toThrow(/path traversal/);
      expect(() => validateRepoRelativePath("--output=/dev/null")).toThrow(/kan ikke starte med «-»/);
      expect(() => validateRepoRelativePath("data/people\nmalicious")).toThrow(/linjeskift/);
    });

    it("evaluerer adversarial lang review-tekst lineært uten polynomial runtime", () => {
      // Bygg en 50 000 tegns streng med gjentatte uavsluttede tags og tallsekvenser
      const adversarialText = `
# Review
Sider visuelt kontrollert: 100/100
` + "<div ".repeat(5000) + "\n" + "12345/67890 ".repeat(5000) + "\n" + "TODO ".repeat(100);

      const start = performance.now();
      const result = markdownV1Parser.parseReview(adversarialText);
      const durationMs = performance.now() - start;

      // Må fullføre på under 100 ms (lineær tid)
      expect(durationMs).toBeLessThan(100);
      expect(result.pagesReviewedClaim?.isFull).toBe(true);
      expect(result.placeholdersFound).toContain("TODO");
    });
  });

  describe("Forbedrede review- og inventory-garantier", () => {
    it("requireCompleteReview = true feller audit når kilder har unknown reviewStatus", () => {
      const sources = new Map<string, Source>([
        ["medlemsblad-1953", { id: "medlemsblad-1953", title: "AaFK 1953", sourceType: "member_magazine", providers: [] }],
      ]);
      const resStrict = auditSourceInventory(sources, new Map(), new Map(), new Map(), {
        sourceIds: ["medlemsblad-1953"],
        requireCompleteReview: true,
      });
      expect(resStrict.allSourcesPassed).toBe(false);

      const resPreflight = auditSourceInventory(sources, new Map(), new Map(), new Map(), {
        sourceIds: ["medlemsblad-1953"],
        requireCompleteReview: false,
      });
      expect(resPreflight.allSourcesPassed).toBe(true);
    });

    it("henter reviewStatus fra Source Inventory-tabell for reelle lange sourceId-er", () => {
      const realSourceId = "medlemsblad-for-aalesunds-fotb-1954-cd1c";
      const reviewDoc = `
# Review 1954

Sider visuelt kontrollert: 50/50

## 2. Source inventory
| sourceId | År | Sider | Extraction | Disposition |
|---|---|---|---|---|
| \`${realSourceId}\` | 1954 | 50 | complete | \`duplicate\` |

## 11. Definition of Done
- [x] Fullført.
`;
      const parseResult = markdownV1Parser.parseReview(reviewDoc, {
        knownSourceIds: new Set([realSourceId]),
      });

      expect(parseResult.passed).toBe(true);
      expect(parseResult.sourceReviewStatuses.get(realSourceId)).toBe("duplicate_or_reprint");
    });

    it("generell tekst-omtale av sourceId gjør den IKKE reviewed", () => {
      const sourceId = "medlemsblad-for-aalesunds-fotb-1954-cd1c";
      const textOnlyDoc = `
# Review
Sider visuelt kontrollert: 10/10
Dette er et opptrykk av ${sourceId} fra tidligere år.

- [x] DoD ferdig
`;
      const parseResult = markdownV1Parser.parseReview(textOnlyDoc, {
        knownSourceIds: new Set([sourceId]),
      });

      // sourceReviewStatuses skal IKKE inneholde sourceId bare fra fritekst
      expect(parseResult.sourceReviewStatuses.has(sourceId)).toBe(false);
    });

    it("godtar autoritative runbook-dispositions (honor_created, milestone_created, mention_linked osv.)", () => {
      const reviewWithRunbookDispositions = `
# Review
Sider visuelt kontrollert: 20/20

| Person | Kategori | Disposition |
|---|---|---|
| Emil Sandø | honor | \`honor_created\` |
| Karsten Nedregård | milestone | \`milestone_created\` |
| Trygve Olsen | mention | \`mention_linked\` |
| Ny bane | observation | \`observation_created\` |
| Rekrutt | player | \`non_senior\` |

- [x] DoD ferdig
`;
      const parseResult = markdownV1Parser.parseReview(reviewWithRunbookDispositions);
      expect(parseResult.passed).toBe(true);
      expect(parseResult.dispositionsFound).toContain("honor_created");
      expect(parseResult.dispositionsFound).toContain("milestone_created");
      expect(parseResult.dispositionsFound).toContain("mention_linked");
      expect(parseResult.dispositionsFound).toContain("observation_created");
      expect(parseResult.dispositionsFound).toContain("non_senior");
    });

    it("skiller extractionMode ocr_unavailable fra reviewStatus", () => {
      const sources = new Map<string, Source>([
        ["medlemsblad-1953", { id: "medlemsblad-1953", title: "AaFK 1953", sourceType: "member_magazine", providers: [] }],
      ]);
      const extractions = new Map<string, PublicationExtraction>([
        [
          "medlemsblad-1953",
          {
            sourceId: "medlemsblad-1953",
            providerId: "nasjonalbiblioteket",
            adapter: "nb",
            retrievedAt: "2026-08-15",
            ocrAccess: "unavailable",
            pagesExpected: 40,
            pagesProcessed: 0,
            pagesFailed: [],
            candidates: [],
            resolvedRoles: [],
            resolvedLineups: [],
          },
        ],
      ]);

      const result = auditSourceInventory(sources, new Map(), extractions, new Map(), {
        sourceIds: ["medlemsblad-1953"],
      });

      expect(result.sources[0]?.extractionMode).toBe("ocr_unavailable");
      expect(result.sources[0]?.reviewStatus).toBe("unknown"); // IKKE unavailable!
    });

    it("fanger orphan ekstraksjon og orphan source-result", () => {
      const extractions = new Map<string, PublicationExtraction>([
        [
          "orphan-kilde-1950",
          {
            sourceId: "orphan-kilde-1950",
            providerId: "nasjonalbiblioteket",
            adapter: "nb",
            retrievedAt: "2026-08-15",
            ocrAccess: "alto",
            pagesExpected: 10,
            pagesProcessed: 10,
            pagesFailed: [],
            candidates: [],
            resolvedRoles: [],
            resolvedLineups: [],
          },
        ],
      ]);

      const sourceResults = new Map<string, SourceResultCollection>([
        [
          "orphan-sr-1950",
          {
            sourceId: "orphan-sr-1950",
            scorePerspective: "aafk",
            seasons: [],
          },
        ],
      ]);

      const result = auditSourceInventory(new Map(), new Map(), extractions, sourceResults, {});
      expect(result.allSourcesPassed).toBe(false);
      expect(result.sources.some((s) => s.errors.some((e) => e.includes("Orphan extraction")))).toBe(true);
      expect(result.sources.some((s) => s.errors.some((e) => e.includes("Orphan source-result")))).toBe(true);
    });
  });
});
