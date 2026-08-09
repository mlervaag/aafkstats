import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { clubKey, clubNameForms, standings as standingsSchema, standingsPath } from "@aafkstats/schema";
import type { Standings, StandingsRow } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import { FOTMOB_TABLE_ADAPTER, fetchFotmobTable } from "./adapters/fotmob-table.js";
import {
  computeProgression,
  divisionClubsMatch,
  pointsPerWin,
  progressionAgreesWithTable,
} from "./adapters/rsssf-table.js";

/**
 * Å hente og skrive tabellen for én sesong, delt av kommandoen og rutinen.
 *
 * Lå i CLI-en først. Rutinen etter kamp trengte nøyaktig det samme, og
 * alternativet var å la den kjøre kommandoen som en underprosess — da hadde
 * kontrollene stått ett sted og feilhåndteringen et annet.
 */

const AAFK_SOURCE_NAME = "Aalesund";

export interface StandingsUpdate {
  /** Ble fila faktisk endret? `false` når innholdet var likt fra før. */
  changed: boolean;
  written: boolean;
  relativePath: string;
  /** AaFKs plassering i den hentede tabellen. */
  position: number;
  teams: number;
  playedInDivision: number;
  unfinished: number;
  progressionRounds: number;
  notes: string[];
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

/**
 * Hentedatoen i en tabellfil, byttet ut med en fast verdi.
 *
 * Brukes bare til å sammenligne to versjoner av samme fil. En kjøring som ikke
 * fant noe nytt skal ikke etterlate en diff, og en ny dato alene er ikke en
 * endring i tabellen — den er en opplysning om at vi så etter. Uten dette ville
 * en rutine som kjøres hver dag gitt en commit hver dag.
 */
function withoutRetrievedAt(yaml: string): string {
  return yaml.replace(/^(\s*retrievedAt:).*$/gm, "$1 —");
}

export async function updateStandings(options: {
  root: string;
  archive: Archive;
  competitionId: string;
  season: number;
  leagueId: string;
  sourceSeason?: string | undefined;
  retrievedAt: string;
  refresh?: boolean | undefined;
  write: boolean;
  allowPartial: boolean;
  onProgress?: ((line: string) => void) | undefined;
}): Promise<StandingsUpdate> {
  const fetched = await fetchFotmobTable({
    leagueId: options.leagueId,
    season: options.season,
    sourceSeason: options.sourceSeason,
    refresh: options.refresh,
  });

  const table: StandingsRow[] = fetched.rows.map((row, index) => ({
    position: index + 1,
    name: row.name,
    clubId: resolveClub(options.archive, row.name, fetched.externalIds[index]),
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
    competitionId: options.competitionId,
    season: options.season,
    table,
    progression,
    providers: [{
      providerId: "fotmob",
      url: fetched.url,
      retrievedAt: options.retrievedAt,
      fields: ["table", ...(progression.length > 0 ? ["progression"] : [])],
      note: `Lest med ${FOTMOB_TABLE_ADAPTER}. Tabellen er hentet; kurven er regnet ut av divisjonens runder i samme svar.`,
    }],
    sources: [],
    note: notes.length > 0 ? notes.join(" ") : undefined,
  } satisfies Standings);

  const relativePath = standingsPath(options.competitionId, options.season);
  const absolute = resolve(options.root, relativePath);
  const yaml = stringify(value, { lineWidth: 0, defaultStringType: "PLAIN" });
  const existing = existsSync(absolute) ? await readFile(absolute, "utf8") : null;
  const changed = existing === null || withoutRetrievedAt(existing) !== withoutRetrievedAt(yaml);

  const result: StandingsUpdate = {
    changed,
    written: false,
    relativePath,
    position: ownRow + 1,
    teams: table.length,
    playedInDivision: fetched.results.length,
    unfinished: fetched.unfinished,
    progressionRounds: progression.length,
    notes,
  };

  if (!options.write || !changed) return result;
  if (fetched.unfinished > 0 && !options.allowPartial) {
    throw new Error(
      "sesongen er ikke ferdigspilt; bruk --allow-partial hvis du med vilje lagrer en tabell underveis",
    );
  }

  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, yaml, "utf8");
  options.onProgress?.(`skrev ${relativePath}`);
  return { ...result, written: true };
}
