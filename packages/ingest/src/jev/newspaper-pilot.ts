import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { scoreFragment, stripSearchMarkup } from "../adapters/nb-newspaper-search.js";

export type PilotLabel = "relevant" | "noise" | "uncertain";
export type PilotSplit = "development" | "test";

export interface PilotSample {
  id: string;
  groupId: string;
  split: PilotSplit;
  label: PilotLabel;
  source: string;
  publicationDate?: string;
  page?: string;
  text: string;
  baselineScore: number;
  labelNote: string;
}

export interface JevJudgement {
  model: string;
  relevant: number;
  concreteEvidence: number;
  visualReview: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ScoredPilotSample extends PilotSample {
  judgement: JevJudgement;
  jevScore: number;
  normalizedBaselineScore: number;
  combinedScore: number;
}

export interface BinaryMetrics {
  threshold: number;
  evaluated: number;
  positives: number;
  negatives: number;
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
  recall: number;
  precision: number;
  noiseReduction: number;
  f1: number;
}

export interface RankingMetrics {
  k: number;
  reviewed: number;
  relevantFound: number;
  relevantTotal: number;
  recallAtK: number;
  precisionAtK: number;
}

export interface PilotEvaluation {
  contract: "jev-newspaper-evaluation@1";
  createdAt: string;
  model: string;
  targetRecall: number;
  datasetKind?: "seed" | "raw";
  provenance?: Record<string, number>;
  methodNotes?: Partial<Record<"jev" | "baseline" | "combined", string>>;
  dataset: {
    total: number;
    development: number;
    test: number;
    relevant: number;
    noise: number;
    uncertain: number;
  };
  methods: {
    jev: MethodEvaluation;
    baseline: MethodEvaluation;
    combined: MethodEvaluation;
  };
  usage: { inputTokens: number; outputTokens: number };
  uncertain: Array<Pick<ScoredPilotSample, "id" | "groupId" | "label" | "jevScore" | "baselineScore" | "combinedScore">>;
  errors: Array<{ id: string; message: string }>;
  results: ScoredPilotSample[];
}

export interface MethodEvaluation {
  selectedThreshold: number;
  development: BinaryMetrics;
  test: BinaryMetrics;
  testRanking: RankingMetrics[];
}

interface GroundTruthManifest {
  cases: Array<{
    year: number;
    no: number;
    opponent: string;
    expectedScore: [number, number];
    fragments: Array<{ issueId: string; issueDate: string; text: string }>;
  }>;
}

interface SearchFixture {
  [query: string]: {
    _embedded?: {
      items?: Array<{
        id: string;
        metadata?: { title?: string; originInfo?: { issued?: string } };
        contentFragments?: Array<{ pageNumber?: string; text?: string }>;
      }>;
    };
  };
}

interface JevResponse {
  model?: unknown;
  answers?: Record<string, unknown>;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
}

export interface JevClientOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  attempts?: number;
  fetchImpl?: typeof fetch;
}

export interface RunPilotOptions {
  client: JevClient;
  samples: PilotSample[];
  concurrency?: number;
  targetRecall?: number;
  onResult?: (sample: ScoredPilotSample, completed: number, total: number) => Promise<void> | void;
  prior?: Map<string, JevJudgement>;
}

const AAFK_ALIASES = ["Aalesunds Fotballklubb", "Aalesunds Fotballklub", "Aalesunds FK", "Aalesund FK", "AaFK", "AAFK", "ÅFK", "A.F.K."];
const DEFAULT_MODEL = "jev-latest";

// Tre fragmenter i det ekte 1935-snapshotet kan ikke gis sikker binær fasit
// uten å åpne faksimilen. De holdes synlige, men deltar ikke i terskelmålingen.
const UNCERTAIN_SNAPSHOT = new Set([
  "40efa9681a1cb3b2d3a7929b7028d882|1|Aalesund tapte",
  "37331be80f40c569f046fb6b44ec2476|8|spennende dyst på Nørve",
  "7570fe7e986bc39dbb61ea9d54c62a94|5|Aalesunds-mesterskopet",
]);

// Dette er terminlistetreffet som det originale 1935-søket var ment å finne.
const RELEVANT_SNAPSHOT = new Set([
  "fad17415341d1347ba2c22141c0bde5f|4|Ålesund—Lyn, Gjøvik",
]);

export function buildDiscoveryState(sample: PilotSample): Record<string, unknown> {
  return {
    archive: "AaFK-arkivet",
    researchGoal: "Finn historisk dokumentasjon om Aalesunds Fotballklubb uten å anta hvilken kamp eller hendelse teksten gjelder.",
    club: "Aalesunds Fotballklubb",
    aliases: AAFK_ALIASES,
    source: sample.source,
    publicationDate: sample.publicationDate ?? "ukjent",
    page: sample.page ?? "ukjent",
    ocrText: stripSearchMarkup(sample.text),
  };
}

