import type { Source } from "@aafkstats/schema";

export const PROVIDER_ID = "sunnmore-fotballkrets";
export const SERIES_SOURCE_ID = "sunnmore-fotballkrets-arsrapporter";
export const INDEX_URL =
  "https://www.fotball.no/kretser/sunnmore/om-kretsen/historie/arsrapporter/";
export const KNOWN_BASELINE = { from: 1952, through: 2025, count: 74 } as const;

export interface AnnualReportLink {
  year: number;
  label: string;
  url: string;
}

export interface SourceConflict {
  year: number;
  id: string;
  differences: string[];
}

export interface SourcePlan {
  missing: AnnualReportLink[];
  existing: AnnualReportLink[];
  conflicts: SourceConflict[];
}

/** Leser bare indeksen. URL-en beholdes fra href-en og utledes aldri fra årstallet. */
export function parseAnnualReportIndex(
  html: string,
  indexUrl = INDEX_URL,
): AnnualReportLink[] {
  const reports: AnnualReportLink[] = [];
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/giu;

  for (const match of html.matchAll(anchorPattern)) {
    const label = normalizeHtmlText(match[3] ?? "");
    const labelMatch = /^Årsrapport\s+((?:19|20)\d{2})$/u.exec(label);
    if (!labelMatch) continue;

    const href = decodeHtmlEntities(match[2] ?? "").trim();
    let resolved: URL;
    try {
      resolved = new URL(href, indexUrl);
    } catch {
      throw new Error(`ugyldig URL for «${label}»: ${href}`);
    }
    validateReportUrl(resolved, label);

    reports.push({ year: Number(labelMatch[1]), label, url: resolved.href });
  }

  assertNoDuplicates(reports);
  return reports.sort((a, b) => a.year - b.year);
}

export function validateAnnualReportSeries(reports: AnnualReportLink[]): void {
  const years = new Set(reports.map((report) => report.year));
  const baselineYears = reports.filter(
    (report) => report.year >= KNOWN_BASELINE.from && report.year <= KNOWN_BASELINE.through,
  );

  const missingBaseline: number[] = [];
  for (let year = KNOWN_BASELINE.from; year <= KNOWN_BASELINE.through; year++) {
    if (!years.has(year)) missingBaseline.push(year);
  }
  if (baselineYears.length !== KNOWN_BASELINE.count || missingBaseline.length > 0) {
    throw new Error(
      `årsrapportbaselinen ${KNOWN_BASELINE.from}–${KNOWN_BASELINE.through} er ufullstendig: ` +
        `${baselineYears.length}/${KNOWN_BASELINE.count} rapporter` +
        (missingBaseline.length ? `; mangler ${missingBaseline.join(", ")}` : ""),
    );
  }

  const highest = Math.max(...reports.map((report) => report.year));
  const gaps: number[] = [];
  for (let year = KNOWN_BASELINE.from; year <= highest; year++) {
    if (!years.has(year)) gaps.push(year);
  }
  if (gaps.length > 0) {
    throw new Error(`årsrapportserien har hull mellom ${KNOWN_BASELINE.from} og ${highest}: ${gaps.join(", ")}`);
  }
}

export function planAnnualReportSources(
  reports: AnnualReportLink[],
  sources: Array<Source & { file?: string }>,
): SourcePlan {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const plan: SourcePlan = { missing: [], existing: [], conflicts: [] };

  for (const report of reports) {
    const id = annualReportSourceId(report.year);
    const source = byId.get(id);
    if (!source) {
      plan.missing.push(report);
      continue;
    }

    const differences = compareSource(source, report);
    if (differences.length > 0) plan.conflicts.push({ year: report.year, id, differences });
    else plan.existing.push(report);
  }
  return plan;
}

export function annualReportSourceId(year: number): string {
  return `sunnmore-fotballkrets-arsrapport-${year}`;
}

export function generateAnnualReportSource(report: AnnualReportLink): string {
  return [
    `id: ${annualReportSourceId(report.year)}`,
    `title: Sunnmøre Fotballkrets - Årsrapport ${report.year}`,
    "sourceType: annual_report",
    `parentSourceId: ${SERIES_SOURCE_ID}`,
    "publisher: Sunnmøre Fotballkrets",
    `year: ${report.year}`,
    "description: >",
    "  Offisiell årsrapport fra Sunnmøre Fotballkrets.",
    `accessUrl: ${report.url}`,
    "providers:",
    `  - providerId: ${PROVIDER_ID}`,
    `    url: ${report.url}`,
    "",
  ].join("\n");
}

export function annualReportManifest(reports: AnnualReportLink[]): string {
  return `${JSON.stringify({
    indexUrl: INDEX_URL,
    knownBaseline: KNOWN_BASELINE,
    reports: [...reports]
      .sort((a, b) => a.year - b.year)
      .map(({ year, url }) => ({ year, url })),
  }, null, 2)}\n`;
}

function normalizeHtmlText(html: string): string {
  return decodeHtmlEntities(stripTags(html))
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function stripTags(html: string): string {
  let text = "";
  let insideTag = false;
  for (const character of html) {
    if (character === "<") insideTag = true;
    else if (character === ">") insideTag = false;
    else if (!insideTag) text += character;
  }
  return text;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|nbsp|amp|lt|gt|quot|apos|aring);/giu, (entity, decimal, hex) => {
    if (decimal) return String.fromCodePoint(Number(decimal));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    const named: Record<string, string> = {
      "&nbsp;": "\u00a0", "&amp;": "&", "&lt;": "<", "&gt;": ">",
      "&quot;": "\"", "&apos;": "'", "&aring;": "Å",
    };
    return named[entity.toLowerCase()] ?? entity;
  });
}

function validateReportUrl(url: URL, label: string): void {
  if (url.protocol !== "https:" || url.hostname !== "www.fotball.no" || !url.pathname.toLowerCase().endsWith(".pdf")) {
    throw new Error(`ugyldig PDF-URL for «${label}»: ${url.href}`);
  }
}

function assertNoDuplicates(reports: AnnualReportLink[]): void {
  const years = new Map<number, string>();
  const urls = new Map<string, number>();
  for (const report of reports) {
    const previousUrl = years.get(report.year);
    if (previousUrl !== undefined) {
      throw new Error(`duplikat år ${report.year}: ${previousUrl} og ${report.url}`);
    }
    const previousYear = urls.get(report.url);
    if (previousYear !== undefined) {
      throw new Error(`duplikat URL ${report.url}: år ${previousYear} og ${report.year}`);
    }
    years.set(report.year, report.url);
    urls.set(report.url, report.year);
  }
}

function compareSource(source: Source, report: AnnualReportLink): string[] {
  const expected = {
    id: annualReportSourceId(report.year),
    year: report.year,
    sourceType: "annual_report",
    parentSourceId: SERIES_SOURCE_ID,
    publisher: "Sunnmøre Fotballkrets",
    accessUrl: report.url,
  } as const;
  const differences: string[] = [];
  for (const [field, value] of Object.entries(expected)) {
    if (source[field as keyof Source] !== value) differences.push(`${field}: forventet «${value}»`);
  }
  const provider = source.providers.find((entry) => entry.providerId === PROVIDER_ID);
  if (!provider) differences.push(`providers: mangler ${PROVIDER_ID}`);
  else if (provider.url !== report.url) differences.push(`providers.url: forventet «${report.url}»`);
  return differences;
}
