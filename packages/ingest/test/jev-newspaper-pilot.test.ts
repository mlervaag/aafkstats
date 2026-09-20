import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { repoRoot } from "@aafkstats/schema/load";
import {
  buildDiscoveryState,
  JevClient,
  loadSeedPilotDataset,
  metricsAtThreshold,
  rankingAtK,
  scoreSample,
  selectThreshold,
  type JevJudgement,
  type PilotSample,
} from "../src/jev/newspaper-pilot.js";
import { rawFragmentSignals } from "../src/jev/raw-newspaper-holdout.js";

const groundTruthPath = resolve(repoRoot(), "packages/ingest/test/fixtures/nb-newspaper-ground-truth.yaml");
const searchFixturePath = resolve(repoRoot(), "packages/ingest/test/fixtures/nb-newspaper-search-1935-09.json");

describe("Jev newspaper pilot dataset", () => {
  it("bygger et ekte, gruppesplittet pilotsett med positive, negative og usikre fragmenter", async () => {
    const samples = await loadSeedPilotDataset(groundTruthPath, searchFixturePath);
    expect(samples.length).toBeGreaterThan(70);
    expect(samples.filter((sample) => sample.label === "relevant").length).toBeGreaterThanOrEqual(20);
    expect(samples.filter((sample) => sample.label === "noise").length).toBeGreaterThanOrEqual(50);
    expect(samples.filter((sample) => sample.label === "uncertain")).toHaveLength(3);

    const splitsByGroup = new Map<string, Set<string>>();
    for (const sample of samples) {
      const splits = splitsByGroup.get(sample.groupId) ?? new Set<string>();
      splits.add(sample.split);
      splitsByGroup.set(sample.groupId, splits);
    }
    expect([...splitsByGroup.values()].every((splits) => splits.size === 1)).toBe(true);
  });

  it("lekker ikke forventet motstander, resultat eller fasit inn i discovery-state", () => {
    const sample = makeSample("relevant", 100);
    sample.text = "AaFK møtte Herd";
    sample.labelNote = "hemmelig fasit";
    const state = JSON.stringify(buildDiscoveryState(sample));
    expect(state).toContain("AaFK møtte Herd");
    expect(state).not.toContain("hemmelig fasit");
    expect(state).not.toContain('"label"');
    expect(state).not.toContain('"baselineScore"');
  });
});

describe("raw newspaper holdout signals", () => {
  it("gjenkjenner historiske og moderne AaFK-navneformer Unicode-sikkert", () => {
    expect(rawFragmentSignals("<em>Ålesunds FK</em> vant kampen")).toMatchObject({ hasIdentity: true, hasFootball: true });
    expect(rawFragmentSignals("AFK kunne reise hjem med hevet hode etter nederlaget")).toMatchObject({ hasIdentity: true, hasFootball: true });
    expect(rawFragmentSignals("Aalesunds Kunstforening åpner utstilling")).toMatchObject({ hasIdentity: false, hasFootball: false });
    expect(rawFragmentSignals("Joh. Johannessen A/S Sportssenteret, Ålesund")).toMatchObject({ hasIdentity: false });
  });

  it("gjenkjenner resultatlister med Aalesund uten klubbforkortelse", () => {
    expect(rawFragmentSignals("Aalesund—Nydalen 4-2").hasSportsListing).toBe(true);
    expect(rawFragmentSignals("fra Aalesund og Sunnmøre").hasSportsListing).toBe(false);
  });
});

describe("Jev client", () => {
  it("sender typed questions og validerer Noul-svaret", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { questions: Record<string, { type: string }> };
      expect(request.questions.relevant?.type).toBe("noul");
      expect(request.questions.concreteEvidence?.type).toBe("noul");
      expect(request.questions.visualReview?.type).toBe("noul");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer test-key");
      return new Response(JSON.stringify({
        model: "jev-test",
        answers: {
          relevant: { type: "noul", noul: 0.9 },
          concreteEvidence: { type: "noul", noul: 0.7 },
          visualReview: { type: "noul", noul: 0.2 },
        },
        usage: { input_tokens: 123, output_tokens: 3 },
      }), { status: 200 });
    });
    const client = new JevClient({ apiKey: "test-key", fetchImpl, attempts: 1 });
    await expect(client.classify(makeSample("relevant", 80))).resolves.toEqual({
      model: "jev-test",
      relevant: 0.9,
      concreteEvidence: 0.7,
      visualReview: 0.2,
      inputTokens: 123,
      outputTokens: 3,
    });
  });

  it("avviser svar uten gyldige sannsynligheter", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      answers: {
        relevant: { type: "noul", noul: 2 },
        concreteEvidence: { type: "noul", noul: 0.5 },
        visualReview: { type: "noul", noul: 0.5 },
      },
    }), { status: 200 }));
    const client = new JevClient({ apiKey: "test-key", fetchImpl, attempts: 1 });
    await expect(client.classify(makeSample("noise", 0))).rejects.toThrow(/Ugyldig Noul-svar/);
  });
});

describe("Jev pilot evaluation", () => {
  it("velger terskel på recallmålet og holder usikre utenfor matrisen", () => {
    const scores = [
      scoreSample(makeSample("relevant", 100, "positive-1"), judgement(0.95, 0.8)),
      scoreSample(makeSample("relevant", 80, "positive-2"), judgement(0.75, 0.65)),
      scoreSample(makeSample("noise", 20, "noise-1"), judgement(0.3, 0.2)),
      scoreSample(makeSample("noise", 0, "noise-2"), judgement(0.1, 0.1)),
      scoreSample(makeSample("uncertain", 0, "uncertain"), judgement(0.99, 0.99)),
    ];
    const threshold = selectThreshold(scores, (sample) => sample.jevScore, 1);
    const metrics = metricsAtThreshold(scores, (sample) => sample.jevScore, threshold);
    expect(metrics.evaluated).toBe(4);
    expect(metrics.recall).toBe(1);
    expect(metrics.noiseReduction).toBe(1);
    expect(rankingAtK(scores, (sample) => sample.jevScore, 2)).toMatchObject({ recallAtK: 1, precisionAtK: 1 });
  });
});

function makeSample(label: PilotSample["label"], baselineScore: number, id = "sample"): PilotSample {
  return {
    id,
    groupId: id,
    split: "development",
    label,
    source: "Sunnmørsposten",
    publicationDate: "1935-09-01",
    text: "OCR fragment",
    baselineScore,
    labelNote: "test",
  };
}

function judgement(relevant: number, concreteEvidence: number): JevJudgement {
  return { model: "jev-test", relevant, concreteEvidence, visualReview: 0.1 };
}
