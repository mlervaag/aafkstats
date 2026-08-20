import type { NewspaperEvent } from "./evidence-cluster.js";
import type { SourceResultQuery } from "./source-result-query.js";

/**
 * Hvilken avishendelse hører til hvilken kamppåstand.
 *
 * ## Hvorfor dette ikke kan avgjøres rad for rad
 *
 * Møtte AaFK Raufoss to ganger i 1963, finnes det to kamper og to sett
 * avisomtale. Vurderes hver kilderad for seg, får begge radene den hendelsen som
 * ser sterkest ut alene — og da havner begge på samme kamp. Det skjedde: rad #27
 * fra juni fikk oktoberkampen, med «høy» tillit.
 *
 * Spørsmålet er ikke «hvilken hendelse passer best til denne raden», men
 * «hvilken fordeling av alle hendelsene på alle radene er best samlet sett». Det
 * er et tilordningsproblem, og det har én hard regel: **én hendelse kan bare
 * tilhøre én kamp.** Er oktoberkampen åpenbart hypotese B sin, er den ikke
 * tilgjengelig for A med mindre helheten blir bedre av byttet.
 *
 * ## Hvorfor rå kraft holder
 *
 * En motstander går igjen to til fem ganger i en sesong. Da er alle mulige
 * fordelinger noen hundre kombinasjoner, og et fullstendig søk er både raskere å
 * forstå og lettere å teste enn en ungarsk algoritme. Grensen er satt der
 * kombinatorikken fortsatt er triviell; over den brukes grådig tildeling, som er
 * god nok når gruppene først er så store at kilden uansett må leses av et
 * menneske.
 */

export interface MatchHypothesis {
  id: string;
  /** Kildepåstandene som handler om den samme antatte kampen. */
  queries: SourceResultQuery[];
  /** Radnummeret i kildens egen liste, brukt som svakt kronologisignal. */
  order: number;
}

export interface Allocation {
  hypothesisId: string;
  /** Den foreslåtte kandidathendelsen fra én-til-én-fordelingen (for inspeksjon og rapportering). */
  candidateEventId?: string;
  /** Akseptert hendelsestildeling (KUN satt dersom alle sikkerhetskrav er oppfylt). */
  eventId?: string;
  decision: "accepted" | "unresolved" | "rejected";
  score: number;
  runnerUpScore: number;
  margin: number;
  confidence: "high" | "medium" | "low";
  alternatives: Array<{ eventId: string; score: number }>;
}

/** Over dette blir fullstendig søk unødvendig dyrt, og grådig tildeling overtar. */
const BRUTE_FORCE_LIMIT = 6;
/** Minste kant-score som kreves for at en hendelse skal kunne tildeles en hypotese. */
export const MINIMUM_EDGE_SCORE = 45;
/** Marginen mot nest beste alternativ som kreves for high confidence. */
export const HIGH_MARGIN = 8;
export const MEDIUM_MARGIN = 4;


function scoreMatches(scoreFound: [number, number], expectedScore: readonly [number, number]): boolean {
  return (
    (scoreFound[0] === expectedScore[0] && scoreFound[1] === expectedScore[1]) ||
    (scoreFound[0] === expectedScore[1] && scoreFound[1] === expectedScore[0])
  );
}

/**
 * Kompatibiliteten mellom én kamppåstand og én avishendelse.
 *
 * Minstekrav for en gyldig kant:
 * 1. Eventet må ha minst ett fragment som omtaler begge lag (sameFragment),
 *    eller et eksplisitt resultat som matcher kilden.
 * 2. Merk at et avvikende resultat ikke gir straffefradrag (kilden kan ta
 *    feil av sifrene), men treff gir positiv uttelling.
 */
