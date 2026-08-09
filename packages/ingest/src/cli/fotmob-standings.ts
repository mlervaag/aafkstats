import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { clubKey, clubNameForms, standings as standingsSchema, standingsPath } from "@aafkstats/schema";
import type { Standings, StandingsRow } from "@aafkstats/schema";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import type { Archive } from "@aafkstats/schema/load";
import { assertMayFetch, assertMayPublish } from "../policy.js";
import { FOTMOB_TABLE_ADAPTER, fetchFotmobTable } from "../adapters/fotmob-table.js";
import {
  computeProgression,
  divisionClubsMatch,
  pointsPerWin,
  progressionAgreesWithTable,
} from "../adapters/rsssf-table.js";

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
 * `--allow-partial` kreves for en sesong som ikke er ferdigspilt. Uten den er
 * det for lett å skrive en halv tabell som ser ut som en sluttabell.
 */

const AAFK_SOURCE_NAME = "Aalesund";

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

/**
 * Klubben i arkivet bak en tabellrad.
 *
 * Kildens egen lag-ID først. Arkivet fører den som `aliases.fotmob`, og den er
 * en sikrere kobling enn et navn — kilden skriver «Aalesund» der arkivet skriver
 * «Aalesunds FK», og de to normaliserer ikke likt. Uten ID-en sto AaFKs egen rad
 * uten klubb, og det er nettopp den raden sesongsiden markerer som oss.
 *
 * Navnet er reserven, med samme regel som RSSSF-innhøsteren: bare et entydig
 * treff teller. To klubber som normaliserer likt er en dublett valideringen
 * allerede rapporterer, og å gjette mellom dem her ville skjult den.
 */
function resolveClub(archive: Archive, name: string, externalId: string | undefined): string | null {
  if (externalId !== undefined) {
    const byAlias = archive.clubs.filter((club) => String(club.aliases?.fotmob ?? "") === externalId);
    if (byAlias.length === 1) return byAlias[0]!.id;
  }
  const key = clubKey(name);
  const hits = archive.clubs.filter((club) =>
    clubNameForms(club).some((form) => clubKey(form) === key),
  );
  return hits.length === 1 ? hits[0]!.id : null;
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
  const fetched = await fetchFotmobTable({
    leagueId: args.league,
    season: args.season,
    sourceSeason: args.sourceSeason,
    refresh: args.refresh,
  });

  const table: StandingsRow[] = fetched.rows.map((row, index) => ({
    position: index + 1,
    name: row.name,
    clubId: resolveClub(archive, row.name, fetched.externalIds[index]),
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    points: row.points,
    // Alltid `none` herfra. Kilden fargelegger europacup- og nedrykksplasser i
    // en tabell som ikke er ferdig, og det er en spådom om hvor det bærer — ikke
    // noe plasseringen har ført til. Utfallet føres når sesongen er spilt.
    outcome: "none",
  }));

  const ownRow = fetched.rows.findIndex((row) => clubKey(row.name) === clubKey(AAFK_SOURCE_NAME));
  if (ownRow === -1) {
    throw new Error(
      `AaFK står ikke i tabellen (${fetched.rows.length} lag: ${fetched.rows.map((r) => r.name).join(", ")}). `
      + "Enten er det feil divisjon for dette året, eller så er raden mistet i lesingen.",
    );
  }

  const notes: string[] = [];
  if (fetched.unfinished > 0) {
    notes.push(
      `Tabellen er hentet mens sesongen pågår: ${fetched.results.length} av `
      + `${fetched.results.length + fetched.unfinished} kamper i divisjonen er spilt. `
      + "Ingen rad har utfall ennå.",
    );
  }

  let progression: Standings["progression"] = [];
  const clubsMatch = divisionClubsMatch(fetched.results, fetched.rows);
  if (!clubsMatch.ok) {
    notes.push(`Plasseringskurven er utelatt: ${clubsMatch.reason}.`);
  } else {
    const candidate = computeProgression(fetched.results, AAFK_SOURCE_NAME, pointsPerWin(fetched.rows));
    const agrees = progressionAgreesWithTable(candidate, fetched.rows[ownRow]!, ownRow + 1);
    if (agrees.ok) progression = candidate;
    else notes.push(`Plasseringskurven er utelatt: ${agrees.reason}.`);
  }

  const value = standingsSchema.parse({
    competitionId: args.competition,
    season: args.season,
    table,
    progression,
    providers: [{
      providerId: "fotmob",
      url: fetched.url,
      retrievedAt: args.retrievedAt,
      fields: ["table", ...(progression.length > 0 ? ["progression"] : [])],
      note: `Lest med ${FOTMOB_TABLE_ADAPTER}. Tabellen er hentet; kurven er regnet ut av divisjonens runder i samme svar.`,
    }],
    sources: [],
    note: notes.length > 0 ? notes.join(" ") : undefined,
  } satisfies Standings);

  const relativePath = standingsPath(args.competition, args.season);
  console.log(JSON.stringify({
    divisjon: fetched.leagueName,
    lag: table.length,
    kjenteKlubber: table.filter((row) => row.clubId !== null).length,
    aafk: ownRow + 1,
    spilteKamperIDivisjonen: fetched.results.length,
    ikkeSpilt: fetched.unfinished,
    runderIKurven: progression.length,
    forbehold: notes.length,
  }, null, 2));
  for (const note of notes) console.error(`KONTROLL: ${note}`);

  if (!args.write) {
    console.log(`Ingen filer skrevet. Planen ville blitt ${relativePath}.`);
    return;
  }
  if (fetched.unfinished > 0 && !args.allowPartial) {
    throw new Error(
      "sesongen er ikke ferdigspilt; bruk --allow-partial hvis du med vilje lagrer en tabell underveis",
    );
  }

  const absolute = resolve(root, relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, stringify(value, { lineWidth: 0, defaultStringType: "PLAIN" }), "utf8");

  const after = await loadArchive(root);
  const issues = [...after.issues, ...crossValidate(after)];
  if (issues.length > 0) {
    throw new Error(`skrev ${relativePath}, men arkivet har ${issues.length} feil; se pnpm validate`);
  }
  console.log(`Skrev ${relativePath}.`);
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
