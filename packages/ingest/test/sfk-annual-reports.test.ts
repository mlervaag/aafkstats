import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  INDEX_URL,
  type AnnualReportLink,
  annualReportManifest,
  generateAnnualReportSource,
  parseAnnualReportIndex,
  planAnnualReportSources,
  validateAnnualReportSeries,
} from "../src/adapters/sfk-annual-reports.js";

const fixture = fileURLToPath(new URL("fixtures/sfk-annual-reports-index.html", import.meta.url));
const link = (year: number, url = `https://www.fotball.no/reports/${year}.pdf`): AnnualReportLink => ({
  year, label: `Årsrapport ${year}`, url,
});
const baseline = () => Array.from({ length: 74 }, (_, index) => link(1952 + index));

describe("SFK-årsrapportindeksen", () => {
  it("normaliserer HTML, NBSP og relative href-er", async () => {
    const reports = parseAnnualReportIndex(await readFile(fixture, "utf8"));
    expect(reports.map((report) => report.year)).toEqual([1952, 1984, 1985, 1993, 2016, 2025]);
    expect(reports.find((report) => report.year === 1993)?.label).toBe("Årsrapport 1993");
    expect(reports.find((report) => report.year === 2016)?.url).toBe(
      "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/kretsting/arsrapport-2016.pdf",
    );
  });

  it("beholder den avvikende canonical URL-en for 1985", async () => {
    const reports = parseAnnualReportIndex(await readFile(fixture, "utf8"));
    expect(reports.find((report) => report.year === 1985)?.url).toBe(
      "https://www.fotball.no/globalassets/krets/sunnmore/2020/arsrapport-1985.pdf",
    );
  });

  it.each([
    "http://www.fotball.no/a.pdf",
    "https://evil.example/a.pdf",
    "https://fotball.no/a.pdf",
    "https://www.fotball.no/a.txt",
  ])("avviser ugyldig rapport-URL: %s", (url) => {
    expect(() => parseAnnualReportIndex(`<a href="${url}">Årsrapport 1966</a>`)).toThrow(/ugyldig PDF-URL/);
  });

  it("avviser duplikate år med begge URL-ene", () => {
    expect(() => parseAnnualReportIndex(
      '<a href="/a.pdf">Årsrapport 1966</a><a href="/b.pdf">Årsrapport 1966</a>',
    )).toThrow(/duplikat år 1966.*a\.pdf.*b\.pdf/);
  });

  it("avviser duplikate URL-er med begge årstallene", () => {
    expect(() => parseAnnualReportIndex(
      '<a href="/same.pdf">Årsrapport 1966</a><a href="/same.pdf">Årsrapport 1967</a>',
    )).toThrow(/duplikat URL.*år 1966 og 1967/);
  });
});

describe("baseline", () => {
  it("godtar 1952–2025 og sammenhengende nye år", () => {
    expect(() => validateAnnualReportSeries(baseline())).not.toThrow();
    expect(() => validateAnnualReportSeries([...baseline(), link(2026)])).not.toThrow();
    expect(() => validateAnnualReportSeries([link(1950), ...baseline(), link(2026)])).not.toThrow();
  });

  it("avviser et manglende baselineår", () => {
    expect(() => validateAnnualReportSeries(baseline().filter((report) => report.year !== 1985))).toThrow(/mangler 1985/);
  });

  it("avviser hull etter 2025", () => {
    expect(() => validateAnnualReportSeries([...baseline(), link(2027)])).toThrow(/hull.*2026/);
  });
});

describe("source-plan", () => {
  const report = link(1966, "https://www.fotball.no/canonical.pdf");
  const existing = {
    id: "sunnmore-fotballkrets-arsrapport-1966",
    title: "Manuelt kuratert tittel",
    sourceType: "annual_report" as const,
    parentSourceId: "sunnmore-fotballkrets-arsrapporter",
    publisher: "Sunnmøre Fotballkrets",
    year: 1966,
    description: "En bedre manuell beskrivelse.",
    accessUrl: report.url,
    providers: [{ providerId: "sunnmore-fotballkrets", url: report.url }],
  };

  it("bevarer en eksisterende, kompatibel source", () => {
    expect(planAnnualReportSources([report], [existing])).toEqual({ missing: [], existing: [report], conflicts: [] });
  });

  it("stopper ved URL-konflikt", () => {
    const changed = { ...existing, accessUrl: "https://www.fotball.no/annen.pdf" };
    expect(planAnnualReportSources([report], [changed]).conflicts[0]?.differences).toContain(
      `accessUrl: forventet «${report.url}»`,
    );
  });

  it("genererer byte-identisk YAML og manifest", () => {
    expect(generateAnnualReportSource(report)).toBe(generateAnnualReportSource(report));
    expect(annualReportManifest([report])).toBe(annualReportManifest([report]));
    expect(annualReportManifest([report])).toContain(`"indexUrl": "${INDEX_URL}"`);
  });

  it("andre planlegging etter opprettelse lager ingen endringer", () => {
    const first = planAnnualReportSources([report], []);
    expect(first.missing).toEqual([report]);
    expect(planAnnualReportSources([report], [existing]).missing).toEqual([]);
  });
});
