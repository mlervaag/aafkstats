import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { publicationExtraction } from "@aafkstats/schema";
import type { PublicationExtraction, ResolvedLineup, ResolvedRole } from "@aafkstats/schema";
import { crossValidate, loadArchive, dataDir, repoRoot } from "@aafkstats/schema/load";
import { assertMayFetch } from "../policy.js";
import { publicationAltoPages, readAltoPage, searchPublication } from "../adapters/nb-publications.js";
import { resolveRolesFromSearch, searchTerms } from "../adapters/nb-search.js";
import { joinLines, readPageColumns } from "../adapters/nb-pages.js";
import { knownPeople, resolveRoles } from "../adapters/nb-roles.js";
import { resolveLineups } from "../adapters/nb-lineups.js";
import { applyResolvedRoles } from "../adapters/nb-apply.js";

/**
 * Andre gjennomgang av publikasjonene.
 *
 * Første gjennomgang (`nb-extract`) leste ALTO linje for linje og la igjen
 * 4 814 pekere: publikasjon, side, og et rolleord eller et siffer. Denne
 * kjøringen bruker de pekerne som arbeidskø og leser de samme sidene på nytt —
 * spaltevis, med orddelingen reparert — slik at et rolleord får riktig navn.
 *
 * Uten `--all-pages` leses bare sider kandidatlaget alt har markert. Det er
 * 1 720 av 3 211 sider, og resten inneholder pr. definisjon ingen rolleord.
 */

const args = parseArgs({ allowPositionals: true, options: {
  write: { type: "boolean" },
  apply: { type: "boolean" },
  refresh: { type: "boolean" },
  "all-pages": { type: "boolean" },
  "no-names": { type: "boolean" },
  source: { type: "string" },
  concurrency: { type: "string", default: "3" },
  delay: { type: "string", default: "250" },
} });

const root = dataDir();
const archive = await loadArchive(root);
if (archive.issues.length > 0) throw new Error(`arkivet har ${archive.issues.length} valideringsfeil`);

const people = knownPeople(archive.people.map((person) => ({ id: person.id, name: person.name, names: person.names })));
const cacheDir = join(repoRoot(), ".cache", "nb-extract");
const options = {
  cacheDir,
  retrievedAt: new Date().toISOString().slice(0, 10),
  refresh: args.values.refresh,
  concurrency: Number(args.values.concurrency),
  delayMs: Number(args.values.delay),
  onProgress: (message: string) => console.warn(`  ${message}`),
};

const sources = archive.sources.filter((source) =>
  source.urn
  && source.providers.some((provider) => provider.providerId === "nasjonalbiblioteket")
  && (!args.values.source || source.id === args.values.source));
if (args.values.source && sources.length === 0) throw new Error(`ukjent NB-kilde: ${args.values.source}`);
if (sources.length > 0) assertMayFetch(archive, "nasjonalbiblioteket");

let readPages = 0;
let fromCache = 0;
const resolvedBySource = new Map<string, ResolvedRole[]>();
const lineupsBySource = new Map<string, ResolvedLineup[]>();