export const DISCOVERY_QUESTIONS = {
  relevant: {
    type: "noul",
    instructions: "Kan OCR-fragmentet omtale Aalesunds Fotballklubb, et av klubbens lag eller en konkret hendelse knyttet til klubben? Stedsnavnet Aalesund alene er ikke nok.",
  },
  concreteEvidence: {
    type: "noul",
    instructions: "Inneholder OCR-fragmentet konkrete historiske opplysninger om klubben, som kamp, motstander, resultat, dato, spiller, målscorer, lagoppstilling, trener, leder, bane eller klubbhendelse?",
  },
  visualReview: {
    type: "noul",
    instructions: "Er teksten så OCR-skadet, avkortet, sammenblandet mellom avisspalter eller tabellpreget at original avisside bør kontrolleres visuelt før innholdet tolkes?",
  },
} as const;

export class JevClient {
  readonly model: string;
  private readonly apiKey: string;
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly attempts: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: JevClientOptions) {
    if (!options.apiKey.trim()) throw new Error("TYPESAFE_API_KEY mangler");
    this.apiKey = options.apiKey.trim();
    this.model = options.model ?? DEFAULT_MODEL;
    this.url = `${(options.baseUrl ?? "https://api.typesafe.ai").replace(/\/$/, "")}/v1/systemone`;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.attempts = options.attempts ?? 4;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async classify(sample: PilotSample): Promise<JevJudgement> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(this.url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ model: this.model, state: buildDiscoveryState(sample), questions: DISCOVERY_QUESTIONS }),
          signal: controller.signal,
        });
        const body = await response.text();
        if (!response.ok) {
          const error = new Error(`TypeSafe svarte ${response.status} ${response.statusText}: ${safeErrorBody(body)}`);
          if (response.status >= 400 && response.status < 500 && response.status !== 429) throw error;
          lastError = error;
        } else {
          return parseJevResponse(JSON.parse(body) as JevResponse);
        }
      } catch (error) {
        lastError = error;
        if (error instanceof Error && /TypeSafe svarte 4\d\d/.test(error.message) && !/ 429 /.test(error.message)) throw error;
      } finally {
        clearTimeout(timer);
      }
      if (attempt < this.attempts - 1) await sleep(Math.min(8_000, 500 * 2 ** attempt));
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

export async function loadSeedPilotDataset(groundTruthPath: string, searchFixturePath: string): Promise<PilotSample[]> {
  const groundTruth = parseYaml(await readFile(groundTruthPath, "utf8"), { schema: "core" }) as GroundTruthManifest;
  const searchFixture = JSON.parse(await readFile(searchFixturePath, "utf8")) as SearchFixture;
  const samples: PilotSample[] = [];

  for (const testCase of groundTruth.cases) {
    for (const [index, fragment] of testCase.fragments.entries()) {
      const score = `${testCase.expectedScore[0]}-${testCase.expectedScore[1]}`;
      samples.push({
        id: `ground-truth:${testCase.year}:${testCase.no}:${fragment.issueId}:${index}`,
        groupId: `ground-truth:${testCase.year}:${testCase.no}`,
        split: splitForGroup(`ground-truth:${testCase.year}:${testCase.no}`),
        label: "relevant",
        source: "Sunnmørsposten",
        publicationDate: compactIssueDate(fragment.issueDate),
        text: fragment.text,
        baselineScore: scoreFragment(fragment.text, { opponent: testCase.opponent, year: testCase.year, score }).score,
        labelNote: "Faksimile-ground-truth: konkret AaFK-fragment. Relasjonen til én bestemt kamp kan fortsatt være tvetydig.",
      });
    }
  }

  const seen = new Set<string>();
  for (const response of Object.values(searchFixture)) {
    for (const item of response._embedded?.items ?? []) {
      for (const fragment of item.contentFragments ?? []) {
        if (!fragment.text) continue;
        const unique = `${item.id}|${fragment.pageNumber ?? ""}|${fragment.text}`;
        if (seen.has(unique)) continue;
        seen.add(unique);
        const selectorPrefix = `${item.id}|${fragment.pageNumber ?? ""}|`;
        const plainText = stripSearchMarkup(fragment.text).replace(/\s+/g, " ");
        const matchingSelector = [...RELEVANT_SNAPSHOT, ...UNCERTAIN_SNAPSHOT]
          .find((selector) => selector.startsWith(selectorPrefix) && plainText.includes(selector.split("|")[2]!));
        const label: PilotLabel = matchingSelector && RELEVANT_SNAPSHOT.has(matchingSelector)
          ? "relevant"
          : matchingSelector && UNCERTAIN_SNAPSHOT.has(matchingSelector)
            ? "uncertain"
            : "noise";
        const groupId = `nb-1935:${item.id}`;
        samples.push({
          id: `${groupId}:${fragment.pageNumber ?? "unknown"}:${shortHash(fragment.text)}`,
          groupId,
          split: splitForGroup(groupId),
          label,
          source: item.metadata?.title?.trim() || "Sunnmørsposten",
          publicationDate: compactIssueDate(item.metadata?.originInfo?.issued),
          page: fragment.pageNumber,
          text: fragment.text,
          baselineScore: scoreFragment(fragment.text, { opponent: "Lyn, Gjøvik", opponentAliases: ["Lyn"], year: 1935, score: "5-1" }).score,
          labelNote: label === "relevant"
            ? "Manuelt identifisert terminlistetreff for Ålesund–Lyn, Gjøvik."
            : label === "uncertain"
              ? "Avkortet ekte OCR som krever faksimilekontroll; holdes utenfor binær eval."
              : "Manuelt avgrenset hard negativ fra samme ekte NB-søkeresultat; sted, annonser eller annen fotball er ikke AaFK-evidens.",
        });
      }
    }
  }

  assertDataset(samples);
  return samples.sort((left, right) => left.id.localeCompare(right.id));
}

