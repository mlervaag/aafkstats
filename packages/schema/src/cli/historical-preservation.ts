import { appendFileSync } from "node:fs";
import { getDefaultBaseRevision, resolveGitSha } from "../historical/git.js";
import { runFullPreservationAudit, type FullPreservationResult } from "../historical/full-preservation.js";
import { repoRoot } from "../load.js";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

export interface CliOptions {
  base?: string;
  head?: string;
  dir?: string;
  json?: boolean;
  summaryFile?: string;
}

export function parsePreservationCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--base" && args[i + 1] !== undefined) {
      options.base = args[++i]!;
    } else if (arg === "--head" && args[i + 1] !== undefined) {
      options.head = args[++i]!;
    } else if (arg === "--dir" && args[i + 1] !== undefined) {
      options.dir = args[++i]!;
    } else if (arg === "--summary-file" && args[i + 1] !== undefined) {
      options.summaryFile = args[++i]!;
    } else if (arg === "--json") {
      options.json = true;
    }
  }
  return options;
}

export function formatPreservationConsole(result: FullPreservationResult): string {
  const { summary, changes, baseRef, headRef, passed } = result;
  const lines: string[] = [];

  lines.push(`${BOLD}Historical preservation audit${RESET}`);
  lines.push(`${DIM}────────────────────────────────────────${RESET}`);
  lines.push("");
  lines.push(`Base:  ${CYAN}${baseRef.slice(0, 12)}${RESET}`);
  lines.push(`Head:  ${CYAN}${headRef.slice(0, 12)}${RESET}`);
  lines.push("");

  const pad = (label: string, count: number, color = RESET) =>
    `${label.padEnd(36)} ${color}${String(count).padStart(4)}${RESET}`;

  lines.push(pad("People checked:", summary.peopleChecked));
  lines.push(pad("Existing people changed:", summary.existingPeopleChanged));
  lines.push(pad("Archive entities checked:", summary.archiveEntitiesChecked));
  lines.push(pad("Archive files deleted:", summary.archiveFilesDeleted, summary.archiveFilesDeleted > 0 ? RED : RESET));
  lines.push("");
  lines.push(pad("Additions:", summary.additions, summary.additions > 0 ? GREEN : RESET));
  lines.push(pad("Safe enrichments:", summary.safeEnrichments, summary.safeEnrichments > 0 ? GREEN : RESET));
  lines.push(pad("Review required:", summary.reviewRequired, summary.reviewRequired > 0 ? YELLOW : RESET));
  lines.push(pad("Approved exceptions:", summary.approvedExceptions, summary.approvedExceptions > 0 ? CYAN : RESET));
  lines.push(pad("Destructive changes:", summary.destructiveChanges, summary.destructiveChanges > 0 ? RED : RESET));
  lines.push("");

  if (summary.selfApprovedExceptions.length > 0) {
    lines.push(`${RED}${BOLD}SELF-APPROVED EXCEPTIONS:${RESET} ${summary.selfApprovedExceptions.length} unntak er lagt til i denne endringen og gjelder ikke:`);
    for (const ex of summary.selfApprovedExceptions) {
      lines.push(`  ${RED}✗${RESET} ${ex.entity}/${ex.id} (${ex.path}, ${ex.change})`);
    }
    lines.push(`  ${DIM}Et unntak må godkjennes i en egen endring før det kan brukes.${RESET}`);
    lines.push("");
  }

  if (summary.staleExceptions.length > 0) {
    lines.push(`${YELLOW}${BOLD}WARNING:${RESET} ${summary.staleExceptions.length} preservation exception(s) matched no detected change:`);
    for (const ex of summary.staleExceptions) {
      lines.push(`  ${DIM}-${RESET} ${ex.entity}/${ex.id} (${ex.path})`);
    }
    lines.push("");
  }

  const destructive = changes.filter((c) => c.status === "DESTRUCTIVE_CHANGE");
  if (destructive.length > 0) {
    lines.push(`${RED}${BOLD}DESTRUCTIVE CHANGES DETECTED:${RESET}`);
    lines.push(`${DIM}────────────────────────────────────────${RESET}`);
    for (const c of destructive) {
      lines.push("");
      lines.push(`  ${RED}✗${RESET} ${BOLD}${c.entity}:${RESET} ${c.id}`);
      lines.push(`    ${BOLD}Path:${RESET}   ${c.path}`);
      lines.push(`    ${BOLD}Change:${RESET} ${c.changeType}`);
      lines.push(`    ${BOLD}Detail:${RESET} ${c.message}`);
      if (c.baseValue !== undefined) {
        lines.push(`    ${DIM}BASE:${RESET}   ${JSON.stringify(c.baseValue)}`);
      }
      if (c.headValue !== undefined) {
        lines.push(`    ${DIM}HEAD:${RESET}   ${JSON.stringify(c.headValue)}`);
      } else {
        lines.push(`    ${DIM}HEAD:${RESET}   <missing>`);
      }
    }
    lines.push("");
  }

  const reviews = changes.filter((c) => c.status === "REVIEW_REQUIRED");
  if (reviews.length > 0) {
    lines.push(`${YELLOW}${BOLD}REVIEW REQUIRED:${RESET}`);
    for (const c of reviews) {
      lines.push(`  ${YELLOW}!${RESET} ${c.entity} «${c.id}» (${c.path}): ${c.message}`);
    }
    lines.push("");
  }

  if (passed) {
    lines.push(`${GREEN}✓ PASS${RESET} – no historical data loss detected.`);
  } else {
    lines.push(`${RED}✗ FAIL${RESET} – destructive changes detected without approved exception.`);
  }

  return lines.join("\n");
}

