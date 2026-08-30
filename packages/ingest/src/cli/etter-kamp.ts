import { resolve } from "node:path";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { fetchFotmobSeason, FOTMOB_ADAPTER } from "../adapters/fotmob.js";
import { assertMayFetch, assertMayPublish } from "../policy.js";
import { reconcile, writePlan } from "../reconcile.js";
import { matchesDue, ongoingLeagues, sourceForDue, todayInOslo } from "../etter-kamp.js";
import type { Due } from "../etter-kamp.js";
import { updateStandings } from "../standings-update.js";

/**
 * Alt som skal oppdateres etter at AaFK har spilt.
 *
 * ## Hvorfor dette er én kommando
 *
 * Etter en kamp må tre ting skje, og de henger sammen: resultatet og kampfakta
 * skal inn, tabellen skal hentes på nytt, og arkivfilen skal bygges. Gjøres det
 * for hånd, må noen huske hvilken FotMob-ID divisjonen har, hvilken kamp som var
 * ny, og at tabellen ble utdatert av den samme runden. Det er tre steder å ta
 * feil, og de tar man feil på en søndag kveld.
 *
 * Rutinen finner selv hva som skal oppdateres: kamper som står på terminlista og
 * hvis dato er passert. Det er hele definisjonen av «AaFK har spilt en kamp som
 * arkivet ikke vet utfallet av».
 *
 * ## Hva den ikke gjør
 *
 * Den henter ikke en kamp som ikke er ferdigspilt. Kilden sier selv om kampen er
 * over, og en kamp som pågår har ingen sluttstilling å arkivere. Står avspark
 * 17:00 og klokka er 17:42, gjør rutinen ingenting — og det er riktig.
 *
 * Den skriver heller ingenting uten `--write`, som resten av innhøstingen. En
 * tørrkjøring sier hva som ville skjedd, og er alltid tillatt.
 *
 * ## Tabellen henter seg selv, uansett om vi spilte
 *
 * Tabellen flytter seg hver gang to andre lag spiller. Søndagen dette ble
 * skrevet falt AaFK fra 14. til 15. plass en time etter at vår egen kamp var
 * ferdig og hentet, fordi Kristiansund slo Molde. Rutinen henter derfor tabellen
 * for hver seriesesong som ikke er ferdigspilt, helt uavhengig av om vi har
 * spilt — det er nettopp derfor den kan kjøres på et fast skjema.
 *
 * ## Stille når ingenting har skjedd
 *
 * En rutine som kjøres hver dag må kunne kjøres hver dag uten å etterlate spor.
 * Tabellfila skrives bare når innholdet faktisk er et annet; en ny hentedato
 * alene er ikke en endring. Er det ingenting å gjøre, skriver rutinen ingenting
 * og sier det.
 */

interface Args {
  today: string;
  write: boolean;
  refresh: boolean;
  retrievedAt: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(repoRoot(), process.env.AAFK_DATA_DIR ?? "data");
  const archive = await loadArchive(root);
  const issues = [...archive.issues, ...crossValidate(archive)];
  if (issues.length > 0) throw new Error(`arkivet har ${issues.length} valideringsfeil før oppdatering`);

  const due = matchesDue(archive, args.today);
  console.log(`Etter kamp · ${args.today}${args.write ? " (skriv)" : " (tørrkjøring)"}`);

  assertMayFetch(archive, "fotmob");
  if (args.write) assertMayPublish(archive, "fotmob");

  // Ingen tidlig retur her, selv når vi ikke har spilt: tabellen lenger nede
  // endrer seg av andre lags kamper, og det er hele grunnen til at rutinen kan
  // stå på et fast skjema.
  if (due.length === 0) {
    console.log("Ingen egne kamper mangler resultat.");
  } else {
    console.log(`${due.length} ${due.length === 1 ? "kamp" : "kamper"} står på terminlista med passert dato:`);
    for (const match of due) console.log(`  ${match.date}  ${match.opponent}  (${match.competitionName})`);
  }

  // Gruppert på sesong og konkurranse: ett kildekall dekker alle kampene i
  // samme divisjonssesong, og en runde gir sjelden mer enn én kamp.
  const groups = new Map<string, Due[]>();
  for (const match of due) {
    const key = `${match.competitionId}|${match.season}`;
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }

  const written: string[] = [];
  const stillOpen: Due[] = [];

