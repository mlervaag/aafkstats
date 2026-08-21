import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { fileURLToPath } from "url";
import {
  loadSiblingPilotManifest,
  evaluateGroupResults,
  type SiblingPilotGroupFixture,
} from "../src/newspaper/sibling-evaluator.js";
import { allocateEvents, type MatchHypothesis } from "../src/newspaper/allocation.js";
import { reconcile } from "../src/newspaper/reconciliation.js";
import type { NewspaperEvent } from "../src/newspaper/evidence-cluster.js";
import type { SiblingDiscoveryResult } from "../src/newspaper/discovery.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const MANIFEST_PATH = resolve(__dirname, "fixtures/nb-newspaper-sibling-pilot.yaml");

describe("NB Newspaper Sibling Pilot Manifest & Pure Evaluator", () => {
  it("validerer struktur, unike ID-er og forventningskrav i manifestet", () => {
    const manifest = loadSiblingPilotManifest(MANIFEST_PATH);
    expect(manifest.version).toBe(1);
    expect(manifest.groups).toHaveLength(10);
    expect(manifest.totalGroups).toBe(10);
    expect(manifest.totalHypotheses).toBe(26);

    const allGroupKeys = manifest.groups.map((g) => g.groupKey);
    expect(new Set(allGroupKeys).size).toBe(10);

    const allIds = manifest.groups.flatMap((g) => g.hypotheses.map((h) => h.id));
    expect(new Set(allIds).size).toBe(26);

    for (const group of manifest.groups) {
      expect(group.groupKey).toBeDefined();
      expect(group.hypotheses.length).toBeGreaterThanOrEqual(1);
      for (const h of group.hypotheses) {
        expect(["exact", "unresolved", "unverified"]).toContain(h.expectedAllocation);
        if (h.expectedAllocation === "exact") {
          expect(h.expectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });

  describe("Confidence- og evidensmargin-regler i allocateEvents", () => {
    it("gir low/unresolved ved margin 0 og løftes aldri til high av kronologi alene", () => {
      const hypotheses: MatchHypothesis[] = [
        {
          id: "h1",
          order: 1,
          queries: [
            {
              ref: { sourceId: "src", season: 1963, no: 1 },
              year: 1963,
              groupKey: "1963|motstander",
              opponent: "Motstander",
              linked: false,
              expectedScore: [2, 0],
              replay: false,
              extraTime: false,
              hints: {},
            },
          ],
        },
        {
          id: "h2",
          order: 2,
          queries: [
            {
              ref: { sourceId: "src", season: 1963, no: 2 },
              year: 1963,
              groupKey: "1963|motstander",
              opponent: "Motstander",
              linked: false,
              expectedScore: [2, 0],
              replay: false,
              extraTime: false,
              hints: {},
            },
          ],
        },
      ];

      // To hendelser med identisk evidens-score (70 på begge for begge hypoteser).
      // Kronologi (+10) gjør at [h1->e1, h2->e2] velges fremfor [h1->e2, h2->e1],
      // men evidensmarginen mellom fordelingene er 0.
      const events: NewspaperEvent[] = [
        {
          id: "event:1963-05-01",
          inferredDate: "1963-05-01",
          dateConfidence: "high",
          score: 70,
          evidence: [
            {
              itemUrl: "https://nb.no/item1",
              newspaper: "Sunnmørsposten",
              mayStoreFullText: false,
              score: 70,
              sameFragment: true,
              opponentFound: true,
              scoreFound: [2, 0],
              inferredDate: "1963-05-01",
              dateConfidence: "high",
            },
          ],
        },
        {
          id: "event:1963-09-01",
          inferredDate: "1963-09-01",
          dateConfidence: "high",
          score: 70,
          evidence: [
            {
              itemUrl: "https://nb.no/item2",
              newspaper: "Sunnmørsposten",
              mayStoreFullText: false,
              score: 70,
              sameFragment: true,
              opponentFound: true,
              scoreFound: [2, 0],
              inferredDate: "1963-09-01",
              dateConfidence: "high",
            },
          ],
        },
      ];

      const allocations = allocateEvents(hypotheses, events);
      expect(allocations).toHaveLength(2);
      for (const alloc of allocations) {
        expect(alloc.margin).toBe(0);
        expect(alloc.confidence).toBe("low");
        expect(alloc.decision).not.toBe("accepted");
        expect(alloc.eventId).toBeUndefined();
      }
    });

    it("gir ikke kunstig high confidence ved swap med lav evidensmargin", () => {
      const hypotheses: MatchHypothesis[] = [
        {
          id: "h1",
          order: 1,
          queries: [
            {
              ref: { sourceId: "src", season: 1963, no: 1 },
              year: 1963,
              groupKey: "1963|rival",
              opponent: "Rival",
              linked: false,
              replay: false,
              extraTime: false,
              competitionHint: "cup",
              hints: {},
            },
          ],
        },
        {
          id: "h2",
          order: 2,
          queries: [
            {
              ref: { sourceId: "src", season: 1963, no: 2 },
              year: 1963,
              groupKey: "1963|rival",
              opponent: "Rival",
              linked: false,
              replay: false,
              extraTime: false,
              hints: {},
            },
          ],
        },
      ];

      // e1 (cup) gir 75 til h1 (m/cup-hint) og 70 til h2.
      // e2 gir 60 til h1 og 60 til h2.
      // Beste fordeling: [h1->e1 (75), h2->e2 (60)] -> evidenceTotal = 135.
      // Swap fordeling: [h1->e2 (60), h2->e1 (70)] -> evidenceTotal = 130.
      // Evidensmargin for h1 = 135 - 130 = 5 (< HIGH_MARGIN).
      const events: NewspaperEvent[] = [
        {
          id: "event:e1",
          inferredDate: "1963-05-01",
          dateConfidence: "high",
          score: 50,
          evidence: [
            {
              itemUrl: "https://nb.no/e1",
              newspaper: "Sunnmørsposten",
              mayStoreFullText: false,
              score: 50,
              sameFragment: true,
              opponentFound: true,
              competitionFound: "cup",
              scoreFound: [2, 0],
              inferredDate: "1963-05-01",
              dateConfidence: "high",
              temporal: { inferredMatchDate: "1963-05-01", dateConfidence: "high" },
              kind: "article",
            },
          ],
        },
        {
          id: "event:e2",
          inferredDate: "1963-09-01",
          dateConfidence: "high",
          score: 50,
          evidence: [
            {
              itemUrl: "https://nb.no/e2",
              newspaper: "Sunnmørsposten",
              mayStoreFullText: false,
              score: 50,
              sameFragment: true,
              opponentFound: true,
              scoreFound: [3, 0],
              inferredDate: "1963-09-01",
              dateConfidence: "high",
              temporal: { inferredMatchDate: "1963-09-01", dateConfidence: "high" },
              kind: "article",
            },
          ],
        },
      ];

      const allocations = allocateEvents(hypotheses, events);
      expect(allocations).toHaveLength(2);

      expect(allocations[0]!.margin).toBe(5);
      expect(allocations[0]!.confidence).not.toBe("high");
      expect(allocations[0]!.decision).not.toBe("accepted");
      expect(allocations[0]!.eventId).toBeUndefined();
    });

    it("kjører ekte konfliktregresjon: aksepterer Åndalsnes 1964 #16 og produserer reell conflict i reconcile", () => {
      const hypothesis16: MatchHypothesis = {
        id: "andalsnes#16",
        order: 16,
        queries: [
          {
            ref: { sourceId: "medlemsblad-1965", season: 1964, no: 16 },
            year: 1964,
            groupKey: "1964|andalsnes",
            opponent: "Åndalsnes",
            linked: false,
            expectedScore: [4, 0], // Medlemsbladet hevder 4-0
            replay: false,
            extraTime: false,
            hints: {},
          },
        ],
      };

      const event16: NewspaperEvent = {
        id: "event:1964-05-24",
        inferredDate: "1964-05-24",
        dateConfidence: "high",
        score: 67,
        evidence: [
          {
            itemUrl: "https://nb.no/item-andalsnes-1964",
            newspaper: "Sunnmørsposten",
            mayStoreFullText: false,
            score: 67,
            sameFragment: true,
            opponentFound: true,
            scoreFound: [6, 1], // Avisen dokumenterer 6-1
            inferredDate: "1964-05-24",
            dateConfidence: "high",
            temporal: { inferredMatchDate: "1964-05-24", dateConfidence: "high" },
            kind: "article",
          },
        ],
      };

      // 1. Allokeringen skal akseptere hendelsen basert på uavhengig evidens (ikke kreve scorematch)
      const allocations = allocateEvents([hypothesis16], [event16]);
      expect(allocations).toHaveLength(1);
      const alloc = allocations[0]!;
      expect(alloc.candidateEventId).toBe("event:1964-05-24");
      expect(alloc.eventId).toBe("event:1964-05-24");
      expect(alloc.decision).toBe("accepted");
      expect(alloc.confidence).toBe("high");

      // 2. Reconcile alene skal oppdage og rapportere resultatavviket som en reell konflikt
      const query = hypothesis16.queries[0]!;
      const reconciled = reconcile(query, event16.evidence);
      expect(reconciled.status).toBe("conflict");
      expect(reconciled.checks.score).toBe("conflict");
      expect(reconciled.sourceScore).toEqual([4, 0]);
      expect(reconciled.newspaperScore).toEqual([6, 1]);
    });


  });

  describe("Deterministisk evaluering av kontrollgrupper", () => {
    it("evaluerer Herd 1962 (#5 og #9) som fullt korrekt og uten falsk score-konflikt", () => {
      const groupFixture: SiblingPilotGroupFixture = {
        groupKey: "1962|herd",
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1962,
        opponent: "Herd",
        hypotheses: [
          { id: "medlemsblad-for-aalesunds-fotb-1965-a2c9#1962-5", no: 5, expectedAllocation: "exact", expectedDate: "1962-04-25" },
          { id: "medlemsblad-for-aalesunds-fotb-1965-a2c9#1962-9", no: 9, expectedAllocation: "exact", expectedDate: "1962-06-20" },
        ],
      };

      const results = new Map<string, SiblingDiscoveryResult>();
      results.set("medlemsblad-for-aalesunds-fotb-1965-a2c9#1962-5", {
        status: "confirmed",
        checks: { opponent: "confirmed", score: "confirmed", homeAway: "unknown", competition: "unknown", date: "confirmed" },
        evidence: [],
        combinedConfidence: 0.9,
        event: { id: "event:1962-04-25", inferredDate: "1962-04-25", dateConfidence: "high", score: 85, evidence: [] },
        allocation: {
          hypothesisId: "medlemsblad-for-aalesunds-fotb-1965-a2c9#1962-5",
          candidateEventId: "event:1962-04-25",
          eventId: "event:1962-04-25",
          decision: "accepted",
          score: 85,
          runnerUpScore: 60,
          margin: 25,
          confidence: "high",
          alternatives: [],
        },
      });
      results.set("medlemsblad-for-aalesunds-fotb-1965-a2c9#1962-9", {
        status: "confirmed",
        checks: { opponent: "confirmed", score: "confirmed", homeAway: "unknown", competition: "unknown", date: "confirmed" },
        evidence: [],
        combinedConfidence: 0.9,
        event: { id: "event:1962-06-20", inferredDate: "1962-06-20", dateConfidence: "high", score: 85, evidence: [] },
        allocation: {
          hypothesisId: "medlemsblad-for-aalesunds-fotb-1965-a2c9#1962-9",
          candidateEventId: "event:1962-06-20",
          eventId: "event:1962-06-20",
          decision: "accepted",
          score: 85,
          runnerUpScore: 65,
          margin: 20,
          confidence: "high",
          alternatives: [],
        },
      });

      const evaluated = evaluateGroupResults(groupFixture, results);
      expect(evaluated.classification).toBe("fully_correct");
      expect(evaluated.hypotheses[0]!.classification).toBe("exact_correct");
      expect(evaluated.hypotheses[1]!.classification).toBe("exact_correct");
      expect(evaluated.hypotheses.every((h) => !h.isFalseHighConfidence)).toBe(true);
    });

    it("evaluerer Sarpsborg 1948 #10 som correctly_rejected når uallokert/uavklart", () => {
      const groupFixture: SiblingPilotGroupFixture = {
        groupKey: "1948|sarpsborg",
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1948,
        opponent: "Sarpsborg",
        hypotheses: [
          { id: "medlemsblad-for-aalesunds-fotb-1965-a2c9#1948-10", no: 10, expectedAllocation: "unresolved" },
        ],
      };

      const results = new Map<string, SiblingDiscoveryResult>();
      results.set("medlemsblad-for-aalesunds-fotb-1965-a2c9#1948-10", {
        status: "ambiguous",
        checks: { opponent: "missing", score: "unknown", homeAway: "unknown", competition: "unknown", date: "unknown" },
        evidence: [],
        combinedConfidence: 0,
        candidateEvent: { id: "event:1948-06-03", inferredDate: "1948-06-03", dateConfidence: "low", score: 50, evidence: [] },
        allocation: {
          hypothesisId: "medlemsblad-for-aalesunds-fotb-1965-a2c9#1948-10",
          candidateEventId: "event:1948-06-03",
          eventId: undefined,
          decision: "unresolved",
          score: 50,
          runnerUpScore: 0,
          margin: 5,
          confidence: "low",
          alternatives: [],
        },
      });

      const evaluated = evaluateGroupResults(groupFixture, results);
      expect(evaluated.classification).toBe("fully_correct");
      expect(evaluated.hypotheses[0]!.classification).toBe("correctly_rejected");
      expect(evaluated.hypotheses[0]!.isFalseHighConfidence).toBe(false);
    });

    it("evaluerer Kvik 1963 (#19, #21 og #28) korrekt avvist / uallokert", () => {
      const groupFixture: SiblingPilotGroupFixture = {
        groupKey: "1963|kvik",
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1963,
        opponent: "Kvik",
        hypotheses: [
          { id: "kvik#19", no: 19, expectedAllocation: "unresolved" },
          { id: "kvik#21", no: 21, expectedAllocation: "unresolved" },
          { id: "kvik#28", no: 28, expectedAllocation: "unresolved" },
        ],
      };

      const results = new Map<string, SiblingDiscoveryResult>();
      results.set("kvik#19", {
        status: "not_found",
        checks: { opponent: "missing", score: "unknown", homeAway: "unknown", competition: "unknown", date: "unknown" },
        evidence: [],
        combinedConfidence: 0,
        allocation: {
          hypothesisId: "kvik#19",
          eventId: undefined,
          decision: "rejected",
          score: 0,
          runnerUpScore: 0,
          margin: 0,
          confidence: "low",
          alternatives: [],
        },
      });
      results.set("kvik#21", {
        status: "not_found",
        checks: { opponent: "missing", score: "unknown", homeAway: "unknown", competition: "unknown", date: "unknown" },
        evidence: [],
        combinedConfidence: 0,
        allocation: {
          hypothesisId: "kvik#21",
          eventId: undefined,
          decision: "rejected",
          score: 0,
          runnerUpScore: 0,
          margin: 0,
          confidence: "low",
          alternatives: [],
        },
      });
      results.set("kvik#28", {
        status: "ambiguous",
        checks: { opponent: "missing", score: "unknown", homeAway: "unknown", competition: "unknown", date: "unknown" },
        evidence: [],
        combinedConfidence: 0,
        allocation: {
          hypothesisId: "kvik#28",
          candidateEventId: "event:1963-08-02",
          eventId: undefined,
          decision: "unresolved",
          score: 55,
          runnerUpScore: 0,
          margin: 10,
          confidence: "medium",
          alternatives: [],
        },
      });

      const evaluated = evaluateGroupResults(groupFixture, results);
      expect(evaluated.classification).toBe("fully_correct");
      expect(evaluated.hypotheses[0]!.classification).toBe("correctly_rejected");
      expect(evaluated.hypotheses[1]!.classification).toBe("correctly_rejected");
      expect(evaluated.hypotheses[2]!.classification).toBe("correctly_rejected");
      expect(evaluated.hypotheses[2]!.allocatedEventId).toBeUndefined();
      expect(evaluated.hypotheses[2]!.decision).not.toBe("accepted");
      expect(evaluated.hypotheses.every((h) => !h.isFalseHighConfidence)).toBe(true);
    });

    it("flagger falsk high confidence dersom en feil dato tildeles med high confidence", () => {
      const groupFixture: SiblingPilotGroupFixture = {
        groupKey: "1963|raufoss",
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1963,
        opponent: "Raufoss",
        hypotheses: [
          { id: "raufoss#27", no: 27, expectedAllocation: "exact", expectedDate: "1963-06-09" },
        ],
      };

      const results = new Map<string, SiblingDiscoveryResult>();
      results.set("raufoss#27", {
        status: "confirmed",
        checks: { opponent: "confirmed", score: "confirmed", homeAway: "unknown", competition: "unknown", date: "confirmed" },
        evidence: [],
        combinedConfidence: 0.9,
        event: { id: "event:1963-10-06", inferredDate: "1963-10-06", dateConfidence: "high", score: 85, evidence: [] },
        allocation: {
          hypothesisId: "raufoss#27",
          candidateEventId: "event:1963-10-06",
          eventId: "event:1963-10-06",
          decision: "accepted",
          score: 85,
          runnerUpScore: 50,
          margin: 35,
          confidence: "high", // FEIL DATO MED HIGH CONFIDENCE
          alternatives: [],
        },
      });

      const evaluated = evaluateGroupResults(groupFixture, results);
      expect(evaluated.classification).toBe("failed");
      expect(evaluated.hypotheses[0]!.classification).toBe("incorrect");
      expect(evaluated.hypotheses[0]!.isFalseHighConfidence).toBe(true);
    });
  });
});
