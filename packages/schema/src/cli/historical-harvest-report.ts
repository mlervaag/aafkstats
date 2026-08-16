import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { repoRoot } from "../load.js";
import { parseCheckCliArgs, runHarvestCheck } from "./historical-harvest-check.js";
import type { HarvestAuditReport } from "../historical/harvest-audit-engine.js";

export function generateMarkdownReport(report: HarvestAuditReport): string {
  const {
    manifest,
    profileName,
    mode,
    status,
    sourcesSummary,
    pagesSummary,
    findingsSummary,
    preservation,
    metrics,
    issues,
    passed,
  } = report;

  const lines: string[] = [];

  lines.push(`# Innhøstingsrapport: ${manifest.title}`);
  lines.push("");
  lines.push(`- **Batch-ID:** \`${manifest.id}\``);
  lines.push(`- **Kildeprofil:** \`${manifest.profile}\` (${profileName})`);
  lines.push(`- **Modus:** \`${mode}\``);
  lines.push(`- **Status:** \`${status}\``);
  lines.push(`- **Opprettet:** ${manifest.createdAt ?? "-"}`);
  lines.push("");

  // 1. Scope
  lines.push("## Scope");
  lines.push("");
  if (manifest.scope.parentSourceId) {
    lines.push(`- **Kildeserie:** \`${manifest.scope.parentSourceId}\``);
  }
  if (manifest.scope.years?.from || manifest.scope.years?.to) {
    lines.push(`- **År:** ${manifest.scope.years.from ?? "–"} til ${manifest.scope.years.to ?? "–"}`);
  }
  lines.push(`- **Kilder i scope:** ${sourcesSummary.inScope}`);
  lines.push("");

  // 2. Source Inventory
  lines.push("## Source Inventory");
  lines.push("");
  lines.push("| SourceId | År | Tittel | Disposisjon |");
  lines.push("|---|---|---|---|");
  for (const s of manifest.sourceInventory) {
    lines.push(`| \`${s.sourceId}\` | ${s.year ?? "-"} | ${s.title ?? "-"} | \`${s.reviewStatus}\` |`);
  }
  lines.push("");

  // 3. Review Coverage
  lines.push("## Review Coverage");
  lines.push("");
  lines.push(`- **Tilgjengelige sider:** ${pagesSummary.expected}`);
  lines.push(`- **Visuelt gjennomgåtte sider:** ${pagesSummary.reviewed}`);
  lines.push(`- **Dekning:** ${pagesSummary.coveragePct}% (${pagesSummary.isFull ? "Fullført" : "Ufullstendig"})`);
  lines.push("");
  lines.push("### Gjennomførte Passes");
  lines.push("");
  lines.push("| Pass | Status | Funn | Notat |");
  lines.push("|---|---|---|---|");
  for (const [passId, pass] of Object.entries(manifest.passes)) {
    lines.push(`| \`${passId}\` | \`${pass.status}\` | ${pass.findings ?? 0} | ${pass.note ?? "-"} |`);
  }
  lines.push("");

  // 4. Findings
  lines.push("## Findings");
  lines.push("");
  lines.push(`- **Totalt antall funn:** ${findingsSummary.total}`);
  lines.push(`- **Normaliserte:** ${findingsSummary.normalized}`);
  lines.push(`- **Uavklarte / usikre:** ${findingsSummary.unresolved}`);
  lines.push(`- **Mangler disposisjon:** ${findingsSummary.missingDisposition}`);
  lines.push("");
  lines.push("### Funn per kategori");
  lines.push("");
  lines.push("| Kategori | Antall |");
  lines.push("|---|---|");
  for (const [type, count] of Object.entries(findingsSummary.byType)) {
    lines.push(`| \`${type}\` | ${count} |`);
  }
  lines.push("");

  // 5. Matches
  lines.push("## Matches");
  lines.push("");
  lines.push(`- **Kildedokumenterte resultater (source-results):** ${metrics.sourceResultEntriesAdded}`);
  lines.push(`- **Koblede kilderesultater:** ${metrics.sourceResultEntriesLinked}`);
  lines.push(`- **Nye kanoniske kamper:** ${metrics.canonicalMatchesCreated}`);
  lines.push(`- **Berikede kanoniske kamper:** ${metrics.canonicalMatchesEnriched}`);
  lines.push("");

  // 6. Persons and Roles
  lines.push("## Persons and Roles");
  lines.push("");
  lines.push(`- **Nye personer:** ${metrics.newPeople}`);
  lines.push(`- **Eksisterende personer kildeberiket:** ${metrics.existingPeopleEnriched}`);
  lines.push(`- **Kildereferanser lagt til på personer:** ${metrics.personSourceRefsAdded}`);
  lines.push(`- **Roller opprettet:** ${metrics.rolesCreated}`);
  lines.push(`- **Roller kildeberiket:** ${metrics.rolesSourceEnriched}`);
  lines.push(`- **Æresroller opprettet:** ${metrics.honoraryRolesCreated}`);
  lines.push("");

  // 7. Organization
  lines.push("## Organization");
  lines.push("");
  lines.push(`- **Organisasjons-snapshots lagt til:** ${metrics.snapshotsAdded}`);
  lines.push("");

  // 8. Historical Observations
  lines.push("## Historical Observations");
  lines.push("");
  lines.push(`- **Historiske observasjoner opprettet:** ${metrics.historicalObservationsAdded}`);
  lines.push("");

  // 9. Conflicts and Uncertainty
  lines.push("## Conflicts and Uncertainty");
  lines.push("");
  lines.push(`- **Nye konflikter registrert:** ${metrics.conflictsCreated}`);
  lines.push(`- **Konflikter løst med kildegrunnlag:** ${metrics.conflictsResolved}`);
  lines.push(`- **Uavklarte funn i kø:** ${manifest.unresolved.length}`);
  if (manifest.unresolved.length > 0) {
    lines.push("");
    lines.push("| FindingId | Type | Notat |");
    lines.push("|---|---|---|");
    for (const u of manifest.unresolved) {
      lines.push(`| \`${u.findingId}\` | \`${u.type}\` | ${u.note} |`);
    }
  }
  lines.push("");

  // 10. Reprints / Retrospectives
  lines.push("## Reprints / Retrospectives");
  lines.push("");
  lines.push(`- **Identifiserte opptrykk/reprints:** ${sourcesSummary.reprints}`);
  lines.push("");

  // 11. Preservation
  lines.push("## Preservation");
  lines.push("");
  lines.push(`- **Destruktive endringer:** ${preservation.destructiveChanges}`);
  lines.push(`- **Godkjente unntak:** ${preservation.approvedExceptions}`);
  lines.push(`- **Bevaringsstatus:** ${preservation.passed ? "PASS (Ingen uautorisert datatap)" : "FAIL"}`);
  lines.push("");

  // 12. Validation & Completion
  lines.push("## Validation");
  lines.push("");
  if (issues.length === 0) {
    lines.push("Ingen valideringsfeil eller avvik funnet.");
  } else {
    lines.push("| Nivå | Kategori | Melding |");
    lines.push("|---|---|---|");
    for (const issue of issues) {
      lines.push(`| \`${issue.type}\` | \`${issue.category}\` | ${issue.message} |`);
    }
  }
  lines.push("");

  lines.push("## Completion");
  lines.push("");
  if (passed) {
    lines.push("✓ **PASS: Innhøstingsbatchen er gyldig og verifisert i henhold til repoets historiske runbook.**");
  } else {
    lines.push("✗ **FAIL: Innhøstingsbatchen inneholder åpne avvik eller ufullstendige kontroller.**");
  }
  lines.push("");

  return lines.join("\n");
}

export async function main() {
  const options = parseCheckCliArgs(process.argv.slice(2));
  const root = repoRoot();

  try {
    const report = await runHarvestCheck(options, root);
    const md = generateMarkdownReport(report);

    const reportPath = resolve(root, `docs/data/reports/${report.manifest.id}.md`);
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, md, "utf8");

    console.log(md);
    console.log(`\n✓ Skrev rapport til: ${reportPath}`);
  } catch (err) {
    console.error(`REPORT_ERROR: ${String(err)}`);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("historical-harvest-report")) {
  await main();
}