  for (const [key, matches] of groups) {
    const competitionId = key.split("|")[0]!;
    const season = Number(key.split("|")[1]);
    const competition = archive.competitions.find((entry) => entry.id === competitionId);
    const leagueId = competition?.aliases?.fotmob;
    if (leagueId === undefined) {
      console.error(
        `KONTROLL: ${competitionId} har ingen fotmob-ID i data/competitions/${competitionId}.yaml. `
        + `${matches.length} kamp(er) må hentes for hånd.`,
      );
      stillOpen.push(...matches);
      continue;
    }

    const dates = matches.map((match) => match.date);
    // Både datoene og kilde-ID-ene: en flyttet kamp ligger hos kilden på en
    // annen dato enn den arkivet har, og da er ID-en det eneste som treffer.
    const ids = matches.flatMap((match) => match.externalId === undefined ? [] : [match.externalId]);
    console.log(`\nFotMob ${leagueId} · ${competition?.name ?? competitionId} ${season} · detaljer for ${dates.join(", ")}`);
    const fetched = await fetchFotmobSeason({
      leagueId: String(leagueId),
      season,
      withDetails: true,
      detailsDates: dates,
      detailsIds: ids,
      refresh: args.refresh,
      onProgress: (line) => console.log(`  ${line}`),
    });

    // Kilden er fasit på om kampen er over. Er den ikke det, er det ingenting å
    // arkivere ennå, og rutinen skal si det framfor å skrive en tom kamp.
    const notYet: Due[] = [];
    for (const match of matches) {
      const source = sourceForDue(match, fetched.matches);
      if (source?.status === "played" && source.homeScore !== undefined) {
        if (source.date !== match.date) {
          console.log(`  ${match.date}: kilden har kampen på ${source.date} — flyttet, arkivet oppdateres`);
        }
        continue;
      }
      console.log(`  ${match.date}: kilden har ikke sluttresultat ennå — hoppet over`);
      notYet.push(match);
    }
    stillOpen.push(...notYet);
    if (notYet.length === matches.length) continue;

    const plan = reconcile(archive, fetched.matches, {
      providerId: "fotmob",
      competitionId,
      retrievedAt: args.retrievedAt,
      adapter: FOTMOB_ADAPTER,
    });
    for (const failure of fetched.failures) console.error(`FEIL ${failure.scope} ${failure.externalId}: ${failure.message}`);
    for (const issue of plan.issues) console.error(`KONTROLL: ${issue}`);
    console.log(`  ${JSON.stringify(plan.summary)}`);

    if (!args.write) continue;
    if (plan.issues.length > 0) throw new Error(`uløste reconcile-problemer for ${competitionId} ${season}; skriver ikke`);
    if (fetched.failures.length > 0) throw new Error(`ufullstendig høsting for ${competitionId} ${season}; skriver ikke`);
    await writePlan(root, plan);
    written.push(...matches.filter((match) => !notYet.includes(match)).map((match) => match.matchId));
  }

  // Tabellen, uavhengig av om vi spilte. Den flytter seg av andre lags kamper.
  const leagues = ongoingLeagues(archive);
  const tables: string[] = [];
  if (leagues.length === 0) {
    console.log("\nIngen seriesesong pågår. Ingen tabell å hente.");
  }
  for (const league of leagues) {
    console.log(`\nTabell · ${league.competitionName} ${league.season}`);
    const result = await updateStandings({
      root,
      archive,
      competitionId: league.competitionId,
      season: league.season,
      leagueId: league.leagueId,
      retrievedAt: args.retrievedAt,
      // Tabellen er ferskvare. Uten dette ville en rutine som kjøres hver dag
      // lest gårsdagens svar fra hurtiglageret og meldt «uendret» hver gang.
      refresh: true,
      write: args.write,
      allowPartial: true,
      onProgress: (line) => console.log(`  ${line}`),
    });
    for (const note of result.notes) console.error(`KONTROLL: ${note}`);
    if (!result.changed) {
      console.log(`  uendret · AaFK på ${result.position}. plass`);
      continue;
    }
    console.log(`  AaFK på ${result.position}. plass av ${result.teams} · ${result.playedInDivision} kamper spilt i divisjonen`);
    if (result.written) tables.push(result.relativePath);
    else console.log("  (tørrkjøring — ingen fil skrevet)");
  }

  if (args.write && (written.length > 0 || tables.length > 0)) {
    const after = await loadArchive(root);
    const afterIssues = [...after.issues, ...crossValidate(after)];
    if (afterIssues.length > 0) {
      throw new Error(`skrev filer, men arkivet har ${afterIssues.length} feil; se pnpm validate`);
    }
  }

  console.log("\nOppsummering:");
  if (written.length === 0 && tables.length === 0) {
    console.log("  Ingenting endret seg. Ingen filer skrevet.");
  }
  for (const id of written) console.log(`  kamp: ${id}`);
  for (const path of tables) console.log(`  tabell: ${path}`);
  if (!args.write && (due.length > 0 || leagues.length > 0)) {
    console.log(`  Kjør på nytt med --write for å skrive. Hentedato blir ${args.retrievedAt}.`);
  }
  if (args.write && (written.length > 0 || tables.length > 0)) {
    console.log("  Neste steg: pnpm db:build && pnpm validate, og commit YAML-diffen.");
  }
  if (stillOpen.length > 0) {
    console.log(`  ${stillOpen.length} kamp(er) står fortsatt uten resultat. Kjør rutinen igjen senere.`);
  }
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") continue;
    if (!arg.startsWith("--")) throw new Error(`ukjent argument: ${arg}`);
    if (["--write", "--refresh"].includes(arg)) {
      flags.add(arg);
    } else {
      const next = argv[++i];
      if (!next || next.startsWith("--")) throw new Error(`${arg} krever en verdi`);
      values.set(arg, next);
    }
  }

  const today = values.get("--today") ?? todayInOslo();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("--today må være YYYY-MM-DD");
  const retrievedAt = values.get("--retrieved-at") ?? today;
  if (flags.has("--write") && !values.has("--retrieved-at")) {
    throw new Error("--write krever eksplisitt --retrieved-at YYYY-MM-DD for reproduserbare differ");
  }

  return { today, write: flags.has("--write"), refresh: flags.has("--refresh"), retrievedAt };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
