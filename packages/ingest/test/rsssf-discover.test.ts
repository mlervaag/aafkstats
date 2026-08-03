import { describe, expect, it } from "vitest";
import {
  classifyContent,
  classifyLabel,
  coverageReport,
  readIndexLinks,
} from "../src/adapters/rsssf-discover.js";
import type { DiscoveredPage } from "../src/adapters/rsssf-discover.js";

/** Årsindeksen fra 1965, forkortet. Filnavnene varierer fra år til år. */
const INDEX_1965 = `
<html><body>
<h1>Norwegian football 1965</h1>
League, round by round<br>
<a href="First.html">First division</a><br>
<a href="Second.html">Second division, group A and B</a> (tables only)<br>
<a href="Third.html">Third division</a> (tables only)<br>
<a href="Cup.html">Cup</a> (round by round)<br>
<a href="Ecup.html">European cups</a><br>
<a href="../1964/index.html">Previous season</a><br>
<a href="../archive.html">Back to archive</a>
</body></html>
`;

describe("årsindeksen", () => {
  it("finner sidene og hopper over navigasjonen", () => {
    const links = readIndexLinks(INDEX_1965).map((l) => l.file);
    expect(links).toEqual(["First.html", "Second.html", "Third.html", "Cup.html", "Ecup.html"]);
  });

  // Poenget med å lese indeksen i det hele tatt: filnavnene varierer, og bare
  // teksten rundt lenken sier om siden har enkeltkamper eller bare tabeller.
  it("leser etiketten fra teksten rundt lenken, ikke bare fra lenken", () => {
    const byFile = new Map(readIndexLinks(INDEX_1965).map((l) => [l.file, l.labelledAs]));
    expect(byFile.get("Second.html")).toBe("tables_only");
    expect(byFile.get("Third.html")).toBe("tables_only");
    expect(byFile.get("Cup.html")).toBe("match_list");
    expect(byFile.get("Ecup.html")).toBe("unknown");
  });

  it("kjenner igjen begge merkelappene", () => {
    expect(classifyLabel("First division (tables only)")).toBe("tables_only");
    expect(classifyLabel("Cup (round by round)")).toBe("match_list");
    expect(classifyLabel("National team")).toBe("unknown");
  });
});

describe("klassifisering etter innhold", () => {
  const table = [
    "Snøgg           14   8  2  4 35-21 18 Promoted",
    "Pors            14   7  4  3 21-14 18",
    "Moss            14   8  1  5 32-21 17",
    "Larvik Turn     14   5  5  4 21-17 15",
    "Runar           14   6  2  6 31-20 14",
    "Selbak          14   5  2  7 17-25 12",
  ].join("\n");

  const matches = [
    "19/4:   Start - Odd 0-0",
    "        Bryne - Kjelsås 2-0",
    "        Hødd - Lyn 0-0",
    "        Hamarkameratene - Aalesund 3-0",
    "7/5:    Eik-Tønsberg - Strindheim 1-1",
    "        Skeid - Raufoss 1-0",
  ].join("\n");

  it("kjenner igjen en ren kampoversikt", () => {
    expect(classifyContent(matches, 6)).toBe("match_list");
  });

  it("kjenner igjen en ren tabellside", () => {
    expect(classifyContent(table, 0)).toBe("tables_only");
  });

  /**
   * Den viktigste av de tre. «Tables only» i indeksen er ofte en sannhet med
   * modifikasjoner: 3. divisjon i 1965 er stort sett tabeller, men har åtte ekte
   * kvalifiseringskamper nederst. De er like gode data som alt annet, og en
   * klassifisering med bare to utfall ville kastet dem.
   */
  it("skiller ut sider som har både tabeller og kamper", () => {
    expect(classifyContent(`${table}\n\n${matches}`, 6)).toBe("mixed");
  });

  it("sier «unknown» når siden verken har tabeller eller kamper", () => {
    expect(classifyContent("Norwegian football 1918\nNo competition was played.", 0)).toBe("unknown");
  });
});

describe("dekningsrapporten", () => {
  const page = (over: Partial<DiscoveredPage>): DiscoveredPage => ({
    year: 1965, page: "Cup", label: "Cup (round by round)",
    url: "http://www.rsssf.no/1965/Cup.html",
    labelledAs: "match_list", kind: "match_list",
    totalMatches: 120, aafkMatches: 3, parseFailures: 0, needsReview: false,
    ...over,
  });

  it("summerer kamper og lister sidene de kom fra", () => {
    const report = coverageReport(
      [page({}), page({ year: 1966, aafkMatches: 2 })],
      { generatedAt: "2026-08-03" },
    );
    expect(report).toMatch(/AaFK-kamper funnet: \*\*5\*\*/);
    expect(report).toMatch(/\| 1965 \| `Cup`/);
    expect(report).toMatch(/\| 1966 \| `Cup`/);
  });

  it("skiller ut sidene som bør kontrolleres", () => {
    const report = coverageReport(
      [page({ labelledAs: "tables_only", kind: "match_list", needsReview: true })],
      { generatedAt: "2026-08-03" },
    );
    expect(report).toMatch(/Sider som bør kontrolleres/);
    expect(report).toMatch(/tables_only \| match_list/);
  });

  it("sier tydelig fra når ingenting trenger kontroll", () => {
    const report = coverageReport([page({})], { generatedAt: "2026-08-03" });
    expect(report).toMatch(/Ingen\. Etikett og innhold stemmer/);
  });

  // Rapporten sier hva som finnes. Om det kan publiseres er et annet spørsmål,
  // og de to skal ikke kunne forveksles.
  it("minner om at dekning ikke er det samme som rettigheter", () => {
    expect(coverageReport([], { generatedAt: "2026-08-03" })).toMatch(/data\/sources\/rsssf\.yaml/);
  });
});
