import { fetchJson } from "../http.js";
import {
  buildContentFragmentsUrl,
  buildNewspaperSearchUrl,
  newspaperTitleForYear,
} from "../adapters/nb-newspaper-search.js";
import { readAccess } from "../adapters/nb-newspaper-access.js";
import { bestEvidence, evidenceForFragment } from "./evidence.js";
import { reconcile } from "./reconciliation.js";
import { clusterEvidence } from "./evidence-cluster.js";
import { allocateEvents } from "./allocation.js";
import type { MatchHypothesis, Allocation } from "./allocation.js";
import type { NewspaperEvent } from "./evidence-cluster.js";
import type { NewspaperEvidence } from "./evidence.js";
import type { DiscoveryResult } from "./reconciliation.js";
import type { SourceResultQuery } from "./source-result-query.js";

/**
 * Discovery: finn utgavene. Verification: se hva de faktisk sier.
 *
 * ## Hvorfor stegene er skilt
 *
 * Discovery er et grovt garn — motstanderen sammen med hver av AaFKs
 * skrivemåter — og skal fange bredt. Verification er kildekritikk: står lagene i
 * samme avsnitt, er det et referat eller en tippekupong, hva sier teksten om
 * tid. Blandes de, blir søket enten for smalt til å finne noe eller for løst til
 * å tro på.
 *
 * ## Hvorfor treffene caches på år og motstander
 *
 * Arkivet har over 1600 kilderesultater uten kobling, og de samme lagene går
 * igjen: møtte AaFK Kvik tre ganger i 1963, er det de samme avisutgavene som er
 * aktuelle for alle tre. Uten cache blir det tre identiske runder mot NB. Med
 * cache hentes årgangen én gang, og hver rad vurderes mot det samme
 * treffsettet — det er også slik man i det hele tatt kan skille kampene fra
 * hverandre, siden de ligger i det samme materialet.
 */

interface NbItem {
  id: string;
  accessInfo?: { viewability?: string; accessAllowedFrom?: string; license?: string; isPublicDomain?: boolean; legalDepositLoginText?: string };
  metadata?: { title?: string; identifiers?: { urn?: string }; originInfo?: { issued?: string } };
  contentFragments?: Array<{ pageNumber?: string; pageid?: string; text?: string }>;
}

export interface DiscoveredIssue {
  id: string;
  issued?: string;
  urn?: string;
  itemUrl: string;
  newspaper: string;
  mayStoreFullText: boolean;
  fragments: Array<{ page?: string; text: string }>;
}

export interface DiscoveryOptions {
  newspaper?: string;
  /**
   * Utgaver per søkevariant.
   *
   * Hundre, ikke tjuefem. En årgang har rundt tre hundre utgaver, og et søk på
   * motstander pluss AaFK treffer typisk noen titalls av dem — Clausenengen i
   * 1952 gir 34. Med 25 så vi et utvalg søketjenesten valgte for oss, og den
   * utgaven som faktisk hadde kampreferatet lå ofte utenfor. Med 100 får vi hele
   * treffmengden i ett kall for de aller fleste år og motstandere.
   */
  limit?: number;
  /** Utgaver som får et eget OCR-oppslag for å hente hele kampavsnittet. */
  enrich?: number;
  from?: string;
  to?: string;
  refresh?: boolean;
  cache?: IssueCache;
  onRequest?: (url: string) => void;
}

/** Treffsettet for ett år og én motstander, delt mellom alle radene som gjelder det. */
export type IssueCache = Map<string, DiscoveredIssue[]>;

export function createIssueCache(): IssueCache {
  return new Map();
}

export function cacheKey(query: SourceResultQuery, newspaper: string, options: DiscoveryOptions): string {
  return [newspaper, query.year, query.opponent.toLocaleLowerCase("nb"), options.from ?? "", options.to ?? ""].join("|");
}