export async function runPilot(options: RunPilotOptions): Promise<{ scored: ScoredPilotSample[]; errors: Array<{ id: string; message: string }> }> {
  const prior = options.prior ?? new Map<string, JevJudgement>();
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 16));
  const scored: ScoredPilotSample[] = [];
  const errors: Array<{ id: string; message: string }> = [];
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      const sample = options.samples[index];
      if (!sample) return;
      try {
        const judgement = prior.get(sample.id) ?? await options.client.classify(sample);
        const result = scoreSample(sample, judgement);
        scored.push(result);
        completed += 1;
        await options.onResult?.(result, completed, options.samples.length);
      } catch (error) {
        completed += 1;
        errors.push({ id: sample.id, message: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, options.samples.length) }, worker));
  return { scored: scored.sort((left, right) => left.id.localeCompare(right.id)), errors };
}

export function createEvaluation(
  scored: ScoredPilotSample[],
  errors: Array<{ id: string; message: string }>,
  targetRecall = 0.95,
): PilotEvaluation {
  const model = [...new Set(scored.map((sample) => sample.judgement.model))].join(", ") || "unknown";
  return {
    contract: "jev-newspaper-evaluation@1",
    createdAt: new Date().toISOString(),
    model,
    targetRecall,
    dataset: {
      total: scored.length,
      development: scored.filter((sample) => sample.split === "development").length,
      test: scored.filter((sample) => sample.split === "test").length,
      relevant: scored.filter((sample) => sample.label === "relevant").length,
      noise: scored.filter((sample) => sample.label === "noise").length,
      uncertain: scored.filter((sample) => sample.label === "uncertain").length,
    },
    methods: {
      jev: evaluateMethod(scored, (sample) => sample.jevScore, targetRecall),
      baseline: evaluateMethod(scored, (sample) => sample.normalizedBaselineScore, targetRecall),
      combined: evaluateMethod(scored, (sample) => sample.combinedScore, targetRecall),
    },
    usage: {
      inputTokens: scored.reduce((sum, sample) => sum + (sample.judgement.inputTokens ?? 0), 0),
      outputTokens: scored.reduce((sum, sample) => sum + (sample.judgement.outputTokens ?? 0), 0),
    },
    uncertain: scored.filter((sample) => sample.label === "uncertain").map(({ id, groupId, label, jevScore, baselineScore, combinedScore }) => ({ id, groupId, label, jevScore, baselineScore, combinedScore })),
    errors,
    results: scored,
  };
}

export function scoreSample(sample: PilotSample, judgement: JevJudgement): ScoredPilotSample {
  const jevScore = clamp01(0.65 * judgement.relevant + 0.35 * judgement.concreteEvidence);
  const normalizedBaselineScore = clamp01(sample.baselineScore / 100);
  const combinedScore = clamp01(0.7 * jevScore + 0.3 * normalizedBaselineScore);
  return { ...sample, judgement, jevScore, normalizedBaselineScore, combinedScore };
}

