#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import {
  createEvaluation,
  DISCOVERY_QUESTIONS,
  JevClient,
  loadSeedPilotDataset,
  runPilot,
  type JevJudgement,
  type PilotEvaluation,
  type PilotSample,
} from "../jev/newspaper-pilot.js";
import { loadRawNewspaperHoldout } from "../jev/raw-newspaper-holdout.js";

const parsed = parseArgs({
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  options: {
    "dry-run": { type: "boolean" },
    refresh: { type: "boolean" },
    model: { type: "string" },
    concurrency: { type: "string" },
    limit: { type: "string" },
    "target-recall": { type: "string" },
    out: { type: "string" },
    dataset: { type: "string" },
  },
  strict: true,
});

const root = repoRoot();
const dataset = readDataset(parsed.values.dataset);
const groundTruthPath = resolve(root, "packages/ingest/test/fixtures/nb-newspaper-ground-truth.yaml");
const searchFixturePath = resolve(root, "packages/ingest/test/fixtures/nb-newspaper-search-1935-09.json");
const cachePath = resolve(root, `.cache/jev-newspaper/${dataset}-cache.json`);
const reportPath = resolve(parsed.values.out ?? resolve(root, `.cache/jev-newspaper/${dataset}-report.json`));
const envPath = resolve(root, ".env.jev.local");
const model = parsed.values.model ?? "jev-latest";
const concurrency = readInteger(parsed.values.concurrency, 4, "--concurrency", 1, 16);
const limit = readInteger(parsed.values.limit, Number.MAX_SAFE_INTEGER, "--limit", 1, Number.MAX_SAFE_INTEGER);
const targetRecall = readFraction(parsed.values["target-recall"], 0.95, "--target-recall");

const loaded = dataset === "seed"
  ? { samples: await loadSeedPilotDataset(groundTruthPath, searchFixturePath), provenance: undefined }
  : await loadRawNewspaperHoldout({
      archive: await loadArchive(dataDir()),
      reviewPath: resolve(root, "data/discovery/newspaper-enrichment-reviews.yaml"),
      ingestCacheDir: resolve(root, ".cache/ingest"),
    });
const allSamples = loaded.samples;
const samples = allSamples.slice(0, limit);
printDatasetSummary(samples, allSamples.length, dataset);
if (loaded.provenance) console.log(`Proveniens: ${JSON.stringify(loaded.provenance)}`);

if (parsed.values["dry-run"]) {
  console.log("\nDry-run fullført. Ingen API-kall ble gjort.");
  process.exit(0);
}

const fileEnv = await readLocalEnv(envPath);
const apiKey = process.env.TYPESAFE_API_KEY?.trim() || fileEnv.TYPESAFE_API_KEY?.trim();
if (!apiKey) {
  throw new Error(`TYPESAFE_API_KEY mangler. Lag ${envPath} med linjen TYPESAFE_API_KEY=din_nøkkel, eller sett miljøvariabelen.`);
}

const promptHash = createHash("sha256").update(JSON.stringify(DISCOVERY_QUESTIONS)).digest("hex").slice(0, 16);
const cache = parsed.values.refresh ? emptyCache(model, promptHash) : await readCache(cachePath, model, promptHash);
const prior = new Map<string, JevJudgement>();
const cachedByInput = new Map(Object.values(cache.entries).map((entry) => [entry.inputHash, entry.judgement]));
for (const sample of samples) {
  const entry = cache.entries[sample.id];
  const hash = inputHash(sample);
  const judgement = entry?.inputHash === hash ? entry.judgement : cachedByInput.get(hash);
  if (judgement) prior.set(sample.id, judgement);
}

console.log(`\nStarter Jev-evaluering: ${prior.size} cachede, ${samples.length - prior.size} nye kall, concurrency ${concurrency}.`);
const client = new JevClient({ apiKey, model });
let persistQueue = Promise.resolve();
const run = await runPilot({
  client,
  samples,
  concurrency,
  prior,
  onResult: async (result, completed, total) => {
    cache.entries[result.id] = { inputHash: inputHash(result), judgement: result.judgement };
    persistQueue = persistQueue.then(() => writeJsonAtomic(cachePath, cache));
    await persistQueue;
    console.log(`[${completed}/${total}] ${result.id}: Jev ${formatPercent(result.jevScore)} (${result.label})`);
  },
});
await persistQueue;

