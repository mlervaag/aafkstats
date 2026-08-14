import { describe, expect, it } from "vitest";
import {
  analyzeAnnualReportPdf,
  analyzePageTexts,
  classifyTextLayer,
  countAafkMentions,
  technicalCoverageReport,
  technicalManifest,
  type AnnualReportTechnicalAnalysis,
} from "../src/adapters/sfk-annual-report-analysis.js";
import type { AnnualReportLink } from "../src/adapters/sfk-annual-reports.js";

const report = (year = 2002): AnnualReportLink => ({
  year,
  label: `Årsrapport ${year}`,
  url: `https://www.fotball.no/rapport-${year}.pdf`,
});

describe("tekstlag og AaFK-signaler", () => {
  it("klassifiserer none, sparse og usable fra råmålingene", () => {
    expect(classifyTextLayer(0, 10)).toBe("none");
    expect(classifyTextLayer(2, 10)).toBe("sparse");
    expect(classifyTextLayer(3, 10)).toBe("usable");
  });

  it("skiller sterke klubbaliaser fra svake stedsnavn", () => {
    expect(countAafkMentions(
      "AaFK AAFK Aafk ÅFK Aalesunds FK Aalesund FK Aalesunds Fotballklubb Aalesund Aalesunds",
    )).toEqual({ strong: 7, weak: 2 });
  });

  it("lagrer menneskelige sidetall og krever sterkt AaFK-treff for signaler", () => {
    const analysis = analyzePageTexts(
      report(),
      123,
      `sha256:${"a".repeat(64)}`,
      [
        "Aalesund har tabell, cup, junior og dommerkurs i byen.",
        "AaFK omtales ved serie, NM, reservelag, G19, G16, spiller og dommer.",
      ],
    );
    expect(analysis.mentionPages).toEqual([1, 2]);
    expect(analysis.signals).toEqual({
      seniorTable: true,
      cupResults: true,
      reserve: true,
      junior: true,
      youth: true,
      people: true,
      officials: true,
    });
  });

  it("gir ikke falsk fraværstolkning for en skann uten tekst", () => {
    const analysis = analyzePageTexts(report(1952), 100, `sha256:${"b".repeat(64)}`, ["", ""]);
    expect(analysis).toMatchObject({
      textLayer: "none",
      strongMentions: 0,
      weakMentions: 0,
      ocrStatus: "pending",
      extractionStatus: "unreviewed",
    });
    expect(technicalCoverageReport([analysis])).toMatch(/betyr derfor ikke at rapporten ikke omtaler AaFK/);
  });
});

describe("PDF.js-integrasjon", () => {
  it("leser sidetall og tekst fra en svært liten PDF", async () => {
    const text = "AaFK spiller serie og cup. Dette er nok tekst til at siden har et brukbart tekstlag.";
    const analysis = await analyzeAnnualReportPdf(report(), makePdf(text));
    expect(analysis.pages).toBe(1);
    expect(analysis.textChars).toBeGreaterThan(50);
    expect(analysis.textLayer).toBe("usable");
    expect(analysis.mentionPages).toEqual([1]);
    expect(analysis.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("avviser en HTML-feilside før PDF.js", async () => {
    const analysis = await analyzeAnnualReportPdf(report(), new TextEncoder().encode("<html>feil</html>"));
    expect(analysis).toMatchObject({ textLayer: "failed", ocrStatus: "pending" });
    expect(analysis.error).toMatch(/PDF-signaturen/);
  });
});

describe("deterministiske arbeidsdata", () => {
  const analysis = (year: number): AnnualReportTechnicalAnalysis =>
    analyzePageTexts(report(year), 10, `sha256:${String(year).padStart(64, "0")}`, [""]);

  it("sorterer manifestet på år og er byte-identisk", () => {
    const value = technicalManifest([analysis(2025), analysis(1952)]);
    expect(value.indexOf('"year": 1952')).toBeLessThan(value.indexOf('"year": 2025'));
    expect(value).toBe(technicalManifest([analysis(2025), analysis(1952)]));
  });

  it("genererer en deterministisk årsrapporttabell", () => {
    const value = technicalCoverageReport([analysis(2025), analysis(1952)]);
    expect(value.indexOf("| 1952 |")).toBeLessThan(value.indexOf("| 2025 |"));
    expect(value).toBe(technicalCoverageReport([analysis(2025), analysis(1952)]));
  });
});

function makePdf(text: string): Uint8Array {
  const escaped = text.replace(/([\\()])/gu, "\\$1");
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