export async function discoverNewspaperIssues(
  query: SourceResultQuery,
  options: DiscoveryOptions = {},
): Promise<DiscoveredIssue[]> {
  const newspaper = options.newspaper ?? newspaperTitleForYear(query.year);
  const key = cacheKey(query, newspaper, options);
  const cached = options.cache?.get(key);
  if (cached) return cached;

  const byId = new Map<string, DiscoveredIssue>();
  for (const alias of query.aafkAliases.slice(0, 4)) {
    const url = buildNewspaperSearchUrl(`${query.opponent} ${alias}`, {
      year: query.year,
      newspaper,
      ...(options.from ? { from: options.from } : {}),
      ...(options.to ? { to: options.to } : {}),
      limit: options.limit ?? 100,
    });
    options.onRequest?.(url);
    const response = await fetchJson<{ _embedded?: { items?: NbItem[] } }>(url, { ...(options.refresh ? { refresh: true } : {}) });

    for (const item of response._embedded?.items ?? []) {
      const issue = byId.get(item.id) ?? toIssue(item, newspaper);
      issue.fragments = mergeFragments(issue.fragments, fragmentsOf(item));
      byId.set(item.id, issue);
    }
  }

  const issues = [...byId.values()];
  options.cache?.set(key, issues);
  return issues;
}

/**
 * Hent hele kampavsnittet for de utgavene det er verdt å bruke et kall på.
 *
 * Spørringen bruker motstander og AaFK sammen, ikke motstanderen alene. Det er
 * kampavsnittet vi vil ha, og søketjenesten gir vinduene rundt ordene den blir
 * spurt om — spør man bare om «Raufoss», kan man få leserbrevet om
 * ammunisjonsfabrikken.
 */
export async function enrichIssue(
  issue: DiscoveredIssue,
  query: SourceResultQuery,
  options: DiscoveryOptions = {},
): Promise<DiscoveredIssue> {
  const terms = [`${query.opponent} ${query.aafkAliases[0] ?? "ÅFK"}`, query.opponent];
  for (const term of terms) {
    const url = buildContentFragmentsUrl(issue.id, term);
    options.onRequest?.(url);
    const response = await fetchJson<{ contentFragments?: Array<{ pageNumber?: string; text?: string }> }>(
      url,
      { ...(options.refresh ? { refresh: true } : {}) },
    );
    const found = (response.contentFragments ?? [])
      .filter((fragment): fragment is { pageNumber?: string; text: string } => typeof fragment.text === "string")
      .map((fragment) => ({ ...(fragment.pageNumber ? { page: fragment.pageNumber } : {}), text: fragment.text }));
    issue.fragments = mergeFragments(issue.fragments, found);
    if (found.length > 0) break;
  }
  return issue;
}

/** Beviset én utgave gir for kampen — det sterkeste vinduet i den. */
export function verifyNewspaperCandidate(query: SourceResultQuery, issue: DiscoveredIssue): NewspaperEvidence | undefined {
  return bestEvidence(issue.fragments.map((fragment) => evidenceForFragment(fragment.text, query, {
    issueId: issue.id,
    ...(issue.issued ? { issueDate: issue.issued } : {}),
    ...(fragment.page ? { page: fragment.page } : {}),
  })));
}

/**
 * Hele veien for én rad: finn utgaver, berik de beste, avstem.
 *
 * Berikelsen er progressiv. Er den beste kandidaten klart sterkest etter det
 * grove søket, koster det ingenting mer å slå fast; ligger to kandidater tett,
 * hentes flere. Det holder API-bruken nede uten at riktig utgave faller ut fordi
 * den lå på femteplass i første runde.
 */
