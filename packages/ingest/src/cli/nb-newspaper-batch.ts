import { parseArgs } from "node:util";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { parseArchiveYaml as parseYaml } from "@aafkstats/schema/yaml";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { assertMayFetch } from "../policy.js";
import { AAFK_CLUB_ID } from "@aafkstats/schema";
import { planMonths } from "../adapters/nb-newspaper-plan.js";
import {
  clubNames,
  datelessQueries,
  discoverMatchDate,
  existingMatchDatelessEntry,
  existingMatchForDatelessQuery,
  resolveNewspaperTitle,
  formatBatchReport,
  matchesForBatch,
  runNewspaperBatch,
  type DatelessEntry,
} from "../adapters/nb-newspaper-batch.js";

const args = parseArgs({
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  options: {
    from: { type: "string" },
    to: { type: "string" },
    limit: { type: "string" },
    out: { type: "string" },
    "only-missing-sources": { type: "boolean" },
    "skip-facts": { type: "boolean" },
    "window-days": { type: "string" },
    "expanded-window-days": { type: "string" },
    "candidate-limit": { type: "string" },
    "search-query-limit": { type: "string" },
    dateless: { type: "boolean" },
    season: { type: "string" },
    "likely-months-only": { type: "boolean" },
    "closure-queue-only": { type: "boolean" },
    "newest-first": { type: "boolean" },
    offset: { type: "string" },
    "probes-per-month": { type: "string" },
    "shortlist-per-month": { type: "string" },
    "publish-out": { type: "string" },
    "local-only": { type: "boolean" },
    refresh: { type: "boolean" },
    "dry-run": { type: "boolean" },
  },
});

const from = Number(args.values.from ?? 1927);
const to = Number(args.values.to ?? from);
if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1900 || to < from || to > 2100) {
  console.error("Bruk: pnpm ingest:nb-newspaper-batch -- --from 1980 --to 1989 [--limit 20] [--only-missing-sources] [--skip-facts]");
  process.exit(1);
}

const limit = args.values.limit === undefined ? undefined : Number(args.values.limit);
if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit må være et positivt heltall");

const archive = await loadArchive(dataDir());
if (archive.issues.length > 0) throw new Error(`arkivet har ${archive.issues.length} valideringsfeil`);

