import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { dataDir, loadArchive, repoRoot } from "@aafkstats/schema/load";
import { assertMayFetch } from "../policy.js";
import { AAFK_CLUB_ID } from "@aafkstats/schema";
import { planMonths } from "../adapters/nb-newspaper-plan.js";
import {
  clubNames,
  datelessQueries,
  discoverMatchDate,
  resolveNewspaperTitle,
  searchWindow,
  formatBatchReport,
  matchesForBatch,
  runNewspaperBatch,
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
    dateless: { type: "boolean" },
    season: { type: "string" },
    "likely-months-only": { type: "boolean" },
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

// Samme port som resten av innhøstingen. Verktøyet skriver aldri data, men det
// henter fra en kilde, og det spørsmålet stilles ett sted.
assertMayFetch(archive, "nasjonalbiblioteket");

if (args.values.dateless) {
  const season = args.values.season === undefined ? undefined : Number(args.values.season);
  const queries = datelessQueries(archive, {
    ...(season === undefined ? { from, to } : { season }),
  });
  console.log(`${queries.length} kildeførte resultater uten dato${season === undefined ? ` i ${from}\u2013${to}` : ` i ${season}`}.`);

  const aafkNames = clubNames(archive.clubs.find((club) => club.id === AAFK_CLUB_ID));
  const titles = new Map<string, string | null>();
  const entries = [];
  for (const query of queries.slice(0, limit ?? queries.length)) {
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
      searchWindow(`${query.season}-01-01`, 364),
      { digitized: titles, ...(args.values.refresh ? { refresh: true } : {}) },
    );

    const entry = await discoverMatchDate(query, aafkNames, {
      months,
      planReason: plan.reason,
      ...(newspaper ? { newspaper } : {}),
      ...(args.values.refresh ? { refresh: true } : {}),
    });
    entries.push(entry);
    const found = entry.confirmed
      ? `dato ${entry.confirmed.likelyDate} (utgave ${entry.confirmed.issued})`
      : `${entry.shortlist.length} kandidater`;
    console.log(`${entry.season} ${entry.opponent} ${entry.score} \u2192 ${entry.outcome} \u00b7 ${found}`);
    console.log(`   steg 0: ${plan.reason}`);
  }

  const file = args.values.out ?? join(repoRoot(), ".cache/ingest/nb-newspaper-batch", `datolose-${season ?? `${from}-${to}`}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ version: 1, createdAt: new Date().toISOString(), entries }, null, 2)}\n`, "utf8");
  console.log(`\nRapport: ${file}`);
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

// Rapporten inneholder OCR-utdrag til kontroll og hører derfor hjemme i den
// hurtiglagrede, uversjonerte delen av treet — ikke i data/.
const reportFile = args.values.out ?? join(repoRoot(), ".cache/ingest/nb-newspaper-batch", `${from}-${to}.json`);

const report = await runNewspaperBatch(archive, {
  ...selection,
  ...(limit === undefined ? {} : { limit }),
  facts: !args.values["skip-facts"],
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
