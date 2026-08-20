import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { assertMayFetch } from "../policy.js";
import { newspaperPageUrl } from "../adapters/nb-newspaper-access.js";
import { createIssueCache, discoverForGroup, discoverForSourceResult } from "../newspaper/discovery.js";
import { buildHypotheses, parseSourceResultId, sourceIdFromPath, sourceResultPopulation, withSiblings } from "../newspaper/source-result-query.js";
import { batchPolicyFor } from "../newspaper/batch-policy.js";
import type { Allocation, MatchHypothesis } from "../newspaper/allocation.js";
import type { DiscoveredIssue } from "../newspaper/discovery.js";
import type { DiscoveryResult } from "../newspaper/reconciliation.js";

/**
 * Avisdiscovery for kilderesultater.
 *
 * V1 kjører singletons automatisk. Hypoteser med siblings blir en synlig
 * manuell kø uten NB-kall. Den eksisterende allokeringen kan prøves eksplisitt
 * med `--resolve-siblings`, men er ikke standardpolicy.
 */

const args = parseArgs({
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  options: {
    "source-result": { type: "string" },
    "source-result-id": { type: "string" },
    year: { type: "string" },
    no: { type: "string" },
    "from-year": { type: "string" },
    "to-year": { type: "string" },
    "unlinked-only": { type: "boolean" },
    limit: { type: "string" },
    output: { type: "string" },
    enrich: { type: "string" },
    refresh: { type: "boolean" },
    "dry-run": { type: "boolean" },
    "resolve-siblings": { type: "boolean" },
    "skip-batches": { type: "string" },
    "group-keys": { type: "string" },
    "hypothesis-ids": { type: "string" },
  },
});

const identifier = args.values["source-result-id"] === undefined ? undefined : parseSourceResultId(args.values["source-result-id"]);
if (args.values["source-result-id"] !== undefined && identifier === undefined) {
  throw new Error("--source-result-id må være «sourceId:år:nr»");
}

const sourceId = identifier?.sourceId
  ?? (args.values["source-result"] === undefined ? undefined : sourceIdFromPath(args.values["source-result"]));
if (sourceId === undefined) {
  console.error("Bruk: pnpm ingest:nb-newspaper-discover -- --source-result data/source-results/<fil>.yaml [--year ÅR] [--no N] [--unlinked-only] [--limit 20]");
  process.exit(1);
}

const number = (value: string | undefined): number | undefined => (value === undefined ? undefined : Number(value));
const season = identifier?.season ?? number(args.values.year);
const no = identifier?.no ?? number(args.values.no);
const limit = number(args.values.limit);
const outputFile = args.values.output === undefined ? undefined : resolve(repoRoot(), args.values.output);
if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit må være et positivt heltall");

const archive = await loadArchive(dataDir());
if (archive.issues.length > 0) throw new Error(`arkivet har ${archive.issues.length} valideringsfeil`);

const selection = {
  sourceId,
  ...(season === undefined ? {} : { season }),
  ...(no === undefined ? {} : { no }),
  ...(number(args.values["from-year"]) === undefined ? {} : { fromYear: number(args.values["from-year"])! }),
  ...(number(args.values["to-year"]) === undefined ? {} : { toYear: number(args.values["to-year"])! }),
  ...(args.values["unlinked-only"] ? { unlinkedOnly: true } : {}),
};
const population = sourceResultPopulation(archive, selection);

const skipBatches = args.values["skip-batches"]?.split(",").map((s) => s.trim().toLowerCase()) ?? [];
const excludedHypothesisIds = new Set<string>();
if (skipBatches.some((b) => ["batch-01", "batch-1", "batch-01-v4", "batch-01-v3"].includes(b))) {
  const b1 = sourceResultPopulation(archive, { sourceId, fromYear: 1945, toYear: 1964, unlinkedOnly: true }).hypotheses.slice(0, 100);
  for (const h of b1) excludedHypothesisIds.add(h.hypothesis.id);
}
if (skipBatches.some((b) => ["batch-02", "batch-2", "batch-02-v3", "batch-02-v2"].includes(b))) {
  const b2 = sourceResultPopulation(archive, { sourceId, fromYear: 1950, toYear: 1964, unlinkedOnly: true }).hypotheses.slice(0, 260);
  for (const h of b2) excludedHypothesisIds.add(h.hypothesis.id);
}

const allowedGroupKeys = args.values["group-keys"] ? new Set(args.values["group-keys"].split(",").map((s) => s.trim())) : undefined;
const allowedHypothesisIds = args.values["hypothesis-ids"] ? new Set(args.values["hypothesis-ids"].split(",").map((s) => s.trim())) : undefined;

