import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArchiveYaml as parseYaml } from "../yaml.js";
import { z } from "zod";
import { AAFK_CLUB_ID } from "../entities.js";
import { loadArchive } from "../load.js";

export const newspaperReviewStatus = z.enum([
  "candidate_found",
  "ocr_correlated",
  "visually_confirmed",
  "no_ocr_candidate",
  "not_found",
  "conflict_candidate",
  "not_digitized",
]);

const reviewEntry = z.object({
  matchId: z.string().min(1),
  status: newspaperReviewStatus,
  reviewMethod: z.enum(["ocr_api", "facsimile"]),
  facsimileReviewed: z.boolean().default(false),
  confidence: z.enum(["high", "medium", "low"]).default("low"),
  canonicalLinked: z.boolean().default(false),
  evidenceIssues: z.array(z.object({
    issueId: z.string().min(1),
    urn: z.string().min(1).optional(),
    url: z.string().url(),
    issued: z.string().regex(/^\d{4}-?\d{2}-?\d{2}$/).optional(),
    page: z.string().min(1).optional(),
    reviewMethod: z.enum(["ocr_api", "facsimile"]),
    facsimileReviewed: z.boolean(),
    canonicalLinked: z.boolean().default(false),
    confidence: z.enum(["high", "medium", "low"]),
    genres: z.array(z.enum(["match_report", "result_note", "preview", "lineup", "results_board", "standings", "fixture_list", "advertisement", "unknown"])),
  }).strict()).default([]),
  issueId: z.string().min(1).optional(),
  urn: z.string().min(1).optional(),
  url: z.string().url().optional(),
  issued: z.string().regex(/^\d{4}-?\d{2}-?\d{2}$/).optional(),
  page: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  searchedIssues: z.number().int().nonnegative().default(0),
  ocrCandidates: z.number().int().nonnegative().default(0),
  visuallyReviewedPages: z.number().int().nonnegative().default(0),
  genres: z.array(z.enum(["match_report", "result_note", "preview", "lineup", "results_board", "standings", "fixture_list", "advertisement", "unknown"])).default([]),
  fieldsAdded: z.array(z.string().min(1)).default([]),
  newPlayers: z.number().int().nonnegative().default(0),
  newEvents: z.number().int().nonnegative().default(0),
  newHistoricalObservations: z.number().int().nonnegative().default(0),
  falsePositive: z.boolean().default(false),
  differentMatch: z.boolean().default(false),
  conflict: z.object({ field: z.literal("score"), canonical: z.string(), newspaper: z.string() }).strict().optional(),
  note: z.string().max(500).optional(),
}).strict();

const reviewLedger = z.object({
  contract: z.union([z.literal("newspaper-enrichment-reviews@1"), z.literal("newspaper-enrichment-reviews@2")]),
  entries: z.array(reviewEntry).default([]),
}).strict();

export type NewspaperReviewEntry = z.infer<typeof reviewEntry>;

export interface NewspaperEnrichmentStatusEntry {
  matchId: string;
  date: string;
  season: number;
  opponent: string;
  opponentClubId: string;
  competition: string;
  homeAway: "home" | "away";
  score: string;
  hasSmpMention: boolean;
  hasMatchReport: boolean;
  hasPostMatchEvidence: boolean;
  canonicalLinked: boolean;
  reviewMethod?: "ocr_api" | "facsimile";
  facsimileReviewed: boolean;
  ocrCorrelated: boolean;
  conflictCandidate: boolean;
  lineup: boolean;
  goalscorers: boolean;
  arena: boolean;
  attendance: boolean;
  referee: boolean;
  halfTimeScore: boolean;
  reviewStatus: "pending" | z.infer<typeof newspaperReviewStatus>;
  enrichmentStatus: "complete" | "residual";
  residualReason: "complete" | "no_ocr_candidate" | "conflict_candidate" | "preview_only" | "fixture_only" | "weak_candidate" | "pending" | "not_digitized" | "not_found";
  review?: Omit<NewspaperReviewEntry, "matchId" | "status" | "evidenceIssues">;
}

