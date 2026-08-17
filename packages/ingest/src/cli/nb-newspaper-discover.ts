import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { stringify } from "yaml";
import { dataDir, loadArchive } from "@aafkstats/schema/load";
import { assertMayFetch } from "../policy.js";
import { newspaperPageUrl } from "../adapters/nb-newspaper-access.js";
import { createIssueCache, discoverForGroup } from "../newspaper/discovery.js";
import { buildHypotheses, parseSourceResultId, sourceIdFromPath, sourceResultQueries, withSiblings } from "../newspaper/source-result-query.js";
import type { DiscoveredIssue } from "../newspaper/discovery.js";
import type { DiscoveryResult } from "../newspaper/reconciliation.js";
import type { SourceResultQuery } from "../newspaper/source-result-query.js";

/**
 * Avisdiscovery for kilderesultater.
 *
 * Skriver aldri i arkivet. Utfallet er en rapport: hva avisene sier, hvor sikkert
 * det er, og hvor kildene er uenige. Kanonisering er en egen avgjørelse, og den
 * tas et annet sted av noen som har lest rapporten.
 */

const args = parseArgs({
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  options: {
    "source-result": { type: "string" },
    "source-result-id": { type: "string" },
    year: { type: "string" },
    no: { type: "string" },
    "from-year": { type: "string" },
    "to-year": { type: "string" },
    "unlinked-only": { type: "boolean" },
    limit: { type: "string" },
    output: { type: "string" },
    enrich: { type: "string" },
    refresh: { type: "boolean" },
    "dry-run": { type: "boolean" },
  },
});

const identifier = args.values["source-result-id"] === undefined ? undefined : parseSourceResultId(args.values["source-result-id"]);
if (args.values["source-result-id"] !== undefined && identifier === undefined) {
  throw new Error("--source-result-id må være «sourceId:år:nr»");
}

const sourceId = identifier?.sourceId
  ?? (args.values["source-result"] === undefined ? undefined : sourceIdFromPath(args.values["source-result"]));
if (sourceId === undefined) {
  console.error("Bruk: pnpm ingest:nb-newspaper-discover -- --source-result data/source-results/<fil>.yaml [--year ÅR] [--no N] [--unlinked-only] [--limit 20]");
  process.exit(1);
}

const number = (value: string | undefined): number | undefined => (value === undefined ? undefined : Number(value));
const season = identifier?.season ?? number(args.values.year);
const no = identifier?.no ?? number(args.values.no);
const limit = number(args.values.limit);

const archive = await loadArchive(dataDir());
if (archive.issues.length > 0) throw new Error(`arkivet har ${archive.issues.length} valideringsfeil`);
assertMayFetch(archive, "nasjonalbiblioteket");

const selection = {
  sourceId,
  ...(season === undefined ? {} : { season }),
  ...(no === undefined ? {} : { no }),
  ...(number(args.values["from-year"]) === undefined ? {} : { fromYear: number(args.values["from-year"])! }),
  ...(number(args.values["to-year"]) === undefined ? {} : { toYear: number(args.values["to-year"])! }),
  ...(args.values["unlinked-only"] ? { unlinkedOnly: true } : {}),
};
const queries = sourceResultQueries(archive, selection);

const selected = queries.slice(0, limit ?? queries.length);
console.log(`${queries.length} kilderesultater valgt fra ${sourceId}${selected.length < queries.length ? `, tar de ${selected.length} første` : ""}.`);

if (args.values["dry-run"]) {
  for (const query of selected) {
    console.log(`  ${query.year} #${query.ref.no} ${query.printedOpponent} ${query.expectedScore?.join("-") ?? "?"}`
      + `${query.competitionHint ? ` · ${query.competitionHint}` : ""}${query.homeAwayHint ? ` · ${query.homeAwayHint}` : ""}`);
  }
  process.exit(0);
}

const cache = createIssueCache();
let requests = 0;
const records = [];
const wanted = new Set(selected.map((query) => `${query.year}-${query.ref.no}`));

