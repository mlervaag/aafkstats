import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { parseArchiveYaml as parseYaml } from "../yaml.js";
import { repoRoot } from "../load.js";
import type { NewspaperEnrichmentStatus } from "../historical/newspaper-enrichment-status.js";

type EvidenceIssue = { issueId: string; issued?: string; canonicalLinked: boolean };
type Review = { matchId: string; status: string; canonicalLinked: boolean; facsimileReviewed: boolean; evidenceIssues: EvidenceIssue[]; issueId?: string; issued?: string; page?: string; genres: string[]; fieldsAdded: string[]; searchedIssues: number; ocrCandidates: number; conflict?: { canonical: string; newspaper: string } };
const root = repoRoot(), from = 1980, to = 1999, id = "sunnmorsposten-1980-1999-production";
const blocks = [[1980, 1984], [1985, 1989], [1990, 1994], [1995, 1999]] as const;
const comparisons = [[1915, 1924], [1925, 1934], [1935, 1944], [1945, 1951], [1952, 1962], [1963, 1971], [1972, 1978], [1979, 1979], ...blocks] as const;
const status = parseYaml(await readFile(join(root, "data/discovery/newspaper-enrichment-status.yaml"), "utf8")) as NewspaperEnrichmentStatus;
const ledger = parseYaml(await readFile(join(root, "data/discovery/newspaper-enrichment-reviews.yaml"), "utf8")) as { entries: Review[] };
const entries = status.entries.filter((entry) => inRange(entry.season, from, to));
const reviews = ledger.entries.filter((entry) => inRange(year(entry), from, to));
const linked = reviews.filter((entry) => entry.canonicalLinked && entry.issueId && entry.issued);
const linkedEvidence = reviews.flatMap((entry) => entry.evidenceIssues).filter((entry): entry is EvidenceIssue & { issued: string } => entry.canonicalLinked && entry.issued !== undefined);
const sourceIds = [...new Set(linkedEvidence.map(sourceId))].sort();
const sourceInventory = await Promise.all(sourceIds.map(async (sourceId) => {
  const source = parseYaml(await readFile(join(root, "data/sources", `${sourceId}.yaml`), "utf8")) as { title: string; year: number };
  return { sourceId, title: source.title, year: source.year, reviewStatus: "reviewed" };
}));
const conflicts = reviews.filter((entry) => entry.conflict && entry.issueId && entry.issued);
const facsimileReviews = reviews.filter((entry) => entry.facsimileReviewed);
const findingId = (entry: Review) => `conflict-${entry.matchId.slice(0, 10)}-${entry.issueId!.slice(0, 8)}`;
const manifest = {
  version: 1, id, title: "Datoankret Sunnmørsposten-berikelse 1980–1999", profile: "generic_publication", mode: "initial", status: "normalized",
  scope: { years: { from, to }, sourceIds }, sourceInventory,
  coverage: { mode: "sections", expected: entries.length, reviewed: reviews.length },
  passes: {
    facsimile_review: { status: "skipped", findings: facsimileReviews.length, note: "Produksjonspolicyen bruker NB OCR-API uten obligatorisk faksimilekontroll per kamp." },
    explicit_results: { status: "reviewed", findings: linked.length, note: `${entries.length} kampjobber; ${linked.length} kampkoblinger til ${sourceIds.length} aviskilder.` },
    people_and_roles: { status: "skipped", findings: 0, note: "Ingen personer uten entydig rolle- og identitetsbinding." },
    organization: { status: "skipped", findings: 0, note: "Ikke del av kampberikelsen." },
    retrospectives_and_claims: { status: "skipped", findings: 0, note: "Ikke del av datoankret samtidig omtale." },
    observations: { status: "skipped", findings: 0, note: "Ingen historiske observasjoner skrevet." },
  },
  reviewMethod: { facsimile: "unavailable", reason: "Batchen følger den kalibrerte policyen for datoankret canonical avisberikelse og bruker NB OCR-API." },
  review: { file: `docs/data/reviews/${id}.md` },
  findings: conflicts.map((entry) => ({ id: findingId(entry), source: { sourceId: sourceId(entry), ...(entry.page ? { page: entry.page } : {}) }, type: "source_conflict", claim: { text: `OCR leser ${entry.conflict!.newspaper}; canonical har ${entry.conflict!.canonical}.` }, confidence: "uncertain", disposition: "no_structured_action", status: "unresolved" })),
  unresolved: conflicts.map((entry) => ({ findingId: findingId(entry), type: "score-conflict-candidate", note: `${entry.matchId}: canonical resultat er ikke endret.` })),
  previousWork: { pullRequests: [217, 219, 220, 221, 223, 226], notes: ["PR #217–#223 etablerte og skalerte produksjonsløypa til 1915–1979; PR #226 korrigerte permanente avissidelenker."] },
  baseRevision: "4108e926", createdAt: "2026-08-24",
  notes: [`Alle ${entries.length} kamper ble kjørt; ${sourceIds.length} aviskilder ble koblet til ${linked.length} kampjobber.`, "Ingen beskyttet OCR-tekst er lagret."],
};
await writeFile(join(root, "data/harvests", `${id}.yaml`), stringifyYaml(manifest, { lineWidth: 0 }), "utf8");
await writeFile(join(root, "docs/data/reviews", `${id}.md`), markdown(), "utf8");
console.log(`Skrev ${entries.length} jobber, ${sourceIds.length} kilder og ${conflicts.length} konflikter.`);

