import { resolveMatchDate } from "./date-inference.js";
import type { NewspaperEvidence, NewspaperQuery } from "./evidence.js";
import type { DateConfidence } from "./date-inference.js";

/**
 * Hva avisene til sammen sier om ett kilderesultat.
 *
 * ## Hvorfor konflikt er et utfall og ikke en feil
 *
 * Kilderesultatene er kildeutsagn, ikke kamper. Klubbens jubileumsliste fra 1965
 * er satt sammen i ettertid, og der den er uenig med avisa dagen etter kampen,
 * er det avisa som var til stede. Et verktøy som bare kan si «funnet» og «ikke
 * funnet» må da enten forkaste kampen eller forfalske den.
 *
 * Sarpsborg-kampen i juli 1948 er tilfellet som formet dette: lista sier 1-0,
 * avisa sier 2-1, og datoen er hevet over tvil. Det riktige svaret er ikke å
 * velge — det er å registrere at kampen er funnet, og at kildene er uenige om
 * resultatet. Da kan et menneske avgjøre, med begge tallene foran seg.
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

  const date = resolveMatchDate(relevant.flatMap((item) => (item.temporal ? [{ temporal: item.temporal, weight: item.score }] : [])));
  const strongest = relevant[0]!;
  // Bare et resultat i løpende tekst eller i resultatbørsen teller som
  // enighet. Et sifferpar i en tabellrad er ikke et kampresultat, og det skal
  // ikke kunne oppheve tvilen når sesongen har to kamper mot samme motstander.
  const scoreAgreement = relevant.find((item) =>
    item.scoreMatchesSource === true && (item.kind === "article" || item.kind === "result_list"));
  const conflicting = conflictingScore(query, relevant);

  const checks: ReconciliationChecks = {
    opponent: relevant.some((item) => item.opponentFound) ? "confirmed" : "missing",
    score: scoreAgreement ? "confirmed" : conflicting ? "conflict" : "unknown",
    homeAway: homeAwayCheck(query, relevant),
    competition: relevant.some((item) => item.competitionFound !== undefined) ? "probable" : "unknown",
    date: date === undefined ? "unknown" : date.confidence === "high" ? "confirmed" : "probable",
  };

  // Summen av de tre beste vinduene, med avtakende vekt. Fire utgaver som hver
  // sier litt er sterkere enn én som sier alt — men ikke fire ganger sterkere.
  const combinedConfidence = relevant
    .slice(0, 3)
    .reduce((sum, item, index) => sum + item.score / (index + 1), 0);

  return {
    status: statusFor({
      strongest,
      checks,
      date,
      conflicting: conflicting !== undefined,
      candidates: relevant.length,
      ambiguousSiblings: (query.siblingCount ?? 1) > 1 && !scoreAgreement,
    }),
    ...(date ? { matchDate: { value: date.date, confidence: date.confidence, agreement: date.agreement, disagreement: date.disagreement } } : {}),
    ...(conflicting ? { newspaperScore: conflicting } : {}),
    ...(sourceScore ? { sourceScore } : {}),
    checks,
    evidence: relevant,
    combinedConfidence: Math.round(combinedConfidence),
  };
}

function statusFor(input: {
  strongest: NewspaperEvidence;
  checks: ReconciliationChecks;
  date: { confidence: DateConfidence } | undefined;
  conflicting: boolean;
  candidates: number;
  /**
   * Sesongen har flere kilderesultater mot samme motstander, og ingen av dem
   * kan skilles på resultatet.
   *
   * Da er treffsettet det samme for alle radene, og verktøyet kan ikke vite
   * hvilken av kampene en utgave omtaler. Første forsøk ga da to Clausenengen-
   * rader i 1952 samme dato, og en Raufoss-rad fra juni fikk august-kampen med
   * «høy» tillit. En feil dato med høy tillit er verre enn ingen dato.
   */
  ambiguousSiblings: boolean;
}): DiscoveryStatus {
  const identified = input.strongest.score >= STRONG_SCORE && input.checks.date !== "unknown";

  if (input.ambiguousSiblings && !input.conflicting) return "ambiguous";

  // Konflikt går foran alt annet: kampen er funnet, men kildene er uenige, og
  // det skal ikke kunne skjules bak en «confirmed».
  if (identified && input.conflicting) return "conflict";
  if (identified && input.checks.score === "confirmed") return "confirmed";
  if (identified) return "probable";
  if (input.strongest.score >= STRONG_SCORE) return "probable";
  if (input.candidates > 1) return "ambiguous";
  return "probable";
}

/**
 * Resultatet avisa oppgir når det er et annet enn kildens.
 *
 * Bare avsnitt som nevner begge lagene teller, og bare når de faktisk har et
 * resultat. Et avvik fra en tabellrad er ikke en konflikt, det er en tabellrad.
 */
function conflictingScore(query: NewspaperQuery, evidence: NewspaperEvidence[]): [number, number] | undefined {
  if (!query.expectedScore) return undefined;
  if (evidence.some((item) => item.scoreMatchesSource === true)) return undefined;

  const candidate = evidence.find((item) =>
    item.sameFragment && item.scoreFound !== undefined && (item.kind === "article" || item.kind === "result_list"));
  return candidate?.scoreFound;
}

function homeAwayCheck(query: NewspaperQuery, evidence: NewspaperEvidence[]): ReconciliationChecks["homeAway"] {
  const found = evidence.find((item) => item.homeAwayFound !== undefined)?.homeAwayFound;
  if (found === undefined || query.homeAwayHint === undefined) return "unknown";
  return found === query.homeAwayHint ? "confirmed" : "conflict";
}