let candidateHypotheses = population.hypotheses;
if (excludedHypothesisIds.size > 0) {
  candidateHypotheses = candidateHypotheses.filter((item) => !excludedHypothesisIds.has(item.hypothesis.id));
}
if (allowedGroupKeys) {
  candidateHypotheses = candidateHypotheses.filter((item) => allowedGroupKeys.has(item.groupKey));
}
if (allowedHypothesisIds) {
  candidateHypotheses = candidateHypotheses.filter((item) => allowedHypothesisIds.has(item.hypothesis.id));
}

const selected = candidateHypotheses.slice(0, limit ?? candidateHypotheses.length);

console.log(`${population.summary.hypotheses} kamphypoteser valgt fra ${sourceId}${selected.length < population.summary.hypotheses ? `, tar de ${selected.length} første` : ""}.`);
console.log(stringify({ population: population.summary }).trim());

if (args.values["dry-run"]) {
  for (const planned of selected) {
    const query = planned.hypothesis.queries[0]!;
    const decision = batchPolicyFor(planned.hypothesis, planned.siblingGroupSize);
    const policy = decision.policy === "manual" ? `manual (${decision.reviewReason})` : "automatic";
    console.log(`  ${query.year} #${query.ref.no} ${query.printedOpponent} ${query.expectedScore?.join("-") ?? "?"} · ${policy}`);
  }
  process.exit(0);
}

const automaticSelected = selected.some((item) => batchPolicyFor(item.hypothesis, item.siblingGroupSize).policy === "automatic");
if (automaticSelected || args.values["resolve-siblings"]) assertMayFetch(archive, "nasjonalbiblioteket");

const cache = createIssueCache();
const metrics = {
  candidateIssuesFound: 0,
  issuesEnriched: 0,
  nbRequests: 0,
  hypothesesWithTemporalEvidence: 0,
  hypothesesWithResultAgreement: 0,
  hypothesesWithResultConflict: 0,
  hypothesesWithoutUsefulTemporalEvidence: 0,
  siblingGroupsSkipped: 0,
};
const records: ReportRecord[] = [];
const discoveryOptions = {
  cache,
  ...(number(args.values.enrich) === undefined ? {} : { enrich: number(args.values.enrich)! }),
  ...(args.values.refresh ? { refresh: true } : {}),
  onRequest: () => { metrics.nbRequests += 1; },
  onIssuesDiscovered: (count: number) => { metrics.candidateIssuesFound += count; },
  onIssueEnriched: () => { metrics.issuesEnriched += 1; },
};

for (const planned of selected.filter((item) => batchPolicyFor(item.hypothesis, item.siblingGroupSize).policy === "automatic")) {
  const result = await discoverForSourceResult(planned.hypothesis.queries[0]!, discoveryOptions);
  observe(result, metrics);
  records.push(toRecord(planned.hypothesis, result, result.issues, "automatic"));
  logResult(planned.hypothesis, result);
}

const manualPlans = selected.filter((item) => batchPolicyFor(item.hypothesis, item.siblingGroupSize).policy === "manual");
const selectedSiblingGroups = new Set(manualPlans.map((item) => item.groupKey));
const wantedManual = new Set(manualPlans.map((item) => item.hypothesis.id));
if (!args.values["resolve-siblings"]) {
  metrics.siblingGroupsSkipped = selectedSiblingGroups.size;
  for (const planned of manualPlans) {
    const decision = batchPolicyFor(planned.hypothesis, planned.siblingGroupSize);
    if (decision.policy !== "manual") continue;
    records.push(manualSiblingRecord(planned.hypothesis, planned.groupKey, decision.siblingGroupSize, planned.groupHypotheses));
    const query = planned.hypothesis.queries[0]!;
    console.log(`${query.year} #${query.ref.no} ${query.printedOpponent} → ambiguous · sibling_group (${decision.siblingGroupSize})`);
  }
} else {
  for (const [groupKey, group] of withSiblings(archive, selection)) {
    if (!selectedSiblingGroups.has(groupKey)) continue;
    const hypotheses = buildHypotheses(group);
    const results = await discoverForGroup(hypotheses, discoveryOptions);
    for (const hypothesis of hypotheses) {
      if (!wantedManual.has(hypothesis.id)) continue;
      const result = results.get(hypothesis.id);
      if (!result) continue;
      observe(result, metrics);
      records.push({ ...toRecord(hypothesis, result, [], "experimental_sibling_allocation"), allocation: result.allocation });
      logResult(hypothesis, result);
    }
  }
}

const summary = reportSummary(records, population.summary, metrics);
console.log(`\n${stringify({ summary }).trim()}`);

if (outputFile) {
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, stringify({
    version: 1,
    createdAt: new Date().toISOString(),
    sourceId,
    population: population.summary,
    summary,
    records,
  }), "utf8");
  console.log(`Rapport: ${outputFile}`);
}

