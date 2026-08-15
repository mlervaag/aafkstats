import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
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
import { runPreservationAudit } from "../historical/preservation.js";
import { auditSourceInventory, type HistoricalAuditScope, type SourceInventoryResult } from "../historical/source-inventory.js";
import { calculateHarvestMetrics, type SemanticHarvestMetrics } from "../historical/harvest-diff.js";
import { markdownV1Parser, type ReviewValidationResult } from "../historical/review-parser.js";
import { repoRoot, dataDir } from "../load.js";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

export interface HistoricalAuditCliOptions {
  sources: string[];
  parentSourceId?: string;
  yearFrom?: number;
  yearTo?: number;
  reviewFile?: string;
  base?: string;
  head?: string;
  json?: boolean;
  summaryFile?: string;
}

export function parseHistoricalAuditCliArgs(args: string[]): HistoricalAuditCliOptions {
  const options: HistoricalAuditCliOptions = { sources: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--source" && args[i + 1] !== undefined) {
      options.sources.push(args[++i]!);
    } else if (arg === "--parent-source" && args[i + 1] !== undefined) {
      options.parentSourceId = args[++i]!;
    } else if (arg === "--year-from" && args[i + 1] !== undefined) {
      const val = args[++i]!;
      options.yearFrom = Number.parseInt(val, 10);
    } else if (arg === "--year-to" && args[i + 1] !== undefined) {
      const val = args[++i]!;
      options.yearTo = Number.parseInt(val, 10);
    } else if (arg === "--review-file" && args[i + 1] !== undefined) {
      options.reviewFile = args[++i]!;
    } else if (arg === "--base" && args[i + 1] !== undefined) {
      options.base = args[++i]!;
    } else if (arg === "--head" && args[i + 1] !== undefined) {
      options.head = args[++i]!;
    } else if (arg === "--summary-file" && args[i + 1] !== undefined) {
      options.summaryFile = args[++i]!;
    } else if (arg === "--json") {
      options.json = true;
    }
  }
  return options;
}

export interface HistoricalAuditReport {
  scope: HistoricalAuditScope;
  baseRef: string;
  headRef: string;
  inventory: SourceInventoryResult;
  metrics: SemanticHarvestMetrics;
  review?: ReviewValidationResult;
  passed: boolean;
}