function markdown(): string {
  const lines = ["# Review: Datoankret Sunnmørsposten-berikelse 1980–1999", "", "Reviewgrunnlag: NB OCR-API etter den kalibrerte produksjonspolicyen. `facsimileReviewed` er false når faksimilen ikke er kontrollert, og ingen OCR-tekst er lagret.", "", "## Per sesong", "", "| År | Scope | OCR | Smp | Referat | Resultatnotis | Preview | Ingen kandidat | Ikke digitalisert | Konflikt | Nye fakta | Complete | Residual |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]; 
  for (let season = from; season <= to; season += 1) lines.push(seasonRow(season, season));
  lines.push(seasonRow(from, to, "**Sum**"), "", "## Produksjonsblokker", "", "| Periode | Scope | Smp | Referat | Ingen kandidat | Ikke digitalisert | Complete | Residual | D+1 | Hovedvindu | Kandidater/kamp |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [start, end] of blocks) lines.push(blockRow(start, end));
  lines.push("", "## Historisk sammenligning", "", "| Periode | Omtale | Referat | Complete | Ingen OCR | Konflikt | D+1 | Hovedvindu | Kandidater/kamp | Skalar-yield |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [start, end] of comparisons) lines.push(compareRow(start, end));
  lines.push("", "## Kvalitet og avstemming", "", `${conflicts.length} resultatavvik er uløste konfliktkandidater. ${facsimileReviews.length} kampjobber er markert visuelt kontrollert; skalarfakta er bare skrevet additivt.`, "", `${sum(reviews, "searchedIssues")} utgaver ble undersøkt og ${sum(reviews, "ocrCandidates")} OCR-kandidater bevart. ${linked.filter((entry) => offset(entry) === 1).length}/${linked.length} primærkoblinger var D+1; ${linked.filter((entry) => Math.abs(offset(entry)) <= 2).length}/${linked.length} lå innen D−2 til D+2.`, "", "Aviskoblingene og klassifiseringen fra produksjonssettene 1915–1979 er uendret. Det globale scopet inkluderer den nye 1959-kampen fra PR #228. PR #212-ledgeren er regenerert og er uendret.", "", "## Source Inventory", "", `Manifestet er autoritativt for ${sourceIds.length} unike utgaver: [${id}.yaml](../../../data/harvests/${id}.yaml).`);
  return `${lines.join("\n")}\n`;
}
function seasonRow(start: number, end: number, label = String(start)): string { const current = status.entries.filter((e) => inRange(e.season, start, end)), currentReviews = ledger.entries.filter((e) => inRange(year(e), start, end)); const count = (fn: (e: typeof current[number]) => boolean) => current.filter(fn).length; return `| ${label} | ${current.length} | ${count((e) => e.reviewStatus === "ocr_correlated")} | ${count((e) => e.hasSmpMention)} | ${count((e) => e.hasMatchReport)} | ${currentReviews.filter((e) => e.genres.includes("result_note")).length} | ${count((e) => e.residualReason === "preview_only")} | ${count((e) => e.reviewStatus === "no_ocr_candidate")} | ${count((e) => e.reviewStatus === "not_digitized")} | ${count((e) => e.conflictCandidate)} | ${currentReviews.filter((e) => e.fieldsAdded.length > 0).length} | ${count((e) => e.enrichmentStatus === "complete")} | ${count((e) => e.enrichmentStatus === "residual")} |`; }
function blockRow(start: number, end: number): string { const current = status.entries.filter((e) => inRange(e.season, start, end)), r = ledger.entries.filter((e) => inRange(year(e), start, end)), l = r.filter((e) => e.canonicalLinked && e.issued); return `| ${start}–${end} | ${current.length} | ${current.filter((e) => e.hasSmpMention).length} | ${current.filter((e) => e.hasMatchReport).length} | ${current.filter((e) => e.reviewStatus === "no_ocr_candidate").length} | ${current.filter((e) => e.reviewStatus === "not_digitized").length} | ${current.filter((e) => e.enrichmentStatus === "complete").length} | ${current.filter((e) => e.enrichmentStatus === "residual").length} | ${l.filter((e) => offset(e) === 1).length} | ${l.filter((e) => Math.abs(offset(e)) <= 2).length} | ${ratio(sum(r, "ocrCandidates"), current.length)} |`; }
function compareRow(start: number, end: number): string { const current = status.entries.filter((e) => inRange(e.season, start, end)), r = ledger.entries.filter((e) => inRange(year(e), start, end)), l = r.filter((e) => e.canonicalLinked && e.issued), pct = (n: number) => current.length ? `${(100 * n / current.length).toFixed(1)} %` : "–"; return `| ${start}–${end} | ${pct(current.filter((e) => e.hasSmpMention).length)} | ${pct(current.filter((e) => e.hasMatchReport).length)} | ${pct(current.filter((e) => e.enrichmentStatus === "complete").length)} | ${pct(current.filter((e) => e.reviewStatus === "no_ocr_candidate").length)} | ${pct(current.filter((e) => e.conflictCandidate).length)} | ${percent(l.filter((e) => offset(e) === 1).length, l.length)} | ${percent(l.filter((e) => Math.abs(offset(e)) <= 2).length, l.length)} | ${ratio(sum(r, "ocrCandidates"), current.length)} | ${pct(r.filter((e) => e.fieldsAdded.length > 0).length)} |`; }
function sourceId(entry: Pick<Review, "issueId" | "issued"> | EvidenceIssue): string { return `sunnmorsposten-${entry.issued!.replaceAll("-", "")}-${entry.issueId}`; }
function year(entry: Review): number { return Number(entry.matchId.slice(0, 4)); }
function inRange(value: number, start: number, end: number): boolean { return value >= start && value <= end; }
function offset(entry: Review): number { return Math.round((new Date(entry.issued!).getTime() - new Date(entry.matchId.slice(0, 10)).getTime()) / 86_400_000); }
function sum(items: Review[], field: "searchedIssues" | "ocrCandidates"): number { return items.reduce((total, item) => total + item[field], 0); }
function ratio(n: number, d: number): string { return d ? (n / d).toFixed(2) : "–"; }
function percent(n: number, d: number): string { return d ? `${(100 * n / d).toFixed(1)} %` : "–"; }
