import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { resolve } from "node:path";
import { fetchRsssfSeason } from "../adapters/rsssf.js";
import type { RsssfDivision } from "../adapters/rsssf.js";
import { reconcile, writePlan } from "../reconcile.js";

/**
 * Henter én divisjon i én sesong fra RSSSF Norway.
 *
 * Samme forsiktighet som FotMob-CLI-en: omfanget må stå i kallet, tørrkjøring er
 * standard, og skriving krever både en ren plan og en eksplisitt hentedato. En
 * kjøring skriver aldri mer enn den ene sesongen den ble bedt om.
 */

interface Args {
  season: number;
  division: RsssfDivision;
  competition: string;
  limit?: number;
  refresh: boolean;
  write: boolean;
  skipExisting: boolean;
  retrievedAt: string;
}

const DIVISIONS: RsssfDivision[] = ["Premier", "First", "Cup"];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(repoRoot(), "data");

  const before = await loadArchive(root);
  const existingIssues = [...before.issues, ...crossValidate(before)];
  if (existingIssues.length > 0) {
    throw new Error(`arkivet har ${existingIssues.length} valideringsfeil før høsting`);
  }

  console.log(
    `RSSSF ${args.division} ${args.season} → ${args.competition}` +
      `${args.write ? " (skriv)" : " (tørrkjøring)"}`,
  );

  const fetched = await fetchRsssfSeason({
    season: args.season,
    division: args.division,
    limit: args.limit,
    refresh: args.refresh,
    onProgress: (line) => console.log(`  ${line}`),
  });

  const plan = reconcile(before, fetched.matches, {
    sourceId: "rsssf",
    competitionId: args.competition,
    retrievedAt: args.retrievedAt,
    skipExisting: args.skipExisting,
  });

  console.log(JSON.stringify(
    { ...plan.summary, failures: fetched.failures.length, issues: plan.issues.length },
    null,
    2,
  ));
  for (const failure of fetched.failures) {
    console.error(`FEIL ${failure.scope} ${failure.externalId}: ${failure.message}`);
  }
  for (const issue of plan.issues) console.error(`KONTROLL: ${issue}`);
  if (plan.skipped.length > 0) {
    console.log(`Hoppet over ${plan.skipped.length} kamper som allerede har en annen kilde:`);
    for (const id of plan.skipped) console.log(`  - ${id}`);
  }

  if (!args.write) {
    console.log("Ingen filer skrevet. Bruk --write etter å ha kontrollert planen.");
    return;
  }
  if (plan.issues.length > 0) throw new Error("uløste reconcile-problemer; skriver ikke");
  if (fetched.failures.length > 0) throw new Error("høstingen var ufullstendig; skriver ikke");

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
    if (["--refresh", "--write", "--skip-existing"].includes(arg)) {
      flags.add(arg);
    } else {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} krever en verdi`);
      values.set(arg, value);
    }
  }

  const season = Number(values.get("--season"));
  const division = values.get("--division") as RsssfDivision | undefined;
  const competition = values.get("--competition");
  if (!Number.isInteger(season) || !division || !competition) {
    throw new Error(
      "bruk: --season ÅR --division Premier|First|Cup --competition ARKIV-ID [--limit N] [--skip-existing] [--write]",
    );
  }
  if (!DIVISIONS.includes(division)) {
    throw new Error(`--division må være en av ${DIVISIONS.join(", ")}`);
  }
  if (season < 1902 || season > 2100) throw new Error("--season er utenfor arkivets område");

  const limitRaw = values.get("--limit");
  const limit = limitRaw === undefined ? undefined : Number(limitRaw);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 60)) {
    throw new Error("--limit må være 1–60");
  }

  const retrievedAt = values.get("--retrieved-at") ?? new Date().toISOString().slice(0, 10);
  if (flags.has("--write") && !values.has("--retrieved-at")) {
    throw new Error("--write krever eksplisitt --retrieved-at YYYY-MM-DD for reproduserbare differ");
  }

  return {
    season,
    division,
    competition,
    limit,
    refresh: flags.has("--refresh"),
    write: flags.has("--write"),
    skipExisting: flags.has("--skip-existing"),
    retrievedAt,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
