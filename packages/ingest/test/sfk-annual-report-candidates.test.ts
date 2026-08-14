import { describe, expect, it } from "vitest";
import { analyzePageTexts } from "../src/adapters/sfk-annual-report-analysis.js";
import {
  candidateCoverageReport,
  candidateManifest,
  extractAnnualReportPageCandidates,
} from "../src/adapters/sfk-annual-report-candidates.js";
import type { AnnualReportLink } from "../src/adapters/sfk-annual-reports.js";

const report: AnnualReportLink = {
  year: 2002,
  label: "Årsrapport 2002",
  url: "https://www.fotball.no/rapport-2002.pdf",
};
const texts = [
  "Aalesund har tabell og NM i byen, men dette er bare et svakt stedsnavn.",
  "AaFK spiller serie og NM. Junior og G16 er omtalt med spillere, trenere og dommere.",
  "AaFK nevnes uten noe temasignal på denne siden.",
];
const analysis = analyzePageTexts(report, 100, `sha256:${"a".repeat(64)}`, texts);

describe("SFK-faktakandidater", () => {
  it("lager bare sidebaserte kandidater med sikkert AaFK-signal", () => {
    const candidates = extractAnnualReportPageCandidates(analysis, texts);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      year: 2002,
      page: 2,
      strongMentions: 1,
      topics: ["seniorTable", "cupResults", "junior", "youth", "people", "officials"],
    });
    expect(candidates[0]?.keywords).toEqual(expect.arrayContaining(["serie", "nm", "junior", "g16", "spillere", "dommere"]));
  });

  it("sorterer manifestet deterministisk uten råtekst", () => {
    const candidates = extractAnnualReportPageCandidates(analysis, texts);
    const manifest = candidateManifest(candidates);
    expect(manifest).toBe(candidateManifest(candidates));
    expect(manifest).not.toContain("AaFK spiller serie");
  });

  it("gjør kandidatsidene selvforklarende i committed rapport", () => {
    const value = candidateCoverageReport([analysis], extractAnnualReportPageCandidates(analysis, texts));
    expect(value).toContain("| 2002 | 3 | 1 | serie, NM, junior, ungdom, personer, dommere/verv |");
    expect(value).toContain("| 2002 | 2 | 1 | 0 | serie, NM, junior, ungdom, personer, dommere/verv |");
    expect(value).not.toContain("AaFK spiller serie");
  });
});
