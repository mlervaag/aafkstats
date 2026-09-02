import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { clubNameForms } from "@aafkstats/schema";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { assertMayFetch } from "../policy.js";
import {
  fetchWikidataTransferTargets,
  findTransferCandidates,
  type TransferTargetResult,
} from "../adapters/nb-transfer-candidates.js";

/**
 * Overgangskandidater for 2000–2012, hentet fra Sunnmørsposten hos NB.
 *
 * Produserer et artefakt til redaksjonell kontroll. Ingenting skrives til
 * `data/`. Se toppkommentaren i `../adapters/nb-transfer-candidates.js` for
 * hvorfor Wikidata bare er en målliste og ikke en kilde.
 */

const args = parseArgs({
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  options: {
    from: { type: "string" },
    to: { type: "string" },
    limit: { type: "string" },
    json: { type: "boolean" },
    refresh: { type: "boolean" },
  },
});

if (args.values.from === undefined || args.values.to === undefined) {
  console.error("Bruk: pnpm ingest:nb-transfer-candidates -- --from 2000 --to 2012 [--limit 5] [--json]");
  process.exit(1);
}

const from = Number(args.values.from);
const to = Number(args.values.to);
if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
  throw new Error("--from og --to må være heltall, og --to må være minst --from");
}

const limit = args.values.limit === undefined ? undefined : Number(args.values.limit);
if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error("--limit må være et positivt heltall");
}

const archive = await loadArchive(dataDir());
if (archive.issues.length > 0) throw new Error(`arkivet har ${archive.issues.length} valideringsfeil; kjør pnpm validate`);

assertMayFetch(archive, "wikidata");
assertMayFetch(archive, "nasjonalbiblioteket");

// Klubbnavn brukes bare som et signal i poengsettingen — «nevner utgaven en
// klubb i tillegg til overgangsordet» — ikke til å slå fast hvilken klubb
// overgangen faktisk gjaldt. Svært korte former («FK», «IL») luket bort i
// selve poengsettingen, se `scoreTransferFragment`.
const clubNames = [...new Set(archive.clubs.flatMap((club) => clubNameForms(club)))];

let targets = await fetchWikidataTransferTargets(from, to, { refresh: args.values.refresh });
const targetsFound = targets.length;
if (limit !== undefined) targets = targets.slice(0, limit);

const results = await findTransferCandidates(targets, {
  clubNames,
  refresh: args.values.refresh,
  concurrency: 3,
});

const withCandidates = results.filter((result) => result.candidates.length > 0);
const totalCandidates = results.reduce((sum, result) => sum + result.candidates.length, 0);

const summary = {
  periode: `${from}–${to}`,
  målFraWikidata: targetsFound,
  målSøkt: targets.length,
  målMedKandidater: withCandidates.length,
  kandidaterTotalt: totalCandidates,
};

if (args.values.json) console.log(JSON.stringify({ ...summary, resultater: results }, null, 2));
else console.log(JSON.stringify(summary, null, 2));

const artifactPath = resolve(repoRoot(), "artifacts", `nb-overgangskandidater-${from}-${to}.md`);
await mkdir(dirname(artifactPath), { recursive: true });
await writeFile(artifactPath, formatArtifact(results, { from, to, targetsFound }), "utf8");
console.log(`Artefakt skrevet: ${artifactPath}`);

function formatArtifact(
  targetResults: TransferTargetResult[],
  info: { from: number; to: number; targetsFound: number },
): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`# Overgangskandidater ${info.from}–${info.to}`);
  lines.push("");
  lines.push(`Maskinelt uttrekk, ${today}. **Kandidater til redaksjonell kontroll, ikke arkivdata.**`);
  lines.push("");
  lines.push(
    "Wikidata er brukt bare som målliste — hvilke spillere og hvilke år vi skal lete etter. " +
      "Ingenting av det Wikidata sier om klubb, dato eller retning er ført inn her eller skal " +
      "oppgis som kilde: `data/providers/wikidata.yaml` viser at 122 av 153 kildehenvisninger på " +
      "disse opplysningene bare er «imported from English Wikipedia», altså ingen kilde i det " +
      "hele tatt.",
  );
  lines.push("");
  lines.push(
    "Teksten er søkt opp i Sunnmørsposten hos Nasjonalbiblioteket. Årganger fra og med 1936 er " +
      "bare synlige i Nasjonalbibliotekets lokaler eller med innlogging (se " +
      "`packages/ingest/src/adapters/nb-newspaper-access.ts`) — derfor er det bare *fakta* som kan " +
      "føres inn i arkivet når en kandidat kontrolleres, aldri avisteksten selv.",
  );
  lines.push("");
  lines.push(
    `${info.targetsFound} mål funnet i Wikidata for perioden, ${targetResults.length} søkt. ` +
      "Hvert treff krever at spillerens etternavn og et overgangsord begge finnes i samme " +
      "tekstvindu, innenfor 200 tegn fra hverandre — uten det er kandidaten forkastet før den " +
      "når dette dokumentet.",
  );
  lines.push("");
  lines.push("## Kandidater per mål");
  lines.push("");

  for (const { target, candidates } of targetResults) {
    const retning = target.direction === "in" ? "inn til AaFK" : "ut fra AaFK";
    lines.push(`### ${target.player} — ${retning}, Wikidata antyder ${target.year}`);
    lines.push("");
    if (candidates.length === 0) {
      lines.push("Ingen kandidater over sperren.");
      lines.push("");
      continue;
    }
    for (const candidate of candidates) {
      const utgave = candidate.issued ? formatIssued(candidate.issued) : "ukjent utgavedato";
      const side = candidate.pageNumber ? ` · side ${candidate.pageNumber}` : "";
      lines.push(`- **${utgave}${side}** (score ${candidate.score}) — ${candidate.reasons.join("; ")}`);
      lines.push(`  ${candidate.itemUrl}`);
      lines.push(`  > ${candidate.text.replace(/\s+/g, " ").trim()}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatIssued(issued: string): string {
  if (!/^\d{8}$/.test(issued)) return issued;
  return `${issued.slice(6, 8)}.${issued.slice(4, 6)}.${issued.slice(0, 4)}`;
}
