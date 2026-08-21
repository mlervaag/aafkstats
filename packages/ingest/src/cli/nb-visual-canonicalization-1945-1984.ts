import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { repoRoot, loadArchive } from "@aafkstats/schema/load";
import type { ObservationValue } from "@aafkstats/schema";
import type { VisualReviewCase } from "./nb-visual-review-1945-1984.js";

function sha256(content: string): string {
  return "sha256:" + createHash("sha256").update(content, "utf8").digest("hex");
}

export type CanonicalAction =
  | "create_match"
  | "enrich_existing_match"
  | "already_present"
  | "blocked_existing_conflict"
  | "invalid_input";

export interface CanonicalPlanItem {
  hypothesisId: string;
  season: number;
  claimResolution: string;
  canonicalEligibility: string;
  matchedSourceResult?: {
    sourceId: string;
    no: number;
  };
  observedEvent?: {
    matchDate: string;
    opponentClubId: string;
    homeAway: "home" | "away" | "neutral" | "unknown";
    score: { aafk: number; opponent: number };
    competitionId: string | null;
  };
  newspaper?: {
    title: string;
    issueDate: string;
    page: string;
    pageUrl: string;
    evidenceType: string;
  };
  proposedMatchId?: string;
  action: CanonicalAction;
  conflictReason?: string;
  isIdempotentNoOp?: boolean;
}

export interface CanonicalizationResult {
  contract: "nb-source-result-canonicalization@1";
  generatedAt: string;
  mode: "dry_run" | "applied";
  summary: {
    pr199ReadyInput: number;
    newCanonicalMatches: number;
    existingMatchesEnriched: number;
    alreadyPresent: number;
    sourceResultsLinked: number;
    nbObservationsCreated: number;
    blockedExistingConflicts: number;
    skippedInvalid: number;
    newClubs: number;
    canonicalMatchesDeleted: number;
  };
  accounting: {
    created: number;
    enriched_existing: number;
    already_present: number;
    blocked_existing_conflict: number;
    invalid_input: number;
    total: number;
  };
  communityRestQueue: {
    summary: {
      sibling_resolution: number;
      date_research: number;
      competition_conflict: number;
      score_conflict: number;
      home_away_research: number;
      source_reconciliation: number;
      non_senior: number;
      different_event: number;
      unreviewed_awaiting_visual_batch: number;
    };
    candidateCount: number;
    nonCommunityCount: number;
  };
  items: CanonicalPlanItem[];
}

