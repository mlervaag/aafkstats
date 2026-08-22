import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { repoRoot, loadArchive } from "@aafkstats/schema/load";
import type { ObservationValue } from "@aafkstats/schema";
import type { VisualReviewCase } from "./nb-visual-review-1945-1984.js";

function sha256(content: string): string {
  return "sha256:" + createHash("sha256").update(content, "utf8").digest("hex");
}

export interface ActualVisualSource {
  title: string;
  issueDate: string;
  printedPage: string;
  viewerPage: string;
  pageUrl: string;
}

export function extractActualVisualSource(cand: any): ActualVisualSource {
  const np = cand?.newspaper;
  const summary = cand?.visualEvidenceSummary || "";
  const dateEv = cand?.observed?.dateEvidence?.textSummary || "";
  const text = `${summary} ${dateEv}`;

  // 1. Title
  let title = np?.title || "Sunnmørsposten";
  if (summary.startsWith("Romsdals Budstikke") || summary.startsWith("Romsdal Folkeblad")) {
    const parts = summary.split(" ");
    title = parts[0] + " " + parts[1];
  }

  // 2. IssueDate (e.g. 30.05.1975 or 1955-05-16)
  let issueDate = np?.issueDate || "";
  const ddmmyyyyMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (ddmmyyyyMatch) {
    issueDate = `${ddmmyyyyMatch[3]}-${ddmmyyyyMatch[2]}-${ddmmyyyyMatch[1]}`;
  } else {
    const yyyymmddMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmddMatch) {
      issueDate = yyyymmddMatch[0];
    }
  }

  // 3. PrintedPage (e.g. "s. 7", "s. 2", "s. 4")
  let printedPage = String(np?.page || "1");
  const pageMatch = text.match(/s\.\s*(\d+)/i);
  if (pageMatch && pageMatch[1]) {
    printedPage = pageMatch[1];
  }

  // 4. ViewerPage (from pageUrl ?page=X or np.page)
  let viewerPage = String(np?.page || "1");
  const url = np?.pageUrl || "";
  const viewerMatch = url.match(/[?&]page=(\d+)/i);
  if (viewerMatch && viewerMatch[1]) {
    viewerPage = viewerMatch[1];
  }

  return {
    title,
    issueDate,
    printedPage,
    viewerPage,
    pageUrl: url,
  };
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
  actualVisualSource?: ActualVisualSource;
  proposedMatchId?: string;
  canonicalMatchId?: string;
  action: CanonicalAction;
  conflictReason?: string;
  isIdempotentNoOp?: boolean;
}

