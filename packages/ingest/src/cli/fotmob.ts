import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { fetchFotmobSeason } from "../adapters/fotmob.js";
import { pilotReport } from "../report.js";
import { reconcile, writePlan } from "../reconcile.js";

interface Args {
  league: string;
  season: number;
  sourceSeason?: string;
  competition: string;
  details: boolean;
  detailsLimit?: number;
  detailsOffset?: number;
  limit?: number;
  refresh: boolean;
  write: boolean;
  allowPartial: boolean;
  retrievedAt: string;
  report?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(repoRoot(), "data");
  const before = await loadArchive(root);
  const existingIssues = [...before.issues, ...crossValidate(before)];
  if (existingIssues.length > 0) throw new Error(`arkivet har ${existingIssues.length} valideringsfeil før høsting`);

  console.log(`FotMob ${args.league}, sesong ${args.season}${args.write ? " (skriv)" : " (tørrkjøring)"}`);
  const fetched = await fetchFotmobSeason({
    leagueId: args.league,
    season: args.season,
    sourceSeason: args.sourceSeason,
    withDetails: args.details,
    detailsLimit: args.detailsLimit,
    detailsOffset: args.detailsOffset,
    limit: args.limit,
    refresh: args.refresh,
    onProgress: (line) => console.log(`  ${line}`),
  });
  const plan = reconcile(before, fetched.matches, {
    sourceId: "fotmob",
    competitionId: args.competition,
    retrievedAt: args.retrievedAt,
  });

  console.log(JSON.stringify({ ...plan.summary, failures: fetched.failures.length, issues: plan.issues.length }, null, 2));
  for (const failure of fetched.failures) console.error(`FEIL ${failure.scope} ${failure.externalId}: ${failure.message}`);
  for (const issue of plan.issues) console.error(`KONTROLL: ${issue}`);

  if (args.report) {
    const path = resolve(repoRoot(), args.report);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, pilotReport(fetched, plan, {
      generatedAt: args.retrievedAt,
      leagueId: args.league,
      season: args.season,
      competitionId: args.competition,
      withDetails: args.details,
    }), "utf8");
    console.log(`Rapport: ${path}`);
  }

  if (!args.write) {
    console.log("Ingen filer skrevet. Bruk --write etter å ha kontrollert planen.");
    return;
  }
  if (plan.issues.length > 0) throw new Error("uløste reconcile-problemer; skriver ikke");
  if (fetched.failures.length > 0 && !args.allowPartial) {
    throw new Error("høstingen var ufullstendig; bruk --allow-partial bare etter manuell kontroll");
  }
  await writePlan(root, plan);
  const after = await loadArchive(root);
  const afterIssues = [...after.issues, ...crossValidate(after)];
  if (afterIssues.length > 0) {
    throw new Error(`skrev filer, men arkivet har ${afterIssues.length} feil; se pnpm validate`);
  }
  console.log(`Skrev ${plan.files.length} validerte YAML-filer.`);
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--") continue;
    if (!arg.startsWith("--")) throw new Error(`ukjent argument: ${arg}`);
    if (["--with-details", "--refresh", "--write", "--allow-partial"].includes(arg)) {
      flags.add(arg);
    } else {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} krever en verdi`);
      values.set(arg, value);
    }
  }
  const league = values.get("--league");
  // «2021/2022» er en gyldig sesong hos kilden. Kampene arkiveres under det første
  // årstallet, som er den utgaven av turneringen de tilhører.
  const seasonRaw = values.get("--season") ?? "";
  const crossYear = /^(\d{4})\/(\d{4})$/.exec(seasonRaw);
  const sourceSeason = crossYear ? seasonRaw : undefined;
  const season = crossYear ? Number(crossYear[1]) : Number(seasonRaw);
  const competition = values.get("--competition");
  if (!league || !Number.isInteger(season) || !competition) {
    throw new Error("bruk: --league ID --season ÅR|ÅR/ÅR --competition ARKIV-ID [--with-details] [--details-offset N] [--limit N] [--write]");
  }
  const limitRaw = values.get("--limit");
  const limit = limitRaw === undefined ? undefined : Number(limitRaw);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 40)) {
    throw new Error("--limit må være 1–40");
  }
  const detailsLimitRaw = values.get("--details-limit");
  const detailsLimit = detailsLimitRaw === undefined ? undefined : Number(detailsLimitRaw);
  if (detailsLimit !== undefined && (!Number.isInteger(detailsLimit) || detailsLimit < 1 || detailsLimit > 10)) {
    throw new Error("--details-limit må være 1–10");
  }
  const detailsOffsetRaw = values.get("--details-offset");
  const detailsOffset = detailsOffsetRaw === undefined ? undefined : Number(detailsOffsetRaw);
  if (detailsOffset !== undefined && (!Number.isInteger(detailsOffset) || detailsOffset < 0)) {
    throw new Error("--details-offset må være 0 eller større");
  }

  const retrievedAt = values.get("--retrieved-at") ?? new Date().toISOString().slice(0, 10);
  if (flags.has("--write") && !values.has("--retrieved-at")) {
    throw new Error("--write krever eksplisitt --retrieved-at YYYY-MM-DD for reproduserbare differ");
  }
  return {
    league,
    season,
    sourceSeason,
    competition,
    details: flags.has("--with-details"),
    detailsLimit,
    detailsOffset,
    limit,
    refresh: flags.has("--refresh"),
    write: flags.has("--write"),
    allowPartial: flags.has("--allow-partial"),
    retrievedAt,
    report: values.get("--report"),
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
