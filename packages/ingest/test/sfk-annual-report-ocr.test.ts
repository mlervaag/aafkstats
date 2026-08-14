import { describe, expect, it } from "vitest";
import { ocrCoverageReport, ocrManifest, type AnnualReportOcrResult } from "../src/adapters/sfk-annual-report-ocr.js";

const result: AnnualReportOcrResult = {
  year: 1966,
  sourceId: "sunnmore-fotballkrets-arsrapport-1966",
  pages: 17,
  pagesProcessed: 17,
  pagesFailed: [],
  textChars: 12_345,
  meanConfidence: 78,
  cacheHits: 17,
  candidates: [
    {
      id: "sfk-side-kontroll",
      year: 1966,
      sourceId: "sunnmore-fotballkrets-arsrapport-1966",
      page: 4,
      strongMentions: 7,
      weakMentions: 0,
      topics: ["seniorTable", "cupResults", "officials"],
      keywords: ["divisjon", "runde"],
    },
  ],
};

describe("SFK-årsrapport-OCR", () => {
  it("lager et deterministisk manifest uten OCR-prosa", () => {
    const manifest = ocrManifest([result]);
    expect(manifest).toBe(ocrManifest([result]));
    expect(manifest).toContain('"candidatePages": 1');
    expect(manifest).not.toContain("OCR-prosa");
  });

  it("viser golden case med sidebaserte signaler", () => {
    const report = ocrCoverageReport([result]);
    expect(report).toContain("| 1966 | 17 | 17 | 0 | 12345 | 78.0 % | 1 | serie, NM, dommere/verv |");
    expect(report).toContain("| 1966 | 4 | 7 | 0 | serie, NM, dommere/verv | divisjon, runde |");
  });
});
