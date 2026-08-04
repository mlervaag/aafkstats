import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "../src/build.js";
import { all, open } from "../src/index.js";

interface Row {
  season: number;
  played: number;
  expected_matches: number | null;
  coverage: string;
  coverage_evidence: string;
}

/**
 * En sesong er komplett når to uavhengige tall stemmer overens.
 *
 * Den forrige regelen svarte «komplett» på runde 1 til N uten hull. Det er sant
 * også når den virkelige sesongen hadde 22 runder og arkivet har fem: runde 1 til
 * 5 henger sammen, og merket lyver. Testene her bygger fire sesonger som skiller
 * tilfellene fra hverandre.
 *
 * Arkivet kopieres fra fixturen for å få klubber, konkurranser og kilder, og
 * sesongene legges oppå. Fixturen selv rører vi ikke: den brukes av alle de andre
 * testene, og et årstall lagt til her ville flyttet tallene deres.
 */
describe("kompletthet krever kjent omfang", () => {
  let rows: Map<number, Row>;
  let ongoing: Row | undefined;

  beforeAll(async () => {
    const root = mkdtempSync(join(tmpdir(), "aafk-coverage-"));
    const data = join(root, "data");
    cpSync(resolve(import.meta.dirname, "../../../fixtures/data"), data, { recursive: true });

    const match = (
      year: number,
      round: number,
      opponent: string,
      day: string,
    ): [string, string] => [
      `${year}-${day}-aalesunds-fk-${opponent}.yaml`,
      [
        `id: ${year}-${day}-aalesunds-fk-${opponent}`,
        `date: ${year}-${day}`,
        "status: played",
        `competition: { id: forstedivisjon, season: ${year}, stage: regular_season, round: ${round} }`,
        "home: { clubId: aalesunds-fk, score: 2 }",
        `away: { clubId: ${opponent}, score: 1 }`,
        "sources:",
        "  - { sourceId: rsssf, retrievedAt: 2026-08-02, fields: [home.score, away.score] }",
        "confidence: probable",
        "",
      ].join("\n"),
    ];

    const season = (year: number, body: string[]): void => {
      const dir = join(data, "seasons", String(year));
      mkdirSync(join(dir, "matches"), { recursive: true });
      writeFileSync(
        join(dir, "season.yaml"),
        [`year: ${year}`, "competitionId: forstedivisjon", ...body, ""].join("\n"),
      );
      for (const [name, yaml] of [
        match(year, 1, "molde-fk", "05-04"),
        match(year, 2, "sk-brann", "05-11"),
      ]) {
        writeFileSync(join(dir, "matches", name), yaml);
      }
    };

    // 1975: to kamper, og sluttabellen sier at AaFK spilte to. Komplett.
    season(1975, []);
    mkdirSync(join(data, "standings", "forstedivisjon"), { recursive: true });
    writeFileSync(
      join(data, "standings", "forstedivisjon", "1975.yaml"),
      [
        "competitionId: forstedivisjon",
        "season: 1975",
        "table:",
        "  - { position: 1, name: Aalesund, clubId: aalesunds-fk, played: 2, wins: 2, draws: 0, losses: 0, goalsFor: 4, goalsAgainst: 2, points: 4 }",
        "  - { position: 2, name: Molde, clubId: molde-fk, played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 2, goalsAgainst: 4, points: 0 }",
        "",
      ].join("\n"),
    );

    // 1976: to kamper med sammenhengende runder, men ingen vet hvor mange
    // runder sesongen hadde. Den kan se komplett ut og være det ikke.
    season(1976, []);

    // 1977: samme to kamper, men sesongfila sier at serien hadde 22.
    // Dette er tilfellet den gamle regelen svarte «komplett» på.
    season(1977, [
      "expectedMatches: 22",
      "note: Serien hadde 12 lag og 22 runder ifølge sesongoversikten hos RSSSF.",
    ]);

    const dbPath = join(root, "arkiv.sqlite");
    await loadValidateAndBuild(data, dbPath);
    const db = open(dbPath);
    rows = new Map(
      all<Row>(
        db,
        `SELECT season, played, expected_matches, coverage, coverage_evidence
         FROM seasons WHERE competition_id = 'forstedivisjon'`,
      ).map((row) => [row.season, row]),
    );
    ongoing = all<Row>(
      db,
      `SELECT season, played, expected_matches, coverage, coverage_evidence
       FROM seasons WHERE season = 2024 AND competition_id = 'eliteserien'`,
    )[0];
    db.close();
  }, 60_000);

  it("kaller sesongen komplett når tabellen bekrefter kampantallet", () => {
    expect(rows.get(1975)).toMatchObject({
      played: 2,
      expected_matches: 2,
      coverage: "complete",
      coverage_evidence: "rounds_and_standings",
    });
  });

  it("kaller den ikke komplett når ingen vet hvor mange kamper den hadde", () => {
    // Dette er den viktige forskjellen. Rundene henger sammen, men det sier
    // ingenting om hvor mange de skulle vært.
    expect(rows.get(1976)).toMatchObject({
      coverage: "unverified",
      coverage_evidence: "rounds_only",
      expected_matches: null,
    });
  });

  it("kaller runde 1 til 2 av 22 for delvis, ikke komplett", () => {
    expect(rows.get(1977)).toMatchObject({
      played: 2,
      expected_matches: 22,
      coverage: "partial",
      coverage_evidence: "rounds_and_declared_count",
    });
  });

  it("holder de tre fra hverandre", () => {
    const coverages = [1975, 1976, 1977].map((year) => rows.get(year)!.coverage);
    expect(new Set(coverages).size).toBe(3);
  });

  it("skiller en sesong som pågår fra en som mangler noe", () => {
    // 2024 i fixturen har én kamp igjen på terminlista. Den er ikke ufullstendig,
    // den er ikke ferdig, og de to skal ikke få samme merke.
    expect(ongoing).toMatchObject({ coverage: "in_progress", coverage_evidence: "season_in_progress" });
    expect(rows.get(1977)!.coverage).toBe("partial");
  });
});
