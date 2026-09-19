import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { AAFK_CLUB_ID } from "@aafkstats/schema";
import type { Club, Match } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import {
  buildContentFragmentsUrl,
  buildNewspaperSearchUrl,
  newspaperSearchQueries,
  newspaperTitleForYear,
  scoreFragment,
  stripSearchMarkup,
  type NewspaperMatchQuery,
} from "../adapters/nb-newspaper-search.js";
import { clubNames } from "../adapters/nb-newspaper-batch.js";
import { shortHash, splitForGroup, type PilotLabel, type PilotSample } from "./newspaper-pilot.js";

interface ReviewManifest {
  entries: ReviewEntry[];
}

interface ReviewEntry {
  matchId: string;
  canonicalLinked?: boolean;
  issueId?: string;
  issued?: string;
  page?: string;
  evidenceIssues?: Array<{
    issueId: string;
    issued?: string;
    page?: string;
    canonicalLinked?: boolean;
  }>;
}

interface ContentResponse {
  contentFragments?: RawFragment[];
}

interface SearchResponse {
  _embedded?: {
    items?: Array<{
      id: string;
      metadata?: { title?: string; originInfo?: { issued?: string } };
      contentFragments?: RawFragment[];
    }>;
  };
}

interface RawFragment {
  pageid?: string;
  pageNumber?: string;
  text?: string;
}

interface Candidate extends PilotSample {
  year: number;
  hardness: number;
}

export interface RawHoldoutOptions {
  archive: Archive;
  reviewPath: string;
  ingestCacheDir: string;
  relevantTarget?: number;
  noiseTarget?: number;
  uncertainTarget?: number;
}

export interface RawHoldoutDataset {
  samples: PilotSample[];
  provenance: {
    eligibleReviews: number;
    cachedCanonicalIssues: number;
    cachedSearches: number;
    rawFragmentsInspected: number;
    relevantCandidates: number;
    noiseCandidates: number;
    uncertainCandidates: number;
  };
}

const FOOTBALL_SIGNAL = /\b(?:fotball|fotballklub\w*|kamp\w*|mål\w*|scor\w*|resultat\w*|spilt\w*|spille\w*|seier\w*|vant|tapte|nederlag\w*|poeng\w*|oppgjør\w*|møtte|tilskuer\w*|skudd\w*|laget|cup\w*|serie\w*|divisjon\w*|runde\w*|keeper\w*|back\w*|forward\w*|trening\w*|sport\w*|oppstilling\w*)\b/iu;
const AAFK_IDENTITY = /(?<![\p{L}\p{N}])(?:AaFK|AAFK|ÅFK|AFK|A\s*\.\s*F\s*\.\s*K\s*\.|(?:Aalesunds?|Ålesunds?)\s+(?:FK|Fotballklub\w*))(?:s)?(?![\p{L}\p{N}])/iu;
const AAFK_SPORTS_LISTING = /(?:(?:Aales(?:und|\.)|Ålesund)\s*[-—–]\s*[\p{Lu}\d]|[\p{Lu}][\p{L}.]+\s*[-—–]\s*(?:Aales(?:und|\.)|Ålesund))/u;

export interface RawFragmentSignals {
  hasIdentity: boolean;
  hasFootball: boolean;
  hasSportsListing: boolean;
  hasResult: boolean;
}

export function rawFragmentSignals(value: string): RawFragmentSignals {
  const plain = stripSearchMarkup(value).replace(/\s+/g, " ").trim();
  return {
    hasIdentity: AAFK_IDENTITY.test(plain),
    hasFootball: FOOTBALL_SIGNAL.test(plain),
    hasSportsListing: AAFK_SPORTS_LISTING.test(plain),
    hasResult: /(?<!\d)\d{1,2}\s*[-—–:]\s*\d{1,2}(?!\d)/u.test(plain),
  };
}