export async function discoverForSourceResult(
  query: SourceResultQuery,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult & { issues: DiscoveredIssue[] }> {
  const issues = await discoverNewspaperIssues(query, options);
  const ranked = issues
    .map((issue) => ({ issue, evidence: verifyNewspaperCandidate(query, issue) }))
    .sort((a, b) => (b.evidence?.score ?? 0) - (a.evidence?.score ?? 0));

  const budget = options.enrich ?? 3;
  const close = ranked.length > 1 && (ranked[0]!.evidence?.score ?? 0) - (ranked[1]!.evidence?.score ?? 0) < 15;
  const toEnrich = ranked.slice(0, close ? budget * 2 : budget);

  for (const candidate of toEnrich) {
    await enrichIssue(candidate.issue, query, options);
    candidate.evidence = verifyNewspaperCandidate(query, candidate.issue);
  }

  const evidence = ranked.flatMap((candidate) => (candidate.evidence ? [candidate.evidence] : []));
  return { ...reconcile(query, evidence), issues: toEnrich.map((candidate) => candidate.issue) };
}

function toIssue(item: NbItem, newspaper: string): DiscoveredIssue {
  const issued = item.metadata?.originInfo?.issued;
  const access = readAccess(item.accessInfo, newspaper, issued);
  return {
    id: item.id,
    ...(issued ? { issued } : {}),
    ...(item.metadata?.identifiers?.urn ? { urn: item.metadata.identifiers.urn } : {}),
    itemUrl: `https://www.nb.no/items/${item.id}`,
    newspaper,
    mayStoreFullText: access.mayStoreFullText,
    fragments: fragmentsOf(item),
  };
}

function fragmentsOf(item: NbItem): Array<{ page?: string; text: string }> {
  return (item.contentFragments ?? [])
    .filter((fragment): fragment is { pageNumber?: string; text: string } => typeof fragment.text === "string")
    .map((fragment) => ({ ...(fragment.pageNumber ? { page: fragment.pageNumber } : {}), text: fragment.text }));
}

function mergeFragments(
  left: Array<{ page?: string; text: string }>,
  right: Array<{ page?: string; text: string }>,
): Array<{ page?: string; text: string }> {
  const seen = new Map<string, { page?: string; text: string }>();
  for (const fragment of [...left, ...right]) seen.set(`${fragment.page ?? ""}|${fragment.text}`, fragment);
  return [...seen.values()];
}

/**
 * Hele gruppen under ett: ett søk, berikelse med spredning i tid, hendelser,
 * global fordeling, og til slutt avstemming på det hver kamp faktisk fikk.
 */
export async function discoverForGroup(
  hypotheses: MatchHypothesis[],
  options: DiscoveryOptions = {},
): Promise<Map<string, DiscoveryResult & { allocation: Allocation; event?: NewspaperEvent }>> {
  const lead = hypotheses[0]?.queries[0];
  if (!lead) return new Map();

  const issues = await discoverNewspaperIssues(lead, options);
  const candidates = issues
    .map((issue) => ({ issue, evidence: verifyNewspaperCandidate(lead, issue) }))
    .filter((candidate): candidate is { issue: DiscoveredIssue; evidence: NewspaperEvidence } => candidate.evidence !== undefined);

  const enriched = new Set<string>();
  const enrich = async (chosen: Array<{ issue: DiscoveredIssue; evidence: NewspaperEvidence }>): Promise<void> => {
    for (const candidate of chosen) {
      if (enriched.has(candidate.issue.id)) continue;
      enriched.add(candidate.issue.id);
      await enrichIssue(candidate.issue, lead, options);
      const evidence = verifyNewspaperCandidate(lead, candidate.issue);
      if (evidence) candidate.evidence = evidence;
    }
  };

  await enrich(spreadOverMonths(candidates, hypotheses.length, options.enrich ?? 3));

  let events = clusterEvidence(candidates.map((candidate) => candidate.evidence));
  let allocations = allocateEvents(hypotheses, events);

  // Tredje pass: er fordelingen usikker, eller finnes det færre hendelser enn
  // kamper, utvides berikelsen rundt de månedene som er i spill. Ekstra oppslag
  // koster bare noe når de kan endre svaret.
  const unresolved = allocations.some((allocation) => allocation.confidence === "low" || allocation.eventId === undefined);
  if (unresolved || events.length < hypotheses.length) {
    await enrich(aroundMonths(candidates, monthsInPlay(events, allocations), 2));
    events = clusterEvidence(candidates.map((candidate) => candidate.evidence));
    allocations = allocateEvents(hypotheses, events);
  }

  const byId = new Map(events.map((event) => [event.id, event]));
  const results = new Map<string, DiscoveryResult & { allocation: Allocation; event?: NewspaperEvent }>();
  for (const allocation of allocations) {
    const hypothesis = hypotheses.find((candidate) => candidate.id === allocation.hypothesisId)!;
    const event = allocation.eventId ? byId.get(allocation.eventId) : undefined;
    const query = hypothesis.queries[0]!;
    // Uten tildelt hendelse finnes det ingen bevis for denne påstanden — og det
    // skal se ut som ingenting, ikke som det nest beste.
    const reconciled = reconcile(query, event?.evidence ?? []);
    results.set(allocation.hypothesisId, {
      ...reconciled,
      status: reconciled.status !== "not_found" && allocation.confidence === "low" ? "ambiguous" : reconciled.status,
      allocation,
      ...(event ? { event } : {}),
    });
  }
  return results;
}

/**
 * Hvilke utgaver som skal få OCR-oppslag: spredning i tid før styrke.
 *
 * ## Hvorfor de globalt beste ikke duger
 *
 * Sarpsborg-kampen i juli 1948 viser det. Årets grove treffsett har sterke
 * kandidater i juni og oktober — en annen kamp, oppsummeringer, tabellstoff — og
 * julitreffene ligger under dem alle. Tar man de N beste i året, blir juli aldri
 * beriket, og en utgave uten beriket tekst har sjelden noe tidsuttrykk. Da
 * bygges julihendelsen aldri, og fordelingen kan ikke velge det den ikke har
 * fått se.
 *
 * Derfor tas den beste kandidaten i hver måned først. Det koster omtrent det
 * samme som en topp-sju-liste, men dekker sesongen i stedet for å dublere den
 * kampen som allerede er godt dekket. Deretter fylles resten opp etter styrke.
 *
 * Budsjettet vokser med antall kamper i gruppen: skal to kamper skilles, må
 * discovery finne minst to hendelser, uansett hvor sterk den ene er.
 */
/** Utgaver per måned som får OCR-oppslag i første pass. */
const PER_MONTH = 2;

export function spreadOverMonths(
  candidates: Array<{ issue: DiscoveredIssue; evidence: NewspaperEvidence }>,
  hypothesisCount: number,
  perHypothesis: number,
): Array<{ issue: DiscoveredIssue; evidence: NewspaperEvidence }> {
  const strongestFirst = [...candidates].sort((a, b) =>
    Number(b.evidence.sameFragment) - Number(a.evidence.sameFragment) || b.evidence.score - a.evidence.score);

  // To per måned, ikke én. En måned har rundt tjuefem utgaver, og kampreferatet
  // er ikke alltid den best rangerte av dem etter det grove søket — med bare én
  // per måned falt riktig juniutgave ut, og junikampen mistet datoen sin.
  const chosen: Array<{ issue: DiscoveredIssue; evidence: NewspaperEvidence }> = [];
  const perMonthCount = new Map<string, number>();
  for (const candidate of strongestFirst) {
    const month = monthOf(candidate.issue);
    if (month === undefined) continue;
    const used = perMonthCount.get(month) ?? 0;
    if (used >= PER_MONTH) continue;
    perMonthCount.set(month, used + 1);
    chosen.push(candidate);
  }

  const budget = Math.max(chosen.length, perHypothesis * Math.max(1, hypothesisCount));
  for (const candidate of strongestFirst) {
    if (chosen.length >= budget) break;
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }

  return chosen;
}

/** De beste ubrukte kandidatene i de månedene fordelingen fortsatt er i tvil om. */
function aroundMonths(
  candidates: Array<{ issue: DiscoveredIssue; evidence: NewspaperEvidence }>,
  months: Set<string>,
  perMonth: number,
): Array<{ issue: DiscoveredIssue; evidence: NewspaperEvidence }> {
  const chosen: Array<{ issue: DiscoveredIssue; evidence: NewspaperEvidence }> = [];
  for (const month of months) {
    chosen.push(...candidates
      .filter((candidate) => monthOf(candidate.issue) === month)
      .sort((a, b) => b.evidence.score - a.evidence.score)
      .slice(0, perMonth));
  }
  return chosen;
}

/**
 * Månedene som er i spill: rundt de tildelte hendelsene, og rundt dem som
 * konkurrerte om å bli det. Naboene tas med fordi en kamp legger igjen spor
 * både før og etter kampdagen.
 */
function monthsInPlay(events: NewspaperEvent[], allocations: Allocation[]): Set<string> {
  const ids = new Set(allocations.flatMap((allocation) => [
    ...(allocation.eventId ? [allocation.eventId] : []),
    ...allocation.alternatives.map((alternative) => alternative.eventId),
  ]));

  const months = new Set<string>();
  for (const event of events) {
    if (!ids.has(event.id)) continue;
    const date = event.inferredDate ?? event.evidence[0]?.issueDate;
    const month = date?.replace(/-/g, "").slice(0, 6);
    if (month === undefined) continue;
    months.add(month);
    months.add(shiftMonth(month, -1));
    months.add(shiftMonth(month, 1));
  }
  return months;
}

function monthOf(issue: DiscoveredIssue): string | undefined {
  return issue.issued?.slice(0, 6);
}

function shiftMonth(month: string, delta: number): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(4, 6)) - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