export function edgeScore(hypothesis: MatchHypothesis, event: NewspaperEvent): number {
  const best = event.evidence[0];

  if (!best) return 0;

  const hasSameFragment = event.evidence.some((item) => item.sameFragment);
  const scores = hypothesis.queries.flatMap((query) => (query.expectedScore ? [query.expectedScore] : []));
  const printed = event.evidence.find((item) => item.scoreFound !== undefined)?.scoreFound;
  const hasScoreMatch = printed && scores.some((expected) => scoreMatches(printed, expected));

  // Uten felles avsnitt eller resultatmatch er det ingen beviselig kobling til kampen.
  if (!hasSameFragment && !hasScoreMatch) {
    return 0;
  }

  // Hendelser med lav datokonfidens og uten resultatmatch har for svak kvalitet
  if (!hasScoreMatch && event.dateConfidence === "low" && event.score < 55) {
    return 0;
  }

  let score = event.score;

  // Enhver av kildepåstandene som stemmer med avisas tall teller.
  if (printed && scores.some((expected) => expected[0] === printed[0] && expected[1] === printed[1])) {
    score += 20;
  } else if (printed && scores.some((expected) => expected[0] === printed[1] && expected[1] === printed[0])) {
    score += 15;
  }

  const homeAway = event.evidence.find((item) => item.homeAwayFound !== undefined)?.homeAwayFound;
  if (homeAway && hypothesis.queries.some((query) => query.homeAwayHint === homeAway)) {
    score += 10;
  }

  if (hypothesis.queries.some((q) => q.competitionHint && event.evidence.some((e) => e.competitionFound === q.competitionHint))) {
    score += 15;
  } else if (event.evidence.some((item) => item.competitionFound !== undefined)) {
    score += 10;
  }

  if (event.evidence.some((item) => item.kind === "article")) {
    score += 10;
  }

  if (event.evidence.length > 1) {
    score += 5;
  }

  const finalScore = Math.round(score);
  return finalScore >= MINIMUM_EDGE_SCORE ? finalScore : 0;
}

/**
 * Beste én-til-én-fordeling av hendelser på kamppåstander.
 *
 * En påstand kan stå uten hendelse. Det er et gyldig utfall — noen kamper er
 * ikke dekket i avisa — og langt bedre enn å tvinge fram en tildeling.
 */
