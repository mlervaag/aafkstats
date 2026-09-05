import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseArchiveYaml as parseYaml } from "../src/yaml.js";
import { repoRoot, loadArchive } from "../src/load.js";

describe("Medlemsblad 1965 Scan 14 Year Shift Guardrails - PR 204", () => {
  it("enforces exact season row counts for 1954, 1955, 1956, 1957", async () => {
    const root = repoRoot();
    const filePath = `${root}/data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`;
    const raw = await readFile(filePath, "utf8");
    const data = parseYaml(raw);

    const s1954 = data.seasons.find((s: any) => s.year === 1954);
    const s1955 = data.seasons.find((s: any) => s.year === 1955);
    const s1956 = data.seasons.find((s: any) => s.year === 1956);
    const s1957 = data.seasons.find((s: any) => s.year === 1957);

    expect(s1954?.results?.length).toBe(32);
    expect(s1955?.results?.length).toBe(29);
    expect(s1956?.results?.length).toBe(28);
    expect(s1957?.results?.length).toBe(29);
  });

  it("verifies landmark match boundary checks on scan 14", async () => {
    const root = repoRoot();
    const filePath = `${root}/data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`;
    const raw = await readFile(filePath, "utf8");
    const data = parseYaml(raw);

    const s1954 = data.seasons.find((s: any) => s.year === 1954);
    const s1955 = data.seasons.find((s: any) => s.year === 1955);
    const s1956 = data.seasons.find((s: any) => s.year === 1956);
    const s1957 = data.seasons.find((s: any) => s.year === 1957);

    // 1954 landmarks:
    // Guard 2-0 under ÅFKs jubileumsturnering (1954 #10)
    const guard1954 = s1954.results.find(
      (r: any) => r.opponent === "Guard" && r.score[0] === 2 && r.score[1] === 0
    );
    expect(guard1954).toBeDefined();
    expect(guard1954.no).toBe(10);
    expect(guard1954.note).toContain("jubileumsturnering");

    // Freidig 1-3 under Cupen (1954 #32)
    const freidig1954 = s1954.results.find(
      (r: any) => r.opponent === "Freidig" && r.score[0] === 1 && r.score[1] === 3
    );
    expect(freidig1954).toBeDefined();
    expect(freidig1954.no).toBe(32);
    expect(freidig1954.note).toContain("Cupen");

    // 1955 starts with Aksla 6-2 (#1)
    expect(s1955.results[0].no).toBe(1);
    expect(s1955.results[0].opponent).toBe("Aksla");
    expect(s1955.results[0].score).toEqual([6, 2]);

    // 1956 starts with Rollon 1-3 (#1)
    expect(s1956.results[0].no).toBe(1);
    expect(s1956.results[0].opponent).toBe("Rollon");
    expect(s1956.results[0].score).toEqual([1, 3]);

    // 1957 starts with Aksla 4-1 (#1)
    expect(s1957.results[0].no).toBe(1);
    expect(s1957.results[0].opponent).toBe("Aksla");
    expect(s1957.results[0].score).toEqual([4, 1]);
  });

  it("verifies migration mapping accounting covers all 54 moved rows and all renumbered rows", async () => {
    const root = repoRoot();
    const mappingPath = `${root}/data/discovery/medlemsblad-1965-year-shift-mapping.yaml`;
    const mappingRaw = await readFile(mappingPath, "utf8");
    const mapping = parseYaml(mappingRaw);

    expect(mapping.contract).toBe("medlemsblad-1965-year-shift-repair@1");
    expect(mapping.summary.totalMovedRows).toBe(54);
    expect(mapping.summary.totalRenumberedRows).toBe(55);
    expect(mapping.summary.matchesRemovedMedlemsbladSource).toBe(10);
    expect(mapping.movedItems.length).toBe(54);

    const movedYears = mapping.movedItems.map((m: any) => `${m.oldCoordinate.season}->${m.newCoordinate.season}`);
    const count55to54 = movedYears.filter((y: string) => y === "1955->1954").length;
    const count56to55 = movedYears.filter((y: string) => y === "1956->1955").length;
    const count57to56 = movedYears.filter((y: string) => y === "1957->1956").length;

    expect(count55to54).toBe(23);
    expect(count56to55).toBe(16);
    expect(count57to56).toBe(15);
  });

  it("verifies that 1955 canonical matches preserve independent NB provenance without medlemsblad source", async () => {
    const archive = await loadArchive();
    const m1955 = archive.matches.filter((m) => m.date.startsWith("1955-"));

    const independentNbMatches = [
      "1955-04-22-aalesunds-fk-rollon",
      "1955-05-15-aalesunds-fk-rollon",
      "1955-05-19-aalesunds-fk-rollon",
      "1955-05-30-aalesunds-fk-molde-fk",
      "1955-07-11-aalesunds-fk-hodd",
      "1955-08-14-kfk-aalesunds-fk",
      "1955-09-12-aalesunds-fk-guard",
      "1955-09-25-langevag-aalesunds-fk",
      "1955-10-09-aalesunds-fk-kfk",
      "1955-11-06-hodd-aalesunds-fk",
    ];

    for (const mId of independentNbMatches) {
      const match = m1955.find((m) => m.id === mId);
      expect(match).toBeDefined();
      // Must NOT cite medlemsblad-1965
      expect(match?.sources.some((s) => s.sourceId === "medlemsblad-for-aalesunds-fotb-1965-a2c9")).toBe(false);
      // MUST have NB provider and Sunnmørsposten externalReport
      expect(match?.providers.some((p) => p.providerId === "nasjonalbiblioteket")).toBe(true);
      expect(match?.externalReports.some((r) => r.publisher === "Sunnmørsposten")).toBe(true);
    }
  }, 30000);
});