export async function buildCanonicalPlan(): Promise<{
  plan: CanonicalizationResult;
  sourceResultFiles: Map<string, { path: string; raw: any; modified: boolean }>;
  matchesToCreate: Map<string, { path: string; data: any }>;
  matchesToUpdate: Map<string, { path: string; data: any }>;
  observationsToWrite: Map<string, { path: string; data: any }>;
}> {
  const root = repoRoot();
  const manifestPath = `${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`;
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = parseYaml(manifestRaw, { schema: "core" });

  const archive = await loadArchive();
  const canonicalClubIds = new Set(archive.clubs.map((c) => c.id));
  const canonicalCompetitions = new Set(archive.competitions.map((c) => c.id));

  // Index existing canonical matches by date & participating clubs
  const matchById = new Map<string, any>();
  const matchesByEvent = new Map<string, any[]>();
  for (const m of archive.matches) {
    matchById.set(m.id, m);
    const oppClubId = m.home.clubId === "aalesunds-fk" ? m.away.clubId : m.home.clubId;
    const eventKey = `${m.date}|${oppClubId}`;
    const list = matchesByEvent.get(eventKey) || [];
    list.push(m);
    matchesByEvent.set(eventKey, list);
  }

  // Load source-results cache
  const sourceResultFiles = new Map<string, { path: string; raw: any; modified: boolean }>();
  for (const src of archive.sources.values()) {
    const p = `${root}/data/source-results/${src.id}.yaml`;
    try {
      const content = await readFile(p, "utf8");
      sourceResultFiles.set(src.id, { path: p, raw: parseYaml(content, { schema: "core" }), modified: false });
    } catch {
      // file might not exist
    }
  }

  const allCases: VisualReviewCase[] = manifest.cases || [];
  const readyCases = allCases.filter((c) => c.canonicalEligibility === "ready");

  // Community rest queue accounting
  const nonReadyCases = allCases.filter((c) => c.canonicalEligibility !== "ready");
  const restSummary = {
    sibling_resolution: 0,
    date_research: 0,
    competition_conflict: 0,
    score_conflict: 0,
    home_away_research: 0,
    source_reconciliation: 0,
    non_senior: 0,
    different_event: 0,
    unreviewed_awaiting_visual_batch: 0,
  };

  for (const c of nonReadyCases) {
    if (c.reviewStatus === "unreviewed_awaiting_visual_batch") {
      restSummary.unreviewed_awaiting_visual_batch++;
    } else if (c.claimResolution === "non_senior" || c.canonicalEligibility === "non_senior") {
      restSummary.non_senior++;
    } else if (c.claimResolution === "different_event") {
      restSummary.different_event++;
    } else if (c.canonicalEligibility === "score_conflict" || c.claimResolution === "same_event_score_conflict") {
      restSummary.score_conflict++;
    } else if (c.canonicalEligibility === "competition_conflict") {
      restSummary.competition_conflict++;
    } else if (c.canonicalEligibility === "home_away_conflict" || c.canonicalEligibility === "home_away_uncertain") {
      restSummary.home_away_research++;
    } else if (c.canonicalEligibility === "date_uncertain") {
      restSummary.date_research++;
    } else if (c.claimResolution === "sibling_group_only" || c.canonicalEligibility === "insufficient") {
      restSummary.sibling_resolution++;
    } else {
      restSummary.source_reconciliation++;
    }
  }

  const planItems: CanonicalPlanItem[] = [];
  const matchesToCreate = new Map<string, { path: string; data: any }>();
  const matchesToUpdate = new Map<string, { path: string; data: any }>();
  const observationsToWrite = new Map<string, { path: string; data: any }>();

  let newCanonicalMatches = 0;
  let existingMatchesEnriched = 0;
  let alreadyPresentCount = 0;
  let sourceResultsLinked = 0;
  let nbObservationsCreated = 0;
  let blockedExistingConflicts = 0;
  let skippedInvalid = 0;
  const newClubs = 0;
  const canonicalMatchesDeleted = 0;

  for (const c of readyCases) {
    const msr = c.matchedSourceResult || c.sourceResults[0];
    if (!msr) {
      skippedInvalid++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        action: "invalid_input",
        conflictReason: "Missing sourceResult reference",
      });
      continue;
    }
    const leadSr = c.sourceResults.find((sr) => sr.sourceId === msr.sourceId && sr.no === msr.no) || c.sourceResults[0];
    const activeCand = c.reviewedCandidates?.[0];
    const obs = activeCand?.observed;
    const np = activeCand?.newspaper;

    const scoreAgrees = leadSr && obs && leadSr.expectedScore.aafk === obs.score.aafk && leadSr.expectedScore.opponent === obs.score.opponent;
    if (!scoreAgrees) {
      console.log(`[SCORE DIVERGENCE] Case ${c.hypothesisId}: source expected ${leadSr?.expectedScore?.aafk}-${leadSr?.expectedScore?.opponent} vs observed ${obs?.score?.aafk}-${obs?.score?.opponent}`);
    }

    if (
      c.reviewStatus !== "visually_reviewed_pilot" ||
      (c.claimResolution !== "exact_match" && c.claimResolution !== "exact_sibling") ||
      !activeCand?.visuallyReviewed ||
      !obs ||
      obs.aafkPresent !== true ||
      obs.seniorAteam !== true ||
      !obs.opponent?.clubId ||
      obs.opponent.confidence !== "high" ||
      obs.score.confidence !== "high" ||
      obs.matchDate.confidence !== "high" ||
      !obs.dateEvidence ||
      obs.homeAway === "unknown" ||
      !obs.competition.competitionId ||
      obs.competition.confidence !== "high" ||
      obs.competitionResolution === "conflict" ||
      obs.homeAwayResolution === "conflict" ||
      !scoreAgrees
    ) {
      skippedInvalid++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        action: "invalid_input",
        conflictReason: !scoreAgrees
          ? `Source-result expectedScore (${leadSr?.expectedScore?.aafk}-${leadSr?.expectedScore?.opponent}) diverges from observed score (${obs?.score?.aafk}-${obs?.score?.opponent})`
          : "Failed strict visual review canonical gate",
      });
      continue;
    }

    // 2. Check canonical opponent club and competition
    if (!canonicalClubIds.has(obs.opponent.clubId)) {
      skippedInvalid++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        action: "invalid_input",
        conflictReason: `Opponent clubId '${obs.opponent.clubId}' not found in canonical clubs archive`,
      });
      continue;
    }

    if (!canonicalCompetitions.has(obs.competition.competitionId)) {
      skippedInvalid++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        action: "invalid_input",
        conflictReason: `Competition '${obs.competition.competitionId}' not found in canonical competitions archive`,
      });
      continue;
    }

    // 3. Determine match attributes
    const matchDate = obs.matchDate.value;
    const matchYear = Number(matchDate.slice(0, 4));
    const compId = obs.competition.competitionId;
    const homeAway = obs.homeAway;
    const oppClubId = obs.opponent.clubId;

    let homeClubId: string;
    let awayClubId: string;
    let homeScore: number;
    let awayScore: number;
    let neutralVenue = false;

    if (homeAway === "away") {
      homeClubId = oppClubId;
      awayClubId = "aalesunds-fk";
      homeScore = obs.score.opponent;
      awayScore = obs.score.aafk;
    } else if (homeAway === "neutral") {
      homeClubId = "aalesunds-fk";
      awayClubId = oppClubId;
      homeScore = obs.score.aafk;
      awayScore = obs.score.opponent;
      neutralVenue = true;
    } else {
      homeClubId = "aalesunds-fk";
      awayClubId = oppClubId;
      homeScore = obs.score.aafk;
      awayScore = obs.score.opponent;
    }

    const proposedMatchId = `${matchDate}-${homeClubId}-${awayClubId}`;
    const matchDir = `${root}/data/seasons/${matchYear}/matches`;
    const matchPath = `${matchDir}/${proposedMatchId}.yaml`;

    // 4. Dedupe / match against existing canonical matches
    const eventKey = `${matchDate}|${oppClubId}`;
    const candidates = matchesByEvent.get(eventKey) || [];

    let existingMatch: any = null;
    let isConflict = false;
    let conflictDetails = "";

    if (candidates.length > 0) {
      for (const candMatch of candidates) {
        // Check if same exact match
        const candAafkGoals = candMatch.home.clubId === "aalesunds-fk" ? candMatch.home.score : candMatch.away.score;
        const candOppGoals = candMatch.home.clubId === "aalesunds-fk" ? candMatch.away.score : candMatch.home.score;
        const candIsAafkHome = candMatch.home.clubId === "aalesunds-fk";
        const observedIsAafkHome = homeAway === "home" || homeAway === "neutral";

        if (candAafkGoals !== obs.score.aafk || candOppGoals !== obs.score.opponent) {
          isConflict = true;
          conflictDetails = `Score divergence on ${matchDate} vs ${oppClubId}: existing=${candAafkGoals}-${candOppGoals} vs observed=${obs.score.aafk}-${obs.score.opponent}`;
          break;
        }

        if (candIsAafkHome !== observedIsAafkHome && homeAway !== "neutral") {
          isConflict = true;
          conflictDetails = `Home/away divergence on ${matchDate} vs ${oppClubId}: existing ${candIsAafkHome ? "home" : "away"} vs observed ${homeAway}`;
          break;
        }

        // Exact match found!
        existingMatch = candMatch;
        break;
      }
    }

    if (isConflict) {
      blockedExistingConflicts++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        matchedSourceResult: c.matchedSourceResult,
        observedEvent: {
          matchDate,
          opponentClubId: oppClubId,
          homeAway,
          score: obs.score,
          competitionId: compId,
        },
        newspaper: np ? { ...np, evidenceType: obs.evidenceType } : undefined,
        proposedMatchId,
        action: "blocked_existing_conflict",
        conflictReason: conflictDetails,
      });
      continue;
    }

    // 5. Build newspaper provenance and observation
    const reportTitle = `${np!.title} ${np!.issueDate} s. ${np!.page}`;
    const pageUrl = np!.pageUrl;

    const providerName = np!.title.toLowerCase().includes("romsdal") ? "romsdals-budstikke" : "sunnmorsposten";
    const obsExternalId = `${providerName}-${np!.issueDate}-s${np!.page}-${oppClubId}`;
    const obsDir = `${root}/data/observations/nasjonalbiblioteket`;
    const obsPath = `${obsDir}/${obsExternalId}.yaml`;

    const rawPayload: Record<string, ObservationValue> = {
      avis: np!.title,
      dato: np!.issueDate,
      side: String(np!.page),
      tittel: reportTitle,
      kamp: `${homeClubId} - ${awayClubId} ${homeScore}-${awayScore}`,
      url: pageUrl,
    };

    const obsContent = {
      providerId: "nasjonalbiblioteket",
      externalId: obsExternalId,
      matchId: proposedMatchId,
      retrievedAt: "2026-08-21",
      adapter: "nasjonalbiblioteket@1",
      payloadHash: sha256(
        JSON.stringify(
          Object.keys(rawPayload)
            .sort()
            .map((k) => [k, rawPayload[k]]),
        ),
      ),
      raw: rawPayload,
      normalized: {
        date: matchDate,
        "home.clubId": homeClubId,
        "away.clubId": awayClubId,
        "home.score": homeScore,
        "away.score": awayScore,
      },
      fields: ["date", "home.clubId", "away.clubId", "home.score", "away.score"],
      warnings: [],
    };
    observationsToWrite.set(obsPath, { path: obsPath, data: obsContent });
    nbObservationsCreated++;

    // 6. Source Result linking
    const srcFileEntry = sourceResultFiles.get(msr.sourceId);
    if (srcFileEntry && srcFileEntry.raw?.seasons) {
      for (const season of srcFileEntry.raw.seasons) {
        if (season.year === c.season && season.results) {
          const matchSr = season.results.find((r: any) => r.no === msr.no);
          if (matchSr) {
            if (matchSr.matchId !== proposedMatchId) {
              matchSr.matchId = proposedMatchId;
              srcFileEntry.modified = true;
              sourceResultsLinked++;
            }
          }
        }
      }
    }

    // 7. Match creation vs enrichment
    if (existingMatch) {
      // Enrichment of existing match
      let modified = false;
      const targetMatch = { ...existingMatch };

      if (!targetMatch.externalReports) targetMatch.externalReports = [];
      if (!targetMatch.externalReports.some((r: any) => r.url === pageUrl)) {
        targetMatch.externalReports.push({
          publisher: np!.title,
          title: reportTitle,
          date: np!.issueDate,
          url: pageUrl,
        });
        modified = true;
      }

      if (!targetMatch.providers) targetMatch.providers = [];
      if (!targetMatch.providers.some((p: any) => p.providerId === "nasjonalbiblioteket" && p.url === pageUrl)) {
        targetMatch.providers.push({
          providerId: "nasjonalbiblioteket",
          url: pageUrl,
          retrievedAt: "2026-08-21",
          fields: ["date", "status", "competition", "home.clubId", "away.clubId", "home.score", "away.score"],
        });
        modified = true;
      }

      if (!targetMatch.sources) targetMatch.sources = [];
      if (msr && !targetMatch.sources.some((s: any) => s.sourceId === msr.sourceId)) {
        targetMatch.sources.push({ sourceId: msr.sourceId });
        modified = true;
      }

      if (modified) {
        existingMatchesEnriched++;
        matchesToUpdate.set(matchPath, { path: matchPath, data: targetMatch });
        planItems.push({
          hypothesisId: c.hypothesisId,
          season: c.season,
          claimResolution: c.claimResolution,
          canonicalEligibility: c.canonicalEligibility,
          matchedSourceResult: msr,
          observedEvent: {
            matchDate,
            opponentClubId: oppClubId,
            homeAway,
            score: obs.score,
            competitionId: compId,
          },
          newspaper: { ...np!, evidenceType: obs.evidenceType },
          proposedMatchId,
          action: "enrich_existing_match",
        });
      } else {
        alreadyPresentCount++;
        planItems.push({
          hypothesisId: c.hypothesisId,
          season: c.season,
          claimResolution: c.claimResolution,
          canonicalEligibility: c.canonicalEligibility,
          matchedSourceResult: msr,
          observedEvent: {
            matchDate,
            opponentClubId: oppClubId,
            homeAway,
            score: obs.score,
            competitionId: compId,
          },
          newspaper: { ...np!, evidenceType: obs.evidenceType },
          proposedMatchId,
          action: "already_present",
          isIdempotentNoOp: true,
        });
      }
    } else {
      // Check if another ready item in this same batch created this match
      let targetMatch = matchesToCreate.get(matchPath)?.data;
      if (targetMatch) {
        // Enriched in-memory
        if (!targetMatch.externalReports.some((r: any) => r.url === pageUrl)) {
          targetMatch.externalReports.push({
            publisher: np!.title,
            title: reportTitle,
            date: np!.issueDate,
            url: pageUrl,
          });
        }
        if (!targetMatch.providers.some((p: any) => p.providerId === "nasjonalbiblioteket" && p.url === pageUrl)) {
          targetMatch.providers.push({
            providerId: "nasjonalbiblioteket",
            url: pageUrl,
            retrievedAt: "2026-08-21",
            fields: ["date", "status", "competition", "home.clubId", "away.clubId", "home.score", "away.score"],
          });
        }
        if (msr && !targetMatch.sources.some((s: any) => s.sourceId === msr.sourceId)) {
          targetMatch.sources.push({ sourceId: msr.sourceId });
        }
        alreadyPresentCount++;
        planItems.push({
          hypothesisId: c.hypothesisId,
          season: c.season,
          claimResolution: c.claimResolution,
          canonicalEligibility: c.canonicalEligibility,
          matchedSourceResult: msr,
          observedEvent: {
            matchDate,
            opponentClubId: oppClubId,
            homeAway,
            score: obs.score,
            competitionId: compId,
          },
          newspaper: { ...np!, evidenceType: obs.evidenceType },
          proposedMatchId,
          action: "already_present",
          isIdempotentNoOp: true,
        });
      } else {
        newCanonicalMatches++;
        targetMatch = {
          id: proposedMatchId,
          date: matchDate,
          dateConfidence: "exact",
          status: "played",
          competition: {
            id: compId,
            season: matchYear,
            stage: compId === "treningskamp" ? "friendly" : "regular_season",
          },
          home: {
            clubId: homeClubId,
            score: homeScore,
            halfTimeScore: null,
          },
          away: {
            clubId: awayClubId,
            score: awayScore,
            halfTimeScore: null,
          },
          neutralVenue,
          events: [],
          externalReports: [
            {
              publisher: np!.title,
              title: reportTitle,
              date: np!.issueDate,
              url: pageUrl,
            },
          ],
          providers: [
            {
              providerId: "nasjonalbiblioteket",
              url: pageUrl,
              retrievedAt: "2026-08-21",
              fields: ["date", "status", "competition", "home.clubId", "away.clubId", "home.score", "away.score"],
            },
          ],
          sources: msr ? [{ sourceId: msr.sourceId }] : [],
          confidence: "confirmed",
          conflicts: [],
          tags: [],
          aliases: {},
          manual: [],
          note: activeCand.visualEvidenceSummary,
        };
        matchesToCreate.set(matchPath, { path: matchPath, data: targetMatch });
        planItems.push({
          hypothesisId: c.hypothesisId,
          season: c.season,
          claimResolution: c.claimResolution,
          canonicalEligibility: c.canonicalEligibility,
          matchedSourceResult: msr,
          observedEvent: {
            matchDate,
            opponentClubId: oppClubId,
            homeAway,
            score: obs.score,
            competitionId: compId,
          },
          newspaper: { ...np!, evidenceType: obs.evidenceType },
          proposedMatchId,
          action: "create_match",
        });
      }
    }
  }

  const candidateCount =
    restSummary.sibling_resolution +
    restSummary.date_research +
    restSummary.competition_conflict +
    restSummary.score_conflict +
    restSummary.home_away_research +
    restSummary.source_reconciliation;

  const nonCommunityCount =
    restSummary.non_senior + restSummary.different_event + restSummary.unreviewed_awaiting_visual_batch;

  const plan: CanonicalizationResult = {
    contract: "nb-source-result-canonicalization@1",
    generatedAt: "2026-08-21",
    mode: "dry_run",
    summary: {
      pr199ReadyInput: readyCases.length,
      newCanonicalMatches,
      existingMatchesEnriched,
      alreadyPresent: alreadyPresentCount,
      sourceResultsLinked,
      nbObservationsCreated,
      blockedExistingConflicts,
      skippedInvalid,
      newClubs,
      canonicalMatchesDeleted,
    },
    accounting: {
      created: planItems.filter((i) => i.action === "create_match").length,
      enriched_existing: planItems.filter((i) => i.action === "enrich_existing_match").length,
      already_present: planItems.filter((i) => i.action === "already_present").length,
      blocked_existing_conflict: planItems.filter((i) => i.action === "blocked_existing_conflict").length,
      invalid_input: planItems.filter((i) => i.action === "invalid_input").length,
      total: planItems.length,
    },
    communityRestQueue: {
      summary: restSummary,
      candidateCount,
      nonCommunityCount,
    },
    items: planItems,
  };

  return {
    plan,
    sourceResultFiles,
    matchesToCreate,
    matchesToUpdate,
    observationsToWrite,
  };
}

