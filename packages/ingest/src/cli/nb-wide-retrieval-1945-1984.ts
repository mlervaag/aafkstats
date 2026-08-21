import { writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { loadArchive, dataDir, repoRoot } from "@aafkstats/schema/load";
import { flattenSourceResults } from "@aafkstats/schema";
import { fetchJson } from "../http.js";
import { buildNewspaperSearchUrl, AAFK_ALIASES } from "../adapters/nb-newspaper-search.js";
import { newspaperPageUrl } from "../adapters/nb-newspaper-access.js";
import { parseNote } from "../newspaper/note-parser.js";

interface SourceResultRef {
  sourceId: string;
  season: number;
  no: number;
  opponent: string;
  opponentClubId?: string;
  expectedScore?: { aafk: number; opponent: number };
  resultGroupId?: string;
  note?: string;
}

interface UnifiedHypothesis {
  hypothesisId: string;
  season: number;
  opponent: string;
  opponentClubId?: string;
  expectedScore?: { aafk: number; opponent: number };
  sourceResults: SourceResultRef[];
  siblingGroupId: string;
  isSingleton: boolean;
  siblingGroupSize: number;
  competitionHint?: string;
  homeAwayHint?: string;
}

interface CandidatePage {
  candidateId: string;
  rank: number;
  newspaper: {
    title: string;
    issueDate: string;
    page: string;
    pageUrl: string;
    itemId: string;
  };
  retrieval: {
    queryType: string;
    reasonCodes: string[];
    score: number;
    previewDetected: boolean;
    machinePriority: "high" | "medium" | "low";
  };
  visibility: string;
}

interface NbItem {
  id: string;
  metadata?: {
    title?: string;
    originInfo?: { issued?: string };
    identifiers?: { urn?: string };
  };
  contentFragments?: Array<{ pageNumber?: string; pageid?: string; text?: string }>;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9æøå]+/giu, " ").replace(/\s+/g, " ").trim();
}

function toIsoDate(dateStr: string): string {
  const compact = dateStr.replace(/[^0-9]/g, "");
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  return dateStr;
}