const evaluation = createEvaluation(run.scored, run.errors, targetRecall);
evaluation.datasetKind = dataset;
if (loaded.provenance) evaluation.provenance = loaded.provenance;
if (dataset === "raw") {
  evaluation.methodNotes = {
    baseline: "Kontrollrad, ikke en uavhengig benchmark: råsettets labels er delvis konstruert fra de samme deterministiske signalene som baseline bruker.",
    combined: "Eksperimentell kombinasjon; må vurderes mot Jev alene fordi baseline-signalet ikke er uavhengig av råsettets labels.",
  };
}
await writeJsonAtomic(reportPath, evaluation);
await writeFileAtomic(reportPath.replace(/\.json$/i, ".md"), renderMarkdown(evaluation));
printEvaluation(evaluation, reportPath);
if (run.errors.length > 0) process.exitCode = 1;

interface CacheFile {
  contract: "jev-newspaper-cache@1";
  model: string;
  promptHash: string;
  entries: Record<string, { inputHash: string; judgement: JevJudgement }>;
}

function emptyCache(selectedModel: string, selectedPromptHash: string): CacheFile {
  return { contract: "jev-newspaper-cache@1", model: selectedModel, promptHash: selectedPromptHash, entries: {} };
}

async function readCache(path: string, selectedModel: string, selectedPromptHash: string): Promise<CacheFile> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as CacheFile;
    if (value.contract !== "jev-newspaper-cache@1" || value.model !== selectedModel || value.promptHash !== selectedPromptHash) {
      return emptyCache(selectedModel, selectedPromptHash);
    }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyCache(selectedModel, selectedPromptHash);
    throw error;
  }
}

function inputHash(sample: PilotSample): string {
  return createHash("sha256").update(JSON.stringify({
    source: sample.source,
    publicationDate: sample.publicationDate,
    page: sample.page,
    text: sample.text,
  })).digest("hex").slice(0, 24);
}

async function readLocalEnv(path: string): Promise<Record<string, string>> {
  try {
    const result: Record<string, string> = {};
    for (const rawLine of (await readFile(path, "utf8")).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      result[key] = value;
    }
    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFileAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, value, "utf8");
  try {
    await rename(temporary, path);
  } catch (error) {
    // Windows tillater ikke alltid rename over en eksisterende fil, og OneDrive
    // kan holde målet kortvarig låst. Bare den regenererbare cache/rapportfilen
    // fjernes; tempfilen er komplett før utskiftingen starter.
    if (!isReplaceError(error)) throw error;
    let lastError: unknown = error;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await rm(path, { force: true });
        await rename(temporary, path);
        return;
      } catch (replaceError) {
        lastError = replaceError;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 50 * 2 ** attempt));
      }
    }
    throw lastError;
  }
}

function isReplaceError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EEXIST" || code === "EPERM" || code === "EACCES";
}

function printDatasetSummary(samples: PilotSample[], available: number, selectedDataset: "seed" | "raw"): void {
  const count = (predicate: (sample: PilotSample) => boolean) => samples.filter(predicate).length;
  console.log(`=== JEV / SUNNMØRSPOSTEN ${selectedDataset === "raw" ? "RÅ OCR-HOLDOUT" : "PILOT"} ===`);
  console.log(`Datasett: ${samples.length} av ${available} fragmenter`);
  console.log(`Fasit: ${count((sample) => sample.label === "relevant")} relevante, ${count((sample) => sample.label === "noise")} støy, ${count((sample) => sample.label === "uncertain")} usikre`);
  console.log(`Splitt: ${count((sample) => sample.split === "development")} development, ${count((sample) => sample.split === "test")} test (gruppert per kamp/avisutgave)`);
  console.log(`Development: ${count((sample) => sample.split === "development" && sample.label === "relevant")} relevante, ${count((sample) => sample.split === "development" && sample.label === "noise")} støy, ${count((sample) => sample.split === "development" && sample.label === "uncertain")} usikre`);
  console.log(`Test: ${count((sample) => sample.split === "test" && sample.label === "relevant")} relevante, ${count((sample) => sample.split === "test" && sample.label === "noise")} støy, ${count((sample) => sample.split === "test" && sample.label === "uncertain")} usikre`);
}