export function formatAuditConsole(report: HistoricalAuditReport): string {
  const { scope, inventory, metrics, review, passed } = report;
  const lines: string[] = [];

  lines.push(`${BOLD}Historical harvest audit${RESET}`);
  lines.push(`${DIM}────────────────────────────────────────${RESET}`);
  lines.push("");

  // Scope label
  let scopeLabel = "Entire catalog";
  if (scope.parentSourceId) {
    scopeLabel = scope.parentSourceId;
    if (scope.yearFrom && scope.yearTo) {
      scopeLabel += ` ${scope.yearFrom}–${scope.yearTo}`;
    } else if (scope.yearFrom) {
      scopeLabel += ` fra ${scope.yearFrom}`;
    }
  } else if (scope.sourceIds && scope.sourceIds.length > 0) {
    scopeLabel = scope.sourceIds.join(", ");
  }

  lines.push(`${BOLD}Scope:${RESET}`);
  lines.push(`${CYAN}${scopeLabel}${RESET}`);
  lines.push("");

  const pad = (label: string, count: number, color = RESET) =>
    `${label.padEnd(36)} ${color}${String(count).padStart(4)}${RESET}`;

  lines.push(`${BOLD}Sources${RESET}`);
  lines.push(`${DIM}----------------------------------------${RESET}`);
  lines.push(pad("Discovered:", inventory.summary.discovered));
  lines.push(pad("In scope:", inventory.summary.inScope));
  lines.push(pad("Reviewed:", inventory.summary.reviewed, GREEN));
  lines.push(pad("Unavailable:", inventory.summary.unavailable));
  lines.push(pad("Reprints:", inventory.summary.reprints));
  lines.push("");

  lines.push(`${BOLD}Extraction${RESET}`);
  lines.push(`${DIM}----------------------------------------${RESET}`);
  lines.push(pad("ALTO complete:", inventory.summary.altoComplete, GREEN));
  lines.push(pad("Manual/no-ALTO:", inventory.summary.manualOrNoAlto));
  lines.push(pad("Failed sources:", inventory.summary.failedSources, inventory.summary.failedSources > 0 ? RED : RESET));
  lines.push("");

  lines.push(`${BOLD}Harvest diff${RESET}`);
  lines.push(`${DIM}----------------------------------------${RESET}`);
  lines.push(pad("New people:", metrics.newPeople, metrics.newPeople > 0 ? GREEN : RESET));
  lines.push(pad("Existing people enriched:", metrics.existingPeopleEnriched, metrics.existingPeopleEnriched > 0 ? GREEN : RESET));
  lines.push(pad("Person sourceRefs added:", metrics.personSourceRefsAdded, metrics.personSourceRefsAdded > 0 ? GREEN : RESET));
  lines.push("");
  lines.push(pad("Roles created:", metrics.rolesCreated, metrics.rolesCreated > 0 ? GREEN : RESET));
  lines.push(pad("Roles source-enriched:", metrics.rolesSourceEnriched, metrics.rolesSourceEnriched > 0 ? GREEN : RESET));
  lines.push(pad("Honorary roles created:", metrics.honoraryRolesCreated, metrics.honoraryRolesCreated > 0 ? GREEN : RESET));
  lines.push("");
  lines.push(pad("Source-result entries added:", metrics.sourceResultEntriesAdded, metrics.sourceResultEntriesAdded > 0 ? GREEN : RESET));
  lines.push(pad("Canonical matches created:", metrics.canonicalMatchesCreated));
  lines.push(pad("Canonical matches enriched:", metrics.canonicalMatchesEnriched));
  lines.push("");
  lines.push(pad("Snapshots added:", metrics.snapshotsAdded, metrics.snapshotsAdded > 0 ? GREEN : RESET));
  lines.push(pad("Historical observations added:", metrics.historicalObservationsAdded, metrics.historicalObservationsAdded > 0 ? GREEN : RESET));
  lines.push("");
  lines.push(pad("Conflicts created:", metrics.conflictsCreated));
  lines.push(pad("Conflicts resolved:", metrics.conflictsResolved, metrics.conflictsResolved > 0 ? GREEN : RESET));
  lines.push("");

  lines.push(`${BOLD}Preservation${RESET}`);
  lines.push(`${DIM}----------------------------------------${RESET}`);
  lines.push(pad("Destructive changes:", metrics.destructiveChanges, metrics.destructiveChanges > 0 ? RED : GREEN));
  lines.push(pad("Approved exceptions:", metrics.approvedExceptions));
  lines.push("");

  if (review) {
    lines.push(`${BOLD}Review Document Validation (${review.parserName})${RESET}`);
    lines.push(`${DIM}----------------------------------------${RESET}`);
    if (review.pagesReviewedClaim) {
      lines.push(`Sidekontroll: ${review.pagesReviewedClaim.reviewed}/${review.pagesReviewedClaim.total} sider (${review.pagesReviewedClaim.isFull ? "Fullført" : "Ufullstendig"})`);
    }
    if (review.issues.length > 0) {
      for (const issue of review.issues) {
        lines.push(`  ${issue.type === "placeholder" ? RED : YELLOW}!${RESET} Linje ${issue.line ?? "?"}: ${issue.message}`);
      }
    } else {
      lines.push(`${GREEN}✓${RESET} Review-dokumentet har ingen åpne placeholders eller mangler.`);
    }
    lines.push("");
  }

  if (passed) {
    lines.push(`${GREEN}✓ PASS${RESET}`);
  } else {
    lines.push(`${RED}✗ FAIL${RESET}`);
  }

  return lines.join("\n");
}

