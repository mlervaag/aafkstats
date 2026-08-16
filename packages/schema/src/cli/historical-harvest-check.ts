import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot, dataDir } from "../load.js";
import { source } from "../source.js";
import { provider } from "../entities.js";
import { publicationExtraction } from "../extraction.js";
import { sourceResultCollection } from "../source-result.js";
import { person } from "../person.js";
import { organizationSnapshot } from "../organization.js";
import { historicalObservation } from "../historical-observation.js";
import { match } from "../match.js";
import { loadPreservationExceptions } from "../preservation-exceptions.js";
import { getDefaultBaseRevision, loadYamlMap, resolveGitSha } from "../historical/git.js";
import { harvestBatchManifest } from "../historical/harvest-manifest.js";
import { auditHarvestBatch, type HarvestAuditReport } from "../historical/harvest-audit-engine.js";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

export interface HarvestCheckCliOptions {
  batchId?: string;
  file?: string;
  base?: string;
  head?: string;
  json?: boolean;
}

export function parseCheckCliArgs(args: string[]): HarvestCheckCliOptions {
  const options: HarvestCheckCliOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--batch" && args[i + 1] !== undefined) {
      options.batchId = args[++i]!;
    } else if (arg === "--file" && args[i + 1] !== undefined) {
      options.file = args[++i]!;
    } else if (arg === "--base" && args[i + 1] !== undefined) {
      options.base = args[++i]!;
    } else if (arg === "--head" && args[i + 1] !== undefined) {
      options.head = args[++i]!;
    } else if (arg === "--json") {
      options.json = true;
    }
  }
  return options;
}

export function formatHarvestConsoleReport(report: HarvestAuditReport): string {
  const lines: string[] = [];

  lines.push(`${BOLD}Historical Harvest Batch${RESET}`);
  lines.push(`${DIM}────────────────────────────────────────${RESET}`);
  lines.push("");
  lines.push(`${BOLD}Batch:${RESET}      ${CYAN}${report.manifest.id}${RESET}`);
  lines.push(`${BOLD}Profile:${RESET}    ${report.manifest.profile} (${report.profileName})`);
  lines.push(`${BOLD}Mode:${RESET}       ${report.mode}`);
  lines.push(`${BOLD}Status:${RESET}     ${report.status === "complete" ? GREEN : YELLOW}${report.status}${RESET}`);
  lines.push("");

  const pad = (label: string, count: string | number, color = RESET) =>
    `${label.padEnd(28)} ${color}${String(count).padStart(6)}${RESET}`;

  lines.push(`${BOLD}Sources${RESET}`);
  lines.push(`${DIM}────────────────────────────────────────${RESET}`);
  lines.push(pad("In scope:", report.sourcesSummary.inScope));
  lines.push(pad("Reviewed:", report.sourcesSummary.reviewed, report.sourcesSummary.reviewed > 0 ? GREEN : RESET));
  lines.push(pad("Reprints:", report.sourcesSummary.reprints));
  lines.push(pad("Unavailable:", report.sourcesSummary.unavailable));
  if (report.sourcesSummary.outOfScope > 0) {
    lines.push(pad("Out of scope:", report.sourcesSummary.outOfScope));
  }
  if (report.sourcesSummary.unknown > 0) {
    lines.push(pad("Unknown review status:", report.sourcesSummary.unknown, YELLOW));
  }
  lines.push("");

  lines.push(`${BOLD}Pages${RESET}`);
  lines.push(`${DIM}────────────────────────────────────────${RESET}`);
  lines.push(pad("Available pages:", report.pagesSummary.expected));
  lines.push(pad("Reviewed:", report.pagesSummary.reviewed, report.pagesSummary.isFull ? GREEN : YELLOW));
  lines.push(pad("Coverage:", `${report.pagesSummary.coveragePct}%`, report.pagesSummary.isFull ? GREEN : YELLOW));
  lines.push("");

  lines.push(`${BOLD}Findings${RESET}`);
  lines.push(`${DIM}────────────────────────────────────────${RESET}`);
  lines.push(pad("Total findings:", report.findingsSummary.total));
  lines.push(pad("Normalized:", report.findingsSummary.normalized, report.findingsSummary.normalized > 0 ? GREEN : RESET));
  lines.push(pad("Unresolved:", report.findingsSummary.unresolved, report.findingsSummary.unresolved > 0 ? YELLOW : RESET));
  lines.push(pad("Missing disposition:", report.findingsSummary.missingDisposition, report.findingsSummary.missingDisposition > 0 ? RED : GREEN));
  lines.push("");

  lines.push(`${BOLD}Targets${RESET}`);
  lines.push(`${DIM}────────────────────────────────────────${RESET}`);
  lines.push(pad("Person targets:", report.targetsSummary.personTargets));
  lines.push(pad("Roles:", report.targetsSummary.roles));
  lines.push(pad("Source-results:", report.targetsSummary.sourceResults));
  lines.push(pad("Canonical matches:", report.targetsSummary.canonicalMatches));
  lines.push(pad("Observations:", report.targetsSummary.observations));
  lines.push(pad("Snapshots:", report.targetsSummary.snapshots));
  lines.push("");

  lines.push(`${BOLD}Preservation${RESET}`);
  lines.push(`${DIM}────────────────────────────────────────${RESET}`);
  lines.push(pad("Destructive changes:", report.preservation.destructiveChanges, report.preservation.destructiveChanges > 0 ? RED : GREEN));
  lines.push(pad("Approved exceptions:", report.preservation.approvedExceptions));
  lines.push("");

  if (report.issues.length > 0) {
    lines.push(`${BOLD}Audit Issues:${RESET}`);
    for (const issue of report.issues) {
      const icon = issue.type === "error" ? `${RED}✗${RESET}` : `${YELLOW}!${RESET}`;
      lines.push(`  ${icon} [${issue.category}] ${issue.message}`);
    }
    lines.push("");
  }

  if (report.passed) {
    lines.push(`${GREEN}✓ PASS${RESET}`);
  } else {
    lines.push(`${RED}✗ FAIL${RESET}`);
  }

  return lines.join("\n");
}