if (args.values.dateless) {
  const season = args.values.season === undefined ? undefined : Number(args.values.season);
  let queries = datelessQueries(archive, {
    ...(season === undefined ? { from, to } : { season }),
  });
  if (args.values["closure-queue-only"]) {
    const closure = parseYaml(await readFile(join(dataDir(), "discovery", "discovery-closure-status.yaml"), "utf8")) as {
      closureQueue?: { needsVisualReview?: string[]; requiresRevalidation?: string[] };
    };
    const active = new Set([
      ...(closure.closureQueue?.needsVisualReview ?? []),
      ...(closure.closureQueue?.requiresRevalidation ?? []),
    ]);
    queries = queries.filter((query) => query.sourceClaimId !== undefined && active.has(query.sourceClaimId));
  }
  if (args.values["newest-first"]) {
    queries.sort((left, right) => right.season - left.season || left.id.localeCompare(right.id));
  }
  const offset = nonNegativeInteger(args.values.offset, "offset", 0);
  const selected = queries.slice(offset, limit === undefined ? undefined : offset + limit);
  console.log(`${queries.length} aktuelle kildeførte resultater uten dato${season === undefined ? ` i ${from}\u2013${to}` : ` i ${season}`}; ${selected.length} valgt.`);

  if (args.values["dry-run"]) {
    for (const query of selected) console.log(`  ${query.sourceClaimId ?? query.id} · ${query.season} · ${query.opponent} ${query.score.join("-")}`);
    process.exit(0);
  }

  if (args.values["local-only"]) {
    const entries = selected.flatMap((query) => {
      const existing = existingMatchForDatelessQuery(archive, query);
      return existing ? [existingMatchDatelessEntry(query, existing)] : [];
    });
    if (args.values["publish-out"]) {
      const publishFile = resolve(repoRoot(), args.values["publish-out"]);
      await writeDatelessLedger(publishFile, entries, {
        from: season ?? from,
        to: season ?? to,
        closureQueueOnly: args.values["closure-queue-only"] ?? false,
        likelyMonthsOnly: false,
      });
      console.log(`Publiserbar ledger: ${publishFile}`);
    }
    console.log(`${entries.length} entydige eksisterende match-kandidater funnet uten NB-kall.`);
    process.exit(0);
  }

  assertMayFetch(archive, "nasjonalbiblioteket");

  const aafkNames = clubNames(archive.clubs.find((club) => club.id === AAFK_CLUB_ID));
  const titles = new Map<string, string | null>();
  const rawFile = resolve(repoRoot(), args.values.out ?? join(".cache", "ingest", "nb-newspaper-batch", `datolose-${season ?? `${from}-${to}`}.json`));
  const report = await readDatelessReport(rawFile);
  const done = new Set(args.values.refresh ? [] : report.entries.map((entry) => entry.sourceClaimId ?? entry.id));
  const probesPerMonth = positiveInteger(args.values["probes-per-month"], "probes-per-month", 2);
  const shortlistPerMonth = positiveInteger(args.values["shortlist-per-month"], "shortlist-per-month", 4);
  const datelessQueryLimit = positiveInteger(args.values["search-query-limit"], "search-query-limit", 8);
  for (const query of selected.filter((item) => !done.has(item.sourceClaimId ?? item.id))) {
    const existingMatch = existingMatchForDatelessQuery(archive, query);
    if (existingMatch) {
      const entry = existingMatchDatelessEntry(query, existingMatch);
      report.entries = [
        ...report.entries.filter((prior) => (prior.sourceClaimId ?? prior.id) !== (entry.sourceClaimId ?? entry.id)),
        entry,
      ].sort((left, right) => left.season - right.season || left.id.localeCompare(right.id));
      report.updatedAt = new Date().toISOString();
      await writeJsonAtomic(rawFile, report);
      console.log(`${entry.season} ${entry.opponent} ${entry.score} → existing_match_candidate · ${entry.existingMatchId}`);
      continue;
    }
    // Steg 0: hvilke måneder er kampen sannsynligvis spilt i, og hvilken tittel
    // katalogfører NB årgangen under. Begge deler før første egentlige søk.
    const plan = planMonths(archive, {
      season: query.season,
      ...(query.competitionId === undefined ? {} : { competitionId: query.competitionId }),
      ...(query.round === undefined ? {} : { round: query.round }),
      ...(query.after === undefined ? {} : { after: query.after }),
      ...(query.before === undefined ? {} : { before: query.before }),
    });
    const months = args.values["likely-months-only"] ? plan.months.slice(0, plan.likelyCount) : plan.months;
    const newspaper = await resolveNewspaperTitle(
      query.season,
      { from: `${query.season}-01-01`, to: `${query.season}-12-31` },
      { digitized: titles, ...(args.values.refresh ? { refresh: true } : {}) },
    );

    const entry = await discoverMatchDate(query, aafkNames, {
      months,
      planReason: plan.reason,
      ...(newspaper ? { newspaper } : {}),
      probesPerMonth,
      shortlistPerMonth,
      queryLimit: datelessQueryLimit,
      ...(args.values.refresh ? { refresh: true } : {}),
    });
    report.entries = [
      ...report.entries.filter((existing) => (existing.sourceClaimId ?? existing.id) !== (entry.sourceClaimId ?? entry.id)),
      entry,
    ].sort((left, right) => left.season - right.season || left.id.localeCompare(right.id));
    report.updatedAt = new Date().toISOString();
    await writeJsonAtomic(rawFile, report);
    const found = entry.confirmed
      ? `dato ${entry.confirmed.likelyDate} (utgave ${entry.confirmed.issued})`
      : `${entry.shortlist.length} kandidater`;
    console.log(`${entry.season} ${entry.opponent} ${entry.score} \u2192 ${entry.outcome} \u00b7 ${found}`);
    console.log(`   steg 0: ${plan.reason}`);
  }

  if (args.values["publish-out"]) {
    const publishFile = resolve(repoRoot(), args.values["publish-out"]);
    await writeDatelessLedger(publishFile, report.entries, {
      from: season ?? from,
      to: season ?? to,
      closureQueueOnly: args.values["closure-queue-only"] ?? false,
      likelyMonthsOnly: args.values["likely-months-only"] ?? false,
    });
    console.log(`Publiserbar ledger uten OCR-tekst: ${publishFile}`);
  }
  console.log(`\nRapport: ${rawFile}`);
  process.exit(0);
}

const selection = { from, to, ...(args.values["only-missing-sources"] ? { onlyMissingSources: true } : {}) };
const candidates = matchesForBatch(archive, selection);
console.log(`${candidates.length} kamper i ${from}–${to} har eksakt dato og resultat${args.values["only-missing-sources"] ? " og mangler kildehenvisning" : ""}.`);

if (args.values["dry-run"]) {
  for (const match of candidates.slice(0, limit ?? candidates.length)) {
    console.log(`  ${match.date} ${match.home.clubId} ${match.home.score}-${match.away.score} ${match.away.clubId}`);
  }
  process.exit(0);
}

// Samme port som resten av innhøstingen. Tørrkjøringen over gjør ingen NB-kall.
assertMayFetch(archive, "nasjonalbiblioteket");