for (const [index, source] of sources.entries()) {
  const file = join(root, "extractions", `${source.id}.yaml`);
  if (!existsSync(file)) {
    console.warn(`[${index + 1}/${sources.length}] ${source.id}: intet uttrekk, hopper over`);
    continue;
  }
  const extraction = publicationExtraction.parse(parse(await readFile(file, "utf8"))) as PublicationExtraction;

  if (extraction.ocrAccess === "search_only") {
    // De to bøkene uten ALTO leses gjennom fulltekstsøket i stedet. Treffene
    // kommer med teksten før og etter, som er nok til at rolle og navn står i
    // samme setning — og det er disse to bøkene personhistorien ligger i.
    const hits = await searchPublication(source, searchTerms(people, { names: !args.values["no-names"] }), options);
    const roles = resolveRolesFromSearch(hits, {
      sourceId: source.id,
      people,
      ...(source.year === undefined ? {} : { publicationYear: source.year }),
    });
    resolvedBySource.set(source.id, roles);
    console.log(`[${index + 1}/${sources.length}] ${source.id}: fulltekstsøk · ${hits.length} treff · ${roles.length} roller (${roles.filter((role) => role.confidence === "high").length} sikre)`);
    if (args.values.write) await writeResolved(file, extraction, roles);
    continue;
  }

  if (extraction.ocrAccess !== "alto") {
    console.log(`[${index + 1}/${sources.length}] ${source.id}: ${extraction.ocrAccess}, ingen tekst å lese`);
    continue;
  }

  const wanted = new Set(extraction.candidates.map((candidate) => candidate.page));
  const pages = (await publicationAltoPages(source, options))
    .filter((page) => args.values["all-pages"] || wanted.has(page.page));

  const resolved: ResolvedRole[] = [];
  const lineups: ResolvedLineup[] = [];
  for (const page of pages) {
    const cached = existsSync(page.cacheFile);
    let xml: string;
    try {
      xml = await readAltoPage(page, options);
    } catch (error) {
      console.warn(`  ${source.id} side ${page.page}: ${String(error)}`);
      continue;
    }
    readPages += 1;
    if (cached) fromCache += 1;

    const columns = readPageColumns(xml);
    const pageContext = columns.map((section) => joinLines(section.lines)).join(" ");
    for (const [column, section] of columns.entries()) {
      resolved.push(...resolveRoles(section.lines, joinLines(section.lines), {
        sourceId: source.id,
        page: page.page,
        column,
        people,
        pageContext,
        ...(source.year === undefined ? {} : { publicationYear: source.year }),
      }));
      lineups.push(...resolveLineups(joinLines(section.lines), {
        sourceId: source.id,
        page: page.page,
        column,
        people,
        ...(source.year === undefined ? {} : { publicationYear: source.year }),
      }));
    }
  }

  const unique = [...new Map(resolved.map((role) => [role.id, role])).values()];
  resolvedBySource.set(source.id, unique);
  const high = unique.filter((role) => role.confidence === "high").length;
  console.log(`[${index + 1}/${sources.length}] ${source.id}: ${pages.length} sider · ${unique.length} roller (${high} sikre)`);

  const uniqueLineups = [...new Map(lineups.map((lineup) => [lineup.id, lineup])).values()];
  if (uniqueLineups.length > 0) lineupsBySource.set(source.id, uniqueLineups);
  if (args.values.write) await writeResolved(file, extraction, unique, uniqueLineups);
}

async function writeResolved(file: string, extraction: PublicationExtraction, roles: ResolvedRole[], lineups: ResolvedLineup[] = []): Promise<void> {
  const updated: PublicationExtraction = { ...extraction, resolvedRoles: roles, resolvedLineups: lineups };
  publicationExtraction.parse(updated);
  await writeFile(file, stringify(updated, { lineWidth: 0, defaultStringType: "PLAIN" }), "utf8");
}

const all = [...resolvedBySource].flatMap(([sourceId, roles]) => roles.map((role) => ({ sourceId, role })));
const byConfidence = { high: 0, medium: 0, low: 0 };
for (const { role } of all) byConfidence[role.confidence] += 1;

console.log(JSON.stringify({
  publikasjoner: resolvedBySource.size,
  siderLest: readPages,
  fraCache: fromCache,
  fraNett: readPages - fromCache,
  roller: all.length,
  sikre: byConfidence.high,
  middels: byConfidence.medium,
  svake: byConfidence.low,
  oppstillinger: [...lineupsBySource.values()].flat().length,
  oppstillingerSikre: [...lineupsBySource.values()].flat().filter((lineup) => lineup.confidence === "high").length,
  medÅrstall: all.filter(({ role }) => role.from).length,
  motKjentPerson: all.filter(({ role }) => role.personId).length,
}, null, 2));

if (!args.values.write) {
  console.log("Tørrkjøring. Ingen filer skrevet.");
} else if (args.values.apply) {
  const report = await applyResolvedRoles(archive, all, root);
  console.log(JSON.stringify({
    nyeRoller: report.added,
    kilderPåEksisterendeRoller: report.corroborated,
    hoppetOver: report.skipped,
  }, null, 2));

  const after = await loadArchive(root);
  const issues = [...after.issues, ...crossValidate(after)];
  if (issues.length > 0) throw new Error(`skrev filer, men arkivet har ${issues.length} feil; se pnpm validate`);
}
