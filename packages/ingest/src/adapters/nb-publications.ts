import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import type { Archive } from "@aafkstats/schema/load";
import type { FactCandidate, Match, PublicationExtraction, Source } from "@aafkstats/schema";

export const NB_PUBLICATIONS_ADAPTER = "nb-publications@1";

interface CatalogItem {
  id: string;
  accessInfo?: { license?: string; viewability?: string };
  metadata?: { pageCount?: number };
  _links?: { presentation?: { href?: string } };
}

interface IiifCanvas {
  label?: string;
  "@seeAlso"?: { "@id"?: string } | Array<{ "@id"?: string }>;
}

interface IiifManifest {
  sequences?: Array<{ canvases?: IiifCanvas[] }>;
  service?: { "@id"?: string };
}

interface IiifSearchResponse {
  hits?: Array<{ match?: string; before?: string; after?: string; annotations?: string[] }>;
}

export interface NbExtractionOptions {
  cacheDir: string;
  retrievedAt: string;
  refresh?: boolean;
  concurrency?: number;
  delayMs?: number;
  onProgress?: (message: string) => void;
}

export async function extractNbPublication(
  archive: Archive,
  source: Source,
  options: NbExtractionOptions,
): Promise<PublicationExtraction> {
  if (!source.urn) throw new Error(`${source.id}: mangler URN`);
  const catalogUrl = `https://api.nb.no/catalog/v1/items?q=${encodeURIComponent(`urn:"${source.urn}"`)}&size=1`;
  const catalog = await cachedJson<{ _embedded?: { items?: CatalogItem[] } }>(
    catalogUrl, join(options.cacheDir, source.id, "catalog.json"), options,
  );
  const item = catalog._embedded?.items?.[0];
  if (!item) throw new Error(`${source.id}: ikke funnet i NB-katalogen`);
  const manifestUrl = item._links?.presentation?.href;
  if (!manifestUrl) return emptyExtraction(source.id, options.retrievedAt, item.metadata?.pageCount ?? 0, "unavailable");

  const manifest = await cachedJson<IiifManifest>(
    manifestUrl, join(options.cacheDir, source.id, "manifest.json"), options,
  );
  const canvases = manifest.sequences?.flatMap((sequence) => sequence.canvases ?? []) ?? [];
  const pages = canvases.map((canvas, index) => ({
    page: canvas.label || String(index + 1),
    altoUrl: altoUrl(canvas),
  }));
  const altoPages = pages.filter((page): page is { page: string; altoUrl: string } => Boolean(page.altoUrl));
  if (altoPages.length === 0) {
    return extractSearchOnly(archive, source, manifest.service?.["@id"], canvases.length || item.metadata?.pageCount || 0, options);
  }

  const failures: string[] = [];
  const pageTexts: Array<{ page: string; lines: string[]; xml: string }> = [];
  await pool(altoPages, Math.max(1, options.concurrency ?? 3), async ({ page, altoUrl }, index) => {
    try {
      const xml = await cachedText(altoUrl, join(options.cacheDir, source.id, "alto", `${safeFile(page)}.xml`), options);
      pageTexts[index] = { page, lines: altoLines(xml), xml };
    } catch (error) {
      failures.push(page);
      options.onProgress?.(`${source.id} side ${page}: ${String(error)}`);
    }
  });

  const usablePages = pageTexts.filter(Boolean);
  const candidates = usablePages.flatMap(({ page, lines }) => candidatesForPage(archive, source, page, lines));
  const digest = createHash("sha256");
  for (const page of usablePages) digest.update(page.xml);
  return {
    sourceId: source.id,
    providerId: "nasjonalbiblioteket",
    adapter: NB_PUBLICATIONS_ADAPTER,
    retrievedAt: options.retrievedAt,
    ocrAccess: "alto",
    pagesExpected: canvases.length || item.metadata?.pageCount || altoPages.length,
    pagesProcessed: usablePages.length,
    pagesFailed: failures.sort(naturalCompare),
    contentHash: `sha256:${digest.digest("hex")}`,
    candidates: uniqueCandidates(candidates),
  };
}