export async function loadRawNewspaperHoldout(options: RawHoldoutOptions): Promise<RawHoldoutDataset> {
  const manifest = parseYaml(await readFile(options.reviewPath, "utf8"), { schema: "core" }) as ReviewManifest;
  const matches = new Map(options.archive.matches.map((match) => [match.id, match]));
  const clubs = new Map(options.archive.clubs.map((club) => [club.id, club]));
  const canonicalIssueIds = new Set(manifest.entries.flatMap((entry) =>
    entry.evidenceIssues?.filter((issue) => issue.canonicalLinked).map((issue) => issue.issueId) ?? (entry.canonicalLinked && entry.issueId ? [entry.issueId] : []),
  ));
  const relevant = new Map<string, Candidate>();
  const noise = new Map<string, Candidate>();
  const uncertain = new Map<string, Candidate>();
  const inspected = new Set<string>();
  const seenCachedSearches = new Set<string>();
  const cachedCanonicalIssueIds = new Set<string>();
  let eligibleReviews = 0;
  let rawFragmentsInspected = 0;

  for (const entry of manifest.entries) {
    if (!entry.canonicalLinked || !entry.issueId) continue;
    const match = matches.get(entry.matchId);
    if (!match) continue;
    const context = matchContext(match, clubs);
    if (!context) continue;
    eligibleReviews += 1;

    const canonicalIssues = entry.evidenceIssues?.filter((issue) => issue.canonicalLinked) ?? [{ issueId: entry.issueId, issued: entry.issued, page: entry.page }];
    for (const issue of canonicalIssues) {
      const response = await readCachedJson<ContentResponse>(options.ingestCacheDir, buildContentFragmentsUrl(issue.issueId, context.opponent.name));
      if (!response) continue;
      cachedCanonicalIssueIds.add(issue.issueId);
      for (const fragment of response.contentFragments ?? []) {
        const text = fragment.text;
        if (!text) continue;
        const completeFragment = { ...fragment, text };
        const rawKey = rawFragmentKey(issue.issueId, fragment);
        if (inspected.has(rawKey)) continue;
        inspected.add(rawKey);
        rawFragmentsInspected += 1;
        const scored = scoreFragment(text, context.query);
        const hasLocalBinding = isHighConfidenceRelevant(text, scored);
        if (hasLocalBinding) {
          addBest(relevant, candidate({
            issueId: issue.issueId,
            issued: issue.issued,
            page: fragment.pageNumber ?? issue.page,
            text,
            match,
            context,
            label: "relevant",
            baselineScore: scored.score,
            labelNote: "Rå NB-OCR fra canonical-linked avisutgave; AaFK og canonical motstander står lokalt i samme tekstvindu.",
            hardness: 100 - scored.score,
          }));
        } else {
          classifyNonPositive({ issueId: issue.issueId, issued: issue.issued, fragment: completeFragment, match, context, scored, relevant, noise, uncertain, canonicalIssue: true });
        }
      }
    }

    // De brede søkeresponsene gir ekte støy fra nøyaktig samme retrieval som
    // fant kampreferatet. Vi leser bare eksisterende diskcache; ingen NB-kall.
    for (const radius of [2, 3]) {
      const window = dateWindow(match.date, radius);
      const queries = newspaperSearchQueries(context.opponent.name, context.opponentAliases).slice(0, 8);
      for (const query of queries) {
        const url = buildNewspaperSearchUrl(query, {
          year: context.query.year,
          newspaper: newspaperTitleForYear(context.query.year),
          from: window.from,
          to: window.to,
        });
        const cacheKey = cacheFileKey(url);
        if (seenCachedSearches.has(cacheKey)) continue;
        const response = await readCachedJson<SearchResponse>(options.ingestCacheDir, url);
        if (!response) continue;
        seenCachedSearches.add(cacheKey);
        for (const item of response._embedded?.items ?? []) {
          for (const fragment of item.contentFragments ?? []) {
            const text = fragment.text;
            if (!text) continue;
            const completeFragment = { ...fragment, text };
            const rawKey = rawFragmentKey(item.id, fragment);
            if (inspected.has(rawKey)) continue;
            inspected.add(rawKey);
            rawFragmentsInspected += 1;
            const scored = scoreFragment(text, context.query);
            const hasLocalBinding = isHighConfidenceRelevant(text, scored);
            if (hasLocalBinding && canonicalIssueIds.has(item.id)) {
              addBest(relevant, candidate({
                issueId: item.id,
                issued: item.metadata?.originInfo?.issued,
                page: fragment.pageNumber,
                text,
                match,
                context,
                label: "relevant",
                baselineScore: scored.score,
                labelNote: "Rå NB-søke-OCR fra en canonical-linked utgave; AaFK og canonical motstander står i samme tekstvindu.",
                hardness: 100 - scored.score,
              }));
            } else if (!hasLocalBinding) {
              classifyNonPositive({ issueId: item.id, issued: item.metadata?.originInfo?.issued, fragment: completeFragment, match, context, scored, relevant, noise, uncertain, canonicalIssue: canonicalIssueIds.has(item.id) });
            }
          }
        }
      }
    }
  }

  // Den samme råteksten skal aldri få to labels, selv om flere kampoppslag har
  // hentet den. Positiv canonical evidens vinner; gråsoner vinner over noise.
  for (const key of relevant.keys()) {
    noise.delete(key);
    uncertain.delete(key);
  }
  for (const key of uncertain.keys()) noise.delete(key);

  const selected = [
    ...selectStratified([...relevant.values()], options.relevantTarget ?? 160),
    ...selectStratified([...noise.values()], options.noiseTarget ?? 200),
    ...selectStratified([...uncertain.values()], options.uncertainTarget ?? 60),
  ].sort((left, right) => left.id.localeCompare(right.id));
  assertRawHoldout(selected);
  return {
    samples: selected,
    provenance: {
      eligibleReviews,
      cachedCanonicalIssues: cachedCanonicalIssueIds.size,
      cachedSearches: seenCachedSearches.size,
      rawFragmentsInspected,
      relevantCandidates: relevant.size,
      noiseCandidates: noise.size,
      uncertainCandidates: uncertain.size,
    },
  };
}