export async function executeCanonicalization(apply: boolean = false): Promise<CanonicalizationResult> {
  const root = repoRoot();
  const { plan, sourceResultFiles, matchesToCreate, matchesToUpdate, observationsToWrite } = await buildCanonicalPlan();

  if (apply) {
    plan.mode = "applied";

    // 1. Write new matches
    for (const [p, item] of matchesToCreate.entries()) {
      const dir = p.substring(0, p.lastIndexOf("/"));
      await mkdir(dir, { recursive: true });
      await writeFile(p, stringifyYaml(item.data), "utf8");
    }

    // 2. Write updated matches
    for (const [p, item] of matchesToUpdate.entries()) {
      const dir = p.substring(0, p.lastIndexOf("/"));
      await mkdir(dir, { recursive: true });
      await writeFile(p, stringifyYaml(item.data), "utf8");
    }

    // 3. Write observations
    for (const [p, item] of observationsToWrite.entries()) {
      const dir = p.substring(0, p.lastIndexOf("/"));
      await mkdir(dir, { recursive: true });
      await writeFile(p, stringifyYaml(item.data), "utf8");
    }

    // 4. Save modified source results
    for (const [, fileEntry] of sourceResultFiles.entries()) {
      if (fileEntry.modified) {
        await writeFile(fileEntry.path, stringifyYaml(fileEntry.raw), "utf8");
      }
    }

    // 5. Write canonicalization manifest artifact
    const manifestPath = `${root}/data/discovery/nb-source-result-canonicalization-1945-1984.yaml`;
    await writeFile(manifestPath, stringifyYaml(plan), "utf8");
    console.log(`\nSaved canonicalization manifest to ${manifestPath}`);
  }

  return plan;
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");

  console.log(`=== NB Visual Review Canonicalization (1945-1984) [${isApply ? "APPLY" : "DRY-RUN / PLAN"}] ===\n`);

  const result = await executeCanonicalization(isApply);

  console.log("Summary Metrics:");
  console.log(`- PR199 Ready Input:            ${result.summary.pr199ReadyInput}`);
  console.log(`- New Canonical Matches:        ${result.summary.newCanonicalMatches}`);
  console.log(`- Existing Matches Enriched:    ${result.summary.existingMatchesEnriched}`);
  console.log(`- Already Present / Idempotent: ${result.summary.alreadyPresent}`);
  console.log(`- Source-Results Linked:        ${result.summary.sourceResultsLinked}`);
  console.log(`- NB Observations Created:      ${result.summary.nbObservationsCreated}`);
  console.log(`- Blocked Existing Conflicts:   ${result.summary.blockedExistingConflicts}`);
  console.log(`- Skipped Invalid:              ${result.summary.skippedInvalid}`);
  console.log(`- New Clubs:                    ${result.summary.newClubs}`);
  console.log(`- Canonical Matches Deleted:    ${result.summary.canonicalMatchesDeleted}`);

  console.log("\nReconciliation Accounting:");
  console.log(JSON.stringify(result.accounting, null, 2));

  console.log("\nCommunity Rest Queue:");
  console.log(JSON.stringify(result.communityRestQueue, null, 2));

  if (!isApply) {
    console.log("\n[DRY RUN COMPLETE] No files modified. Run with --apply to execute.");
  } else {
    console.log("\n[APPLY COMPLETE] Archive updated successfully.");
  }
}

if (process.argv[1]?.endsWith("nb-visual-canonicalization-1945-1984.ts")) {
  main().catch(console.error);
}
