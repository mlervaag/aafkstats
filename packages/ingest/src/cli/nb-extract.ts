import { parseArgs } from "node:util";
import { join } from "node:path";
import { loadArchive, dataDir, repoRoot } from "@aafkstats/schema/load";
import { applyHighConfidenceMatchSources, extractNbPublication, writeExtraction } from "../adapters/nb-publications.js";

const args = parseArgs({ allowPositionals: true, options: {
  write: { type: "boolean" },
  apply: { type: "boolean" },
  refresh: { type: "boolean" },
  source: { type: "string" },
  concurrency: { type: "string", default: "3" },
  delay: { type: "string", default: "250" },
} });

const root = dataDir();
const archive = await loadArchive(root);
if (archive.issues.length > 0) throw new Error(`arkivet har ${archive.issues.length} valideringsfeil`);
const sources = archive.sources.filter((source) => source.urn && source.providers.some((provider) => provider.providerId === "nasjonalbiblioteket") && (!args.values.source || source.id === args.values.source));
if (args.values.source && sources.length === 0) throw new Error(`ukjent NB-kilde: ${args.values.source}`);

const cacheDir = join(repoRoot(), ".cache", "nb-extract");
const retrievedAt = new Date().toISOString().slice(0, 10);
const extractions = [];
for (const [index, source] of sources.entries()) {
  console.log(`[${index + 1}/${sources.length}] ${source.id}`);
  const extraction = await extractNbPublication(archive, source, {
    cacheDir,
    retrievedAt,
    refresh: args.values.refresh,
    concurrency: Number(args.values.concurrency),
    delayMs: Number(args.values.delay),
    onProgress: (message) => console.warn(`  ${message}`),
  });
  extractions.push(extraction);
  console.log(`  ${extraction.ocrAccess}: ${extraction.pagesProcessed}/${extraction.pagesExpected} sider · ${extraction.candidates.length} kandidater · ${extraction.pagesFailed.length} feil`);
  if (args.values.write) await writeExtraction(join(root, "extractions", `${source.id}.yaml`), extraction);
}

if (args.values.apply) {
  if (!args.values.write) throw new Error("--apply krever --write");
  const changed = await applyHighConfidenceMatchSources(archive, extractions, root);
  console.log(`Knyttet ${changed} kampfiler til entydige publikasjonstreff.`);
}
const pages = extractions.reduce((sum, extraction) => sum + extraction.pagesProcessed, 0);
const candidates = extractions.reduce((sum, extraction) => sum + extraction.candidates.length, 0);
const failed = extractions.reduce((sum, extraction) => sum + extraction.pagesFailed.length, 0);
console.log(`Ferdig: ${extractions.length} publikasjoner · ${pages} ALTO-sider · ${candidates} faktakandidater · ${failed} sidefeil.`);
