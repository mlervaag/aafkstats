import { resolve } from "node:path";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { assertMayFetch, assertMayPublish } from "../policy.js";
import { updateStandings } from "../standings-update.js";

/**
 * Tabellen for én sesong hos FotMob, med plasseringskurven regnet ut.
 *
 * Søsteren til `rsssf-standings`, og med vilje bygget på de samme delene:
 * kurven regnes ut av `computeProgression`, og kontrolleres mot tabellen med
 * `progressionAgreesWithTable`. Hadde utregningen fått sin egen kopi her, ville
 * to sesonger kunnet fått hver sin regel for hva en plassering betyr.
 *
 * Forskjellen på de to er hvilken sesong de kan svare for. RSSSF publiserer
 * sluttabellen etter at sesongen er over; FotMob har den mens den pågår. Den som
 * pågår er nettopp den arkivet ikke kunne vise.
 *
 * Selve arbeidet ligger i `standings-update.ts`, delt med rutinen etter kamp.
 */

interface Args {
  league: string;
  season: number;
  sourceSeason?: string | undefined;
  competition: string;
  retrievedAt: string;
  refresh: boolean;
  write: boolean;
  allowPartial: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(repoRoot(), process.env.AAFK_DATA_DIR ?? "data");
  const archive = await loadArchive(root);
  const before = [...archive.issues, ...crossValidate(archive)];
  if (before.length > 0) throw new Error(`arkivet har ${before.length} valideringsfeil før høsting`);

  assertMayFetch(archive, "fotmob");
  if (args.write) assertMayPublish(archive, "fotmob");

  console.log(`FotMob-tabell ${args.league} ${args.season} → ${args.competition}${args.write ? " (skriv)" : " (tørrkjøring)"}`);
  const result = await updateStandings({
    root,
    archive,
    competitionId: args.competition,
    season: args.season,
    leagueId: args.league,
    sourceSeason: args.sourceSeason,
    retrievedAt: args.retrievedAt,
    refresh: args.refresh,
    write: args.write,
    allowPartial: args.allowPartial,
    onProgress: (line) => console.log(`  ${line}`),
  });

  console.log(JSON.stringify({
    lag: result.teams,
    aafk: result.position,
    spilteKamperIDivisjonen: result.playedInDivision,
    ikkeSpilt: result.unfinished,
    runderIKurven: result.progressionRounds,
    endret: result.changed,
    forbehold: result.notes.length,
  }, null, 2));
  for (const note of result.notes) console.error(`KONTROLL: ${note}`);

  if (!result.changed) {
    console.log("Tabellen er uendret siden forrige henting. Ingen fil skrevet.");
    return;
  }
  if (!args.write) {
    console.log(`Ingen filer skrevet. Planen ville blitt ${result.relativePath}.`);
    return;
  }

  const after = await loadArchive(root);
  const issues = [...after.issues, ...crossValidate(after)];
  if (issues.length > 0) {
    throw new Error(`skrev ${result.relativePath}, men arkivet har ${issues.length} feil; se pnpm validate`);
  }
  console.log(`Skrev ${result.relativePath}.`);
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") continue;
    if (!arg.startsWith("--")) throw new Error(`ukjent argument: ${arg}`);
    if (["--refresh", "--write", "--allow-partial"].includes(arg)) {
      flags.add(arg);
    } else {
      const next = argv[++i];
      if (!next || next.startsWith("--")) throw new Error(`${arg} krever en verdi`);
      values.set(arg, next);
    }
  }

  const league = values.get("--league");
  const seasonRaw = values.get("--season") ?? "";
  const crossYear = /^(\d{4})\/(\d{4})$/.exec(seasonRaw);
  const season = crossYear ? Number(crossYear[1]) : Number(seasonRaw);
  const competition = values.get("--competition");
  if (!league || !Number.isInteger(season) || !competition) {
    throw new Error("bruk: --league ID --season ÅR|ÅR/ÅR --competition ARKIV-ID [--allow-partial] [--write]");
  }

  const retrievedAt = values.get("--retrieved-at") ?? new Date().toISOString().slice(0, 10);
  if (flags.has("--write") && !values.has("--retrieved-at")) {
    throw new Error("--write krever eksplisitt --retrieved-at YYYY-MM-DD for reproduserbare differ");
  }

  return {
    league,
    season,
    sourceSeason: crossYear ? seasonRaw : undefined,
    competition,
    retrievedAt,
    refresh: flags.has("--refresh"),
    write: flags.has("--write"),
    allowPartial: flags.has("--allow-partial"),
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
