import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { fileURLToPath } from "url";
import {
  loadSiblingPilotManifest,
  evaluateGroupResults,
  type SiblingPilotGroupFixture,
} from "../src/newspaper/sibling-evaluator.js";
import { allocateEvents, type MatchHypothesis } from "../src/newspaper/allocation.js";
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

  describe("Confidence- og margin-regler i allocateEvents", () => {
    it("gir low/unresolved og aldri medium ved margin <= 0 (f.eks. -5)", () => {
      const hypotheses: MatchHypothesis[] = [
        {
          id: "test#1963-1",
          order: 1,
          queries: [
            {
              ref: { sourceId: "test-src", season: 1963, no: 1 },
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

      // To hendelser med samme eller høyere alternativ score slik at margin blir <= 0
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
          id: "event:1963-05-02",
          inferredDate: "1963-05-02",
          dateConfidence: "high",
          score: 80,
          evidence: [
            {
              itemUrl: "https://nb.no/item2",
              newspaper: "Sunnmørsposten",
              mayStoreFullText: false,
              score: 80,
              sameFragment: true,
              opponentFound: true,
              scoreFound: [2, 0],
              inferredDate: "1963-05-02",
              dateConfidence: "high",
            },
          ],
        },
      ];

      const allocations = allocateEvents(hypotheses, events);
      expect(allocations).toHaveLength(1);
      const alloc = allocations[0]!;

      // Hvis margin er under MEDIUM_MARGIN (eller negativ/0), kan den ALDRI bli medium eller high
      expect(alloc.confidence).not.toBe("high");
      if (alloc.margin <= 0) {
        expect(alloc.confidence).toBe("low");
        expect(alloc.decision).not.toBe("accepted");
      }
    });
  });

  describe("Deterministisk evaluering av syntetiske grupper", () => {
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
        hypothesis: { id: "h5", queries: [], order: 1 },
        status: "confirmed",
        checks: { opponent: "confirmed", score: "confirmed", homeAway: "unknown", competition: "unknown", date: "confirmed" },
        sources: [],
        evidence: [],
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
        hypothesis: { id: "h9", queries: [], order: 2 },
        status: "confirmed",
        checks: { opponent: "confirmed", score: "confirmed", homeAway: "unknown", competition: "unknown", date: "confirmed" },
        sources: [],
        evidence: [],
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
        hypothesis: { id: "h10", queries: [], order: 1 },
        status: "ambiguous",
        checks: { opponent: "unknown", score: "unknown", homeAway: "unknown", competition: "unknown", date: "unknown" },
        sources: [],
        evidence: [],
        candidateEvent: { id: "event:1948-06-20", inferredDate: "1948-06-20", dateConfidence: "low", score: 50, evidence: [] },
        allocation: {
          hypothesisId: "medlemsblad-for-aalesunds-fotb-1965-a2c9#1948-10",
          candidateEventId: "event:1948-06-20",
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
          { id: "kvik#28", no: 28, expectedAllocation: "unverified" },
        ],
      };

      const results = new Map<string, SiblingDiscoveryResult>();
      results.set("kvik#19", {
        hypothesis: { id: "kvik#19", queries: [], order: 1 },
        status: "not_found",
        checks: { opponent: "unknown", score: "unknown", homeAway: "unknown", competition: "unknown", date: "unknown" },
        sources: [],
        evidence: [],
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
        hypothesis: { id: "kvik#21", queries: [], order: 2 },
        status: "not_found",
        checks: { opponent: "unknown", score: "unknown", homeAway: "unknown", competition: "unknown", date: "unknown" },
        sources: [],
        evidence: [],
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
        hypothesis: { id: "kvik#28", queries: [], order: 3 },
        status: "ambiguous",
        checks: { opponent: "unknown", score: "unknown", homeAway: "unknown", competition: "unknown", date: "unknown" },
        sources: [],
        evidence: [],
        allocation: {
          hypothesisId: "kvik#28",
          candidateEventId: "event:1963-10-06",
          eventId: undefined,
          decision: "unresolved",
          score: 55,
          runnerUpScore: 0,
          margin: 10,
          confidence: "low",
          alternatives: [],
        },
      });

      const evaluated = evaluateGroupResults(groupFixture, results);
      expect(evaluated.classification).toBe("fully_correct");
      expect(evaluated.hypotheses[0]!.classification).toBe("correctly_rejected");
      expect(evaluated.hypotheses[1]!.classification).toBe("correctly_rejected");
      expect(evaluated.hypotheses[2]!.classification).toBe("unverified");
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
        hypothesis: { id: "raufoss#27", queries: [], order: 1 },
        status: "confirmed",
        checks: { opponent: "confirmed", score: "confirmed", homeAway: "unknown", competition: "unknown", date: "confirmed" },
        sources: [],
        evidence: [],
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
