import { clusterEvidence } from "./evidence-cluster.js";
import type { NewspaperEvidence, NewspaperQuery } from "./evidence.js";
import type { DateConfidence } from "./date-inference.js";
import type { NewspaperEvent } from "./evidence-cluster.js";

/**
 * Hva avisene til sammen sier om ett kilderesultat.
 *
 * ## Hvorfor avstemmingen må være hendelseskoherent og kildekritisk
 *
 * Kilderesultatene er kildeutsagn, ikke kamper. Klubbens jubileumsliste fra 1965
 * er satt sammen i ettertid, og der den er uenig med avisa dagen etter kampen,
 * er det avisa som var til stede. Et verktøy som bare kan si «funnet» og «ikke
 * funnet» må da enten forkaste kampen eller forfalske den.
 *
 * Like viktig er det at:
 * 1. Dato og resultat må stamme fra den samme sammenhengende avishendelsen.
 * 2. En kildebekreftelse kan ikke overstyre en motstridende hjemme/borte-angivelse.
 * 3. En resultatkonflikt kan bare rapporteres dersom hendelsen er entydig knyttet
 *    til kilderesultatet og det ikke finnes andre plausible hendelser som matcher
 *    kildens hint (f.eks. cup/serie) bedre.
 */

export type DiscoveryStatus = "confirmed" | "probable" | "ambiguous" | "conflict" | "not_found";

export interface MatchDateResolution {
  value: string;
  confidence: DateConfidence;
  /** Antall utgaver som peker på den samme datoen. */
  agreement: number;
  disagreement: string[];
}

export interface ReconciliationChecks {
  opponent: "confirmed" | "missing";
  score: "confirmed" | "conflict" | "unknown";
  homeAway: "confirmed" | "conflict" | "unknown";
  competition: "probable" | "unknown";
  date: "confirmed" | "probable" | "unknown";
}

export interface DiscoveryResult {
  status: DiscoveryStatus;
  matchDate?: MatchDateResolution;
  /** Resultatet avisene oppgir, når det avviker fra kilden. */
  newspaperScore?: [number, number];
  sourceScore?: [number, number];
  checks: ReconciliationChecks;
  evidence: NewspaperEvidence[];
  combinedConfidence: number;
}

/** Under dette er et treff ikke verdt å rapportere som kandidat. */
const MINIMUM_SCORE = 30;
/** Fra dette og opp er kampen funnet, forutsatt at datoen holder. */
const STRONG_SCORE = 60;

interface EventAnalysis {
  event: NewspaperEvent;
  strongest: NewspaperEvidence;
  inferredDate?: string;
  dateConfidence?: DateConfidence;
  scoreAgreement?: NewspaperEvidence;
  scoreConflict?: [number, number];
  hasScoreContradiction: boolean;
  opponentFound: boolean;
  homeAway: ReconciliationChecks["homeAway"];
  competition: ReconciliationChecks["competition"];
  dateCheck: ReconciliationChecks["date"];
  isCoherentConfirmed: boolean;
  isCoherentConflict: boolean;
  isCoherentProbable: boolean;
}

