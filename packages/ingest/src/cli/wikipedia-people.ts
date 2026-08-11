import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { person as personSchema, personKey, personPath, slugify } from "@aafkstats/schema";
import type { Person } from "@aafkstats/schema";
import { crossValidate, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { assertMayFetch, assertMayPublish } from "../policy.js";
import { fetchCoachTable, fetchSquadAt, revisionUrl } from "../adapters/wikipedia-squad.js";
import type { WikipediaPlayer } from "../adapters/wikipedia-squad.js";

/**
 * Bygger personregisteret fra Wikipedias stallmal.
 *
 * Én kjøring per sesong, som de andre innhøsterne, og tørrkjøring er standard.
 * Filene slås sammen med det som allerede står: en person som var med i både
 * 2018 og 2022 får to draktnummer, ikke to filer.
 *
 * Det som er skrevet for hånd overlever. Legger noen inn en skrivemåte i
 * `names`, eller en note, blir den stående gjennom neste kjøring.
 */

interface Args {
  /** Sesongen stallen skal leses for. Utelates ved --coaches. */
  season?: number;
  coaches: boolean;
  refresh: boolean;
  write: boolean;
}

/** Slår sammen en ny observasjon av en spiller med det som allerede står. */
function merge(existing: Person | undefined, fresh: WikipediaPlayer, season: number, url: string, retrievedAt: string): Person {
  const base: Person = existing ?? {
    id: slugify(fresh.name),
    name: fresh.name,
    names: [],
    squadNumbers: [],
    coachSpells: [],
    roles: [],
    providers: [],
    sources: [],
  };

  // Skrivemåten kilden brukte tas vare på når den ikke er den vi viser og ikke
  // allerede står. Da kan et navn fra en oppstilling knyttes til personen selv
  // om Wikipedia staver det annerledes.
  const names = [...base.names];
  if (personKey(fresh.name) !== personKey(base.name) && !names.some((n) => personKey(n) === personKey(fresh.name))) {
    names.push(fresh.name);
  }

  const squadNumbers = fresh.number === undefined
    ? base.squadNumbers
    : [
        ...base.squadNumbers.filter((entry) => entry.season !== season),
        { season, number: fresh.number },
      ].sort((a, b) => a.season - b.season);

  const providers = [
    ...base.providers.filter((s) => s.providerId !== "wikipedia"),
    {
      providerId: "wikipedia",
      url,
      retrievedAt,
      fields: ["name", "position", "nationality", "squadNumbers"],
      note: "Fakta fra stallmalen. Artikkelteksten er CC BY-SA og er ikke gjengitt.",
    },
  ];

  return personSchema.parse({
    ...base,
    names,
    // Kilden vinner på posisjon og nasjonalitet bare når vi ikke har dem fra før.
    // En rettelse gjort for hånd skal ikke overskrives av neste kjøring.
    position: base.position ?? fresh.position,
    nationality: base.nationality ?? fresh.nationality,
    squadNumbers,
    providers,
  } satisfies Person);
}

export async function run(args: Args): Promise<void> {
  const root = resolve(repoRoot(), process.env.AAFK_DATA_DIR ?? "data");
  const archive = await loadArchive(root);
  const before = [...archive.issues, ...crossValidate(archive)];
  if (before.length > 0) {
    throw new Error(`arkivet har ${before.length} valideringsfeil før høsting`);
  }

  assertMayFetch(archive, "wikipedia");
  if (args.write) assertMayPublish(archive, "wikipedia");

  if (args.coaches) {
    await runCoaches(root, archive, args);
    return;
  }
  if (args.season === undefined) throw new Error("bruk: --season ÅR, eller --coaches");
  console.log(`Wikipedia-stall ${args.season}${args.write ? " (skriv)" : " (tørrkjøring)"}`);
  const revision = await fetchSquadAt(args.season, { refresh: args.refresh });
  if (!revision) {
    // Malen ble tatt i bruk et sted mellom 2013 og 2018. Eldre år har ingen
    // stall å lese, og det skal si fra uten å se ut som en feil i koden.
    console.log(`Ingen stallmal i artikkelen ved utgangen av ${args.season}.`);
    return;
  }

  const url = revisionUrl(revision.revisionId);
  const byId = new Map(archive.people.map((p) => [p.id, p]));
  const written: Person[] = [];
  const issues: string[] = [];

  for (const player of revision.players) {
    const id = slugify(player.name);
    // En eksisterende person kan hete noe annet enn slugen av dette navnet, så
    // vi leter også på skrivemåte. Uten det får «Sten Grytebust» og «Sten
    // Michael Grytebust» hver sin fil.
    const existing = byId.get(id)
      ?? archive.people.find((p) => [p.name, ...p.names].some((n) => personKey(n) === personKey(player.name)));
    if (existing && existing.id !== id && byId.has(id)) {
      issues.push(`${player.name}: to personer kan bli til «${id}»`);
      continue;
    }
    const merged = merge(existing, player, args.season, url, revision.timestamp);
    byId.set(merged.id, merged);
    written.push(merged);
  }

  console.log(JSON.stringify({
    revisjon: revision.timestamp,
    spillere: revision.players.length,
    medNummer: revision.players.filter((p) => p.number !== undefined).length,
    medPosisjon: revision.players.filter((p) => p.position !== undefined).length,
    nyeFiler: written.filter((p) => !archive.people.some((e) => e.id === p.id)).length,
  }, null, 2));
  for (const issue of issues) console.error(`KONTROLL: ${issue}`);

  if (!args.write) {
    console.log(`Ingen filer skrevet. Planen ville rørt ${written.length} personer.`);
    return;
  }
  if (issues.length > 0) throw new Error("uløste problemer; skriver ikke");

  for (const value of written) {
    const absolute = resolve(root, personPath(value.id));
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, stringify(value, { lineWidth: 0, defaultStringType: "PLAIN" }), "utf8");
  }

  const after = await loadArchive(root);
  const afterIssues = [...after.issues, ...crossValidate(after)];
  if (afterIssues.length > 0) {
    throw new Error(`skrev ${written.length} filer, men arkivet har ${afterIssues.length} feil; se pnpm validate`);
  }
  console.log(`Skrev ${written.length} personfiler.`);
}

