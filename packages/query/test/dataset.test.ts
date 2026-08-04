import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { runSafeSql } from "@aafkstats/db/sql";
import { readCoverage } from "../src/coverage.js";
import type { DatasetCoverage } from "../src/coverage.js";
import { datasetPrompt, exampleQueries, views } from "../src/dataset.js";

describe("datasetPrompt", () => {
  it("nevner alle viewene", () => {
    const prompt = datasetPrompt();
    for (const view of views) expect(prompt).toContain(view.name);
  });

  it("er stabil mellom kall så prompt-cachen treffer", () => {
    // Et tidsstempel eller en tilfeldig ID her ville gjort hele systemprompten
    // ucachebar, og hver eneste chatforespørsel ville betalt full pris.
    expect(datasetPrompt()).toBe(datasetPrompt());
  });

  it("inneholder testspørsmålet som eksempel", () => {
    expect(datasetPrompt()).toContain("6 mål på hjemmebane");
  });
});

describe("dokumentasjonen mot faktisk database", () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = join(mkdtempSync(join(tmpdir(), "aafk-dataset-")), "arkiv.sqlite");
    await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  }, 30_000);

  it("dokumenterer nøyaktig de kolonnene som finnes", async () => {
    // Dette er mekanismen som hindrer at dokumentasjonen og databasen gliser fra
    // hverandre. Legges en kolonne til i en migrasjon uten å dokumenteres, feiler
    // testen — og siden samme dokument går inn i systemprompten, ville modellen
    // ellers fått et ufullstendig bilde av datasettet uten at noen merket det.
    const { createRequire } = await import("node:module");
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    for (const view of views) {
      // PRAGMA table_info er blokkert for modellen, men ikke for oss — dette er
      // testkode som kjører med full lesetilgang, ikke chattens sti.
      const rows = db.prepare(`PRAGMA table_info(${view.name})`).all() as { name: string }[];
      const actual = new Set(rows.map((r) => r.name));
      const documented = new Set(view.columns.map((c) => c.name));

      const missing = [...actual].filter((c) => !documented.has(c));
      const extra = [...documented].filter((c) => !actual.has(c));

      expect({ view: view.name, udokumentert: missing, finnesIkke: extra }).toEqual({
        view: view.name,
        udokumentert: [],
        finnesIkke: [],
      });
    }
    db.close();
  });

  it("alle eksempelspørringene kjører", async () => {
    // Et eksempel som ikke kjører er verre enn ingen eksempler: modellen kopierer
    // mønsteret og får feil, og brukeren ser en spørring som ikke virker på /data.
    for (const ex of exampleQueries) {
      const result = await runSafeSql(ex.sql, { dbPath });
      expect(result.columns.length, `feilet: ${ex.question}`).toBeGreaterThan(0);
    }
  });
});

/**
 * Påstander som en gang sto i dokumentasjonen og var gale.
 *
 * Datasettdokumentasjonen går rett inn i systemprompten, så en foreldet påstand
 * her feilinformerer både leseren på `/data` og modellen, uten at noen av dem har
 * en måte å oppdage det på. Disse tre sto der i uker etter at de sluttet å
 * stemme, og testen finnes for at de ikke skal komme tilbake.
 */
describe("ingen påstander fra det gamle testdatasettet", () => {
  const forbudt: [string, RegExp][] = [
    ["fem kamper fra 2025 har hendelser", /fem kamper fra 2025/i],
    ["kampreferat med «tynn» dekning", /referat[^.]*tynn|tynn[^.]*referat/i],
    ["seasons som én rad per sesong", /[ÉE]n rad per sesong\.|kun sesongens hovedkonkurranse/i],
    ["høyeste kildeprioritet vinner automatisk", /h(ø|o)yeste prioritet vinner|vinner automatisk/i],
  ];

  for (const [navn, monster] of forbudt) {
    it(`sier ikke lenger «${navn}»`, () => {
      expect(datasetPrompt()).not.toMatch(monster);
    });
  }

  it("sier at hendelsesdekningen følger kilden, ikke kalenderen", () => {
    expect(datasetPrompt()).toContain("følger kilden, ikke kalenderen");
  });

  it("sier at arkivet foreløpig ikke har egne kampreferat", () => {
    expect(datasetPrompt()).toMatch(/ingen egne kampreferat/i);
  });

  it("sier at seasons har én rad per sesong og konkurranse", () => {
    expect(datasetPrompt()).toMatch(/[ÉE]n rad per sesong OG konkurranse/);
  });
});

/**
 * Dekningstall som kommer fra databasen kan ikke bli utdaterte.
 *
 * Testen bygger fixturen og sjekker at tallene i prompten er fixturens egne. Blir
 * dekningen skrevet tilbake som prosa, faller den her.
 */
describe("dekningen kommer fra databasen", () => {
  let coverage: DatasetCoverage;

  beforeAll(async () => {
    const path = join(mkdtempSync(join(tmpdir(), "aafk-dekning-")), "arkiv.sqlite");
    await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), path);
    const { createRequire } = await import("node:module");
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
    const db = new DatabaseSync(path, { readOnly: true });
    coverage = readCoverage(db);
    db.close();
  }, 30_000);

  it("teller fixturens spilte kamper, inkludert den på grønt bord", () => {
    expect(coverage.played).toBe(11);
    expect(coverage.scheduled).toBe(1);
  });

  it("skiller representerte år fra komplette seriesesonger", () => {
    // Fixturen har tre år. Ingen av dem er en komplett serie, og påstanden må
    // kunne si begge deler uten å blande dem.
    expect(coverage.years).toBe(3);
    expect(coverage.completeLeagueSeasons).toBeLessThan(coverage.years);
  });

  it("legger tallene inn i prompten", () => {
    const prompt = datasetPrompt(coverage);
    expect(prompt).toContain("## Dekning");
    expect(prompt).toContain(`${coverage.played} spilte kamper`);
    expect(prompt).toContain(`${coverage.withEvents} kamper`);
  });

  it("sier rett ut at arkivet ikke har egne kampreferat når det ikke har det", () => {
    // Fixturen har ett referat, så fritekstsøket kan testes. Det ekte arkivet har
    // null, og det er den setningen modellen må få servert riktig: et tomt treff
    // i reports betyr at referatet ikke er skrevet, ikke at kampen mangler.
    expect(coverage.withReport).toBeGreaterThan(0);
    expect(datasetPrompt(coverage)).toContain(`${coverage.withReport} kamper har eget kampreferat`);
    expect(datasetPrompt({ ...coverage, withReport: 0 })).toMatch(/ingen egne kampreferat/i);
  });

  it("er fortsatt stabil mellom kall, så prompt-cachen treffer", () => {
    expect(datasetPrompt(coverage)).toBe(datasetPrompt(coverage));
  });
});