function matchContext(match: Match, clubs: Map<string, Club>): { opponent: Club; opponentAliases: string[]; query: NewspaperMatchQuery } | undefined {
  const opponentId = match.home.clubId === AAFK_CLUB_ID ? match.away.clubId : match.home.clubId;
  const opponent = clubs.get(opponentId);
  if (!opponent || match.home.score === null || match.away.score === null) return undefined;
  const names = clubNames(opponent);
  const year = Number(match.date.slice(0, 4));
  return {
    opponent,
    opponentAliases: names.slice(1),
    query: {
      opponent: opponent.name,
      opponentAliases: names.slice(1),
      year,
      score: `${match.home.score}-${match.away.score}`,
      competition: match.competition.id,
      round: match.competition.round,
    },
  };
}

function classifyNonPositive(input: {
  issueId: string;
  issued?: string;
  fragment: RawFragment & { text: string };
  match: Match;
  context: NonNullable<ReturnType<typeof matchContext>>;
  scored: ReturnType<typeof scoreFragment>;
  relevant: Map<string, Candidate>;
  noise: Map<string, Candidate>;
  uncertain: Map<string, Candidate>;
  canonicalIssue: boolean;
}): void {
  const signals = rawFragmentSignals(input.fragment.text);
  const hasOpponent = input.scored.reasons.some((reason) => reason.startsWith("motstander:"));

  // Direkte klubbidentitet i tydelig fotball-/resultatkontekst er selvstendig
  // AaFK-evidens, også når vinduet gjelder en annen kamp enn den retrievalen
  // opprinnelig ble kjørt for. Dette hindrer at ekte sidefunn merkes som støy.
  if (signals.hasIdentity && (signals.hasFootball || signals.hasResult)) {
    addBest(input.relevant, candidate({
      issueId: input.issueId,
      issued: input.issued,
      page: input.fragment.pageNumber,
      text: input.fragment.text,
      match: input.match,
      context: input.context,
      label: "relevant",
      baselineScore: input.scored.score,
      labelNote: "Rå OCR med eksplisitt AaFK-identitet og fotball-/resultatkontekst; relevant uavhengig av hvilken kamp som utløste retrievalen.",
      hardness: 100 - input.scored.score,
    }));
  } else if (!signals.hasIdentity && !signals.hasFootball && !signals.hasSportsListing && !(input.canonicalIssue && hasOpponent) && input.scored.score <= 20) {
    addBest(input.noise, candidate({
      issueId: input.issueId,
      issued: input.issued,
      page: input.fragment.pageNumber,
      text: input.fragment.text,
      match: input.match,
      context: input.context,
      label: "noise",
      baselineScore: input.scored.score,
      labelNote: "Rå OCR fra samme NB-retrieval uten AaFK-identitet eller fotballsignal; høysikker negativ.",
      hardness: input.scored.score + (input.canonicalIssue ? 10 : 0),
    }));
  } else {
    addBest(input.uncertain, candidate({
      issueId: input.issueId,
      issued: input.issued,
      page: input.fragment.pageNumber,
      text: input.fragment.text,
      match: input.match,
      context: input.context,
      label: "uncertain",
      baselineScore: input.scored.score,
      labelNote: "Rå OCR uten sikker lokal AaFK–motstander-binding, men med identitets-, fotball- eller canonical-motstandersignal; krever menneskelig/faksimile-review.",
      hardness: input.scored.score + (signals.hasIdentity ? 30 : 0) + (signals.hasFootball ? 20 : 0) + (signals.hasSportsListing ? 20 : 0),
    }));
  }
}

