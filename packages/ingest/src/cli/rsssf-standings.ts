import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { clubKey, clubNameForms, standings as standingsSchema, standingsPath } from "@aafkstats/schema";
import type { Standings, StandingsRow } from "@aafkstats/schema";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import type { Archive } from "@aafkstats/schema/load";
import { fetchText } from "../http.js";
import { assertMayFetch, assertMayPublish } from "../policy.js";
import {
  computeProgression,
  divisionClubsMatch,
  finalTable,
  parseDivisionResults,
  pointsPerWin,
  progressionAgreesWithTable,
  readOutcome,
} from "../adapters/rsssf-table.js";
import {
  AAFK_SOURCE_NAME,
  RSSSF_ADAPTER,
  RSSSF_CLUB_ALIASES,
  stripMarkup,
} from "../adapters/rsssf.js";

/**
 * Henter sluttabellen for én divisjon i én sesong.
 *
 * Samme forsiktighet som de andre innhøsterne: omfanget står i kallet,
 * tørrkjøring er standard, og skriving krever en ren plan.
 *
 * Tabellen skrives selv om progresjonen forkastes. De to har ulik status:
 * tabellen er hentet fra kilden, progresjonen er regnet ut av oss. Er
 * utregningen tvilsom, er det bare den som ikke skal stå.
 */
const BASE = "http://www.rsssf.no";

interface Args {
  season: number;
  division: string;
  competition: string;
  retrievedAt: string;
  refresh: boolean;
  write: boolean;
}

/**
 * Kildens lagnavn til en klubb i arkivet, når den finnes der.
 *
 * Tabellen bærer navnet kilden skrev, så oppslaget er en bekvemmelighet: det
 * lar radene for lag vi kjenner bli lenker. Finner vi ingen, står `clubId` som
 * null, og det er en helt normal tilstand — AaFK har ikke møtt alle lagene i
 * hver divisjon de har spilt i.
 */
function resolveClub(archive: Archive, name: string): string | null {
  const canonical = RSSSF_CLUB_ALIASES[name] ?? name;
  const key = clubKey(canonical);
  const hits = archive.clubs.filter((club) =>
    clubNameForms(club).some((form) => clubKey(form) === key),
  );
  // Bare et entydig treff. To klubber som normaliserer likt er en dublett
  // valideringen allerede rapporterer, og å gjette mellom dem her ville skjult den.
  return hits.length === 1 ? hits[0]!.id : null;
}

export async function run(args: Args): Promise<void> {
  const root = resolve(repoRoot(), process.env.AAFK_DATA_DIR ?? "data");
  const archive = await loadArchive(root);
  const before = [...archive.issues, ...crossValidate(archive)];
  if (before.length > 0) {
    throw new Error(`arkivet har ${before.length} valideringsfeil før høsting`);
  }

  assertMayFetch(archive, "rsssf");
  if (args.write) assertMayPublish(archive, "rsssf");

  const url = `${BASE}/${args.season}/${args.division}.html`;
  console.log(`RSSSF ${args.division} ${args.season} → ${args.competition}${args.write ? " (skriv)" : " (tørrkjøring)"}`);

  const text = stripMarkup(await fetchText(url, { refresh: args.refresh }));
  const raw = finalTable(text);
  if (!raw) throw new Error(`fant ingen sluttabell på ${url}`);

  const table: StandingsRow[] = raw.map((row, index) => ({
    position: index + 1,
    name: row.name,
    clubId: resolveClub(archive, row.name),
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    points: row.points,
    outcome: readOutcome(row.status),
    // Statusen står som kilden skrev den når den sier mer enn `outcome` fanger,
    // typisk en europacupplass. Kastes den, mister tabellen en opplysning.
    note: row.status === "" ? undefined : row.status,
  }));

  const notes: string[] = [];
  const results = parseDivisionResults(text);
  const ownRow = raw.findIndex((row) => clubKey(row.name) === clubKey(AAFK_SOURCE_NAME));

  // En tabell uten AaFK betyr én av to ting, og begge er feil å lagre: enten er
  // det feil divisjon for det året, eller så har parseren mistet raden vår. For
  // 1951, 1967 og 1978 var det det første — serien var regional, og sida vi
  // hentet var et annet nivå enn det AaFK spilte på.
  if (ownRow === -1) {
    throw new Error(
      `AaFK står ikke i tabellen på ${url} (${raw.length} lag: ${raw.map((r) => r.name).join(", ")}). `
      + "Enten er det feil divisjon for dette året, eller så er raden mistet i parsingen.",
    );
  }

  let progression: Standings["progression"] = [];
  const clubsMatch = divisionClubsMatch(results, raw);
  if (!clubsMatch.ok) {
    notes.push(`Plasseringskurven er utelatt: ${clubsMatch.reason}.`);
  } else {
    const candidate = computeProgression(results, AAFK_SOURCE_NAME, pointsPerWin(raw));
    const agrees = progressionAgreesWithTable(candidate, raw[ownRow]!, ownRow + 1);
    if (agrees.ok) progression = candidate;
    else notes.push(`Plasseringskurven er utelatt: ${agrees.reason}.`);
  }

  const value = standingsSchema.parse({
    competitionId: args.competition,
    season: args.season,
    table,
    progression,
    providers: [{
      providerId: "rsssf",
      url,
      retrievedAt: args.retrievedAt,
      fields: ["table", ...(progression.length > 0 ? ["progression"] : [])],
      note: `Lest med ${RSSSF_ADAPTER}. Tabellen er hentet; kurven er regnet ut av rundene på samme side.`,
    }],
    sources: [],
    note: notes.length > 0 ? notes.join(" ") : undefined,
  } satisfies Standings);

  const relativePath = standingsPath(args.competition, args.season);
  console.log(JSON.stringify({
    lag: table.length,
    kjenteKlubber: table.filter((row) => row.clubId !== null).length,
    aafk: ownRow === -1 ? null : ownRow + 1,
    runderIKurven: progression.length,
    forbehold: notes.length,
  }, null, 2));
  for (const note of notes) console.error(`KONTROLL: ${note}`);

  if (!args.write) {
    console.log(`Ingen filer skrevet. Planen ville blitt ${relativePath}.`);
    return;
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
    if (!arg.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags.add(arg);
    else { values.set(arg, next); i++; }
  }

  const season = Number(values.get("--season"));
  const division = values.get("--division");
  const competition = values.get("--competition");
  if (!Number.isInteger(season) || !division || !competition) {
    throw new Error("bruk: --season ÅR --division Premier|First --competition ARKIV-ID [--refresh] [--write]");
  }
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(division)) {
    throw new Error("--division må være et sidenavn uten filendelse, f.eks. Premier eller First");
  }

  return {
    season,
    division,
    competition,
    retrievedAt: values.get("--retrieved-at") ?? new Date().toISOString().slice(0, 10),
    refresh: flags.has("--refresh"),
    write: flags.has("--write"),
  };
}

await run(parseArgs(process.argv.slice(2)));