function positiveInteger(valueText: string | undefined, name: string, fallback: number): number {
  const value = Number(valueText ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} må være et positivt heltall`);
  return value;
}
const windowDays = positiveInteger(args.values["window-days"], "window-days", 2);
const expandedWindowDays = positiveInteger(args.values["expanded-window-days"], "expanded-window-days", 3);
const candidateLimit = positiveInteger(args.values["candidate-limit"], "candidate-limit", 5);
const searchQueryLimit = positiveInteger(args.values["search-query-limit"], "search-query-limit", 8);
if (expandedWindowDays < windowDays) throw new Error("--expanded-window-days må være minst --window-days");

// Rapporten inneholder OCR-utdrag til kontroll og hører derfor hjemme i den
// hurtiglagrede, uversjonerte delen av treet — ikke i data/.
const reportFile = args.values.out ?? join(repoRoot(), ".cache/ingest/nb-newspaper-batch", `${from}-${to}.json`);

const report = await runNewspaperBatch(archive, {
  ...selection,
  ...(limit === undefined ? {} : { limit }),
  facts: !args.values["skip-facts"],
  windowDays,
  expandedWindowDays,
  candidateLimit,
  searchQueryLimit,
  ...(args.values.refresh ? { refresh: true } : {}),
  reportFile,
  onProgress: (entry) => {
    const issue = entry.issue?.issued ?? "—";
    const additions = entry.additions?.length ? ` · ${entry.additions.join(", ")}` : "";
    console.log(`${entry.date} ${entry.opponent} ${entry.score} → ${entry.outcome} ${issue}${additions}`);
  },
});

console.log(`\n${formatBatchReport(report)}`);
console.log(`\nRapport: ${reportFile}`);

function nonNegativeInteger(valueText: string | undefined, name: string, fallback: number): number {
  const value = Number(valueText ?? fallback);
  if (!Number.isInteger(value) || value < 0) throw new Error(`--${name} må være et ikke-negativt heltall`);
  return value;
}

interface DatelessReport {
  version: 2;
  createdAt: string;
  updatedAt: string;
  entries: DatelessEntry[];
}

async function readDatelessReport(file: string): Promise<DatelessReport> {
  try {
    const report = JSON.parse(await readFile(file, "utf8")) as DatelessReport;
    if (report.version === 2 && Array.isArray(report.entries)) {
      for (const entry of report.entries) {
        if ((entry.outcome as string) === "dato_funnet") entry.outcome = "datoevidens_funnet";
      }
      return report;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const now = new Date().toISOString();
  return { version: 2, createdAt: now, updatedAt: now, entries: [] };
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

async function writeDatelessLedger(
  file: string,
  entries: DatelessEntry[],
  scope: { from: number; to: number; closureQueueOnly: boolean; likelyMonthsOnly: boolean },
): Promise<void> {
  const counts = Object.fromEntries(["existing_match_candidate", "datoevidens_funnet", "kandidatliste", "ingen_treff", "ikke_digitalisert"].map((outcome) => [
    outcome,
    entries.filter((entry) => entry.outcome === outcome).length,
  ]));
  const publishedEntries = entries.map((entry) => ({
    sourceClaimId: entry.sourceClaimId ?? null,
    legacyQueryId: entry.id,
    season: entry.season,
    opponent: entry.opponent,
    score: entry.score,
    outcome: entry.outcome,
    ...(entry.existingMatchId ? { existingMatchId: entry.existingMatchId } : {}),
    ...(entry.plan ? { plan: entry.plan } : {}),
    ...(entry.confirmed ? { confirmed: {
      issueId: entry.confirmed.id,
      issued: entry.confirmed.issued,
      likelyDate: entry.confirmed.likelyDate,
      dateRange: entry.confirmed.dateRange,
      pageUrl: entry.confirmed.pageUrl,
      ...(entry.confirmed.page ? { page: entry.confirmed.page } : {}),
      score: entry.confirmed.score,
      reasons: entry.confirmed.reasons,
      genres: entry.confirmed.genres,
    } } : {}),
    shortlist: entry.shortlist.slice(0, 4).map((candidate) => ({
      issueId: candidate.id,
      ...(candidate.urn ? { urn: candidate.urn } : {}),
      ...(candidate.issued ? { issued: candidate.issued } : {}),
      pageUrl: candidate.pageUrl,
      ...(candidate.page ? { page: candidate.page } : {}),
      month: candidate.month,
      score: candidate.score,
      reasons: candidate.reasons,
      genres: candidate.genres,
      access: {
        viewability: candidate.access.viewability,
        accessAllowedFrom: candidate.access.accessAllowedFrom,
      },
    })),
  }));
  const ledger = {
    contract: "nb-dateless-discovery@1",
    generatedAt: new Date().toISOString().slice(0, 10),
    scope,
    totals: { checked: entries.length, ...counts },
    queues: {
      existingMatchReview: publishedEntries.filter((entry) => entry.outcome === "existing_match_candidate").map((entry) => entry.sourceClaimId),
      dateEvidenceReview: publishedEntries.filter((entry) => entry.outcome === "datoevidens_funnet").map((entry) => entry.sourceClaimId),
      candidateReview: publishedEntries.filter((entry) => entry.outcome === "kandidatliste").map((entry) => entry.sourceClaimId),
      exhausted: publishedEntries.filter((entry) => entry.outcome === "ingen_treff" || entry.outcome === "ikke_digitalisert").map((entry) => entry.sourceClaimId),
    },
    entries: publishedEntries,
  };
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, stringifyYaml(ledger, { lineWidth: 0 }), "utf8");
  await rename(temporary, file);
}