export function formatPreservationStepSummary(result: FullPreservationResult): string {
  const { summary, changes, baseRef, headRef, passed } = result;
  const lines: string[] = [];

  lines.push("## 🛡️ Historical Preservation Audit");
  lines.push("");
  if (passed) {
    lines.push("✅ **No destructive historical changes detected.**");
  } else {
    lines.push("❌ **Destructive historical changes detected.**");
  }
  lines.push("");
  lines.push(`- **Base ref:** \`${baseRef.slice(0, 10)}\``);
  lines.push(`- **Head ref:** \`${headRef.slice(0, 10)}\``);
  lines.push(`- **People checked:** ${summary.peopleChecked}`);
  lines.push(`- **People changed:** ${summary.existingPeopleChanged}`);
  lines.push(`- **Archive entities checked:** ${summary.archiveEntitiesChecked}`);
  lines.push(`- **Archive files deleted:** ${summary.archiveFilesDeleted}`);
  lines.push(`- **Safe enrichments:** ${summary.safeEnrichments}`);
  lines.push(`- **Approved exceptions:** ${summary.approvedExceptions}`);
  lines.push(`- **Destructive changes:** ${summary.destructiveChanges}`);
  lines.push("");

  const destructive = changes.filter((c) => c.status === "DESTRUCTIVE_CHANGE");
  if (destructive.length > 0) {
    lines.push("### ❌ Destructive changes");
    lines.push("| Entity | Id | Path | Change | Detail |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const c of destructive) {
      lines.push(`| \`${c.entity}\` | \`${c.id}\` | \`${c.path}\` | \`${c.changeType}\` | ${c.message} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function main() {
  const options = parsePreservationCliArgs(process.argv.slice(2));
  const root = repoRoot();

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

    const auditResult = await runFullPreservationAudit(baseSha, headRef, headSha, root);

    if (options.json) {
      console.log(JSON.stringify(auditResult, null, 2));
    } else {
      console.log(formatPreservationConsole(auditResult));
    }

    // Skriv til GitHub Actions step summary dersom tilgjengelig
    const summaryFile = options.summaryFile ?? process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      try {
        appendFileSync(summaryFile, `${formatPreservationStepSummary(auditResult)}\n`, "utf8");
      } catch {
        // Ignorer skrivefeil til step summary
      }
    }

    if (!auditResult.passed) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`${RED}AUDIT_ERROR:${RESET} ${String(err)}`);
    process.exit(1);
  }
}

await main();