/**
 * Trenerperiodene fra artikkelens egen tabell.
 *
 * De legges på personfilene som `coachSpells`, ved siden av periodene arkivet
 * utleder av kampene. De to erstatter ikke hverandre: tabellen rekker til 2001
 * men oppgir bare årstall og utelater vikarene, mens kampene gir eksakte datoer
 * og har med hver eneste en, men bare fra 2010.
 */
async function runCoaches(root: string, archive: Awaited<ReturnType<typeof loadArchive>>, args: Args): Promise<void> {
  console.log(`Wikipedia-trenere${args.write ? " (skriv)" : " (tørrkjøring)"}`);
  const table = await fetchCoachTable({ refresh: args.refresh });
  if (!table) throw new Error("fant ingen trenertabell i artikkelen");

  const url = revisionUrl(table.revisionId);
  // Nøkkel på person-ID, ikke en liste: Rekdal har to perioder i tabellen, og
  // begge skal havne i samme fil.
  const touched = new Map<string, Person>();

  for (const spell of table.spells) {
    const existing = archive.people.find(
      (p) => [p.name, ...p.names].some((n) => personKey(n) === personKey(spell.name)),
    );
    const id = existing?.id ?? slugify(spell.name);
    const current = touched.get(id) ?? existing ?? {
      id, name: spell.name, names: [],
      squadNumbers: [], coachSpells: [], roles: [], providers: [], sources: [],
    };
    const wikipedia = current.providers.find((s) => s.providerId === "wikipedia");

    touched.set(id, personSchema.parse({
      ...current,
      coachSpells: [
        ...current.coachSpells.filter((s) => s.fromSeason !== spell.fromSeason),
        { fromSeason: spell.fromSeason, toSeason: spell.toSeason },
      ].sort((a, b) => a.fromSeason - b.fromSeason),
      providers: [
        ...current.providers.filter((s) => s.providerId !== "wikipedia"),
        {
          providerId: "wikipedia", url, retrievedAt: table.timestamp,
          fields: [...new Set([...(wikipedia?.fields ?? []), "coachSpells"])],
          note: "Årstall fra trenertabellen. Merknadskolonnen er prosa og er ikke gjengitt.",
        },
      ],
    } satisfies Person));
  }
  const written = [...touched.values()];

  console.log(JSON.stringify({
    revisjon: table.timestamp,
    perioder: table.spells.length,
    personer: written.length,
    tidligsteÅr: Math.min(...table.spells.map((s) => s.fromSeason)),
  }, null, 2));

  if (!args.write) {
    console.log(`Ingen filer skrevet. Planen ville rørt ${written.length} personer.`);
    return;
  }
  for (const value of written) {
    const absolute = resolve(root, personPath(value.id));
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, stringify(value, { lineWidth: 0, defaultStringType: "PLAIN" }), "utf8");
  }
  const after = await loadArchive(root);
  const issues = [...after.issues, ...crossValidate(after)];
  if (issues.length > 0) throw new Error(`skrev filer, men arkivet har ${issues.length} feil; se pnpm validate`);
  console.log(`Skrev ${written.length} personfiler.`);
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
  const coaches = flags.has("--coaches");
  const season = Number(values.get("--season"));
  if (!coaches && !Number.isInteger(season)) {
    throw new Error("bruk: --season ÅR [--refresh] [--write], eller --coaches [--write]");
  }
  return {
    ...(Number.isInteger(season) ? { season } : {}),
    coaches,
    refresh: flags.has("--refresh"),
    write: flags.has("--write"),
  };
}

await run(parseArgs(process.argv.slice(2)));