export async function runHarvestCheck(options: HarvestCheckCliOptions, root = repoRoot()): Promise<HarvestAuditReport> {
  const rootDataDir = dataDir();

  let manifestFilePath: string;
  if (options.file) {
    manifestFilePath = resolve(root, options.file);
  } else if (options.batchId) {
    manifestFilePath = resolve(root, `data/harvests/${options.batchId}.yaml`);
  } else {
    throw new Error("Må oppgi enten --batch <batch-id> eller --file <sti-til-manifest>");
  }

  if (!existsSync(manifestFilePath)) {
    throw new Error(`Batchmanifest «${manifestFilePath}» finnes ikke`);
  }

  const rawContent = await readFile(manifestFilePath, "utf8");
  const rawParsed = parseYaml(rawContent, { schema: "core" });
  const parseRes = harvestBatchManifest.safeParse(rawParsed);

  if (!parseRes.success) {
    throw new Error(`Ugyldig batchmanifest-skjema:\n${parseRes.error.issues.map((e) => `  ${e.path.join(".")}: ${e.message}`).join("\n")}`);
  }

  const manifest = parseRes.data;

  let baseRef = options.base ?? manifest.baseRevision;
  const headRef = options.head ?? "working-tree";

  if (!baseRef) {
    baseRef = await getDefaultBaseRevision(root);
  }

  const baseSha = await resolveGitSha(baseRef, root);
  const headSha = headRef === "working-tree" ? "working-tree" : await resolveGitSha(headRef, root);

  // Last kilder og providers
  const sourcesLoad = await loadYamlMap(null, "data/sources", source, root);
  const providersLoad = await loadYamlMap(null, "data/providers", provider, root);
  const extractionsLoad = await loadYamlMap(null, "data/extractions", publicationExtraction, root);
  const sourceResultsLoad = await loadYamlMap(null, "data/source-results", sourceResultCollection, root);

  const basePeopleLoad = await loadYamlMap(baseSha, "data/people", person, root);
  const headPeopleLoad = await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/people", person, root);

  const baseSourceResultsLoad = await loadYamlMap(baseSha, "data/source-results", sourceResultCollection, root);
  const headSourceResultsLoad = await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/source-results", sourceResultCollection, root);

  const baseSnapshotsLoad = await loadYamlMap(baseSha, "data/organization/snapshots", organizationSnapshot, root);
  const headSnapshotsLoad = await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/organization/snapshots", organizationSnapshot, root);

  const isTopLevelObservation = (f: string) => !f.replace(/^data\/observations\//, "").includes("/");
  const baseObservationsLoad = await loadYamlMap(baseSha, "data/observations", historicalObservation, root, undefined, isTopLevelObservation);
  const headObservationsLoad = await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/observations", historicalObservation, root, undefined, isTopLevelObservation);

  const isMatchFile = (f: string) => f.includes("/matches/");
  const baseMatchesLoad = await loadYamlMap(baseSha, "data/seasons", match, root, (m) => m.id, isMatchFile);
  const headMatchesLoad = await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/seasons", match, root, (m) => m.id, isMatchFile);

  const { exceptions } = await loadPreservationExceptions(rootDataDir);

  const report = auditHarvestBatch({
    manifest,
    allSources: sourcesLoad.items,
    allProviders: providersLoad.items,
    allExtractions: extractionsLoad.items,
    allSourceResults: sourceResultsLoad.items,
    basePeople: basePeopleLoad.items,
    headPeople: headPeopleLoad.items,
    baseSourceResults: baseSourceResultsLoad.items,
    headSourceResults: headSourceResultsLoad.items,
    baseSnapshots: baseSnapshotsLoad.items,
    headSnapshots: headSnapshotsLoad.items,
    baseObservations: baseObservationsLoad.items,
    headObservations: headObservationsLoad.items,
    baseMatches: baseMatchesLoad.items,
    headMatches: headMatchesLoad.items,
    exceptions,
    baseSha,
    headSha,
  });

  return report;
}

export async function main() {
  const options = parseCheckCliArgs(process.argv.slice(2));
  try {
    const report = await runHarvestCheck(options);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatHarvestConsoleReport(report));
    }

    if (!report.passed) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`${RED}HARVEST_CHECK_ERROR:${RESET} ${String(err)}`);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("historical-harvest-check")) {
  await main();
}