export function reconcile(query: NewspaperQuery, evidence: NewspaperEvidence[]): DiscoveryResult {
  const relevant = evidence.filter((item) => item.score >= MINIMUM_SCORE).sort((a, b) => b.score - a.score);
  const sourceScore = query.expectedScore ? [query.expectedScore[0], query.expectedScore[1]] as [number, number] : undefined;

  if (relevant.length === 0) {
    return {
      status: "not_found",
      checks: { opponent: "missing", score: "unknown", homeAway: "unknown", competition: "unknown", date: "unknown" },
      evidence: [],
      combinedConfidence: 0,
      ...(sourceScore ? { sourceScore } : {}),
    };
  }

  const events = clusterEvidence(relevant);
  const analyses = events.map((event) => analyzeEvent(query, event));

  const confirmedAnalyses = analyses.filter((a) => a.isCoherentConfirmed);
  const conflictAnalyses = analyses.filter((a) => a.isCoherentConflict);

  // 1. Entydig bekreftet hendelse
  if (confirmedAnalyses.length === 1 && conflictAnalyses.length === 0) {
    const chosen = confirmedAnalyses[0]!;

    // Dersom kilden angir hjemme/borte og avisa entydig dokumenterer det motsatte,
    // kan saken ikke bekreftes automatisk — den må til manuell avklaring (ambiguous).
    if (chosen.homeAway === "conflict") {
      return buildResult({
        status: "ambiguous",
        chosen,
        allAnalyses: analyses,
        relevantEvidence: relevant,
        sourceScore,
        scoreCheck: "confirmed",
      });
    }

    return buildResult({
      status: "confirmed",
      chosen,
      allAnalyses: analyses,
      relevantEvidence: relevant,
      sourceScore,
      scoreCheck: "confirmed",
    });
  }

  // 2. Entydig konflikt i samme hendelse
  if (conflictAnalyses.length === 1 && confirmedAnalyses.length === 0) {
    const chosen = conflictAnalyses[0]!;

    // En konflikt krever entydig kobling til kilderesultatet.
    // Hvis det finnes en annen sterk, datert hendelse mot samme motstander som kan
    // være kildens kamp (f.eks. matcher cup-hint bedre), blir utfallet ambiguous.
    const competingStrongEvents = analyses.filter((a) =>
      a !== chosen && a.opponentFound && a.inferredDate !== undefined &&
      (a.strongest.score >= STRONG_SCORE || a.event.score >= STRONG_SCORE));

    const alternativeHasBetterHints = competingStrongEvents.some((other) => {
      const betterCompetition = query.competitionHint !== undefined &&
        other.competition === "probable" && chosen.competition !== "probable";
      const betterHomeAway = query.homeAwayHint !== undefined &&
        other.homeAway === "confirmed" && chosen.homeAway !== "confirmed";
      return betterCompetition || betterHomeAway;
    });

    if (competingStrongEvents.length > 0 && (alternativeHasBetterHints || chosen.homeAway === "conflict")) {
      return buildResult({
        status: "ambiguous",
        chosen,
        allAnalyses: analyses,
        relevantEvidence: relevant,
        sourceScore,
        newspaperScore: chosen.scoreConflict,
        scoreCheck: "conflict",
      });
    }

    return buildResult({
      status: "conflict",
      chosen,
      allAnalyses: analyses,
      relevantEvidence: relevant,
      sourceScore,
      newspaperScore: chosen.scoreConflict,
      scoreCheck: "conflict",
    });
  }

  // 3. Flere konkurrerende bekreftelser eller konflikter -> ambiguous
  if (confirmedAnalyses.length > 1 || conflictAnalyses.length > 1 || (confirmedAnalyses.length > 0 && conflictAnalyses.length > 0)) {
    const dated = analyses.filter((a) => a.inferredDate !== undefined);
    const chosen = confirmedAnalyses[0] ?? conflictAnalyses[0] ?? dated[0] ?? analyses[0]!;
    return buildResult({
      status: "ambiguous",
      chosen,
      allAnalyses: analyses,
      relevantEvidence: relevant,
      sourceScore,
      scoreCheck: "unknown",
    });
  }

  // 4. Ingen hendelse har full score-bekreftelse eller score-konflikt
  const datedAnalyses = analyses.filter((a) => a.inferredDate !== undefined);

  if (datedAnalyses.length > 1) {
    // Flere konkurrerende datobevis uten entydig scorebekreftelse -> ambiguous
    const chosen = datedAnalyses[0]!;
    return buildResult({
      status: "ambiguous",
      chosen,
      allAnalyses: analyses,
      relevantEvidence: relevant,
      sourceScore,
      scoreCheck: "unknown",
    });
  }

  if (datedAnalyses.length === 1) {
    const chosen = datedAnalyses[0]!;
    if (chosen.isCoherentProbable && !chosen.hasScoreContradiction && chosen.homeAway !== "conflict") {
      return buildResult({
        status: "probable",
        chosen,
        allAnalyses: analyses,
        relevantEvidence: relevant,
        sourceScore,
        scoreCheck: "unknown",
      });
    }
    const status: DiscoveryStatus = relevant.length > 1 || chosen.hasScoreContradiction || chosen.homeAway === "conflict"
      ? "ambiguous"
      : "probable";
    return buildResult({
      status,
      chosen,
      allAnalyses: analyses,
      relevantEvidence: relevant,
      sourceScore,
      scoreCheck: "unknown",
    });
  }

  // Ingen daterte hendelser
  const chosen = analyses[0]!;
  if (chosen.strongest.score >= STRONG_SCORE && chosen.opponentFound && !chosen.hasScoreContradiction && chosen.homeAway !== "conflict") {
    return buildResult({
      status: "probable",
      chosen,
      allAnalyses: analyses,
      relevantEvidence: relevant,
      sourceScore,
      scoreCheck: "unknown",
    });
  }

  const status: DiscoveryStatus = relevant.length > 1 || chosen.hasScoreContradiction || chosen.homeAway === "conflict"
    ? "ambiguous"
    : "probable";
  return buildResult({
    status,
    chosen,
    allAnalyses: analyses,
    relevantEvidence: relevant,
    sourceScore,
    scoreCheck: "unknown",
  });
}

