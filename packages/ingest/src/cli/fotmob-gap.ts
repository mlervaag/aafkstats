import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { fetchFotmobTeamHistory, FOTMOB_ADAPTER } from "../adapters/fotmob.js";
import {
  buildFotmobGapReport,
  classifyFotmobCompetition,
  fotmobGapMarkdown,
  assertFotmobGapTarget,
  prepareFotmobGapMatch,
} from "../fotmob-gap.js";
import type { FotmobCompetitionClass } from "../fotmob-gap.js";
import { assertMayFetch, assertMayPublish } from "../policy.js";
import { reconcile, writePlan } from "../reconcile.js";

interface Args {
  from: string;
  to: string;
  maxPages: number;
  matchIds?: string[];
  competition?: string;
  expectedClass?: Extract<FotmobCompetitionClass, "europe" | "friendly" | "cup" | "qualification">;
  archiveSeason?: number;
  withDetails: boolean;
  refresh: boolean;
  write: boolean;
  retrievedAt: string;
  reportJson?: string;
  reportMd?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(repoRoot(), "data");
  const archive = await loadArchive(root);
  const existingIssues = [...archive.issues, ...crossValidate(archive)];
  if (existingIssues.length > 0) throw new Error(`arkivet har ${existingIssues.length} valideringsfeil før discovery`);
  assertMayFetch(archive, "fotmob");
  if (args.write) assertMayPublish(archive, "fotmob");

  console.log(`FotMob-gap ${args.from}–${args.to}${args.write ? " (skriv)" : " (kun discovery)"}`);
  const fetched = await fetchFotmobTeamHistory({
    from: args.from,
    to: args.to,
    maxPages: args.maxPages,
    matchIds: args.matchIds,
    withDetails: args.withDetails,
    refresh: args.refresh,
    onProgress: (line) => console.log(`  ${line}`),
  });
  for (const failure of fetched.failures) console.error(`FEIL ${failure.scope} ${failure.externalId}: ${failure.message}`);

  const report = buildFotmobGapReport(archive, fetched.matches, {
    from: args.from,
    to: args.to,
    generatedAt: args.retrievedAt,
  });
  console.log(JSON.stringify({ candidates: report.candidates, ...report.summary, failures: fetched.failures.length, requests: fetched.requests }, null, 2));
  if (args.reportJson) await writeReport(args.reportJson, `${JSON.stringify(report, null, 2)}\n`);
  if (args.reportMd) await writeReport(args.reportMd, fotmobGapMarkdown(report));

  if (!args.write) {
    console.log("Ingen arkivdata skrevet. Bruk eksplisitte --match-ids sammen med --write etter kontroll.");
    return;
  }
  if (fetched.failures.length > 0) throw new Error("discovery/detaljhenting var ufullstendig; skriver ikke");
  if (!args.competition || !args.expectedClass || !args.matchIds) throw new Error("intern feil: skriveargumenter mangler");
  const wrongClass = fetched.matches.filter((match) => classifyFotmobCompetition(match) !== args.expectedClass);
  if (wrongClass.length > 0) {
    throw new Error(`kampene ${wrongClass.map((match) => match.externalId).join(", ")} har ikke forventet type ${args.expectedClass}`);
  }
  const preparedMatches = fetched.matches.map((match) => prepareFotmobGapMatch(match, {
    archiveSeason: args.archiveSeason,
    competitionClass: args.expectedClass!,
  }));
  const plan = reconcile(archive, preparedMatches, {
    providerId: "fotmob",
    competitionId: args.competition,
    retrievedAt: args.retrievedAt,
    adapter: FOTMOB_ADAPTER,
  });
  for (const issue of plan.issues) console.error(`KONTROLL: ${issue}`);
  if (plan.issues.length > 0) throw new Error("uløste reconcile-problemer; skriver ikke");
  await writePlan(root, plan);
  const after = await loadArchive(root);
  const afterIssues = [...after.issues, ...crossValidate(after)];
  if (afterIssues.length > 0) throw new Error(`skrev filer, men arkivet har ${afterIssues.length} feil`);
  console.log(`Skrev ${plan.summary.matchesCreated} kamper og ${plan.summary.observationsWritten} observasjoner.`);
}

async function writeReport(relativePath: string, body: string): Promise<void> {
  const path = resolve(repoRoot(), relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
  console.log(`Rapport: ${path}`);
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--") continue;
    if (!arg.startsWith("--")) throw new Error(`ukjent argument: ${arg}`);
    if (["--with-details", "--refresh", "--write"].includes(arg)) flags.add(arg);
    else {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} krever en verdi`);
      values.set(arg, value);
    }
  }
  const from = values.get("--from") ?? "";
  const to = values.get("--to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error("bruk: --from YYYY-MM-DD --to YYYY-MM-DD [--report-json FIL] [--report-md FIL]");
  }
  const maxPages = Number(values.get("--max-pages") ?? "40");
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 40) throw new Error("--max-pages må være 1–40");
  const matchIds = values.get("--match-ids")?.split(",").map((id) => id.trim()).filter(Boolean);
  const expectedClass = values.get("--class") as Args["expectedClass"];
  const competition = values.get("--competition");
  const write = flags.has("--write");
  if (write) {
    if (!matchIds?.length || !competition || !["europe", "friendly", "cup", "qualification"].includes(expectedClass ?? "")) {
      throw new Error("--write krever --match-ids ID,... --class europe|friendly|cup|qualification --competition ARKIV-ID");
    }
    if (!values.has("--retrieved-at")) throw new Error("--write krever eksplisitt --retrieved-at YYYY-MM-DD");
    assertFotmobGapTarget(expectedClass!, competition);
  }
  const archiveSeasonValue = values.get("--season");
  const archiveSeason = archiveSeasonValue === undefined ? undefined : Number(archiveSeasonValue);
  if (archiveSeason !== undefined && (!Number.isInteger(archiveSeason) || archiveSeason < 1902 || archiveSeason > 2100)) {
    throw new Error("--season må være et år mellom 1902 og 2100");
  }
  const retrievedAt = values.get("--retrieved-at") ?? new Date().toISOString().slice(0, 10);
  return {
    from,
    to,
    maxPages,
    matchIds,
    competition,
    expectedClass,
    archiveSeason,
    withDetails: flags.has("--with-details") || write,
    refresh: flags.has("--refresh"),
    write,
    retrievedAt,
    reportJson: values.get("--report-json"),
    reportMd: values.get("--report-md"),
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