// Fordelingen trenger hele søskengruppen, også når brukeren spurte om én rad.
// Bare de valgte radene rapporteres, men konkurransen om hendelsene er ekte.
for (const [, group] of withSiblings(archive, selection)) {
  const hypotheses = buildHypotheses(group);
  const results = await discoverForGroup(hypotheses, {
    cache,
    ...(number(args.values.enrich) === undefined ? {} : { enrich: number(args.values.enrich)! }),
    ...(args.values.refresh ? { refresh: true } : {}),
    onRequest: () => { requests += 1; },
  });

  for (const hypothesis of hypotheses) {
    const result = results.get(hypothesis.id);
    if (!result) continue;
    for (const query of hypothesis.queries) {
      if (!wanted.has(`${query.year}-${query.ref.no}`)) continue;
      records.push({ ...toRecord(query, result, []), allocation: result.allocation });
      console.log(`${query.year} #${query.ref.no} ${query.printedOpponent} ${query.expectedScore?.join("-") ?? "?"}`
        + ` → ${result.status}${result.matchDate ? ` · ${result.matchDate.value} (${result.matchDate.confidence})` : ""}`
        + `${result.newspaperScore ? ` · avisa: ${result.newspaperScore.join("-")}` : ""}`
        + ` · fordeling ${result.allocation.confidence} (margin ${result.allocation.margin})`);
    }
  }
}

const summary = summarize(records);
console.log(`\n${summary}`);
console.log(`API-kall: ${requests} · søkesett i cache: ${cache.size}`);

if (args.values.output) {
  await mkdir(dirname(args.values.output), { recursive: true });
  await writeFile(args.values.output, stringify({ version: 1, createdAt: new Date().toISOString(), sourceId, records }), "utf8");
  console.log(`Rapport: ${args.values.output}`);
}

/**
 * Rapportraden.
 *
 * Den bærer identifikatorer, datoer, sider og utledede fakta — ikke OCR-tekst.
 * Avistekst fra 1936 og framover er opphavsrettsbeskyttet, og rapporten er en
 * fil i arkivet. Den som vil lese artikkelen, følger lenka til siden hos NB.
 */
function toRecord(query: SourceResultQuery, result: DiscoveryResult, issues: DiscoveredIssue[]) {
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  return {
    sourceResult: { file: query.ref.file, sourceId: query.ref.sourceId, year: query.ref.season, no: query.ref.no },
    input: {
      opponent: query.printedOpponent,
      ...(query.opponentClubId ? { opponentClubId: query.opponentClubId } : {}),
      ...(query.expectedScore ? { score: [...query.expectedScore] } : {}),
      ...(query.competitionHint ? { competitionHint: query.competitionHint } : {}),
      ...(query.homeAwayHint ? { homeAwayHint: query.homeAwayHint } : {}),
    },
    status: result.status,
    ...(result.matchDate ? { matchDate: result.matchDate } : {}),
    ...(result.newspaperScore ? { newspaperScore: result.newspaperScore } : {}),
    ...(result.sourceScore ? { sourceScore: result.sourceScore } : {}),
    checks: result.checks,
    combinedConfidence: result.combinedConfidence,
    evidence: result.evidence.slice(0, 5).map((item) => {
      const issue = byId.get(item.issueId);
      return {
        issueId: item.issueId,
        ...(item.issueDate ? { issueDate: item.issueDate } : {}),
        ...(issue?.urn ? { urn: issue.urn } : {}),
        ...(item.page ? { page: item.page } : {}),
        url: newspaperPageUrl(item.issueId, item.page),
        type: item.kind,
        score: item.score,
        ...(item.temporal ? { temporalPhrase: item.temporal.phrase, inferredMatchDate: item.temporal.inferredMatchDate } : {}),
        ...(item.scoreFound ? { newspaperScore: item.scoreFound } : {}),
        reasons: item.reasons,
      };
    }),
  };
}

function summarize(records: Array<{ status: string }>): string {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
  return [...counts].map(([status, count]) => `${count} ${status}`).join(" · ") || "ingen rader";
}
