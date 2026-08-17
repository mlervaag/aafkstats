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
 * Hele gruppen under ett: ett søk, hendelser, global fordeling, så avstemming.
 *
 * Rekkefølgen er poenget. Avstemmingen får bare de bevisene som faktisk ble
 * tildelt kamppåstanden — ikke alt som nevner motstanderen i sesongen. Da kan
 * ikke oktoberkampen lenger datere junikampen, uansett hvor sterk den ser ut
 * alene.
 */
export async function discoverForGroup(
  hypotheses: MatchHypothesis[],
  options: DiscoveryOptions = {},
): Promise<Map<string, DiscoveryResult & { allocation: Allocation; event?: NewspaperEvent }>> {
  const lead = hypotheses[0]?.queries[0];
  if (!lead) return new Map();

  // Gruppen deler år og motstander, så ett søk dekker alle påstandene i den.
  const issues = await discoverNewspaperIssues(lead, options);
  const ranked = issues
    .map((issue) => ({ issue, evidence: verifyNewspaperCandidate(lead, issue) }))
    .filter((candidate) => candidate.evidence !== undefined)
    // Utgaver som alt har begge lagene i samme avsnitt berikes først. De koster
    // like mye som de andre, men det er blant dem kampomtalen ligger — og en
    // utgave som aldri blir beriket, får sjelden noe tidsuttrykk å datere med.
    .sort((a, b) => Number(b.evidence!.sameFragment) - Number(a.evidence!.sameFragment)
      || b.evidence!.score - a.evidence!.score);

  // Berik flere når gruppen har flere påstander: da skal hendelsene skilles fra
  // hverandre, og det krever tekst nok til å se hvilken kamp hver omtaler.
  // Berikelsen er det som skiller hendelsene fra hverandre: uten teksten rundt
  // treffet har en utgave sjelden noe tidsuttrykk, og da havner den i ingen
  // hendelse. Fem per påstand er målt til å dekke både forhåndsomtale,
  // kampdag og referat for de tilfellene som er kontrollert.
  const budget = (options.enrich ?? 5) * Math.max(1, hypotheses.length);
  for (const candidate of ranked.slice(0, budget)) {
    await enrichIssue(candidate.issue, lead, options);
    candidate.evidence = verifyNewspaperCandidate(lead, candidate.issue);
  }

  const events = clusterEvidence(ranked.flatMap((candidate) => (candidate.evidence ? [candidate.evidence] : [])));
  const allocations = allocateEvents(hypotheses, events);
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
      // Fordelingen er usikker når nest beste løsning ligger tett opptil. Da er
      // ikke en enkelt sterk kant nok til å kalle kampen bekreftet.
      status: reconciled.status !== "not_found" && allocation.confidence === "low" ? "ambiguous" : reconciled.status,
      allocation,
      ...(event ? { event } : {}),
    });
  }
  return results;
}