function printEvaluation(evaluation: PilotEvaluation, output: string): void {
  console.log(`\n=== RESULTAT (${evaluation.model}) ===`);
  for (const [name, method] of Object.entries(evaluation.methods)) {
    console.log(`${name.padEnd(9)} terskel ${method.selectedThreshold.toFixed(3)} | test recall ${formatPercent(method.test.recall)} | precision ${formatPercent(method.test.precision)} | støy fjernet ${formatPercent(method.test.noiseReduction)} | FN ${method.test.falseNegative}`);
  }
  console.log(`Tokenbruk: ${evaluation.usage.inputTokens} input, ${evaluation.usage.outputTokens} output`);
  console.log(`Rapport: ${output}`);
  if (evaluation.errors.length > 0) console.error(`Feil: ${evaluation.errors.length}. Cachede suksesser er bevart; kjør kommandoen på nytt.`);
}

function renderMarkdown(evaluation: PilotEvaluation): string {
  const rows = Object.entries(evaluation.methods).map(([name, method]) =>
    `| ${name} | ${method.selectedThreshold.toFixed(3)} | ${formatPercent(method.test.recall)} | ${formatPercent(method.test.precision)} | ${formatPercent(method.test.noiseReduction)} | ${method.test.falseNegative} |`,
  );
  const rankingRows = Object.entries(evaluation.methods).flatMap(([name, method]) => method.testRanking.map((ranking) =>
    `| ${name} | ${ranking.k} | ${ranking.reviewed} | ${ranking.relevantFound}/${ranking.relevantTotal} | ${formatPercent(ranking.recallAtK)} | ${formatPercent(ranking.precisionAtK)} |`,
  ));
  const provenance = evaluation.provenance
    ? `\n## Proveniens\n\n\`\`\`json\n${JSON.stringify(evaluation.provenance, null, 2)}\n\`\`\`\n`
    : "";
  const methodNotes = evaluation.methodNotes
    ? `\n## Metodemerknader\n\n${Object.entries(evaluation.methodNotes).map(([name, note]) => `- **${name}:** ${note}`).join("\n")}\n`
    : "";
  return `# Jev-pilot: Sunnmørsposten OCR\n\nGenerert ${evaluation.createdAt}. Modell: \`${evaluation.model}\`. Datasett: \`${evaluation.datasetKind ?? "ukjent"}\`. Tersklene er valgt på development-splittet med mål om minst ${formatPercent(evaluation.targetRecall)} recall og deretter brukt uendret på test-splittet.\n\n| Metode | Terskel | Test recall | Test precision | Støy fjernet | Falske negative |\n|---|---:|---:|---:|---:|---:|\n${rows.join("\n")}\n\n## Rangering på testsettet\n\n| Metode | K | Kontrollert | Relevante funnet | Recall@K | Precision@K |\n|---|---:|---:|---:|---:|---:|\n${rankingRows.join("\n")}\n\nDatasett: ${evaluation.dataset.relevant} relevante, ${evaluation.dataset.noise} støy og ${evaluation.dataset.uncertain} usikre fragmenter. Usikre fragmenter er ikke med i binærmålingen.\n${provenance}${methodNotes}\nTokenbruk: ${evaluation.usage.inputTokens} input og ${evaluation.usage.outputTokens} output.\n`;
}

function readInteger(value: string | undefined, fallback: number, name: string, min: number, max: number): number {
  if (value === undefined) return fallback;
  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < min || parsedValue > max) throw new Error(`${name} må være et heltall mellom ${min} og ${max}`);
  return parsedValue;
}

function readFraction(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0 || parsedValue > 1) throw new Error(`${name} må være større enn 0 og høyst 1`);
  return parsedValue;
}

function readDataset(value: string | undefined): "seed" | "raw" {
  if (value === undefined || value === "seed") return "seed";
  if (value === "raw") return "raw";
  throw new Error("--dataset må være seed eller raw");
}

function formatPercent(value: number): string {
  return `${(100 * value).toFixed(1)} %`;
}
