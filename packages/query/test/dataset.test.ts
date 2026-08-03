import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { runSafeSql } from "@aafkstats/db/sql";
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
