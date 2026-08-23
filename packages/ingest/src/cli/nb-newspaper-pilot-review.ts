import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import type { Match, Source } from "@aafkstats/schema";
import type { BatchReport } from "../adapters/nb-newspaper-batch.js";
import { buildPilotReviewEntries } from "../newspaper/pilot-review.js";
import { assertMayPublish } from "../policy.js";

const args = parseArgs({
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  allowPositionals: true,
  options: { report: { type: "string" }, out: { type: "string" }, write: { type: "boolean" } },
});
if (!args.values.report) throw new Error("Bruk --report <canonical-newspaper-enrichment@2.json>");
const report = JSON.parse(await readFile(resolve(args.values.report), "utf8")) as BatchReport;
if (report.adapter !== "canonical-newspaper-enrichment@2") throw new Error(`Uventet adapter: ${report.adapter}`);
const entries = buildPilotReviewEntries(report);
const output = resolve(args.values.out ?? `${repoRoot()}/data/discovery/newspaper-enrichment-reviews.yaml`);
const previous = await readExistingEntries(output);
const previousByMatch = new Map(previous.map((entry) => [entry.matchId, entry]));
for (const entry of entries) {
  const prior = previousByMatch.get(entry.matchId);
  if (prior?.canonicalLinked && prior.issueId === entry.issueId) {
    const sameClassification = prior.status === entry.status
      && prior.confidence === entry.confidence
      && prior.genres.join("|") === entry.genres.join("|");
    if (!sameClassification) {
      throw new Error(`Tidligere kobling har endret evidensklassifisering og krever manuell avstemming: ${entry.matchId}`);
    }
    entry.canonicalLinked = true;
    entry.fieldsAdded = prior.fieldsAdded;
    entry.newEvents = prior.newEvents;
  }
}

if (args.values.write) {
  const archive = await loadArchive(dataDir());
  if (archive.issues.length > 0) throw new Error(`arkivet har ${archive.issues.length} valideringsfeil`);
  assertMayPublish(archive, "nasjonalbiblioteket");
  const byMatch = new Map(report.entries.map((entry) => [entry.matchId, entry]));
  const files = new Map(archive.matches.map((match) => [match.id, match.file]));
  const venues = new Map(archive.venues.flatMap((venue) =>
    [venue.name, ...venue.names.map((name) => name.name)].map((name) => [normalizeName(name), venue.id] as const)));
  let linked = 0;
  let factsWritten = 0;

  for (const review of entries.filter((entry) => entry.status === "ocr_correlated" || entry.status === "conflict_candidate")) {
    const batchEntry = byMatch.get(review.matchId);
    const issue = batchEntry?.candidates.find((candidate) => candidate.id === review.issueId);
    const matchFile = files.get(review.matchId);
    if (!batchEntry || !issue || !matchFile || !issue.issued) continue;
    const sourceId = `sunnmorsposten-${issue.issued}-${issue.id}`;
    const source: Source = {
      id: sourceId,
      title: `Sunnmørsposten ${review.issued}`,
      sourceType: "other",
      publisher: "Sunnmørsposten",
      year: Number(issue.issued.slice(0, 4)),
      ...(issue.urn ? { urn: issue.urn } : {}),
      accessUrl: issue.pageUrl,
      providers: [{ providerId: "nasjonalbiblioteket", url: issue.pageUrl }],
    };
    const sourceFile = join(dataDir(), "sources", `${sourceId}.yaml`);
    await mkdir(dirname(sourceFile), { recursive: true });
    await writeSourceOnce(sourceFile, source);

    const absoluteMatchFile = join(dataDir(), matchFile);
    const match = parseYaml(await readFile(absoluteMatchFile, "utf8"), { schema: "core" }) as Match;
    const isReport = review.genres.some((genre) => genre === "match_report" || genre === "result_note");
    const fields = review.status === "ocr_correlated" && isReport && review.issueId === batchEntry.issue?.id
      ? applyFacts(match, batchEntry, venues)
      : [];
    if (isReport && !match.externalReports.some((external) => external.url === issue.pageUrl)) {
      match.externalReports.push({ publisher: "Sunnmørsposten", url: issue.pageUrl, date: review.issued });
    }
    if (!match.providers.some((provider) => provider.providerId === "nasjonalbiblioteket" && provider.url === issue.pageUrl)) {
      match.providers.push({ providerId: "nasjonalbiblioteket", url: issue.pageUrl, retrievedAt: "2026-08-23", fields: [...(isReport ? ["externalReports"] : []), ...fields] });
    }
    if (!match.sources.some((sourceRef) => sourceRef.sourceId === sourceId)) {
      match.sources.push({
        sourceId,
        ...(issue.page ? { page: issue.page } : {}),
        fields: [...(isReport ? ["externalReports"] : []), ...fields],
        note: review.note,
      });
    }
    await writeFile(absoluteMatchFile, stringifyYaml(match, { lineWidth: 0 }), "utf8");
    review.canonicalLinked = true;
    if (fields.length > 0) review.fieldsAdded = fields;
    linked += 1;
    if (fields.length > 0) factsWritten += 1;
  }
  console.log(`Koblet ${linked} avisutgaver; skrev strukturerte fakta til ${factsWritten} kamper.`);
}

