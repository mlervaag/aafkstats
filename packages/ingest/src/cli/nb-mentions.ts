import { parseArgs } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { publicationExtraction } from "@aafkstats/schema";
import type { PublicationExtraction } from "@aafkstats/schema";
import { crossValidate, loadArchive, dataDir } from "@aafkstats/schema/load";
import { applyPersonMentions } from "../adapters/nb-apply.js";
import type { MentionFinding } from "../adapters/nb-apply.js";

/**
 * Fører publikasjonene som omtaler en person som kilder på personen.
 *
 * Leser bare `data/extractions/`, ikke nettet: omtalene ble funnet under
 * masseuttrekket, og navnet er alt slått opp mot personregisteret. Kjøringen
 * trenger derfor verken cache eller NB.
 */

const args = parseArgs({ allowPositionals: true, options: {
  write: { type: "boolean" },
} });

const root = dataDir();
const archive = await loadArchive(root);
if (archive.issues.length > 0) throw new Error(`arkivet har ${archive.issues.length} valideringsfeil`);

const dir = join(root, "extractions");
const mentions: MentionFinding[] = [];
for (const file of (await readdir(dir)).filter((name) => name.endsWith(".yaml"))) {
  const extraction = publicationExtraction.parse(parse(await readFile(join(dir, file), "utf8"))) as PublicationExtraction;
  for (const candidate of extraction.candidates) {
    if (candidate.kind !== "person_mention" || candidate.confidence !== "high") continue;
    // Flere personer på samme linje betyr at OCR-en ikke skilte dem. Da er det
    // ikke sikkert hvem siden faktisk omtaler.
    if (candidate.personIds.length !== 1) continue;
    mentions.push({ personId: candidate.personIds[0]!, sourceId: extraction.sourceId, page: candidate.page });
  }
}

const publications = new Set(mentions.map((mention) => `${mention.personId}|${mention.sourceId}`));
console.log(JSON.stringify({
  omtaler: mentions.length,
  personOgPublikasjon: publications.size,
  personer: new Set(mentions.map((mention) => mention.personId)).size,
}, null, 2));

if (!args.values.write) {
  console.log("Tørrkjøring. Ingen filer skrevet.");
} else {
  const report = await applyPersonMentions(archive, mentions, root);
  console.log(`Skrev ${report.added} kildehenvisninger på ${report.people} personer.`);

  const after = await loadArchive(root);
  const issues = [...after.issues, ...crossValidate(after)];
  if (issues.length > 0) throw new Error(`skrev filer, men arkivet har ${issues.length} feil; se pnpm validate`);
}