const SEARCH_ONLY_TERMS = [
  "formann", "styreleder", "nestformann", "sekretær", "kasserer", "oppmann",
  "trener", "direktør", "æresmedlem", "sportslig leder", "daglig leder",
  "lagoppstilling", "spillerstall", "spillertropp", "sluttabell", "opprykk", "nedrykk",
  "Aalesund", "Aalesunds", "AaFK",
] as const;

async function extractSearchOnly(
  archive: Archive,
  source: Source,
  searchUrl: string | undefined,
  pagesExpected: number,
  options: NbExtractionOptions,
): Promise<PublicationExtraction> {
  if (!searchUrl) return emptyExtraction(source.id, options.retrievedAt, pagesExpected, "unavailable");
  const linesByPage = new Map<string, string[]>();
  const digest = createHash("sha256");
  await pool([...SEARCH_ONLY_TERMS], Math.min(2, options.concurrency ?? 2), async (term) => {
    const response = await cachedJson<IiifSearchResponse>(
      `${searchUrl}?q=${encodeURIComponent(term)}`,
      join(options.cacheDir, source.id, "search", `${safeFile(term)}.json`),
      options,
    );
    digest.update(JSON.stringify(response));
    for (const hit of response.hits ?? []) {
      const page = pageFromAnnotations(hit.annotations);
      if (!page) continue;
      const line = `${hit.before ?? ""} ${hit.match ?? term} ${hit.after ?? ""}`.replace(/\s+/g, " ").trim();
      if (!line) continue;
      const lines = linesByPage.get(page) ?? [];
      if (!lines.includes(line)) lines.push(line);
      linesByPage.set(page, lines);
    }
  });
  const candidates = [...linesByPage.entries()].flatMap(([page, lines]) => candidatesForPage(archive, source, page, lines));
  return {
    sourceId: source.id,
    providerId: "nasjonalbiblioteket",
    adapter: NB_PUBLICATIONS_ADAPTER,
    retrievedAt: options.retrievedAt,
    ocrAccess: "search_only",
    pagesExpected,
    pagesProcessed: 0,
    pagesFailed: [],
    contentHash: `sha256:${digest.digest("hex")}`,
    candidates: uniqueCandidates(candidates),
  };
}