export function metricsAtThreshold(samples: ScoredPilotSample[], getScore: (sample: ScoredPilotSample) => number, threshold: number): BinaryMetrics {
  const evaluated = samples.filter((sample) => sample.label !== "uncertain");
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  for (const sample of evaluated) {
    const positive = sample.label === "relevant";
    const kept = getScore(sample) >= threshold;
    if (positive && kept) truePositive += 1;
    else if (positive) falseNegative += 1;
    else if (kept) falsePositive += 1;
    else trueNegative += 1;
  }
  const positives = truePositive + falseNegative;
  const negatives = trueNegative + falsePositive;
  const recall = divide(truePositive, positives);
  const precision = divide(truePositive, truePositive + falsePositive);
  const noiseReduction = divide(trueNegative, negatives);
  return {
    threshold,
    evaluated: evaluated.length,
    positives,
    negatives,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    recall,
    precision,
    noiseReduction,
    f1: recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision),
  };
}

export function selectThreshold(samples: ScoredPilotSample[], getScore: (sample: ScoredPilotSample) => number, targetRecall: number): number {
  const candidates = [...new Set([0, 1, ...samples.map(getScore).map((score) => Number(score.toFixed(6)))])].sort((a, b) => a - b);
  const viable = candidates
    .map((threshold) => metricsAtThreshold(samples, getScore, threshold))
    .filter((metrics) => metrics.recall >= targetRecall);
  viable.sort((left, right) => right.noiseReduction - left.noiseReduction || right.precision - left.precision || right.threshold - left.threshold);
  return viable[0]?.threshold ?? 0;
}

export function rankingAtK(samples: ScoredPilotSample[], getScore: (sample: ScoredPilotSample) => number, k: number): RankingMetrics {
  const evaluated = samples.filter((sample) => sample.label !== "uncertain").sort((left, right) => getScore(right) - getScore(left) || left.id.localeCompare(right.id));
  const top = evaluated.slice(0, k);
  const relevantTotal = evaluated.filter((sample) => sample.label === "relevant").length;
  const relevantFound = top.filter((sample) => sample.label === "relevant").length;
  return { k, reviewed: top.length, relevantFound, relevantTotal, recallAtK: divide(relevantFound, relevantTotal), precisionAtK: divide(relevantFound, top.length) };
}

function evaluateMethod(scored: ScoredPilotSample[], getScore: (sample: ScoredPilotSample) => number, targetRecall: number): MethodEvaluation {
  const development = scored.filter((sample) => sample.split === "development");
  const test = scored.filter((sample) => sample.split === "test");
  const selectedThreshold = selectThreshold(development, getScore, targetRecall);
  return {
    selectedThreshold,
    development: metricsAtThreshold(development, getScore, selectedThreshold),
    test: metricsAtThreshold(test, getScore, selectedThreshold),
    testRanking: [10, 20, 50].map((k) => rankingAtK(test, getScore, k)),
  };
}

function parseJevResponse(response: JevResponse): JevJudgement {
  const answers = response.answers;
  if (!answers || typeof answers !== "object") throw new Error("TypeSafe-svaret mangler answers");
  return {
    model: typeof response.model === "string" ? response.model : DEFAULT_MODEL,
    relevant: readNoul(answers.relevant, "relevant"),
    concreteEvidence: readNoul(answers.concreteEvidence, "concreteEvidence"),
    visualReview: readNoul(answers.visualReview, "visualReview"),
    inputTokens: readOptionalNumber(response.usage?.input_tokens),
    outputTokens: readOptionalNumber(response.usage?.output_tokens),
  };
}

function readNoul(value: unknown, name: string): number {
  if (!value || typeof value !== "object" || !("noul" in value) || typeof value.noul !== "number" || value.noul < 0 || value.noul > 1) {
    throw new Error(`Ugyldig Noul-svar for ${name}`);
  }
  return value.noul;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function splitForGroup(groupId: string): PilotSplit {
  const firstByte = createHash("sha256").update(groupId).digest()[0]!;
  return firstByte % 5 < 2 ? "development" : "test";
}

export function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function compactIssueDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const compact = value.replaceAll("-", "");
  return /^\d{8}$/.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}` : value;
}

function assertDataset(samples: PilotSample[]): void {
  const ids = new Set<string>();
  for (const sample of samples) {
    if (ids.has(sample.id)) throw new Error(`Duplikat i Jev-pilotdatasettet: ${sample.id}`);
    ids.add(sample.id);
    if (!sample.text.trim()) throw new Error(`Tom OCR-tekst: ${sample.id}`);
  }
  if (!samples.some((sample) => sample.label === "relevant")) throw new Error("Pilotdatasettet mangler relevante eksempler");
  if (!samples.some((sample) => sample.label === "noise")) throw new Error("Pilotdatasettet mangler negative eksempler");
}

function safeErrorBody(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500) || "tom respons";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