export async function main() {
  const options = parseHistoricalAuditCliArgs(process.argv.slice(2));
  const root = repoRoot();
  const rootDataDir = dataDir();

  let baseRef = options.base;
  let headRef = options.head;

  try {
    if (!baseRef) {
      baseRef = await getDefaultBaseRevision(root);
    }
    if (!headRef) {
      headRef = "working-tree";
    }

    const baseSha = await resolveGitSha(baseRef, root);
    const headSha = headRef === "working-tree" ? "working-tree" : await resolveGitSha(headRef, root);

    // Last kilder og providers
    const sourcesMap = (await loadYamlMap(null, "data/sources", source, root)).items;
    const providersMap = (await loadYamlMap(null, "data/providers", provider, root)).items;
    const extractionsMap = (await loadYamlMap(null, "data/extractions", publicationExtraction, root)).items;
    const sourceResultsMap = (await loadYamlMap(null, "data/source-results", sourceResultCollection, root)).items;

    const scope: HistoricalAuditScope = {
      sourceIds: options.sources.length > 0 ? options.sources : undefined,
      parentSourceId: options.parentSourceId,
      yearFrom: options.yearFrom,
      yearTo: options.yearTo,
    };

    // 1. Source inventory audit
    const inventory = auditSourceInventory(sourcesMap, providersMap, extractionsMap, sourceResultsMap, scope);

    // 2. Preservation audit
    const { exceptions } = await loadPreservationExceptions(rootDataDir);
    const basePeople = (await loadYamlMap(baseSha, "data/people", person, root)).items;
    const headPeople = (await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/people", person, root)).items;
    const preservationResult = runPreservationAudit(basePeople, headPeople, exceptions, baseSha, headSha);

    // 3. Last øvrige datasett for semantisk harvest diff
    const baseSourceResults = (await loadYamlMap(baseSha, "data/source-results", sourceResultCollection, root)).items;
    const headSourceResults = (await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/source-results", sourceResultCollection, root)).items;

    const baseSnapshots = (await loadYamlMap(baseSha, "data/organization/snapshots", organizationSnapshot, root)).items;
    const headSnapshots = (await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/organization/snapshots", organizationSnapshot, root)).items;

    const baseObservations = (await loadYamlMap(baseSha, "data/observations", historicalObservation, root)).items;
    const headObservations = (await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/observations", historicalObservation, root)).items;

    const baseMatches = (await loadYamlMap(baseSha, "data/seasons", match, root, (m) => m.id)).items;
    const headMatches = (await loadYamlMap(headRef === "working-tree" ? null : headSha, "data/seasons", match, root, (m) => m.id)).items;

    const metrics = calculateHarvestMetrics(
      {
        basePeople,
        headPeople,
        baseSourceResults,
        headSourceResults,
        baseSnapshots,
        headSnapshots,
        baseObservations,
        headObservations,
        baseMatches,
        headMatches,
      },
      preservationResult.summary.destructiveChanges,
      preservationResult.summary.approvedExceptions,
    );

    // 4. Review-parser (dersom review-fil er oppgitt eller finnes)
    let reviewResult: ReviewValidationResult | undefined;
    if (options.reviewFile) {
      const reviewPath = resolve(root, options.reviewFile);
      if (existsSync(reviewPath)) {
        const reviewText = await readFile(reviewPath, "utf8");
        reviewResult = markdownV1Parser.parseReview(reviewText, { knownSourceIds: new Set(sourcesMap.keys()) });
      }
    }

    const passed =
      inventory.allSourcesPassed &&
      preservationResult.passed &&
      (reviewResult ? reviewResult.passed : true);

    const report: HistoricalAuditReport = {
      scope,
      baseRef: baseSha,
      headRef: headSha,
      inventory,
      metrics,
      review: reviewResult,
      passed,
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatAuditConsole(report));
    }

    if (!passed) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`${RED}AUDIT_ERROR:${RESET} ${String(err)}`);
    process.exit(1);
  }
}

await main();