function candidate(input: {
  issueId: string;
  issued?: string;
  page?: string;
  text: string;
  match: Match;
  context: NonNullable<ReturnType<typeof matchContext>>;
  label: PilotLabel;
  baselineScore: number;
  labelNote: string;
  hardness: number;
}): Candidate {
  const contentHash = shortHash(stripSearchMarkup(input.text).replace(/\s+/g, " ").trim());
  const groupId = `raw-nb:${input.issueId}`;
  return {
    id: `${groupId}:${input.page ?? "unknown"}:${contentHash}`,
    groupId,
    split: splitForGroup(groupId),
    label: input.label,
    source: newspaperTitleForYear(input.context.query.year),
    publicationDate: compactDate(input.issued),
    page: input.page,
    text: input.text,
    baselineScore: input.baselineScore,
    labelNote: input.labelNote,
    year: input.context.query.year,
    hardness: input.hardness,
  };
}

function addBest(target: Map<string, Candidate>, value: Candidate): void {
  const key = `${value.groupId}|${shortHash(stripSearchMarkup(value.text).replace(/\s+/g, " ").trim())}`;
  const existing = target.get(key);
  if (!existing || value.hardness > existing.hardness) target.set(key, value);
}

function isHighConfidenceRelevant(text: string, scored: ReturnType<typeof scoreFragment>): boolean {
  if (!scored.reasons.includes("motstander og AaFK i samme avsnitt")) return false;
  const signals = rawFragmentSignals(text);
  return signals.hasIdentity || signals.hasFootball || signals.hasSportsListing;
}

function selectStratified(candidates: Candidate[], target: number): PilotSample[] {
  const bestByGroup = new Map<string, Candidate>();
  for (const item of candidates) {
    const prior = bestByGroup.get(item.groupId);
    if (!prior || item.hardness > prior.hardness || (item.hardness === prior.hardness && item.id.localeCompare(prior.id) < 0)) {
      bestByGroup.set(item.groupId, item);
    }
  }
  const byDecade = new Map<number, Candidate[]>();
  for (const item of bestByGroup.values()) {
    const decade = Math.floor(item.year / 10) * 10;
    const bucket = byDecade.get(decade) ?? [];
    bucket.push(item);
    byDecade.set(decade, bucket);
  }
  for (const bucket of byDecade.values()) bucket.sort((left, right) => right.hardness - left.hardness || stableOrder(left.id) - stableOrder(right.id) || left.id.localeCompare(right.id));
  const result: Candidate[] = [];
  const decades = [...byDecade.keys()].sort((a, b) => a - b);
  while (result.length < target) {
    let added = false;
    for (const decade of decades) {
      const item = byDecade.get(decade)?.shift();
      if (!item) continue;
      result.push(item);
      added = true;
      if (result.length >= target) break;
    }
    if (!added) break;
  }
  return result;
}

async function readCachedJson<T>(cacheDir: string, url: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(resolve(cacheDir, `${cacheFileKey(url)}.json`), "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function cacheFileKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

function rawFragmentKey(issueId: string, fragment: RawFragment): string {
  return `${issueId}|${fragment.pageNumber ?? ""}|${shortHash(fragment.text ?? "")}`;
}

function compactDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const compact = value.replaceAll("-", "");
  return /^\d{8}$/.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}` : value;
}

function dateWindow(date: string, radius: number): { from: string; to: string } {
  const center = Date.parse(`${date}T00:00:00Z`);
  const shift = (days: number) => new Date(center + days * 86_400_000).toISOString().slice(0, 10);
  return { from: shift(-radius), to: shift(radius) };
}

function stableOrder(value: string): number {
  return createHash("sha256").update(value).digest().readUInt32BE(0);
}

function assertRawHoldout(samples: PilotSample[]): void {
  const ids = new Set<string>();
  const labels = new Set<PilotLabel>();
  const splitByGroup = new Map<string, string>();
  for (const sample of samples) {
    if (ids.has(sample.id)) throw new Error(`Duplikat i råholdout: ${sample.id}`);
    ids.add(sample.id);
    labels.add(sample.label);
    const prior = splitByGroup.get(sample.groupId);
    if (prior && prior !== sample.split) throw new Error(`Grupplekkasje i råholdout: ${sample.groupId}`);
    splitByGroup.set(sample.groupId, sample.split);
  }
  if (!labels.has("relevant") || !labels.has("noise") || !labels.has("uncertain")) throw new Error("Råholdout mangler en labelklasse");
}