type ReportRecord = (ReturnType<typeof toRecord> | ReturnType<typeof manualSiblingRecord>) & { allocation?: Allocation };

function logResult(hypothesis: MatchHypothesis, result: DiscoveryResult): void {
  const query = hypothesis.queries[0]!;
  console.log(`${query.year} #${query.ref.no} ${query.printedOpponent} ${query.expectedScore?.join("-") ?? "?"}`
    + ` → ${result.status}${result.matchDate ? ` · ${result.matchDate.value} (${result.matchDate.confidence})` : ""}`
    + `${result.newspaperScore ? ` · avisa: ${result.newspaperScore.join("-")}` : ""}`);
}

function observe(result: DiscoveryResult, target: typeof metrics): void {
  if (result.evidence.some((item) => item.temporal !== undefined)) target.hypothesesWithTemporalEvidence += 1;
  else target.hypothesesWithoutUsefulTemporalEvidence += 1;
  if (result.checks.score === "confirmed") target.hypothesesWithResultAgreement += 1;
  if (result.checks.score === "conflict") target.hypothesesWithResultConflict += 1;
}

function manualSiblingRecord(
  hypothesis: MatchHypothesis,
  groupKey: string,
  siblingGroupSize: number,
  groupHypotheses: MatchHypothesis[],
) {
  const query = hypothesis.queries[0]!;
  return {
    sourceResults: hypothesis.queries.map((member) => member.ref),
    hypothesisId: hypothesis.id,
    ...(query.resultGroupId ? { resultGroupId: query.resultGroupId } : {}),
    policy: "manual" as const,
    status: "ambiguous" as const,
    reviewReason: "sibling_group" as const,
    siblingGroup: {
      key: groupKey,
      size: siblingGroupSize,
      hypotheses: groupHypotheses.map((member) => ({
        hypothesisId: member.id,
        sourceResults: member.queries.map((query) => query.ref),
      })),
    },
    input: inputFor(hypothesis),
  };
}

function reportSummary(records: ReportRecord[], populationSummary: typeof population.summary, runMetrics: typeof metrics) {
  const statuses = { confirmed: 0, conflict: 0, probable: 0, ambiguous: 0, not_found: 0 };
  for (const record of records) statuses[record.status] += 1;
  return {
    totalHypotheses: records.length,
    automaticSingletonHypotheses: records.filter((record) => record.policy === "automatic").length,
    manualSiblingHypotheses: records.filter((record) => record.policy === "manual").length,
    ...statuses,
    ...runMetrics,
    population: populationSummary,
  };
}

/** Rapporten inneholder utledede fakta og lenker, aldri beskyttet OCR-tekst. */
function toRecord(hypothesis: MatchHypothesis, result: DiscoveryResult, issues: DiscoveredIssue[], policy: "automatic" | "experimental_sibling_allocation") {
  const query = hypothesis.queries[0]!;
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  return {
    sourceResults: hypothesis.queries.map((member) => member.ref),
    hypothesisId: hypothesis.id,
    ...(query.resultGroupId ? { resultGroupId: query.resultGroupId } : {}),
    policy,
    input: inputFor(hypothesis),
    status: result.status,
    ...(result.matchDate ? { matchDate: result.matchDate } : {}),
    ...(result.newspaperScore ? { newspaperScore: result.newspaperScore } : {}),
    ...(result.sourceScore ? { sourceScore: result.sourceScore } : {}),
    checks: result.checks,
    combinedConfidence: result.combinedConfidence,
    evidence: result.evidence.slice(0, 5).map((item) => {
      const issue = byId.get(item.issueId);
      return {
        issueId: item.issueId,
        ...(item.issueDate ? { issueDate: item.issueDate } : {}),
        ...(issue?.urn ? { urn: issue.urn } : {}),
        ...(item.page ? { page: item.page } : {}),
        url: newspaperPageUrl(item.issueId, item.page),
        type: item.kind,
        score: item.score,
        ...(item.temporal ? { temporalPhrase: item.temporal.phrase, inferredMatchDate: item.temporal.inferredMatchDate } : {}),
        ...(item.scoreFound ? { newspaperScore: item.scoreFound } : {}),
        reasons: item.reasons,
      };
    }),
  };
}

function inputFor(hypothesis: MatchHypothesis) {
  const query = hypothesis.queries[0]!;
  return {
    year: query.year,
    opponent: query.printedOpponent,
    ...(query.opponentClubId ? { opponentClubId: query.opponentClubId } : {}),
    expectedScores: hypothesis.queries.flatMap((member) => member.expectedScore ? [[...member.expectedScore]] : []),
    ...(query.competitionHint ? { competitionHint: query.competitionHint } : {}),
    ...(query.homeAwayHint ? { homeAwayHint: query.homeAwayHint } : {}),
  };
}