const currentIds = new Set(entries.map((entry) => entry.matchId));
const merged = [...previous.filter((entry) => !currentIds.has(entry.matchId)), ...entries]
  .sort((left, right) => left.matchId.localeCompare(right.matchId));
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
await writeFile(temporary, stringifyYaml({ contract: "newspaper-enrichment-reviews@1", entries: merged }, { lineWidth: 0 }), "utf8");
await rename(temporary, output);
const counts = new Map<string, number>();
for (const entry of entries) counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
console.log(`Skrev ${entries.length} reviewutfall til ${output}`);
for (const [status, count] of counts) console.log(`${status}: ${count}`);

function applyFacts(match: Match, entry: BatchReport["entries"][number], venues: Map<string, string>): string[] {
  const facts = entry.facts;
  if (!facts) return [];
  const fields: string[] = [];
  if (match.attendance === undefined && facts.attendance !== undefined) {
    match.attendance = facts.attendance;
    fields.push("attendance");
  }
  if (match.referee === undefined && facts.referee !== undefined && isSafeRefereeName(facts.referee)) {
    match.referee = normalizeOcrName(facts.referee);
    fields.push("referee");
  }
  if (match.venueId === undefined && facts.venue !== undefined) {
    const venueId = venues.get(normalizeName(facts.venue));
    if (venueId) {
      match.venueId = venueId;
      fields.push("venueId");
    }
  }
  if (facts.halfTime && match.home.halfTimeScore === null && match.away.halfTimeScore === null) {
    match.home.halfTimeScore = facts.halfTime.home;
    match.away.halfTimeScore = facts.halfTime.away;
    fields.push("home.halfTimeScore", "away.halfTimeScore");
  }
  return fields;
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase("nb").normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9æøå]+/giu, "");
}

function normalizeOcrName(value: string): string {
  return value.replace(/(\p{Ll})-\s+(\p{Ll})/gu, "$1$2").replace(/\s+/gu, " ").trim();
}

function isSafeRefereeName(value: string): boolean {
  const normalized = normalizeOcrName(value);
  if (normalized.split(/\s+/u).length < 2) return false;
  const plain = normalized.toLocaleLowerCase("nb").normalize("NFKD").replace(/\p{M}/gu, "");
  return !/[bcdfghjklmnpqrstvwxz]{4}/u.test(plain);
}

async function readExistingEntries(path: string): Promise<ReturnType<typeof buildPilotReviewEntries>> {
  try {
    const existing = parseYaml(await readFile(path, "utf8"), { schema: "core" }) as {
      entries?: ReturnType<typeof buildPilotReviewEntries>;
    };
    return existing.entries ?? [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeSourceOnce(path: string, source: Source): Promise<void> {
  try {
    const existing = parseYaml(await readFile(path, "utf8"), { schema: "core" }) as Source;
    if (existing.id !== source.id || existing.urn !== source.urn || existing.accessUrl !== source.accessUrl) {
      throw new Error(`Kilde-ID kolliderer med annet NB-dokument: ${source.id}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(path, stringifyYaml(source, { lineWidth: 0 }), "utf8");
  }
}
