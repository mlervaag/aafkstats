import { classifyFragment, KIND_WEIGHT } from "./fragment-kind.js";
import { inferMatchDate } from "./date-inference.js";
import { matchScore, parseScores } from "./score-parse.js";
import type { FragmentKind } from "./fragment-kind.js";
import type { TemporalEvidence } from "./date-inference.js";
import type { HomeAwayHint, NoteHints } from "./note-parser.js";

/**
 * Beviset for at én avisutgave dekker én bestemt kamp.
 *
 * ## Hvorfor et objekt og ikke et tall
 *
 * En score på 78 kan ikke etterprøves. Den sier ikke om kampen ble funnet fordi
 * resultatet sto der, eller fordi lagnavnene tilfeldigvis lå tett i en
 * tippekupong. Den som skal godkjenne et funn må se hvilke ledd som holdt, og
 * den som skal forbedre rangeringen må se hvilke ledd som lyver. Derfor bæres
 * hvert signal videre for seg, og tallet er bare summen av dem.
 *
 * ## Hvorfor resultatet aldri felles som krav
 *
 * Sarpsborg-kampen i juli 1948 står som 1-0 i klubbens egen liste og som 2-1 i
 * avisa dagen etter. Kampen er utvilsomt den samme — lagene, banen og datoen
 * stemmer. Hadde resultatet vært et filter, ville kampen blitt borte, og
 * uenigheten som er den mest verdifulle opplysningen her ville aldri blitt
 * oppdaget. Et resultat som stemmer gir derfor uttelling; et som ikke stemmer
 * gir null og en merknad — aldri utestengelse.
 */

export interface NewspaperQuery {
  year: number;
  opponent: string;
  opponentAliases: string[];
  aafkAliases: string[];
  expectedScore?: readonly [number, number];
  competitionHint?: string;
  homeAwayHint?: HomeAwayHint;
  hints?: NoteHints;
  /** Hvor mange kilderesultater sesongen har mot den samme motstanderen. */
  siblingCount?: number;
}

export interface NewspaperEvidence {
  issueId: string;
  issueDate?: string;
  page?: string;
  kind: FragmentKind;

  opponentFound: boolean;
  aafkFound: boolean;
  sameFragment: boolean;

  scoreFound?: [number, number];
  scoreMatchesSource?: boolean;
  /** Avisa førte lagene motsatt vei av kilden — altså bortekamp for AaFK. */
  scoreReversed?: boolean;

  competitionFound?: string;
  homeAwayFound?: HomeAwayHint;
  matchTalk: boolean;
  temporal?: TemporalEvidence;

  score: number;
  reasons: string[];
}

/** Vektene. Samlet på ett sted fordi de skal kunne justeres mot målinger. */
const WEIGHTS = {
  sameFragment: 25,
  exactScore: 25,
  matchTalk: 15,
  homeAwayAgrees: 10,
  competitionAgrees: 10,
  temporalHigh: 12,
  temporalMedium: 8,
  temporalLow: 3,
  opponentOnly: 8,
  aafkOnly: 8,
} as const;

const MATCH_TALK = /\b(kampen|seriekampen|fotballkampen|cupkampen|kampreferat|oppgjøret|omgang|banen|tilskuere|dommer)\b/iu;

/**
 * Beviset ett tekstvindu gir.
 *
 * Vinduet er enheten, ikke utgaven. En avis der motstanderen står på side 4 og
 * AaFK på side 9 har ikke omtalt kampen — den har omtalt to ting.
 */
export function evidenceForFragment(
  text: string,
  query: NewspaperQuery,
  context: { issueId: string; issueDate?: string; page?: string },
): NewspaperEvidence {
  const kind = classifyFragment(text);
  const normalized = normalize(text);
  const reasons: string[] = [];

  const opponentFound = [query.opponent, ...query.opponentAliases].some((name) => includesName(normalized, name));
  const aafkFound = query.aafkAliases.some((name) => includesName(normalized, name));
  const sameFragment = opponentFound && aafkFound;

  let score = KIND_WEIGHT[kind];
  if (KIND_WEIGHT[kind] !== 0) reasons.push(`sjanger: ${kind}`);

  if (sameFragment) {
    score += WEIGHTS.sameFragment;
    reasons.push("motstander og AaFK i samme avsnitt");
  } else if (opponentFound) {
    score += WEIGHTS.opponentOnly;
    reasons.push(`motstander: ${query.opponent}`);
  } else if (aafkFound) {
    score += WEIGHTS.aafkOnly;
    reasons.push("AaFK omtalt");
  }

  const evidence: NewspaperEvidence = {
    issueId: context.issueId,
    ...(context.issueDate ? { issueDate: context.issueDate } : {}),
    ...(context.page ? { page: context.page } : {}),
    kind,
    opponentFound,
    aafkFound,
    sameFragment,
    matchTalk: MATCH_TALK.test(text),
    score: 0,
    reasons,
  };

  if (evidence.matchTalk) {
    score += WEIGHTS.matchTalk;
    reasons.push("omtaler kampen");
  }

  // Resultatet teller bare i et avsnitt som nevner begge lagene. Ellers er det
  // et hvilket som helst sifferpar på en sportsside.
  if (query.expectedScore && sameFragment) {
    const found = matchScore(text, query.expectedScore);
    if (found) {
      evidence.scoreFound = [found.found.home, found.found.away];
      evidence.scoreMatchesSource = true;
      evidence.scoreReversed = found.reversed;
      score += WEIGHTS.exactScore;
      reasons.push(`resultat: ${found.found.raw}${found.reversed ? " (motsatt lagrekkefølge)" : ""}`);
    } else {
      // Avisa har et resultat, men et annet enn kilden. Det er ikke en grunn til
      // å forkaste utgaven — det er selve funnet. Uten at tallet registreres her
      // finnes det ingen konflikt å melde senere, bare en kamp som ikke ble
      // bekreftet.
      const printed = parseScores(text)[0];
      if (printed && (kind === "article" || kind === "result_list")) {
        evidence.scoreFound = [printed.home, printed.away];
        evidence.scoreMatchesSource = false;
        reasons.push(`avisa oppgir ${printed.raw}, kilden ${query.expectedScore.join("-")}`);
      }
    }
  }

  const homeAway = inferHomeAway(text, query);
  if (homeAway !== undefined) {
    evidence.homeAwayFound = homeAway;
    reasons.push(`bane: ${homeAway}`);
  }

  if (query.competitionHint && query.hints?.keywords.some((keyword) => normalized.includes(normalize(keyword)))) {
    evidence.competitionFound = query.competitionHint;
    score += WEIGHTS.competitionAgrees;
    reasons.push(`konkurranse: ${query.competitionHint}`);
  }

  if (query.homeAwayHint && evidence.homeAwayFound === query.homeAwayHint) {
    score += WEIGHTS.homeAwayAgrees;
    reasons.push(`hjemme/borte stemmer: ${query.homeAwayHint}`);
  }

  if (context.issueDate) {
    const temporal = inferMatchDate(text, context.issueDate);
    if (temporal && (sameFragment || evidence.matchTalk)) {
      evidence.temporal = temporal;
      score += temporal.confidence === "high"
        ? WEIGHTS.temporalHigh
        : temporal.confidence === "medium" ? WEIGHTS.temporalMedium : WEIGHTS.temporalLow;
      reasons.push(`tidsuttrykk: «${temporal.phrase}» ⇒ ${temporal.inferredMatchDate}`);
    }
  }

  evidence.score = score;
  return evidence;
}

