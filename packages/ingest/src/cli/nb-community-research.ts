import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { nbCommunityResearchManifest } from "@aafkstats/schema";
import { loadArchive, repoRoot } from "@aafkstats/schema/load";
import {
  buildNbCommunityResearchManifest,
  compareCommunityResearchManifests,
} from "../newspaper/community-research.js";

const apply = process.argv.slice(2).includes("--apply");
const root = repoRoot();
const output = `${root}/data/discovery/nb-community-research-wave-1.yaml`;
const next = await buildNbCommunityResearchManifest(root);
const previous = existsSync(output)
  ? nbCommunityResearchManifest.parse(parse(await readFile(output, "utf8"), { schema: "core" }))
  : undefined;
const stats = compareCommunityResearchManifests(previous, next);
const archive = await loadArchive(`${root}/data`);
const generatedIds = new Set(next.items.map((item) => item.id));
const generatedTargets = new Set(next.items.map((item) => `${item.sourceResults[0]!.sourceId}|${item.season}|${item.sourceResults[0]!.no}|${item.category}`));
const manualProtected = archive.verificationCases.filter((item) =>
  item.file.startsWith("verification-cases/") && (
    generatedIds.has(item.id)
    || (item.researchTask && generatedTargets.has(`${item.researchTask.sourceResults[0]!.sourceId}|${item.researchTask.season}|${item.researchTask.sourceResults[0]!.no}|${item.researchTask.category}`))
  ),
).length;

if (apply && (stats.created > 0 || stats.updated > 0 || !previous)) {
  await writeFile(output, stringify(next, { lineWidth: 0 }), "utf8");
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  output,
  ...stats,
  manualProtected,
  published: next.items.filter((item) => item.published).length,
  draft: next.items.filter((item) => !item.published).length,
  categories: next.summary,
  canonicalMatchesChanged: 0,
  sourceResultsChanged: 0,
}, null, 2));