function analyzeEvent(query: NewspaperQuery, event: NewspaperEvent): EventAnalysis {
  const strongest = event.evidence[0]!;

  // Bare gyldig kampomtale (artikkel eller resultatliste) i samme fragment teller som scorebevis.
  // Tabeller, kuponger og terminlister skal aldri bekrefte kilden eller oppheve en konflikt.
  const validMatchEvidence = event.evidence.filter((item) =>
    item.sameFragment && (item.kind === "article" || item.kind === "result_list"));

  const matchingScoreEvidence = validMatchEvidence.find((item) => item.scoreMatchesSource === true);
  const conflictingScoreEvidence = validMatchEvidence.find((item) =>
    item.scoreFound !== undefined && item.scoreMatchesSource === false);

  const hasScoreContradiction = matchingScoreEvidence !== undefined && conflictingScoreEvidence !== undefined;

  const scoreAgreement = hasScoreContradiction ? undefined : matchingScoreEvidence;
  const scoreConflict = hasScoreContradiction ? undefined : conflictingScoreEvidence?.scoreFound;

  const opponentFound = event.evidence.some((item) => item.opponentFound);
  const homeAway = homeAwayCheck(query, event.evidence);
  const competition = event.evidence.some((item) => item.competitionFound !== undefined) ? "probable" : "unknown";
  const inferredDate = event.inferredDate;
  const dateConfidence = event.dateConfidence;
  const dateCheck: ReconciliationChecks["date"] = inferredDate === undefined ? "unknown" : (dateConfidence === "high" ? "confirmed" : "probable");

  const hasStrongEvidence = strongest.score >= STRONG_SCORE || event.score >= STRONG_SCORE;
  const hasIdentifiedDate = inferredDate !== undefined && dateCheck !== "unknown";

  const isCoherentConfirmed = hasStrongEvidence && hasIdentifiedDate && scoreAgreement !== undefined && !hasScoreContradiction && opponentFound;
  const isCoherentConflict = hasStrongEvidence && hasIdentifiedDate && scoreConflict !== undefined && scoreAgreement === undefined && !hasScoreContradiction && opponentFound;
  const isCoherentProbable = hasStrongEvidence && hasIdentifiedDate && opponentFound;

  return {
    event,
    strongest,
    inferredDate,
    dateConfidence,
    scoreAgreement,
    scoreConflict,
    hasScoreContradiction,
    opponentFound,
    homeAway,
    competition,
    dateCheck,
    isCoherentConfirmed,
    isCoherentConflict,
    isCoherentProbable,
  };
}

function buildResult(input: {
  status: DiscoveryStatus;
  chosen: EventAnalysis;
  allAnalyses: EventAnalysis[];
  relevantEvidence: NewspaperEvidence[];
  sourceScore?: [number, number];
  newspaperScore?: [number, number];
  scoreCheck: ReconciliationChecks["score"];
}): DiscoveryResult {
  const { status, chosen, allAnalyses, relevantEvidence, sourceScore, newspaperScore, scoreCheck } = input;

  const disagreement = allAnalyses
    .filter((a) => a.inferredDate !== undefined && a.inferredDate !== chosen.inferredDate)
    .map((a) => a.inferredDate!);

  const agreement = chosen.inferredDate === undefined
    ? 0
    : chosen.event.evidence.filter((item) => item.temporal?.inferredMatchDate === chosen.inferredDate).length;

  const matchDate: MatchDateResolution | undefined = chosen.inferredDate === undefined ? undefined : {
    value: chosen.inferredDate,
    confidence: chosen.dateConfidence ?? "high",
    agreement: Math.max(1, agreement),
    disagreement: [...new Set(disagreement)],
  };

  const checks: ReconciliationChecks = {
    opponent: chosen.opponentFound ? "confirmed" : "missing",
    score: scoreCheck,
    homeAway: chosen.homeAway,
    competition: chosen.competition,
    date: chosen.dateCheck,
  };

  // Beregn combinedConfidence KUN fra bevisene i den valgte hendelsen
  const combinedConfidence = chosen.event.evidence
    .slice(0, 3)
    .reduce((sum, item, index) => sum + item.score / (index + 1), 0);

  // Legg valgt hendelses beviser først, deretter eventuelle andre relevante beviser
  const chosenSet = new Set(chosen.event.evidence);
  const orderedEvidence = [
    ...chosen.event.evidence,
    ...relevantEvidence.filter((item) => !chosenSet.has(item)),
  ];

  return {
    status,
    ...(matchDate ? { matchDate } : {}),
    ...(newspaperScore ? { newspaperScore } : {}),
    ...(sourceScore ? { sourceScore } : {}),
    checks,
    evidence: orderedEvidence,
    combinedConfidence: Math.round(combinedConfidence),
  };
}

function homeAwayCheck(query: NewspaperQuery, evidence: NewspaperEvidence[]): ReconciliationChecks["homeAway"] {
  const found = evidence.find((item) => item.homeAwayFound !== undefined)?.homeAwayFound;
  if (found === undefined || query.homeAwayHint === undefined) return "unknown";
  return found === query.homeAwayHint ? "confirmed" : "conflict";
}