/** Det sterkeste beviset blant vinduene i én utgave. */
export function bestEvidence(evidence: NewspaperEvidence[]): NewspaperEvidence | undefined {
  return [...evidence].sort((a, b) => b.score - a.score)[0];
}

function includesName(normalizedText: string, name: string): boolean {
  const needle = normalize(name);
  return needle.length >= 2 && normalizedText.includes(needle);
}

const HOME_VENUES = /\b(?:p[aå]\s+kr[aå]myra|kr[aå]myra\s+stadion|\bkr[aå]myra\b|p[aå]\s+aksla|aksla\s+stadion|\baksla\b|i\s+[aå]lesund|i\s+aalesund|p[aå]\s+hjemmebane|hjemmekamp|p[aå]\s+eget\s+gras|p[aå]\s+eget\s+gress)\b/iu;
const AWAY_VENUES = /\b(?:p[aå]\s+bortebane|bortekamp|p[aå]\s+fremmed\s+gras|p[aå]\s+fremmed\s+gress)\b/iu;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchFixtureLine(text: string, query: NewspaperQuery): HomeAwayHint | undefined {
  for (const aafkName of query.aafkAliases) {
    const trimmedAafk = aafkName.trim();
    if (trimmedAafk.length < 2) continue;
    const aafkEsc = escapeRegExp(trimmedAafk);

    for (const oppName of [query.opponent, ...query.opponentAliases]) {
      const trimmedOpp = oppName.trim();
      if (trimmedOpp.length < 2) continue;
      if (trimmedAafk.toLowerCase() === trimmedOpp.toLowerCase()) continue;
      const oppEsc = escapeRegExp(trimmedOpp);

      // Oppsettlinje: "AaFK - Motstander" eller "AaFK—Motstander"
      const homePattern = new RegExp(`(?:^|[\\r\\n•·;.,]|^\\s*|\\b)${aafkEsc}\\s*[-–—:]\\s*${oppEsc}(?:\\b|\\s*[-–—:\\d]|$)`, "iu");
      if (homePattern.test(text)) return "home";

      // Oppsettlinje: "Motstander - AaFK" eller "Motstander—AaFK"
      const awayPattern = new RegExp(`(?:^|[\\r\\n•·;.,]|^\\s*|\\b)${oppEsc}\\s*[-–—:]\\s*${aafkEsc}(?:\\b|\\s*[-–—:\\d]|$)`, "iu");
      if (awayPattern.test(text)) return "away";
    }
  }
  return undefined;
}

/**
 * Utleder hjemme/borte fra tekst KUN når det foreligger entydig belegg:
 * 1. Tydelig oppsettlinje med lagrekkefølge («Lag1 — Lag2» / «Lag1 - Lag2»).
 * 2. Eksplisitt hjemmekamp/bortekamp eller kjent AaFK-hjemmearena (Kråmyra, Aksla, Ålesund).
 *
 * Hvis belegget ikke er entydig, returneres undefined (unknown).
 */
export function inferHomeAway(text: string, query: NewspaperQuery): HomeAwayHint | undefined {
  // 1. Tydelig kampoppsettlinje med lagrekkefølge
  const fixtureOrder = matchFixtureLine(text, query);
  if (fixtureOrder !== undefined) return fixtureOrder;

  // 2. Eksplisitte arena- og stedsangivelser
  const hasHome = HOME_VENUES.test(text);
  const hasAway = AWAY_VENUES.test(text);

  if (hasHome && !hasAway) return "home";
  if (hasAway && !hasHome) return "away";

  return undefined;
}

function normalize(value: string): string {
  return value
    .replace(/<\/?(?:em|strong|b|i)>/gi, " ")
    .toLocaleLowerCase("nb")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