export interface NewspaperEnrichmentStatus {
  contract: "newspaper-enrichment-status@3";
  generatedFrom: { authoritativeAsOf: "working-tree"; inputs: string[] };
  searchPolicy: {
    initialWindowDays: number;
    expandedWindowDays: number;
    resultIsRequired: false;
    pipeline: "canonical_match_date_anchored";
    reviewMethod: "ocr_api";
    facsimileReviewRequired: false;
    reviewBasis: "nb_ocr_api_production_policy";
    calibration: {
      season: 1979;
      facsimileSampleMatchLinkAccuracyPercent: 100;
      allMatchesFacsimileReviewed: false;
    };
  };
  totals: Record<string, number>;
  seasons: Record<string, Record<string, number>>;
  pilot1979: Record<string, number>;
  queue: string[];
  entries: NewspaperEnrichmentStatusEntry[];
}

const NEWSPAPER_RE = /(sunnm[oø]rsposten|s[oø]ndm[oø]rsposten)/iu;
const GOAL_TYPES = new Set(["goal", "own_goal", "penalty_goal"]);

export async function buildNewspaperEnrichmentStatus(repo: string): Promise<NewspaperEnrichmentStatus> {
  const data = join(repo, "data");
  const archive = await loadArchive(data);
  if (archive.issues.length > 0) throw new Error(`arkivet har ${archive.issues.length} valideringsfeil`);
  const reviewPath = join(data, "discovery", "newspaper-enrichment-reviews.yaml");
  const ledger = await readReviewLedger(reviewPath);
  const reviews = new Map(ledger.entries.map((entry) => [entry.matchId, entry]));
  const clubs = new Map(archive.clubs.map((club) => [club.id, club]));
  const sources = new Map(archive.sources.map((source) => [source.id, source]));

  const entries = archive.matches
    .filter((match) => match.status === "played"
      && match.dateConfidence === "exact"
      && match.home.score !== null
      && match.away.score !== null
      && Number(match.date.slice(0, 4)) >= 1914)
    .map((match): NewspaperEnrichmentStatusEntry => {
      const isHome = match.home.clubId === AAFK_CLUB_ID;
      const opponentClubId = isHome ? match.away.clubId : match.home.clubId;
      const review = reviews.get(match.id);
      const sourceCoverage = match.sources.some((ref) => {
        const source = sources.get(ref.sourceId);
        return source?.year === match.competition.season && NEWSPAPER_RE.test(`${source.title} ${source.publisher ?? ""}`);
      }) || match.externalReports.some((report) => NEWSPAPER_RE.test(report.publisher)
        && report.date !== undefined
        && Math.abs(dayDistance(match.date, report.date)) <= 7);
      const aafkLineup = match.lineups?.[isHome ? "home" : "away"];
      const goalscorers = match.events.some((event) => GOAL_TYPES.has(event.type) && event.player !== undefined);
      return {
        matchId: match.id,
        date: match.date,
        season: match.competition.season,
        opponent: clubs.get(opponentClubId)?.name ?? opponentClubId,
        opponentClubId,
        competition: match.competition.id,
        homeAway: isHome ? "home" : "away",
        score: `${match.home.score}-${match.away.score}`,
        hasSmpMention: sourceCoverage,
        hasMatchReport: hasReport(match.date, review),
        hasPostMatchEvidence: hasPostMatchEvidence(match.date, review),
        canonicalLinked: review?.canonicalLinked ?? false,
        ...(review ? { reviewMethod: review.reviewMethod } : {}),
        facsimileReviewed: review?.facsimileReviewed ?? false,
        ocrCorrelated: review?.status === "ocr_correlated" || review?.status === "conflict_candidate",
        conflictCandidate: review?.status === "conflict_candidate",
        lineup: (aafkLineup?.starters.length ?? 0) > 0,
        goalscorers,
        arena: match.venueId !== undefined,
        attendance: match.attendance !== undefined,
        referee: match.referee !== undefined,
        halfTimeScore: match.home.halfTimeScore !== null && match.away.halfTimeScore !== null,
        reviewStatus: review?.status ?? "pending",
        ...completionFor(match.date, review),
        ...(review ? { review: withoutIdentity(review) } : {}),
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.matchId.localeCompare(right.matchId));

  const queue = entries.filter((entry) => entry.enrichmentStatus === "residual")
    .map((entry) => entry.matchId);
  const totals = summarize(entries, queue.length);
  const pilot = entries.filter((entry) => entry.season === 1979);
  const pilotQueue = pilot.filter((entry) => queue.includes(entry.matchId)).length;

  return {
    contract: "newspaper-enrichment-status@3",
    generatedFrom: {
      authoritativeAsOf: "working-tree",
      inputs: ["data/seasons/*/matches/*.yaml", "data/clubs/*.yaml", "data/sources/*.yaml", "data/discovery/newspaper-enrichment-reviews.yaml"],
    },
    searchPolicy: {
      initialWindowDays: 2,
      expandedWindowDays: 3,
      resultIsRequired: false,
      pipeline: "canonical_match_date_anchored",
      reviewMethod: "ocr_api",
      facsimileReviewRequired: false,
      reviewBasis: "nb_ocr_api_production_policy",
      calibration: {
        season: 1979,
        facsimileSampleMatchLinkAccuracyPercent: 100,
        allMatchesFacsimileReviewed: false,
      },
    },
    totals,
    seasons: Object.fromEntries([...new Set(entries.map((entry) => entry.season))]
      .sort((left, right) => left - right)
      .map((season) => {
        const seasonEntries = entries.filter((entry) => entry.season === season);
        return [String(season), summarize(seasonEntries, seasonEntries.filter((entry) => entry.enrichmentStatus === "residual").length)];
      })),
    pilot1979: summarize(pilot, pilotQueue),
    queue,
    entries,
  };
}

function dayDistance(left: string, right: string): number {
  return Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / 86_400_000);
}

function hasReport(matchDate: string, review: NewspaperReviewEntry | undefined): boolean {
  if (!review?.issued || dayDistance(matchDate, review.issued) < 0) return false;
  return review.genres.some((genre) => genre === "match_report" || genre === "result_note");
}

function hasPostMatchEvidence(matchDate: string, review: NewspaperReviewEntry | undefined): boolean {
  if (!review?.issued || dayDistance(matchDate, review.issued) < 0) return false;
  return review.genres.some((genre) => genre === "match_report" || genre === "result_note" || genre === "results_board");
}

function completionFor(matchDate: string, review: NewspaperReviewEntry | undefined): Pick<NewspaperEnrichmentStatusEntry, "enrichmentStatus" | "residualReason"> {
  if (review?.status === "ocr_correlated" && review.canonicalLinked && hasReport(matchDate, review) && hasPostMatchEvidence(matchDate, review)) {
    return { enrichmentStatus: "complete", residualReason: "complete" };
  }
  if (!review) return { enrichmentStatus: "residual", residualReason: "pending" };
  if (review.status === "conflict_candidate") return { enrichmentStatus: "residual", residualReason: "conflict_candidate" };
  if (review.status === "no_ocr_candidate") return { enrichmentStatus: "residual", residualReason: "no_ocr_candidate" };
  if (review.status === "not_digitized") return { enrichmentStatus: "residual", residualReason: "not_digitized" };
  if (review.status === "not_found") return { enrichmentStatus: "residual", residualReason: "not_found" };
  if (review.genres.includes("preview")) return { enrichmentStatus: "residual", residualReason: "preview_only" };
  if (review.genres.includes("fixture_list") && !review.genres.some((genre) => genre === "match_report" || genre === "result_note" || genre === "results_board")) {
    return { enrichmentStatus: "residual", residualReason: "fixture_only" };
  }
  return { enrichmentStatus: "residual", residualReason: "weak_candidate" };
}

async function readReviewLedger(path: string): Promise<z.infer<typeof reviewLedger>> {
  if (!existsSync(path)) return { contract: "newspaper-enrichment-reviews@2", entries: [] };
  return reviewLedger.parse(parseYaml(await readFile(path, "utf8")));
}

function withoutIdentity(entry: NewspaperReviewEntry): Omit<NewspaperReviewEntry, "matchId" | "status" | "evidenceIssues"> {
  const { matchId: _matchId, status: _status, evidenceIssues: _evidenceIssues, ...rest } = entry;
  return rest;
}

function summarize(entries: NewspaperEnrichmentStatusEntry[], queue: number): Record<string, number> {
  const reviewed = entries.filter((entry) => entry.reviewStatus !== "pending");
  const ocrCandidates = reviewed.reduce((sum, entry) => sum + (entry.review?.ocrCandidates ?? 0), 0);
  return {
    canonicalMatchesInScope: entries.length,
    withSmpMention: entries.filter((entry) => entry.hasSmpMention).length,
    matchReports: entries.filter((entry) => entry.hasMatchReport).length,
    postMatchEvidence: entries.filter((entry) => entry.hasPostMatchEvidence).length,
    canonicalLinked: entries.filter((entry) => entry.canonicalLinked).length,
    ocrCorrelated: entries.filter((entry) => entry.reviewStatus === "ocr_correlated").length,
    facsimileReviewed: entries.filter((entry) => entry.facsimileReviewed).length,
    noOcrCandidate: entries.filter((entry) => entry.reviewStatus === "no_ocr_candidate").length,
    notFound: entries.filter((entry) => entry.reviewStatus === "not_found").length,
    pending: entries.filter((entry) => entry.reviewStatus === "pending").length,
    residualQueue: queue,
    enrichmentComplete: entries.filter((entry) => entry.enrichmentStatus === "complete").length,
    residualNoOcrCandidate: entries.filter((entry) => entry.residualReason === "no_ocr_candidate").length,
    residualConflictCandidate: entries.filter((entry) => entry.residualReason === "conflict_candidate").length,
    residualPreviewOnly: entries.filter((entry) => entry.residualReason === "preview_only").length,
    residualFixtureOnly: entries.filter((entry) => entry.residualReason === "fixture_only").length,
    residualWeakCandidate: entries.filter((entry) => entry.residualReason === "weak_candidate").length,
    lineups: entries.filter((entry) => entry.lineup).length,
    goalscorers: entries.filter((entry) => entry.goalscorers).length,
    arenas: entries.filter((entry) => entry.arena).length,
    attendances: entries.filter((entry) => entry.attendance).length,
    referees: entries.filter((entry) => entry.referee).length,
    halfTimeScores: entries.filter((entry) => entry.halfTimeScore).length,
    conflictCandidates: entries.filter((entry) => entry.reviewStatus === "conflict_candidate").length,
    newLineups: reviewed.filter((entry) => entry.review?.fieldsAdded.includes("lineups")).length,
    newPlayers: reviewed.reduce((sum, entry) => sum + (entry.review?.newPlayers ?? 0), 0),
    newGoalscorers: reviewed.filter((entry) => entry.review?.fieldsAdded.includes("goalscorers")).length,
    newEvents: reviewed.reduce((sum, entry) => sum + (entry.review?.newEvents ?? 0), 0),
    newArenas: reviewed.filter((entry) => entry.review?.fieldsAdded.includes("venueId")).length,
    newAttendances: reviewed.filter((entry) => entry.review?.fieldsAdded.includes("attendance")).length,
    newReferees: reviewed.filter((entry) => entry.review?.fieldsAdded.includes("referee")).length,
    newHalfTimeScores: reviewed.filter((entry) => entry.review?.fieldsAdded.includes("home.halfTimeScore")).length,
    newHistoricalObservations: reviewed.reduce((sum, entry) => sum + (entry.review?.newHistoricalObservations ?? 0), 0),
    ocrFalsePositives: reviewed.filter((entry) => entry.review?.falsePositive).length,
    differentMatch: reviewed.filter((entry) => entry.review?.differentMatch).length,
    searchedIssues: reviewed.reduce((sum, entry) => sum + (entry.review?.searchedIssues ?? 0), 0),
    ocrCandidates,
    visuallyReviewedPages: reviewed.reduce((sum, entry) => sum + (entry.review?.visuallyReviewedPages ?? 0), 0),
    averageCandidatesPerReviewedMatch: reviewed.length === 0 ? 0 : Number((ocrCandidates / reviewed.length).toFixed(2)),
  };
}
