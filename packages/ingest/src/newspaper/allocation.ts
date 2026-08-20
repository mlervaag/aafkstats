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
  eventId?: string;
  score: number;
  /** Nest beste fordeling totalt, og avstanden opp til den beste. */
  runnerUpScore: number;
  margin: number;
  confidence: "high" | "medium" | "low";
  alternatives: Array<{ eventId: string; score: number }>;
}

/** Over dette blir fullstendig søk unødvendig dyrt, og grådig tildeling overtar. */
const BRUTE_FORCE_LIMIT = 6;
/** Marginen mellom beste og nest beste fordeling som skiller sikkert fra usikkert. */
const HIGH_MARGIN = 25;
const MEDIUM_MARGIN = 10;

/**
 * Kompatibiliteten mellom én kamppåstand og én avishendelse.
 *
 * Merk at et avvikende resultat ikke gir fradrag. Kilden kan ta feil av
 * resultatet uten å ta feil av at kampen fant sted — det er hele Sarpsborg-
 * tilfellet — så et avvik skal gi mindre uttelling enn et treff, ikke straff.
 */
export function edgeScore(hypothesis: MatchHypothesis, event: NewspaperEvent): number {
  const best = event.evidence[0];
  if (!best) return 0;

  let score = event.score;

  // Enhver av kildepåstandene som stemmer med avisas tall teller. Er kildene
  // uenige med hverandre, holder det at én av dem treffer.
  const scores = hypothesis.queries.flatMap((query) => (query.expectedScore ? [query.expectedScore] : []));
  const printed = event.evidence.find((item) => item.scoreFound !== undefined)?.scoreFound;
  if (printed && scores.some((expected) => expected[0] === printed[0] && expected[1] === printed[1])) score += 20;
  else if (printed && scores.some((expected) => expected[0] === printed[1] && expected[1] === printed[0])) score += 15;

  const homeAway = event.evidence.find((item) => item.homeAwayFound !== undefined)?.homeAwayFound;
  if (homeAway && hypothesis.queries.some((query) => query.homeAwayHint === homeAway)) score += 10;

  if (event.evidence.some((item) => item.competitionFound !== undefined)) score += 10;
  if (event.evidence.some((item) => item.kind === "article")) score += 10;
  if (event.evidence.length > 1) score += 5;

  return Math.round(score);
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

  const assignments = hypotheses.length <= BRUTE_FORCE_LIMIT && events.length <= BRUTE_FORCE_LIMIT * 2
    ? allAssignments(hypotheses, events)
    : [greedyAssignment(hypotheses, events, edges)];

  const scored = assignments
    .map((assignment) => ({ assignment, total: totalScore(assignment, edges, hypotheses, events) }))
    .sort((a, b) => b.total - a.total);

  const best = scored[0]!;
  const runnerUp = scored.find((candidate) => !sameAssignment(candidate.assignment, best.assignment));
  const margin = best.total - (runnerUp?.total ?? 0);

  return hypotheses.map((hypothesis) => {
    const eventId = best.assignment.get(hypothesis.id);
    const row = edges.get(hypothesis.id)!;
    return {
      hypothesisId: hypothesis.id,
      ...(eventId ? { eventId } : {}),
      score: eventId ? row.get(eventId)! : 0,
      runnerUpScore: runnerUp?.total ?? 0,
      margin,
      confidence: hypotheses.length === 1 || margin >= HIGH_MARGIN ? "high" : margin >= MEDIUM_MARGIN ? "medium" : "low",
      alternatives: [...row]
        .filter(([id, value]) => id !== eventId && value > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, value]) => ({ eventId: id, score: value })),
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

function sameAssignment(left: Map<string, string | undefined>, right: Map<string, string | undefined>): boolean {
  for (const [key, value] of left) if (right.get(key) !== value) return false;
  return true;
}
