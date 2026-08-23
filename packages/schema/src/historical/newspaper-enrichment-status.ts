import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
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
  note: z.string().max(500).optional(),
}).strict();

const reviewLedger = z.object({
  contract: z.literal("newspaper-enrichment-reviews@1"),
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
  existingSmpSource: boolean;
  facsimileVerified: boolean;
  lineup: boolean;
  goalscorers: boolean;
  arena: boolean;
  attendance: boolean;
  referee: boolean;
  halfTimeScore: boolean;
  reviewStatus: "pending" | z.infer<typeof newspaperReviewStatus>;
  review?: Omit<NewspaperReviewEntry, "matchId" | "status">;
}

export interface NewspaperEnrichmentStatus {
  contract: "newspaper-enrichment-status@2";
  generatedFrom: { authoritativeAsOf: "working-tree"; inputs: string[] };
  searchPolicy: {
    initialWindowDays: number;
    expandedWindowDays: number;
    resultIsRequired: false;
    visualReviewRequired: true;
    pilot1979: {
      visualReviewRequired: false;
      reviewBasis: "nb_ocr_api_user_waiver";
    };
  };
  totals: Record<string, number>;
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
        existingSmpSource: sourceCoverage,
        facsimileVerified: review?.status === "visually_confirmed" || review?.facsimileReviewed === true,
        lineup: (aafkLineup?.starters.length ?? 0) > 0,
        goalscorers,
        arena: match.venueId !== undefined,
        attendance: match.attendance !== undefined,
        referee: match.referee !== undefined,
        halfTimeScore: match.home.halfTimeScore !== null && match.away.halfTimeScore !== null,
        reviewStatus: review?.status ?? "pending",
        ...(review ? { review: withoutIdentity(review) } : {}),
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.matchId.localeCompare(right.matchId));

  const queue = entries.filter((entry) => !entry.existingSmpSource && entry.reviewStatus !== "not_found" && entry.reviewStatus !== "not_digitized")
    .map((entry) => entry.matchId);
  const totals = summarize(entries, queue.length);
  const pilot = entries.filter((entry) => entry.season === 1979);
  const pilotQueue = pilot.filter((entry) => queue.includes(entry.matchId)).length;

  return {
    contract: "newspaper-enrichment-status@2",
    generatedFrom: {
      authoritativeAsOf: "working-tree",
      inputs: ["data/seasons/*/matches/*.yaml", "data/clubs/*.yaml", "data/sources/*.yaml", "data/discovery/newspaper-enrichment-reviews.yaml"],
    },
    searchPolicy: {
      initialWindowDays: 2,
      expandedWindowDays: 3,
      resultIsRequired: false,
      visualReviewRequired: true,
      pilot1979: {
        visualReviewRequired: false,
        reviewBasis: "nb_ocr_api_user_waiver",
      },
    },
    totals,
    pilot1979: summarize(pilot, pilotQueue),
    queue,
    entries,
  };
}

function dayDistance(left: string, right: string): number {
  return Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / 86_400_000);
}

async function readReviewLedger(path: string): Promise<z.infer<typeof reviewLedger>> {
  if (!existsSync(path)) return { contract: "newspaper-enrichment-reviews@1", entries: [] };
  return reviewLedger.parse(parseYaml(await readFile(path, "utf8"), { schema: "core" }));
}

function withoutIdentity(entry: NewspaperReviewEntry): Omit<NewspaperReviewEntry, "matchId" | "status"> {
  const { matchId: _matchId, status: _status, ...rest } = entry;
  return rest;
}

function summarize(entries: NewspaperEnrichmentStatusEntry[], queue: number): Record<string, number> {
  const reviewed = entries.filter((entry) => entry.reviewStatus !== "pending");
  const ocrCandidates = reviewed.reduce((sum, entry) => sum + (entry.review?.ocrCandidates ?? 0), 0);
  return {
    canonicalMatchesInScope: entries.length,
    withSmpSource: entries.filter((entry) => entry.existingSmpSource).length,
    ocrCorrelated: entries.filter((entry) => entry.reviewStatus === "ocr_correlated").length,
    facsimileVerified: entries.filter((entry) => entry.facsimileVerified).length,
    noOcrCandidate: entries.filter((entry) => entry.reviewStatus === "no_ocr_candidate").length,
    matchReports: reviewed.filter((entry) => entry.review?.genres.includes("match_report")).length,
    notFound: entries.filter((entry) => entry.reviewStatus === "not_found").length,
    pending: entries.filter((entry) => entry.reviewStatus === "pending").length,
    residualQueue: queue,
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