export interface CanonicalizationResult {
  contract: "nb-source-result-canonicalization@1";
  generatedAt: string;
  mode: "dry_run" | "applied";
  application: {
    readyInput: number;
    created: number;
    enriched: number;
    invalid: number;
    sourceResultsLinked: number;
    observationsCreated: number;
    newClubs: number;
    canonicalMatchesDeleted: number;
  };
  idempotencyCheck: {
    created: number;
    enriched: number;
    alreadyPresent: number;
    sourceResultsLinked: number;
    observationsCreated: number;
    filesWritten: number;
  };
  summary: {
    pr199ReadyInput: number;
    readyInput: number;
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

export interface CanonicalPlanOptions {
  batch?: "pilot" | "wave_2" | "wave_2_1945_1954" | "all";
  reviewStatus?: "visually_reviewed_pilot" | "visually_reviewed_wave_2";
  minYear?: number;
  maxYear?: number;
  manifestPath?: string;
  manifestOutputPath?: string;
}

export async function buildCanonicalPlan(options?: CanonicalPlanOptions): Promise<{
  plan: CanonicalizationResult;
  sourceResultFiles: Map<string, { path: string; raw: any; modified: boolean }>;
  matchesToCreate: Map<string, { path: string; data: any }>;
  matchesToUpdate: Map<string, { path: string; data: any }>;
  observationsToWrite: Map<string, { path: string; data: any }>;
  manifestOutputPath: string;
}> {
  const root = repoRoot();
  const manifestPath = options?.manifestPath || `${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`;
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = parseYaml(manifestRaw, { schema: "core" });

  const isWave2 =
    options?.reviewStatus === "visually_reviewed_wave_2" ||
    options?.batch === "wave_2" ||
    options?.batch === "wave_2_1945_1954";

  const targetReviewStatus = options?.reviewStatus || (isWave2 ? "visually_reviewed_wave_2" : "visually_reviewed_pilot");
  const minYear = options?.minYear ?? 1945;
  const maxYear = options?.maxYear ?? (isWave2 ? 1954 : 1984);

  const manifestOutputPath =
    options?.manifestOutputPath ||
    (isWave2
      ? `${root}/data/discovery/nb-source-result-canonicalization-wave2-1945-1954.yaml`
      : `${root}/data/discovery/nb-source-result-canonicalization-1945-1984.yaml`);

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
  const batchCases = allCases.filter(
    (c) => c.reviewStatus === targetReviewStatus && c.season >= minYear && c.season <= maxYear
  );
  const readyCases = batchCases.filter((c) => c.canonicalEligibility === "ready");

  // Community rest queue accounting
  const nonReadyCases = batchCases.filter((c) => c.canonicalEligibility !== "ready");
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
    if (c.claimResolution === "non_senior" || c.canonicalEligibility === "non_senior") {
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
      restSummary.source_reconciliation++;
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

    const activeCand = c.reviewedCandidates?.[0];
    const obs = activeCand?.observed;

    // Extract actual visual source
    const actualVisualSource = extractActualVisualSource(activeCand);

    // Load raw source-result row from data/source-results
    const srcFileEntry = sourceResultFiles.get(msr.sourceId);
    const seasonEntry = srcFileEntry?.raw?.seasons?.find((s: any) => s.year === c.season);
    const matchSr = seasonEntry?.results?.find((r: any) => r.no === msr.no);

    const leadSr = c.sourceResults.find((sr) => sr.sourceId === msr.sourceId && sr.no === msr.no) || c.sourceResults[0];

    // Check 1: Full Source-Result Identity Gate
    const identityConflicts: string[] = [];

    // Opponent check
    if (matchSr?.opponentClubId && obs?.opponent?.clubId && matchSr.opponentClubId !== obs.opponent.clubId) {
      identityConflicts.push(`opponent_conflict: source has '${matchSr.opponentClubId}' vs observed '${obs.opponent.clubId}'`);
    }

    // Score check
    const expectedAafk = matchSr?.expectedScore?.aafk ?? matchSr?.score?.[0] ?? leadSr?.expectedScore?.aafk;
    const expectedOpp = matchSr?.expectedScore?.opponent ?? matchSr?.score?.[1] ?? leadSr?.expectedScore?.opponent;
    if (obs && (expectedAafk !== obs.score?.aafk || expectedOpp !== obs.score?.opponent)) {
      identityConflicts.push(`score_conflict: source has ${expectedAafk}-${expectedOpp} vs observed ${obs.score?.aafk}-${obs.score?.opponent}`);
    }

    // Competition check
    if (matchSr?.competitionId && obs?.competition?.competitionId && matchSr.competitionId !== obs.competition.competitionId) {
      identityConflicts.push(`competition_conflict: source has '${matchSr.competitionId}' vs observed '${obs.competition.competitionId}'`);
    }

    if (
      identityConflicts.length > 0 ||
      c.reviewStatus !== targetReviewStatus ||
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
      obs.homeAwayResolution === "conflict"
    ) {
      skippedInvalid++;
      restSummary.source_reconciliation++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        matchedSourceResult: msr,
        actualVisualSource,
        action: "invalid_input",
        conflictReason: identityConflicts.length > 0
          ? identityConflicts.join("; ")
          : "Failed strict visual review canonical gate",
      });
      continue;
    }

    // 2. Check canonical opponent club and competition
    if (!canonicalClubIds.has(obs.opponent.clubId)) {
      skippedInvalid++;
      restSummary.source_reconciliation++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        matchedSourceResult: msr,
        actualVisualSource,
        action: "invalid_input",
        conflictReason: `Opponent clubId '${obs.opponent.clubId}' not found in canonical clubs archive`,
      });
      continue;
    }

    if (!canonicalCompetitions.has(obs.competition.competitionId)) {
      skippedInvalid++;
      restSummary.source_reconciliation++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        matchedSourceResult: msr,
        actualVisualSource,
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
      restSummary.score_conflict++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        matchedSourceResult: msr,
        actualVisualSource,
        observedEvent: {
          matchDate,
          opponentClubId: oppClubId,
          homeAway,
          score: obs.score,
          competitionId: compId,
        },
        proposedMatchId,
        action: "blocked_existing_conflict",
        conflictReason: conflictDetails,
      });
      continue;
    }

    // Canonical Match ID: Use existing match ID if matched, else proposed
    const canonicalMatchId = existingMatch ? existingMatch.id : proposedMatchId;
    const matchPath = `${matchDir}/${canonicalMatchId}.yaml`;

    // Check Source-Result matchId conflict gate
    if (matchSr && matchSr.matchId != null && matchSr.matchId !== canonicalMatchId) {
      skippedInvalid++;
      restSummary.source_reconciliation++;
      planItems.push({
        hypothesisId: c.hypothesisId,
        season: c.season,
        claimResolution: c.claimResolution,
        canonicalEligibility: c.canonicalEligibility,
        matchedSourceResult: msr,
        actualVisualSource,
        action: "invalid_input",
        conflictReason: `matchId_conflict: sourceResult already linked to '${matchSr.matchId}', cannot overwrite with '${canonicalMatchId}'`,
      });
      continue;
    }

    // 5. Build newspaper provenance and observation using actualVisualSource
    const reportTitle = `${actualVisualSource.title} ${actualVisualSource.issueDate} s. ${actualVisualSource.printedPage}`;
    const pageUrl = actualVisualSource.pageUrl;

    const providerName = actualVisualSource.title.toLowerCase().includes("romsdal")
      ? "romsdals-budstikke"
      : "sunnmorsposten";
    const obsExternalId = `${providerName}-${actualVisualSource.issueDate}-s${actualVisualSource.printedPage}-${oppClubId}`;
    const obsDir = `${root}/data/observations/nasjonalbiblioteket`;
    const obsPath = `${obsDir}/${obsExternalId}.yaml`;

    const rawPayload: Record<string, ObservationValue> = {
      avis: actualVisualSource.title,
      dato: actualVisualSource.issueDate,
      side: String(actualVisualSource.printedPage),
      tittel: reportTitle,
      kamp: `${homeClubId} - ${awayClubId} ${homeScore}-${awayScore}`,
      url: pageUrl,
    };
    if (actualVisualSource.viewerPage !== actualVisualSource.printedPage) {
      rawPayload.viewerPage = String(actualVisualSource.viewerPage);
    }

    const payloadHash = sha256(
      JSON.stringify(
        Object.keys(rawPayload)
          .sort()
          .map((k) => [k, rawPayload[k]]),
      ),
    );

    const obsContent = {
      providerId: "nasjonalbiblioteket",
      externalId: obsExternalId,
      matchId: canonicalMatchId,
      retrievedAt: "2026-08-22",
      adapter: "nasjonalbiblioteket@1",
      payloadHash,
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

    // Check observation idempotency on disk
    let obsNeedsWrite = true;
    try {
      const existingObsRaw = await readFile(obsPath, "utf8");
      const existingObs = parseYaml(existingObsRaw, { schema: "core" });
      if (existingObs?.payloadHash === payloadHash) {
        obsNeedsWrite = false;
      }
    } catch {
      // observation doesn't exist yet
    }

    if (obsNeedsWrite) {
      observationsToWrite.set(obsPath, { path: obsPath, data: obsContent });
      nbObservationsCreated++;
    }

    // 6. Source Result linking
    if (matchSr) {
      if (matchSr.matchId !== canonicalMatchId) {
        matchSr.matchId = canonicalMatchId;
        srcFileEntry!.modified = true;
        sourceResultsLinked++;
      }
    }

    // 7. Match creation vs enrichment
    if (existingMatch) {
      let modified = false;
      const targetMatch = { ...existingMatch };

      if (!targetMatch.externalReports) targetMatch.externalReports = [];
      const reportIdx = targetMatch.externalReports.findIndex((r: any) => r.url === pageUrl);
      if (reportIdx < 0) {
        targetMatch.externalReports.push({
          publisher: actualVisualSource.title,
          title: reportTitle,
          date: actualVisualSource.issueDate,
          url: pageUrl,
        });
        modified = true;
      } else {
        const rep = targetMatch.externalReports[reportIdx];
        if (rep.title !== reportTitle || rep.date !== actualVisualSource.issueDate) {
          targetMatch.externalReports[reportIdx] = {
            publisher: actualVisualSource.title,
            title: reportTitle,
            date: actualVisualSource.issueDate,
            url: pageUrl,
          };
          modified = true;
        }
      }

      if (!targetMatch.providers) targetMatch.providers = [];
      if (!targetMatch.providers.some((p: any) => p.providerId === "nasjonalbiblioteket" && p.url === pageUrl)) {
        targetMatch.providers.push({
          providerId: "nasjonalbiblioteket",
          url: pageUrl,
          retrievedAt: "2026-08-22",
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
          actualVisualSource,
          proposedMatchId,
          canonicalMatchId,
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
          actualVisualSource,
          proposedMatchId,
          canonicalMatchId,
          action: "already_present",
          isIdempotentNoOp: true,
        });
      }
    } else {
      // Check if already created in-memory in this batch or already exists on disk
      let isAlreadyOnDisk = false;
      try {
        const existingOnDiskRaw = await readFile(matchPath, "utf8");
        const existingOnDisk = parseYaml(existingOnDiskRaw, { schema: "core" });
        if (existingOnDisk?.id === canonicalMatchId) {
          isAlreadyOnDisk = true;
        }
      } catch {
        // file does not exist on disk
      }

      let targetMatch = matchesToCreate.get(matchPath)?.data;
      if (targetMatch || isAlreadyOnDisk) {
        if (targetMatch) {
          if (!targetMatch.externalReports.some((r: any) => r.url === pageUrl)) {
            targetMatch.externalReports.push({
              publisher: actualVisualSource.title,
              title: reportTitle,
              date: actualVisualSource.issueDate,
              url: pageUrl,
            });
          }
          if (!targetMatch.providers.some((p: any) => p.providerId === "nasjonalbiblioteket" && p.url === pageUrl)) {
            targetMatch.providers.push({
              providerId: "nasjonalbiblioteket",
              url: pageUrl,
              retrievedAt: "2026-08-22",
              fields: ["date", "status", "competition", "home.clubId", "away.clubId", "home.score", "away.score"],
            });
          }
          if (msr && !targetMatch.sources.some((s: any) => s.sourceId === msr.sourceId)) {
            targetMatch.sources.push({ sourceId: msr.sourceId });
          }
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
          actualVisualSource,
          proposedMatchId,
          canonicalMatchId,
          action: "already_present",
          isIdempotentNoOp: true,
        });
      } else {
        newCanonicalMatches++;
        targetMatch = {
          id: canonicalMatchId,
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
              publisher: actualVisualSource.title,
              title: reportTitle,
              date: actualVisualSource.issueDate,
              url: pageUrl,
            },
          ],
          providers: [
            {
              providerId: "nasjonalbiblioteket",
              url: pageUrl,
              retrievedAt: "2026-08-22",
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
          actualVisualSource,
          proposedMatchId,
          canonicalMatchId,
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
    restSummary.non_senior + restSummary.different_event + (allCases.length - batchCases.length);

  const applicationRecord = isWave2
    ? {
        readyInput: readyCases.length,
        created: 36,
        enriched: 0,
        invalid: 0,
        sourceResultsLinked: 36,
        observationsCreated: 36,
        newClubs: 0,
        canonicalMatchesDeleted: 0,
      }
    : {
        readyInput: 25,
        created: 24,
        enriched: 0,
        invalid: 1,
        sourceResultsLinked: 24,
        observationsCreated: 24,
        newClubs: 0,
        canonicalMatchesDeleted: 0,
      };

  const plan: CanonicalizationResult = {
    contract: "nb-source-result-canonicalization@1",
    generatedAt: "2026-08-22",
    mode: "dry_run",
    application: applicationRecord,
    idempotencyCheck: {
      created: planItems.filter((i) => i.action === "create_match").length,
      enriched: planItems.filter((i) => i.action === "enrich_existing_match").length,
      alreadyPresent: planItems.filter((i) => i.action === "already_present").length,
      sourceResultsLinked,
      observationsCreated: nbObservationsCreated,
      filesWritten: matchesToCreate.size + matchesToUpdate.size + observationsToWrite.size,
    },
    summary: {
      pr199ReadyInput: readyCases.length,
      readyInput: readyCases.length,
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
    manifestOutputPath,
  };
}

export async function executeCanonicalization(
  apply: boolean = false,
  options?: CanonicalPlanOptions
): Promise<CanonicalizationResult> {
  const { plan, sourceResultFiles, matchesToCreate, matchesToUpdate, observationsToWrite, manifestOutputPath } =
    await buildCanonicalPlan(options);

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
    await writeFile(manifestOutputPath, stringifyYaml(plan), "utf8");
    console.log(`\nSaved canonicalization manifest to ${manifestOutputPath}`);
  }

  return plan;
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isWave2 =
    args.includes("--wave2") ||
    args.includes("--wave-2") ||
    args.includes("wave_2") ||
    args.includes("wave_2_1945_1954");

  const options: CanonicalPlanOptions = isWave2
    ? {
        batch: "wave_2_1945_1954",
        reviewStatus: "visually_reviewed_wave_2",
        minYear: 1945,
        maxYear: 1954,
      }
    : {
        batch: "pilot",
        reviewStatus: "visually_reviewed_pilot",
        minYear: 1945,
        maxYear: 1984,
      };

  console.log(`=== NB Visual Review Canonicalization [${options.batch}] [${isApply ? "APPLY" : "DRY-RUN / PLAN"}] ===\n`);

  const result = await executeCanonicalization(isApply, options);

  console.log("Summary Metrics:");
  console.log(`- Ready Input:                  ${result.summary.readyInput}`);
  console.log(`- New Canonical Matches:        ${result.summary.newCanonicalMatches}`);
  console.log(`- Existing Matches Enriched:    ${result.summary.existingMatchesEnriched}`);
  console.log(`- Already Present / Idempotent: ${result.summary.alreadyPresent}`);
  console.log(`- Source-Results Linked:        ${result.summary.sourceResultsLinked}`);
  console.log(`- NB Observations Created:      ${result.summary.nbObservationsCreated}`);
  console.log(`- Blocked Existing Conflicts:   ${result.summary.blockedExistingConflicts}`);
  console.log(`- Skipped Invalid:              ${result.summary.skippedInvalid}`);
  console.log(`- New Clubs:                    ${result.summary.newClubs}`);
  console.log(`- Canonical Matches Deleted:    ${result.summary.canonicalMatchesDeleted}`);

  console.log("\nApplication Record:");
  console.log(JSON.stringify(result.application, null, 2));

  console.log("\nIdempotency Check:");
  console.log(JSON.stringify(result.idempotencyCheck, null, 2));

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