export function allocateEvents(hypotheses: MatchHypothesis[], events: NewspaperEvent[]): Allocation[] {
  if (hypotheses.length === 0) return [];

  const edges = new Map<string, Map<string, number>>();
  for (const hypothesis of hypotheses) {
    const row = new Map<string, number>();
    for (const event of events) row.set(event.id, edgeScore(hypothesis, event));
    edges.set(hypothesis.id, row);
  }

  // Identifiser symmetriske hypoteser: like scorer og hint med identiske kant-scorer
  const symmetricHypothesisIds = new Set<string>();
  for (let i = 0; i < hypotheses.length; i++) {
    for (let j = i + 1; j < hypotheses.length; j++) {
      const h1 = hypotheses[i]!;
      const h2 = hypotheses[j]!;
      const q1 = h1.queries[0]!;
      const q2 = h2.queries[0]!;
      const sameScore = q1.expectedScore && q2.expectedScore &&
        q1.expectedScore[0] === q2.expectedScore[0] && q1.expectedScore[1] === q2.expectedScore[1];
      const sameHints = q1.competitionHint === q2.competitionHint && q1.homeAwayHint === q2.homeAwayHint;
      if (sameScore && sameHints) {
        const row1 = edges.get(h1.id)!;
        const row2 = edges.get(h2.id)!;
        let identical = true;
        for (const ev of events) {
          if ((row1.get(ev.id) ?? 0) !== (row2.get(ev.id) ?? 0)) {
            identical = false;
            break;
          }
        }
        if (identical) {
          symmetricHypothesisIds.add(h1.id);
          symmetricHypothesisIds.add(h2.id);
        }
      }
    }
  }

  const assignments = hypotheses.length <= BRUTE_FORCE_LIMIT && events.length <= BRUTE_FORCE_LIMIT * 2
    ? allAssignments(hypotheses, events)
    : [greedyAssignment(hypotheses, events, edges)];

  const scored = assignments
    .map((assignment) => ({ assignment, total: totalScore(assignment, edges, hypotheses, events) }))
    .sort((a, b) => b.total - a.total);

  const best = scored[0]!;
  const byId = new Map(events.map((e) => [e.id, e]));

  return hypotheses.map((hypothesis) => {
    const isSymmetric = symmetricHypothesisIds.has(hypothesis.id);
    const assignedEventId = isSymmetric ? undefined : best.assignment.get(hypothesis.id);
    const row = edges.get(hypothesis.id)!;
    const rawScore = assignedEventId ? (row.get(assignedEventId) ?? 0) : 0;
    const candidateEventId = assignedEventId && rawScore >= MINIMUM_EDGE_SCORE ? assignedEventId : undefined;
    const score = candidateEventId ? rawScore : 0;
    const candidateEvent = candidateEventId ? byId.get(candidateEventId) : undefined;

    // Beregn margin mot beste reelle alternative fordeling der denne hypotesen
    // IKKE tildeles candidateEventId.
    let margin = 0;
    let runnerUpScore = 0;
    if (candidateEventId) {
      if (scored.length > 1) {
        // Fullstendig søk: finn beste komplette fordeling der hypotesen ikke har denne hendelsen
        const runnerUpAssignment = scored.find(
          (a) => a.assignment.get(hypothesis.id) !== candidateEventId,
        );
        if (runnerUpAssignment) {
          margin = Math.max(0, best.total - runnerUpAssignment.total);
          const altEventId = runnerUpAssignment.assignment.get(hypothesis.id);
          runnerUpScore = altEventId ? (row.get(altEventId) ?? 0) : 0;
        } else {
          margin = score;
        }
      } else {
        // Greedy fallback: konservativ margin mot beste kvalifiserte alternative hendelse
        const competingScores = [...row.entries()]
          .filter(([id, val]) => id !== candidateEventId && val >= MINIMUM_EDGE_SCORE)
          .map(([, val]) => val)
          .sort((a, b) => b - a);
        runnerUpScore = competingScores[0] ?? 0;
        margin = Math.max(0, score - runnerUpScore);
      }
    }

    // Tidskausalt bevis og kildebevis:
    const isHighDate = candidateEvent?.inferredDate !== undefined &&
      (candidateEvent.dateConfidence === "high" || candidateEvent.dateConfidence === "medium");
    const isMediumDate = candidateEvent?.inferredDate !== undefined;


    const hasSameFragment = candidateEvent?.evidence.some((e) => e.sameFragment) ?? false;
    const hasCompetitionMatch = hypothesis.queries.some(
      (q) => q.competitionHint && candidateEvent?.evidence.some((e) => e.competitionFound === q.competitionHint),
    );



    // Sjekk om det finnes uoppklarte tidligere søsken i samme gruppe.
    // En senere kildepåstand kan ikke få high confidence uten eksplisitt konkurransebevis
    // dersom tidligere kamper mot samme motstander er uavklarte (som Kvik #28 etter #19/#21).
    const hasUnresolvedPrecedingSibling = hypotheses.some(
      (h) => h.order < hypothesis.order && (!best.assignment.get(h.id) || symmetricHypothesisIds.has(h.id)),
    );

    const hasPrintedScore = candidateEvent?.evidence.some((e) => e.scoreFound !== undefined) ?? false;

    // Confidence-krav:
    // 1. En negativ eller null margin kan ALDRI gi medium eller high confidence.
    // 2. High krever tidskausalt bevis (high date), felles omtale i samme avsnitt,
    //    at avisen rapporterer et kampresultat (enten matchende eller reell konflikt),
    //    at foregående søsken ikke er uoppklart (eller cupmatch),
    //    sterk margin (>= HIGH_MARGIN) og god score (>= 55).
    // 3. Reconcile alene avgjør om allokeringen ender som confirmed eller conflict.
    // 4. Medium krever tidskausalt bevis (medium date), positiv margin (>= MEDIUM_MARGIN) og score (>= 45).
    let confidence: "high" | "medium" | "low" = "low";
    if (candidateEventId && !isSymmetric && margin > 0) {
      const passesPrecedingCheck = !hasUnresolvedPrecedingSibling || hasCompetitionMatch;
      if (
        isHighDate &&
        hasSameFragment &&
        hasPrintedScore &&
        passesPrecedingCheck &&
        margin >= HIGH_MARGIN &&
        score >= 55
      ) {
        confidence = "high";
      } else if (isMediumDate && margin >= MEDIUM_MARGIN && score >= 45) {
        confidence = "medium";
      }
    }





    // Akseptert tildeling krever at sikkerhetskravene er oppfylt (high confidence).
    // Ikke-aksepterte allokeringer forblir uavklarte eller avviste.
    const isAccepted = confidence === "high" && candidateEventId !== undefined && !isSymmetric;
    const decision: Allocation["decision"] = isAccepted
      ? "accepted"
      : isSymmetric || !candidateEventId
        ? "rejected"
        : "unresolved";

    const eventId = isAccepted ? candidateEventId : undefined;

    return {
      hypothesisId: hypothesis.id,
      ...(candidateEventId ? { candidateEventId } : {}),
      ...(eventId ? { eventId } : {}),
      decision,
      score,
      runnerUpScore,
      margin,
      confidence,
      alternatives: [...row]
        .filter(([id, val]) => id !== candidateEventId && val > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, val]) => ({ eventId: id, score: val })),
    };
  });
}