function pageFromAnnotations(annotations: string[] | undefined): string | undefined {
  const value = annotations?.[0];
  const match = value?.match(/_(\d+)(?:#|$)/);
  return match?.[1] ? String(Number(match[1])) : undefined;
}

function emptyExtraction(sourceId: string, retrievedAt: string, pages: number, access: "search_only" | "unavailable"): PublicationExtraction {
  return { sourceId, providerId: "nasjonalbiblioteket", adapter: NB_PUBLICATIONS_ADAPTER, retrievedAt, ocrAccess: access, pagesExpected: pages, pagesProcessed: 0, pagesFailed: [], candidates: [] };
}

function altoUrl(canvas: IiifCanvas): string | undefined {
  const seeAlso = canvas["@seeAlso"];
  return Array.isArray(seeAlso) ? seeAlso.find((entry) => entry["@id"])?.["@id"] : seeAlso?.["@id"];
}

export function altoLines(xml: string): string[] {
  const blocks = xml.match(/<TextLine\b[\s\S]*?<\/TextLine>/gi) ?? [];
  return blocks.map((block) => [...block.matchAll(/<String\b[^>]*\bCONTENT=(?:"([^"]*)"|'([^']*)')[^>]*\/?\s*>/gi)]
    .map((match) => decodeXml(match[1] ?? match[2] ?? ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim())
    .filter(Boolean);
}

export function candidatesForPage(archive: Archive, source: Source, page: string, lines: string[]): FactCandidate[] {
  const out: FactCandidate[] = [];
  const knownPeople = archive.people.map((person) => ({
    id: person.id,
    name: person.name,
    forms: [person.name, ...person.names].map(normalize),
  }));
  const roleTerms = ["formann", "leder", "styreleder", "nestformann", "sekretær", "kasserer", "oppmann", "trener", "direktør", "æresmedlem", "æresmedlemmer", "sportslig leder", "daglig leder"];
  const lineupTerms = ["lagoppstilling", "lagoppstillingen", "laget bestod", "spillertropp", "spillerstall", "troppen", "stallen"];
  const seasonTerms = ["sluttabell", "tabellen", "seriemester", "opprykk", "nedrykk", "poeng", "målforskjell"];

  for (const line of lines) {
    const normalized = normalize(line);
    const years = [...line.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((match) => Number(match[1])).filter((year) => year >= 1914 && year <= 2100);
    const scores = [...line.matchAll(/\b(\d{1,2})\s*[-–—:]\s*(\d{1,2})\b/g)].map((match) => `${Number(match[1])}-${Number(match[2])}`);
    const people = knownPeople.filter((person) => person.forms.some((form) => containsPhrase(normalized, form)));
    const roles = roleTerms.filter((term) => containsPhrase(normalized, normalize(term)));
    const lineup = lineupTerms.filter((term) => containsPhrase(normalized, normalize(term)));
    const season = seasonTerms.filter((term) => containsPhrase(normalized, normalize(term)));

    if (people.length > 0) out.push(candidate(source.id, page, "person_mention", people.length === 1 ? "high" : "medium", [], people.map((p) => p.name), years, [], people.map((p) => p.id), []));
    if (roles.length > 0) {
      const names = unique([...people.map((p) => p.name), ...extractNames(line)]);
      out.push(candidate(source.id, page, names.length > 0 ? "person_role" : "organization", people.length === 1 && years.length > 0 ? "high" : "medium", roles, names, years, [], people.map((p) => p.id), []));
    }
    if (lineup.length > 0) out.push(candidate(source.id, page, "lineup_or_squad", "medium", lineup, unique(extractNames(line)), years, [], people.map((p) => p.id), []));
    if (season.length > 0 && years.length > 0) out.push(candidate(source.id, page, "season_fact", "medium", season, [], years, scores, [], []));
    if (scores.length > 0 && /\b(aafk|aa\.?\s*f\.?\s*k\.?|aalesund|ålesund)\b/i.test(line)) {
      const matchIds = matchCandidates(archive, source, normalized, years, scores);
      out.push(candidate(source.id, page, "match_result", matchIds.length === 1 ? "high" : "medium", [], extractNames(line), years, scores, [], matchIds));
    }
  }
  return out;
}

function matchCandidates(archive: Archive, source: Source, line: string, years: number[], scores: string[]): string[] {
  const candidates: string[] = [];
  for (const match of archive.matches) {
    if (match.home.score === null || match.away.score === null) continue;
    if (match.home.clubId !== "aalesunds-fk" && match.away.clubId !== "aalesunds-fk") continue;
    if (years.length > 0 ? !years.includes(match.competition.season) : source.year !== match.competition.season) continue;
    const opponentId = match.home.clubId === "aalesunds-fk" ? match.away.clubId : match.home.clubId;
    const opponent = archive.clubs.find((club) => club.id === opponentId);
    if (!opponent) continue;
    const opponentForms = [opponent.name, opponent.shortName, ...opponent.names.map((entry) => entry.name)]
      .filter((value): value is string => Boolean(value)).map(normalize);
    if (!opponentForms.some((form) => containsPhrase(line, form))) continue;
    const direct = `${match.home.score}-${match.away.score}`;
    const reversed = `${match.away.score}-${match.home.score}`;
    if (!scores.includes(direct) && !scores.includes(reversed)) continue;
    candidates.push(match.id);
  }
  return unique(candidates);
}

function candidate(sourceId: string, page: string, kind: FactCandidate["kind"], confidence: FactCandidate["confidence"], keywords: string[], names: string[], years: number[], scores: string[], personIds: string[], matchIds: string[]): FactCandidate {
  const payload = { keywords: unique(keywords), names: unique(names), years: unique(years), scores: unique(scores), personIds: unique(personIds), matchIds: unique(matchIds) };
  const hash = createHash("sha256").update(`${sourceId}|${page}|${kind}|${JSON.stringify(payload)}`).digest("hex").slice(0, 16);
  return { id: `${kind.replaceAll("_", "-")}-${hash}`, kind, page, confidence, ...payload };
}

function uniqueCandidates(values: FactCandidate[]): FactCandidate[] {
  return [...new Map(values.map((value) => [value.id, value])).values()].sort((a, b) => naturalCompare(a.page, b.page) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

function extractNames(line: string): string[] {
  const excluded = /^(Aalesunds? Fotballklubb|Aalesund Fotballklubb|Norges Fotballforbund|Medlemsblad for|Det Norske|Den Norske)$/i;
  return unique([...line.matchAll(/\b[\p{Lu}ÆØÅ][\p{L}.'’-]+(?:\s+[\p{Lu}ÆØÅ][\p{L}.'’-]+){1,3}\b/gu)]
    .map((match) => match[0].trim().replace(/^(?:Formann|Styreleder|Nestformann|Sekretær|Kasserer|Oppmann|Trener|Direktør)\s+/i, ""))
    .filter((name) => name.length >= 5 && name.length <= 80 && !excluded.test(name)));
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9æøå]+/g, " ").trim();
}

function containsPhrase(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

function decodeXml(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_all, code: string) => String.fromCodePoint(Number(code)));
}

async function cachedJson<T>(url: string, file: string, options: NbExtractionOptions): Promise<T> {
  return JSON.parse(await cachedText(url, file, options)) as T;
}

async function cachedText(url: string, file: string, options: NbExtractionOptions): Promise<string> {
  if (!options.refresh && existsSync(file)) return readFile(file, "utf8");
  await mkdir(dirname(file), { recursive: true });
  let last: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    try {
      const response = await fetch(url, { headers: { "user-agent": "aafkstats-public-archive/0.1 (+https://github.com/mlervaag/aafkstats)", accept: "application/json, application/alto+xml, text/xml;q=0.9, */*;q=0.5" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      await writeFile(file, body, "utf8");
      return body;
    } catch (error) {
      last = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw last;
}

async function pool<T>(items: T[], concurrency: number, work: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await work(items[index]!, index);
    }
  }));
}

function safeFile(value: string): string { return value.replace(/[^a-zA-Z0-9_-]+/g, "-"); }
function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function naturalCompare(a: string, b: string): number { return a.localeCompare(b, "nb", { numeric: true }); }

export async function writeExtraction(file: string, extraction: PublicationExtraction): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, stringify(extraction, { lineWidth: 0, defaultStringType: "PLAIN" }), "utf8");
}

export async function applyHighConfidenceMatchSources(archive: Archive, extractions: PublicationExtraction[], dataRoot: string): Promise<number> {
  const references = new Map<string, Array<{ sourceId: string; page: string }>>();
  for (const extraction of extractions) for (const candidate of extraction.candidates) {
    if (candidate.kind !== "match_result" || candidate.confidence !== "high" || candidate.matchIds.length !== 1) continue;
    const matchId = candidate.matchIds[0]!;
    const entries = references.get(matchId) ?? [];
    if (!entries.some((entry) => entry.sourceId === extraction.sourceId && entry.page === candidate.page)) entries.push({ sourceId: extraction.sourceId, page: candidate.page });
    references.set(matchId, entries);
  }
  let changed = 0;
  for (const match of archive.matches) {
    const refs = references.get(match.id);
    if (!refs) continue;
    const { file, ...value } = match;
    let dirty = false;
    for (const ref of refs) {
      if (value.sources.some((sourceRef) => sourceRef.sourceId === ref.sourceId && sourceRef.page === ref.page)) continue;
      value.sources.push({ sourceId: ref.sourceId, page: ref.page, fields: ["home.score", "away.score"], note: "Entydig maskinelt treff på år, motstander og resultat; bør redaksjonelt etterkontrolleres." });
      dirty = true;
    }
    if (!dirty) continue;
    await writeFile(join(dataRoot, file), stringify(value satisfies Match, { lineWidth: 0, defaultStringType: "PLAIN" }), "utf8");
    changed++;
  }
  return changed;
}