export async function runWideRetrieval() {
  const archive = await loadArchive(dataDir());
  const unlinkedRows: SourceResultRef[] = [];

  for (const collection of archive.sourceResults) {
    for (const result of flattenSourceResults(collection)) {
      if (result.season >= 1945 && result.season <= 1984) {
        if (result.matchId === null || result.matchId === undefined) {
          unlinkedRows.push({
            sourceId: collection.sourceId,
            season: result.season,
            no: Number(result.id.slice(-3)),
            opponent: result.opponent ?? "Ukjent",
            opponentClubId: result.opponentClubId ?? undefined,
            expectedScore: (result.aafkGoals !== null && result.opponentGoals !== null)
              ? { aafk: result.aafkGoals, opponent: result.opponentGoals }
              : undefined,
            resultGroupId: result.resultGroupId ?? undefined,
            note: result.note ?? undefined,
          });
        }
      }
    }
  }

  console.log(`Fant ${unlinkedRows.length} ukoblede source-results i perioden 1945-1984.`);

  // Group into unified hypotheses
  const hypothesisMap = new Map<string, SourceResultRef[]>();
  for (const row of unlinkedRows) {
    const hypId = row.resultGroupId ?? `${row.sourceId}#${row.season}-${String(row.no).padStart(3, "0")}`;
    if (!hypothesisMap.has(hypId)) hypothesisMap.set(hypId, []);
    hypothesisMap.get(hypId)!.push(row);
  }

  // Sibling groups by season|normalizedOpponent
  const groupHypotheses = new Map<string, string[]>(); // groupKey -> hypIds
  for (const [hypId, rows] of hypothesisMap.entries()) {
    const lead = rows[0];
    if (!lead) continue;
    const oppKey = lead.opponentClubId || normalize(lead.opponent).replace(/[^a-z0-9]/g, "");
    const groupKey = `${lead.season}|${oppKey}`;
    if (!groupHypotheses.has(groupKey)) groupHypotheses.set(groupKey, []);
    groupHypotheses.get(groupKey)!.push(hypId);
  }

  const unifiedList: UnifiedHypothesis[] = [];
  for (const [hypId, rows] of hypothesisMap.entries()) {
    const lead = rows[0];
    if (!lead) continue;
    const oppKey = lead.opponentClubId || normalize(lead.opponent).replace(/[^a-z0-9]/g, "");
    const groupKey = `${lead.season}|${oppKey}`;
    const groupSize = groupHypotheses.get(groupKey)?.length ?? 1;
    const hints = parseNote(lead.note);

    unifiedList.push({
      hypothesisId: hypId,
      season: lead.season,
      opponent: lead.opponent,
      opponentClubId: lead.opponentClubId,
      expectedScore: lead.expectedScore,
      sourceResults: rows,
      siblingGroupId: groupKey,
      isSingleton: groupSize === 1,
      siblingGroupSize: groupSize,
      competitionHint: hints.competitionHint,
      homeAwayHint: hints.homeAwayHint,
    });
  }

  // Sort by season and hypothesis ID
  unifiedList.sort((a, b) => a.season - b.season || a.hypothesisId.localeCompare(b.hypothesisId));

  console.log(`Bygget ${unifiedList.length} unifiserte hypoteser (${unifiedList.filter(h => h.isSingleton).length} singletons, ${unifiedList.filter(h => !h.isSingleton).length} sibling-hypoteser i ${groupHypotheses.size} grupper).`);

  // Cache for search results: Map<queryKey, NbItem[]>
  const queryCache = new Map<string, NbItem[]>();
  let apiRequests = 0;
  let cacheHits = 0;

  async function executeNbSearch(query: string, year: number, newspaper = "Sunnmørsposten"): Promise<NbItem[]> {
    const cacheKey = `${newspaper}|${year}|${query}`;
    if (queryCache.has(cacheKey)) {
      cacheHits++;
      return queryCache.get(cacheKey)!;
    }

    const url = buildNewspaperSearchUrl(query, { year, newspaper, limit: 50 });
    let isNetwork = false;
    try {
      const response = await fetchJson<{ _embedded?: { items?: NbItem[] } }>(url, {
        onNetworkRequest: () => { isNetwork = true; apiRequests++; },
      });
      if (!isNetwork) cacheHits++;
      const items = response._embedded?.items ?? [];
      queryCache.set(cacheKey, items);
      return items;
    } catch (err) {
      console.warn(`NB search error for "${query}" (${year}):`, (err as Error).message);
      return [];
    }
  }

  // Candidate generation per hypothesis / group
  interface HypothesisWithCandidates {
    hypothesis: UnifiedHypothesis;
    candidates: CandidatePage[];
  }

  const results: HypothesisWithCandidates[] = [];

  console.log("\nStarter bred retrieval for 1945-1984...");

  // Process by group to share queries and enable joint ranking
  const processedGroups = new Set<string>();

  for (const hyp of unifiedList) {
    if (processedGroups.has(hyp.siblingGroupId)) continue;
    processedGroups.add(hyp.siblingGroupId);

    const groupHypothesesList = unifiedList.filter(h => h.siblingGroupId === hyp.siblingGroupId);
    const opponent = hyp.opponent;
    const season = hyp.season;
    const normOpp = normalize(opponent);

    // Build search queries
    const searchTerms = [
      `${opponent} Aalesund`,
      `${opponent} Ålesund`,
      `${opponent} AaFK`,
      `${opponent} ÅFK`,
      `Aalesund ${opponent}`,
      `Ålesunds Fotballklubb ${opponent}`,
      `Aalesunds FK ${opponent}`,
      opponent,
    ];

    // Collect all items from search variants
    const itemMap = new Map<string, { item: NbItem; queriesMatched: string[]; allFragments: Array<{ pageNumber?: string; text?: string }> }>();

    for (const term of searchTerms) {
      const items = await executeNbSearch(term, season, "Sunnmørsposten");
      for (const item of items) {
        if (!itemMap.has(item.id)) {
          itemMap.set(item.id, {
            item,
            queriesMatched: [term],
            allFragments: item.contentFragments ?? [],
          });
        } else {
          const entry = itemMap.get(item.id)!;
          if (!entry.queriesMatched.includes(term)) entry.queriesMatched.push(term);
          entry.allFragments.push(...(item.contentFragments ?? []));
        }
      }
    }

    // Score and rank candidate pages for each hypothesis in the group
    for (const curHyp of groupHypothesesList) {
      const pageCandidateMap = new Map<string, {
        itemId: string;
        issueDate: string;
        page: string;
        score: number;
        reasons: string[];
        previewDetected: boolean;
        machinePriority: "high" | "medium" | "low";
      }>();

      for (const [itemId, entry] of itemMap.entries()) {
        const rawIssueDate = entry.item.metadata?.originInfo?.issued ?? `${season}0101`;
        const issueDate = toIsoDate(rawIssueDate);
        // Deduplicate fragments
        const seenFragKeys = new Set<string>();
        const fragments = entry.allFragments.filter(f => {
          const k = `${f.pageNumber ?? "1"}|${f.text ?? ""}`;
          if (seenFragKeys.has(k)) return false;
          seenFragKeys.add(k);
          return true;
        });

        for (const frag of fragments) {
          const rawText = frag.text ?? "";
          const text = normalize(rawText);
          const page = frag.pageNumber ?? "1";
          const pageKey = `${itemId}|${page}`;

          let score = 0;
          const reasons: string[] = [];
          let previewDetected = false;

          const oppMatched = text.includes(normOpp) || (curHyp.opponentClubId && text.includes(curHyp.opponentClubId));
          const aafkMatched = AAFK_ALIASES.some(a => text.includes(normalize(a)));

          if (oppMatched) {
            score += 25;
            reasons.push("opponent_hit");
          }
          if (aafkMatched) {
            score += 20;
            reasons.push("aafk_hit");
          }
          if (oppMatched && aafkMatched) {
            score += 20;
            reasons.push("team_pair_cooccurrence");
          }

          // Expected score check
          let scoreMatched = false;
          if (curHyp.expectedScore) {
            const s1 = `${curHyp.expectedScore.aafk} ${curHyp.expectedScore.opponent}`;
            const s2 = `${curHyp.expectedScore.opponent} ${curHyp.expectedScore.aafk}`;
            const sHyphen1 = `${curHyp.expectedScore.aafk}-${curHyp.expectedScore.opponent}`;
            const sHyphen2 = `${curHyp.expectedScore.opponent}-${curHyp.expectedScore.aafk}`;
            if (text.includes(s1) || text.includes(s2) || rawText.includes(sHyphen1) || rawText.includes(sHyphen2)) {
              score += 35;
              scoreMatched = true;
              reasons.push("score_hit");
            }
          }

          // Match talk
          if (/(kamp|referat|omgang|maal|mal|slutt|seier|tap|uavgjort|scoring|dommer|tilskuer)/i.test(text)) {
            score += 15;
            reasons.push("match_context");
          }

          // Preview detection
          if (/(moter|spiller mot|tar imot|reiser til|helgens kamp|sondag kl|lordag kl|privatkamp i helgen)/i.test(text)) {
            previewDetected = true;
            reasons.push("preview_detected");
          }

          if (score > 20) {
            const machinePriority: "high" | "medium" | "low" =
              (oppMatched && aafkMatched && scoreMatched) ? "high"
              : (oppMatched && aafkMatched) ? "medium"
              : "low";

            const existing = pageCandidateMap.get(pageKey);
            if (!existing || score > existing.score) {
              pageCandidateMap.set(pageKey, {
                itemId,
                issueDate,
                page,
                score,
                reasons,
                previewDetected,
                machinePriority,
              });
            }
          }
        }
      }

      // Check for preview-triggered follow-up retrieval
      const previewCandidates = [...pageCandidateMap.values()].filter(c => c.previewDetected);
      if (previewCandidates.length > 0) {
        // Targeted follow-up: search for match reports in subsequent days
        for (const prev of previewCandidates.slice(0, 2)) {
          const prevDate = prev.issueDate;
          if (/^\d{4}-\d{2}-\d{2}$/.test(prevDate)) {
            const d = new Date(prevDate);
            d.setDate(d.getDate() + 1);
            const nextDateStr = d.toISOString().slice(0, 10);
            const d2 = new Date(prevDate);
            d2.setDate(d2.getDate() + 3);
            const nextDateStr2 = d2.toISOString().slice(0, 10);

            // Follow-up query
            const followUpUrl = buildNewspaperSearchUrl(`${opponent} Aalesund`, {
              year: season,
              newspaper: "Sunnmørsposten",
              from: nextDateStr,
              to: nextDateStr2,
              limit: 10,
            });
            try {
              let isNet = false;
              const followUpRes = await fetchJson<{ _embedded?: { items?: NbItem[] } }>(followUpUrl, {
                onNetworkRequest: () => { isNet = true; apiRequests++; },
              });
              if (!isNet) cacheHits++;
              for (const item of followUpRes._embedded?.items ?? []) {
                const rawIssued = item.metadata?.originInfo?.issued ?? nextDateStr;
                const issueDate = toIsoDate(rawIssued);
                for (const frag of item.contentFragments ?? []) {
                  const rawText = frag.text ?? "";
                  const text = normalize(rawText);
                  const page = frag.pageNumber ?? "1";
                  const pageKey = `${item.id}|${page}`;
                  let score = 40;
                  const reasons = ["preview_followup_hit", "temporal_chaining"];
                  let oppMatch = false;
                  let scoreMatch = false;
                  if (text.includes(normOpp)) {
                    score += 20;
                    oppMatch = true;
                    reasons.push("opponent_hit");
                  }
                  if (curHyp.expectedScore) {
                    const s1 = `${curHyp.expectedScore.aafk} ${curHyp.expectedScore.opponent}`;
                    if (text.includes(s1)) {
                      score += 30;
                      scoreMatch = true;
                      reasons.push("score_hit");
                    }
                  }
                  const machinePriority: "high" | "medium" | "low" = (oppMatch && scoreMatch) ? "high" : "medium";
                  const existing = pageCandidateMap.get(pageKey);
                  if (!existing || score > existing.score) {
                    pageCandidateMap.set(pageKey, {
                      itemId: item.id,
                      issueDate,
                      page,
                      score,
                      reasons,
                      previewDetected: false,
                      machinePriority,
                    });
                  }
                }
              }
            } catch {
              // ignore follow-up error
            }
          }
        }
      }

      // Sort candidate pages by score descending
      const sortedPages = [...pageCandidateMap.values()].sort((a, b) => b.score - a.score || a.issueDate.localeCompare(b.issueDate));

      // Limit to TOP 3 (or up to 5 if sibling group is large or close scores)
      const topLimit = curHyp.siblingGroupSize > 2 ? 5 : 3;
      const topPages = sortedPages.slice(0, topLimit);

      const candidatePages: CandidatePage[] = topPages.map((p, idx) => {
        const leadRef = curHyp.sourceResults[0];
        const sourceIdStr = leadRef?.sourceId ?? "unknown";
        const noStr = leadRef ? String(leadRef.no).padStart(3, "0") : "001";
        return {
          candidateId: `nb-cand-${sourceIdStr}-${curHyp.season}-${noStr}-rank${idx + 1}`,
          rank: idx + 1,
          newspaper: {
            title: "Sunnmørsposten",
            issueDate: p.issueDate,
            page: p.page,
            pageUrl: newspaperPageUrl(p.itemId, p.page),
            itemId: p.itemId,
          },
          retrieval: {
            queryType: "team_pair_score_wide",
            reasonCodes: p.reasons,
            score: p.score,
            previewDetected: p.previewDetected,
            machinePriority: p.machinePriority,
          },
          visibility: "visual_review_candidate",
        };
      });

      results.push({
        hypothesis: curHyp,
        candidates: candidatePages,
      });
    }
  }

  console.log(`\nRetrieval fullført: ${results.length} hypoteser behandlet.`);
  console.log(`API-forespørsler (nettverk): ${apiRequests}, Cache hits: ${cacheHits}`);

  // ----------------------------------------------------
  // RETRIEVAL METRICS CALCULATION (HONEST RETRIEVAL METRICS)
  // ----------------------------------------------------
  const totalHypotheses = unifiedList.length;
  const hypothesesWithCandidates = results.filter(r => r.candidates.length > 0).length;
  const candidateCoverage = hypothesesWithCandidates / totalHypotheses;

  const totalCandidates = results.reduce((acc, r) => acc + r.candidates.length, 0);
  const hypothesesWithRank1 = results.filter(r => r.candidates.length >= 1).length;
  const hypothesesWithRank2 = results.filter(r => r.candidates.length >= 2).length;
  const hypothesesWithRank3 = results.filter(r => r.candidates.length >= 3).length;

  const hypothesesWithHighOcrSignal = results.filter(r => r.candidates.some(c => c.retrieval.machinePriority === "high")).length;
  const rank1HighOcrSignal = results.filter(r => r.candidates[0]?.retrieval.machinePriority === "high").length;
  const rank1to3HighOcrSignal = results.filter(r => r.candidates.slice(0, 3).some(c => c.retrieval.machinePriority === "high")).length;

  const top1OcrSignalRate = totalHypotheses > 0 ? rank1HighOcrSignal / totalHypotheses : 0;
  const top3OcrSignalRate = totalHypotheses > 0 ? rank1to3HighOcrSignal / totalHypotheses : 0;
  const topNIncrementalGain = totalHypotheses > 0 ? (rank1to3HighOcrSignal - rank1HighOcrSignal) / totalHypotheses : 0;

  // Singletons vs Siblings
  const singletonsTotal = unifiedList.filter(h => h.isSingleton).length;
  const singletonsWithCand = results.filter(r => r.hypothesis.isSingleton && r.candidates.length > 0).length;
  const singletonsHighOcr = results.filter(r => r.hypothesis.isSingleton && r.candidates.some(c => c.retrieval.machinePriority === "high")).length;

  const siblingGroupsTotal = [...groupHypotheses.values()].filter(ids => ids.length > 1).length;
  const siblingClaimsTotal = unifiedList.filter(h => !h.isSingleton).length;
  const siblingClaimsWithCand = results.filter(r => !r.hypothesis.isSingleton && r.candidates.length > 0).length;
  const siblingClaimsHighOcr = results.filter(r => !r.hypothesis.isSingleton && r.candidates.some(c => c.retrieval.machinePriority === "high")).length;

  // Period breakdown
  const periods = [
    { name: "1945-1954", from: 1945, to: 1954 },
    { name: "1955-1964", from: 1955, to: 1964 },
    { name: "1965-1974", from: 1965, to: 1974 },
    { name: "1975-1984", from: 1975, to: 1984 },
  ];

  const periodMetrics = periods.map(p => {
    const pHyp = unifiedList.filter(h => h.season >= p.from && h.season <= p.to);
    const pResults = results.filter(r => r.hypothesis.season >= p.from && r.hypothesis.season <= p.to);
    const withCand = pResults.filter(r => r.candidates.length > 0).length;
    const highOcr = pResults.filter(r => r.candidates.some(c => c.retrieval.machinePriority === "high")).length;
    const candidatesCount = pResults.reduce((acc, r) => acc + r.candidates.length, 0);

    return {
      period: p.name,
      hypotheses: pHyp.length,
      candidateCoverage: pHyp.length > 0 ? Number((withCand / pHyp.length).toFixed(4)) : 0,
      hypothesesWithCandidates: withCand,
      totalCandidates: candidatesCount,
      candidatesPerHypothesis: withCand > 0 ? Number((candidatesCount / withCand).toFixed(2)) : 0,
      highPriorityVisualReviewQueue: highOcr,
    };
  });

  const decisionGate = "READY_FOR_TRUE_VISUAL_REVIEW";

  // Build candidate manifest YAML (clean contract)
  const manifestData = {
    contract: "nb-source-result-wide-candidates@1",
    generatedAt: new Date().toISOString().slice(0, 10),
    decisionGate,
    scope: {
      fromYear: 1945,
      toYear: 1984,
      totalUnlinkedSourceResults: unlinkedRows.length,
      totalHypotheses: unifiedList.length,
      singletonHypotheses: singletonsTotal,
      siblingHypotheses: siblingClaimsTotal,
      siblingGroups: siblingGroupsTotal,
    },
    retrievalSummary: {
      apiRequests,
      cacheHits,
      candidateCoverage: Number(candidateCoverage.toFixed(4)),
      hypothesesWithCandidates,
      totalCandidatesRetrieved: totalCandidates,
      candidateDistribution: {
        withRank1: hypothesesWithRank1,
        withRank2: hypothesesWithRank2,
        withRank3: hypothesesWithRank3,
      },
      ocrSignalRates: {
        top1OcrSignalRate: Number(top1OcrSignalRate.toFixed(4)),
        top3OcrSignalRate: Number(top3OcrSignalRate.toFixed(4)),
        topNIncrementalCandidateGain: Number(topNIncrementalGain.toFixed(4)),
      },
      machineVisualReviewQueue: {
        highPriority: hypothesesWithHighOcrSignal,
        mediumPriority: results.filter(r => r.candidates.some(c => c.retrieval.machinePriority === "medium") && !r.candidates.some(c => c.retrieval.machinePriority === "high")).length,
        lowPriority: results.filter(r => r.candidates.length > 0 && r.candidates.every(c => c.retrieval.machinePriority === "low")).length,
        uncovered: totalHypotheses - hypothesesWithCandidates,
      },
      singletons: {
        total: singletonsTotal,
        withCandidates: singletonsWithCand,
        highPriorityQueue: singletonsHighOcr,
      },
      siblings: {
        groups: siblingGroupsTotal,
        claims: siblingClaimsTotal,
        claimsWithCandidates: siblingClaimsWithCand,
        claimsHighPriorityQueue: siblingClaimsHighOcr,
      },
      periodBreakdown: periodMetrics,
    },
    hypotheses: results.map(r => ({
      hypothesisId: r.hypothesis.hypothesisId,
      season: r.hypothesis.season,
      isSingleton: r.hypothesis.isSingleton,
      siblingGroup: {
        id: r.hypothesis.siblingGroupId,
        size: r.hypothesis.siblingGroupSize,
        claims: unifiedList
          .filter(h => h.siblingGroupId === r.hypothesis.siblingGroupId)
          .flatMap(h => h.sourceResults)
          .map(sr => ({
            sourceId: sr.sourceId,
            no: sr.no,
            opponent: sr.opponent,
            expectedScore: sr.expectedScore,
          })),
      },
      sourceResults: r.hypothesis.sourceResults.map(sr => ({
        sourceId: sr.sourceId,
        no: sr.no,
        opponent: sr.opponent,
        expectedScore: sr.expectedScore,
      })),
      candidates: r.candidates.map(c => ({
        candidateId: c.candidateId,
        rank: c.rank,
        newspaper: {
          title: c.newspaper.title,
          issueDate: c.newspaper.issueDate,
          page: c.newspaper.page,
          pageUrl: c.newspaper.pageUrl,
        },
        retrieval: {
          queryType: c.retrieval.queryType,
          reasonCodes: c.retrieval.reasonCodes,
          previewDetected: c.retrieval.previewDetected,
          machinePriority: c.retrieval.machinePriority,
        },
        visibility: c.visibility,
      })),
    })),
  };

  const manifestPath = resolve(repoRoot(), "data/discovery/nb-source-result-wide-candidates-1945-1984.yaml");
  await writeFile(manifestPath, stringifyYaml(manifestData, { lineWidth: 0 }), "utf8");
  console.log(`Skrev rent kandidatmanifest til ${manifestPath}`);

  // Clean up old fake review file if present
  const oldReviewPath = resolve(repoRoot(), "data/discovery/nb-source-result-wide-review-1945-1984.yaml");
  if (existsSync(oldReviewPath)) {
    await unlink(oldReviewPath);
    console.log(`Fjernet gammel simulert review-fil: ${oldReviewPath}`);
  }

  console.log("\n=======================================================");
  console.log("=== PR 198 SLUTTRAPPORT: WIDE RETRIEVAL 1945-1984 ===");
  console.log("=======================================================");
  console.log(`Beslutningsport: ${decisionGate}`);
  console.log(`Ukoblede kilderesultater: ${unlinkedRows.length}`);
  console.log(`Unifiserte hypoteser: ${totalHypotheses}`);
  console.log(`  - Singletons: ${singletonsTotal}`);
  console.log(`  - Sibling-hypoteser: ${siblingClaimsTotal} (i ${siblingGroupsTotal} grupper)`);
  console.log(`Kandidatdekning (>=1 side funnet): ${(candidateCoverage * 100).toFixed(1)}% (${hypothesesWithCandidates}/${totalHypotheses})`);
  console.log(`Totalt antall konkrete kandidatsider hentet: ${totalCandidates}`);
  console.log(`Maskinell visuell review-kø:`);
  console.log(`  - Høy prioritet (sterkt OCR-signal): ${hypothesesWithHighOcrSignal}`);
  console.log(`  - Medium prioritet: ${results.filter(r => r.candidates.some(c => c.retrieval.machinePriority === "medium") && !r.candidates.some(c => c.retrieval.machinePriority === "high")).length}`);
  console.log(`  - Lav prioritet / udekket: ${results.filter(r => r.candidates.length === 0 || r.candidates.every(c => c.retrieval.machinePriority === "low")).length}`);
  console.log(`Top-1 OCR signal rate: ${(top1OcrSignalRate * 100).toFixed(1)}%`);
  console.log(`Top-3 OCR signal rate: ${(top3OcrSignalRate * 100).toFixed(1)}%`);
  console.log(`Top-N inkrementell kandidatgevinst: ${(topNIncrementalGain * 100).toFixed(1)}%`);
  console.log(`0 kanoniske mutasjoner utført. Klar for ekte visuell review i PR #199.`);
  console.log("=======================================================\n");
}

runWideRetrieval().catch(console.error);
