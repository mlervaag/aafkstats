#!/usr/bin/env npx tsx
/**
 * Convert one or more NFF Fotballdata tournament pages to an AaFKstats import tree.
 *
 * Safe default:
 *   Read HTML files saved manually from the browser.
 *
 * Network mode:
 *   --fetch går gjennom kildepolicyen i data/providers/fotball-no.yaml. NFF
 *   oppgir at roboter og spiders ikke er tillatt, så porten er stengt, og
 *   skriptet sier fra om det framfor å hente. Lagre sidene fra nettleseren.
 *
 * Examples:
 *   pnpm ingest:nff -- \
 *     --fiks-id 83034 --season 1983 --competition forstedivisjon \
 *     --matches-html saved-pages/83034-kamper.html \\
 *     --standings-html saved-pages/83034-tabellen.html --output generated/83034 \
 *     --promoted-positions 1 --relegated-positions 10,11,12
 *
 *   pnpm ingest:nff -- --manifest fiksids.json --output generated/nff
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { stringify } from "yaml";
import { loadArchive, repoRoot } from "@aafkstats/schema/load";
import { assertMayFetch } from "../policy.js";

type TournamentSpec = {
  fiksId: number;
  season: number;
  competitionId: string;
  teamNames?: string[];
  html?: string;
  matchesHtml?: string;
  standingsHtml?: string;
  promotedPositions?: number[];
  relegatedPositions?: number[];
};

type MatchRow = {
  round: number;
  date: string;
  home: string;
  homeGoals: number;
  awayGoals: number;
  away: string;
  matchNumber: string;
};

type StandingRow = {
  position: number;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

const SOURCE_ID = "fotball-no";
const RETRIEVED_AT = new Date().toISOString().slice(0, 10);

const KNOWN_CLUB_IDS: Record<string, string> = {
  "Aalesunds FK": "aalesunds-fk",
  "Aalesunds": "aalesunds-fk",
  "Aalesund": "aalesunds-fk",
  "Molde": "molde-fk",
  "Molde FK": "molde-fk",
  "Strindheim IL": "strindheim",
  "Strindheim": "strindheim",
  "Strømsgodset IF": "stromsgodset",
  "Strømsgodset": "stromsgodset",
  "Lyn, SFK": "lyn",
  "Lyn": "lyn",
  "Tromsø IL": "tromso",
  "Tromsø": "tromso",
  "Hødd (Gjennopprettet)": "hodd",
  "Hødd": "hodd",
  "Bodø/Glimt, FK": "bodo-glimt",
  "Bodø/Glimt": "bodo-glimt",
  "Steinkjer": "steinkjer",
  "Mjølner Narvik": "mjolner",
  "Mo IL": "mo-il",
  "Stjørdals-Blink": "stjordals-blink",
  "Stjørdals Blink": "stjordals-blink",
  "Brann, SK": "sk-brann",
  "Fredrikstad FK": "fredrikstad",
  "Strømmen IF - MEN 1": "strommen",
  "Drøbak/Frogn IL": "drobak-frogn",
  "Moss FK": "moss",
  "Ham-Kam 3": "hamkam",
};

const { values } = parseArgs({
  options: {
    "fiks-id": { type: "string" },
    season: { type: "string" },
    competition: { type: "string" },
    html: { type: "string" },
    "matches-html": { type: "string" },
    "standings-html": { type: "string" },
    manifest: { type: "string" },
    output: { type: "string", default: "generated/nff-import" },
    fetch: { type: "boolean", default: false },
    "team-names": { type: "string", default: "Aalesunds FK,Aalesund,Aalesunds" },
    "promoted-positions": { type: "string" },
    "relegated-positions": { type: "string" },
    overwrite: { type: "boolean", default: false },
  },
  strict: true,
});

function listOfNumbers(value: string | undefined): number[] {
  if (!value?.trim()) return [];
  return value.split(",").map((part) => Number(part.trim())).filter(Number.isFinite);
}

async function loadSpecs(): Promise<TournamentSpec[]> {
  if (values.manifest) {
    const parsed = JSON.parse(await readFile(resolve(values.manifest), "utf8")) as TournamentSpec[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Manifestet må være en ikke-tom JSON-liste.");
    }
    return parsed;
  }

  if (!values["fiks-id"] || !values.season || !values.competition) {
    throw new Error(
      "Oppgi enten --manifest, eller --fiks-id, --season og --competition.",
    );
  }

  return [{
    fiksId: Number(values["fiks-id"]),
    season: Number(values.season),
    competitionId: values.competition,
    html: values.html,
    matchesHtml: values["matches-html"],
    standingsHtml: values["standings-html"],
    teamNames: values["team-names"]!.split(",").map((x: string) => x.trim()).filter(Boolean),
    promotedPositions: listOfNumbers(values["promoted-positions"]),
    relegatedPositions: listOfNumbers(values["relegated-positions"]),
  }];
}

function normalizeText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&oslash;|&#248;/gi, "ø")
    .replace(/&Oslash;|&#216;/gi, "Ø")
    .replace(/&aring;|&#229;/gi, "å")
    .replace(/&Aring;|&#197;/gi, "Å")
    .replace(/&aelig;|&#230;/gi, "æ")
    .replace(/&AElig;|&#198;/gi, "Æ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractTables(html: string): string[][][] {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  const result: string[][][] = [];

  for (const table of tables) {
    const rows: string[][] = [];
    for (const rowMatch of table[1]!.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowMatch[1]!.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)]
        .map((cell) => normalizeText(cell[1]!));
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) result.push(rows);
  }
  return result;
}

function headerKey(value: string): string {
  return value.toLowerCase().replace(/[.\s_-]+/g, "");
}

function findTableWithHeader(tables: string[][][], required: string[]): { tableIndex: number; rowIndex: number; columns: Map<string, number> } {
  for (const [tableIndex, table] of tables.entries()) {
    for (const [rowIndex, row] of table.entries()) {
      const keys = row.map(headerKey);
      if (required.every((wanted) => keys.some((key) => key.includes(wanted)))) {
        const columns = new Map<string, number>();
        for (const [column, key] of keys.entries()) columns.set(key, column);
        return { tableIndex, rowIndex, columns };
      }
    }
  }
  throw new Error(`Fant ikke tabelloverskrift med feltene: ${required.join(", ")}`);
}

function column(row: string[], header: string[], aliases: string[]): string {
  const keys = header.map(headerKey);
  for (const alias of aliases) {
    const index = keys.findIndex((key) => key.includes(alias));
    if (index >= 0) return row[index] ?? "";
  }
  return "";
}

function isoDate(value: string): string {
  const found = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(value);
  if (!found) throw new Error(`Ukjent datoformat: ${value}`);
  return `${found[3]}-${found[2]!.padStart(2, "0")}-${found[1]!.padStart(2, "0")}`;
}

function parseScore(value: string): [number, number] {
  const found = /(\d+)\s*-\s*(\d+)/.exec(value);
  if (!found) throw new Error(`Ukjent resultatformat: ${value}`);
  return [Number(found[1]), Number(found[2])];
}

function parseGoals(value: string): [number, number] {
  const found = /(\d+)\s*-\s*(\d+)/.exec(value);
  if (!found) throw new Error(`Ukjent målformat i tabellen: ${value}`);
  return [Number(found[1]), Number(found[2])];
}

function parseMatches(tables: string[][][], teamNames: string[]): MatchRow[] {
  const { tableIndex, rowIndex } = findTableWithHeader(tables, ["runde", "dato", "hjemmelag", "resultat", "bortelag"]);
  const tableRows = tables[tableIndex]!;
  const header = tableRows[rowIndex]!;
  const result: MatchRow[] = [];

  for (const row of tableRows.slice(rowIndex + 1)) {
    const home = column(row, header, ["hjemmelag"]);
    const away = column(row, header, ["bortelag"]);
    if (!home || !away || !teamNames.some((name) => home === name || away === name)) continue;

    const roundValue = column(row, header, ["runde"]);
    const dateValue = column(row, header, ["dato"]);
    const scoreValue = column(row, header, ["resultat"]);
    const matchNumber = column(row, header, ["kampnr", "kampnummer"]);
    if (!/^\d+$/.test(roundValue) || !dateValue || !scoreValue) continue;

    const [homeGoals, awayGoals] = parseScore(scoreValue);
    result.push({
      round: Number(roundValue),
      date: isoDate(dateValue),
      home,
      homeGoals,
      awayGoals,
      away,
      matchNumber: matchNumber || `${isoDate(dateValue)}-${slugify(home)}-${slugify(away)}`,
    });
  }

  result.sort((a, b) => a.round - b.round || a.date.localeCompare(b.date));
  if (result.length === 0) throw new Error("Fant ingen AaFK-kamper i kamptabellen.");
  return result;
}

function parseStandings(tables: string[][][]): StandingRow[] {
  const { tableIndex, rowIndex } = findTableWithHeader(tables, ["plass", "lag", "kamper", "vunnet", "uavgjort", "tap", "mål", "poeng"]);
  const tableRows = tables[tableIndex]!;
  const header = tableRows[rowIndex]!;
  const result: StandingRow[] = [];

  for (const row of tableRows.slice(rowIndex + 1)) {
    const rawPosition = column(row, header, ["plass"]);
    const positionValue = rawPosition.replace(/\D/g, "");
    const name = column(row, header, ["lag"]);
    if (!/^\d+$/.test(positionValue) || !name) continue;

    const played = Number(column(row, header, ["kamper"]));
    const wins = Number(column(row, header, ["vunnet"]));
    const draws = Number(column(row, header, ["uavgjort"]));
    const losses = Number(column(row, header, ["tap"]));
    const points = Number(column(row, header, ["poeng"]));
    const [goalsFor, goalsAgainst] = parseGoals(column(row, header, ["mål"]));

    if (![played, wins, draws, losses, points].every(Number.isFinite)) continue;
    result.push({
      position: Number(positionValue),
      name,
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      points,
    });
  }

  result.sort((a, b) => a.position - b.position);
  if (result.length < 2) throw new Error("Fant ikke en gyldig sluttabell.");
  return result;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ø/gi, "o")
    .replace(/æ/gi, "ae")
    .replace(/å/gi, "a")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function clubId(name: string): string {
  return KNOWN_CLUB_IDS[name] ?? slugify(
    name.replace(/\s*\(Gjennopprettet\)\s*/i, "").replace(/,\s*(FK|SFK)$/i, ""),
  );
}

