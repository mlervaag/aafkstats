import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { publicationExtraction } from "@aafkstats/schema";
import type { PublicationExtraction, ResolvedRole } from "@aafkstats/schema";
import { crossValidate, loadArchive, dataDir, repoRoot } from "@aafkstats/schema/load";
import { assertMayFetch } from "../policy.js";
import { publicationAltoPages, readAltoPage } from "../adapters/nb-publications.js";
import { joinLines, readPageColumns } from "../adapters/nb-pages.js";
import { knownPeople, resolveRoles } from "../adapters/nb-roles.js";
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

for (const [index, source] of sources.entries()) {
  const file = join(root, "extractions", `${source.id}.yaml`);
  if (!existsSync(file)) {
    console.warn(`[${index + 1}/${sources.length}] ${source.id}: intet uttrekk, hopper over`);
    continue;
  }
  const extraction = publicationExtraction.parse(parse(await readFile(file, "utf8"))) as PublicationExtraction;
  if (extraction.ocrAccess !== "alto") {
    // De to bøkene uten ALTO har ingen sider å lese på nytt. Se runbooken:
    // de må gå gjennom fulltekstsøket, ikke gjennom denne kjøringen.
    console.log(`[${index + 1}/${sources.length}] ${source.id}: ${extraction.ocrAccess}, ingen ALTO å lese`);
    continue;
  }

  const wanted = new Set(extraction.candidates.map((candidate) => candidate.page));
  const pages = (await publicationAltoPages(source, options))
    .filter((page) => args.values["all-pages"] || wanted.has(page.page));

  const resolved: ResolvedRole[] = [];
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

    for (const [column, section] of readPageColumns(xml).entries()) {
      resolved.push(...resolveRoles(section.lines, joinLines(section.lines), {
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

  if (args.values.write) {
    const updated: PublicationExtraction = { ...extraction, resolvedRoles: unique };
    publicationExtraction.parse(updated);
    await writeFile(file, stringify(updated, { lineWidth: 0, defaultStringType: "PLAIN" }), "utf8");
  }
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