/** Alle måter hendelsene kan fordeles på, inkludert å la påstander stå tomme. */

function allAssignments(hypotheses: MatchHypothesis[], events: NewspaperEvent[]): Array<Map<string, string | undefined>> {
  const results: Array<Map<string, string | undefined>> = [];

  const walk = (index: number, used: Set<string>, current: Map<string, string | undefined>): void => {
    if (index === hypotheses.length) {
      results.push(new Map(current));
      return;
    }
    const hypothesis = hypotheses[index]!;
    for (const event of events) {
      if (used.has(event.id)) continue;
      current.set(hypothesis.id, event.id);
      used.add(event.id);
      walk(index + 1, used, current);
      used.delete(event.id);
    }
    current.set(hypothesis.id, undefined);
    walk(index + 1, used, current);
  };

  walk(0, new Set(), new Map());
  return results;
}

function greedyAssignment(
  hypotheses: MatchHypothesis[],
  events: NewspaperEvent[],
  edges: Map<string, Map<string, number>>,
): Map<string, string | undefined> {
  const pairs = hypotheses.flatMap((hypothesis) =>
    events.map((event) => ({ hypothesis: hypothesis.id, event: event.id, score: edges.get(hypothesis.id)!.get(event.id)! })));
  pairs.sort((a, b) => b.score - a.score);

  const assignment = new Map<string, string | undefined>(hypotheses.map((hypothesis) => [hypothesis.id, undefined]));
  const usedEvents = new Set<string>();
  for (const pair of pairs) {
    if (assignment.get(pair.hypothesis) !== undefined || usedEvents.has(pair.event) || pair.score <= 0) continue;
    assignment.set(pair.hypothesis, pair.event);
    usedEvents.add(pair.event);
  }
  return assignment;
}

/**
 * Summen av en fordeling, med kronologi som mykt tillegg.
 *
 * Kildens rekkefølge er et signal, ikke en lov: den retrospektive lista er alt
 * tatt i å ta feil om andre ting. Står to kamper i rekkefølge og hendelsene
 * ligger i samme rekkefølge, teller det litt; er de byttet om, teller det litt
 * imot. Sterk samtidig avisdekning skal fortsatt kunne overstyre lista.
 */
function totalScore(
  assignment: Map<string, string | undefined>,
  edges: Map<string, Map<string, number>>,
  hypotheses: MatchHypothesis[],
  events: NewspaperEvent[],
): number {
  const dates = new Map(events.map((event) => [event.id, event.inferredDate]));
  let total = 0;

  for (const [hypothesisId, eventId] of assignment) {
    if (eventId) total += edges.get(hypothesisId)!.get(eventId)!;
  }

  for (const [index, first] of hypotheses.entries()) {
    for (const second of hypotheses.slice(index + 1)) {
      const firstDate = dates.get(assignment.get(first.id) ?? "");
      const secondDate = dates.get(assignment.get(second.id) ?? "");
      if (!firstDate || !secondDate) continue;
      const inOrder = first.order < second.order === (firstDate < secondDate);
      total += inOrder ? 10 : -10;
    }
  }

  return total;
}