async function writeYaml(path: string, value: unknown, overwrite: boolean): Promise<void> {
  if (!overwrite && existsSync(path)) {
    throw new Error(`Filen finnes allerede: ${path}. Bruk --overwrite for å erstatte den.`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stringify(value, { lineWidth: 100 }), "utf8");
}

async function readOptionalHtml(path: string | undefined): Promise<string | undefined> {
  return path ? readFile(resolve(path), "utf8") : undefined;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "aafkstats-historical-archive/1.0 (contact via GitHub mlervaag/aafkstats)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function getHtmlPair(spec: TournamentSpec, archiveRoot: string): Promise<{
  matchesHtml: string;
  standingsHtml: string;
}> {
  const shared = await readOptionalHtml(spec.html);
  if (shared) return { matchesHtml: shared, standingsHtml: shared };

  const matchesLocal = await readOptionalHtml(spec.matchesHtml);
  const standingsLocal = await readOptionalHtml(spec.standingsHtml);
  if (matchesLocal || standingsLocal) {
    if (!matchesLocal || !standingsLocal) {
      throw new Error(
        `fiksId ${spec.fiksId}: oppgi både matchesHtml og standingsHtml, eller én felles html-fil.`,
      );
    }
    return { matchesHtml: matchesLocal, standingsHtml: standingsLocal };
  }

  if (!values.fetch) {
    throw new Error(
      `fiksId ${spec.fiksId} mangler HTML. Lagre begge NFF-sidene lokalt, eller bruk --fetch.`,
    );
  }

  // Porten er kildekatalogen, ikke et flagg på kommandolinja.
  //
  // Skriptet hadde sin egen `--acknowledge-nff-terms`, der den som kjørte
  // bekreftet vilkårene selv. Det er nøyaktig det policy-laget finnes for å
  // hindre: statusen står maskinlesbart i data/providers/fotball-no.yaml, og
  // den sier at automatisert henting ikke er tillatt. En bekreftelse skrevet
  // inn i et kall er ikke en avklaring, den er en omgåelse av vår egen
  // beslutning. Lagre sidene fra nettleseren i stedet.
  const archive = await loadArchive(archiveRoot);
  assertMayFetch(archive, SOURCE_ID);

  const base = `https://www.fotball.no/fotballdata/turnering/hjem/?fiksId=${spec.fiksId}`;
  const matchesHtml = await fetchPage(`${base}&underside=kamper`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
  const standingsHtml = await fetchPage(`${base}&underside=tabellen`);
  return { matchesHtml, standingsHtml };
}

async function writeSourceFile(root: string, overwrite: boolean): Promise<void> {
  // data/sources/ er publikasjoner: bøker, medlemsblad og aviser. Innhøstings-
  // kildene ligger i data/providers/. Skrev denne til den gamle stien, havnet
  // provider-fila blant publikasjonene og valideringen avviste den.
  const path = join(root, "data/providers/fotball-no.yaml");
  if (existsSync(path) && !overwrite) return;
  await writeYaml(path, {
    id: SOURCE_ID,
    name: "NFF Fotballdata",
    url: "https://www.fotball.no/fotballdata/",
    priority: 80,
    automatedAccess: "blocked",
    publicRedistribution: "permission_required",
    attributionRequired: true,
    permissionStatus: "pending",
    termsCheckedAt: RETRIEVED_AT,
    robotsCheckedAt: RETRIEVED_AT,
    permissionNote:
      "NFF oppgir at gjenbruk krever avtale og at automatiserte roboter/spiders ikke er tillatt. " +
      "Automatisert innhenting må avklares før ordinær bruk.",
    note:
      "Offisiell kilde for terminliste, kampnummer, resultater og sluttabell. " +
      "Bane og 00:00-klokkeslett bør kontrolleres før de importeres.",
  }, overwrite);
}

async function generate(spec: TournamentSpec, root: string, overwrite: boolean, archiveRoot: string): Promise<void> {
  const pages = await getHtmlPair(spec, archiveRoot);
  const matchTables = extractTables(pages.matchesHtml);
  const standingTables = extractTables(pages.standingsHtml);
  const teamNames = spec.teamNames?.length ? spec.teamNames : ["Aalesunds FK", "Aalesund"];
  const matches = parseMatches(matchTables, teamNames);
  const table = parseStandings(standingTables);

  const aafkRow = table.find((row) => clubId(row.name) === "aalesunds-fk");
  if (!aafkRow) throw new Error(`fiksId ${spec.fiksId}: fant ikke AaFK i sluttabellen.`);

  const promoted = new Set(spec.promotedPositions ?? []);
  const relegated = new Set(spec.relegatedPositions ?? []);
  const matchesUrl =
    `https://www.fotball.no/fotballdata/turnering/hjem/?fiksId=${spec.fiksId}&underside=kamper`;
  const tableUrl =
    `https://www.fotball.no/fotballdata/turnering/hjem/?fiksId=${spec.fiksId}&underside=tabellen`;

  await writeSourceFile(root, overwrite);

  const usedClubs = new Map<string, string>();
  for (const match of matches) {
    usedClubs.set(clubId(match.home), match.home);
    usedClubs.set(clubId(match.away), match.away);
  }

  for (const [id, name] of usedClubs) {
    const path = join(root, `data/clubs/${id}.yaml`);
    if (!existsSync(path)) {
      await writeYaml(path, { id, name, names: [], country: "NO", aliases: {} }, false);
    }
  }

  await writeYaml(join(root, `data/seasons/${spec.season}/season.yaml`), {
    year: spec.season,
    competitionId: spec.competitionId,
    finalPosition: aafkRow.position,
    teamsInLeague: table.length,
    promoted: promoted.has(aafkRow.position),
    relegated: relegated.has(aafkRow.position),
  }, overwrite);

  for (const match of matches) {
    const homeId = clubId(match.home);
    const awayId = clubId(match.away);
    const id = `${match.date}-${homeId}-${awayId}`;

    await writeYaml(join(root, `data/seasons/${spec.season}/matches/${id}.yaml`), {
      id,
      date: match.date,
      dateConfidence: "exact",
      status: "played",
      competition: {
        id: spec.competitionId,
        season: spec.season,
        stage: "regular_season",
        round: match.round,
      },
      home: { clubId: homeId, score: match.homeGoals, halfTimeScore: null },
      away: { clubId: awayId, score: match.awayGoals, halfTimeScore: null },
      neutralVenue: false,
      events: [],
      externalReports: [],
      sources: [{
        sourceId: SOURCE_ID,
        url: matchesUrl,
        retrievedAt: RETRIEVED_AT,
        fields: [
          "date",
          "status",
          "competition",
          "competition.round",
          "home.clubId",
          "away.clubId",
          "home.score",
          "away.score",
        ],
        note: `NFF kampnummer ${match.matchNumber}.`,
      }],
      confidence: "confirmed",
      conflicts: [],
      tags: [],
      aliases: { [SOURCE_ID]: match.matchNumber },
      manual: [],
      note:
        "Bane og klokkeslett er utelatt. Kontroller disse feltene manuelt før eventuell import.",
    }, overwrite);
  }

  await writeYaml(join(root, `data/standings/${spec.competitionId}/${spec.season}.yaml`), {
    competitionId: spec.competitionId,
    season: spec.season,
    table: table.map((row) => ({
      position: row.position,
      name: row.name,
      clubId: clubId(row.name),
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      points: row.points,
      outcome: promoted.has(row.position)
        ? "promoted"
        : relegated.has(row.position)
          ? "relegated"
          : "none",
    })),
    progression: [],
    sources: [{
      sourceId: SOURCE_ID,
      url: tableUrl,
      retrievedAt: RETRIEVED_AT,
      fields: ["table"],
    }],
  }, overwrite);

  const summary = {
    fiksId: spec.fiksId,
    season: spec.season,
    matches: matches.length,
    aafk: {
      position: aafkRow.position,
      played: aafkRow.played,
      wins: aafkRow.wins,
      draws: aafkRow.draws,
      losses: aafkRow.losses,
      goalsFor: aafkRow.goalsFor,
      goalsAgainst: aafkRow.goalsAgainst,
      points: aafkRow.points,
    },
  };
  await mkdir(join(root, "audit"), { recursive: true });
  await writeFile(
    join(root, `audit/nff-${spec.fiksId}-summary.json`),
    JSON.stringify(summary, null, 2) + "\n",
    "utf8",
  );
  console.log(JSON.stringify(summary));
}

async function main(): Promise<void> {
  const specs = await loadSpecs();
  const root = resolve(values.output!);
  // Kildekatalogen leses fra det ekte arkivet, ikke fra utskriftstreet.
  // Porten skal svare på hva vi har bestemt om fotball.no, og den beslutningen
  // står i data/, uansett hvor importtreet skrives.
  const archiveRoot = resolve(process.env.AAFK_DATA_DIR ?? join(repoRoot(), "data"));
  await mkdir(root, { recursive: true });

  for (const spec of specs) {
    if (!Number.isInteger(spec.fiksId) || !Number.isInteger(spec.season)) {
      throw new Error(`Ugyldig manifestoppføring: ${JSON.stringify(spec)}`);
    }
    await generate(spec, root, values.overwrite!, archiveRoot);
  }

  console.log(`Importtre skrevet til ${root}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
