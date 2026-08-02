import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "@aafkstats/db";
import type { Sql } from "@aafkstats/db";
import { datasetPrompt, exampleQueries, views } from "../src/dataset.js";
import { runSafeSql } from "@aafkstats/db/sql";
import { connectReadonly } from "@aafkstats/db";

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

const url = process.env.DATABASE_URL;
const describeIfDb = url ? describe : describe.skip;

describeIfDb("dokumentasjonen mot faktisk database", () => {
  // Se kommentaren i safe-sql.integration.test.ts.
  let sql: Sql;
  let ro: Sql;
  beforeAll(() => {
    sql = connect(url);
    ro = connectReadonly();
  });
  afterAll(async () => {
    await sql?.end();
    await ro?.end();
  });

  it("dokumenterer nøyaktig de kolonnene som finnes", async () => {
    // Dette er mekanismen som hindrer at dokumentasjonen og databasen gliser fra
    // hverandre. Legges en kolonne til i en migrasjon uten å dokumenteres, feiler
    // testen — og siden samme dokument går inn i systemprompten, ville modellen
    // ellers fått et ufullstendig bilde av datasettet uten at noen merket det.
    for (const view of views) {
      const [schema, name] = view.name.split(".");
      const rows = await sql<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = ${schema!} AND table_name = ${name!}
      `;
      const actual = new Set(rows.map((r) => r.column_name));
      const documented = new Set(view.columns.map((c) => c.name));

      const missing = [...actual].filter((c) => !documented.has(c));
      const extra = [...documented].filter((c) => !actual.has(c));

      expect({ view: view.name, udokumentert: missing, finnesIkke: extra }).toEqual({
        view: view.name,
        udokumentert: [],
        finnesIkke: [],
      });
    }
  });

  it("alle eksempelspørringene kjører", async () => {
    // Et eksempel som ikke kjører er verre enn ingen eksempler: modellen kopierer
    // mønsteret og får feil, og brukeren ser en spørring som ikke virker på /data.
    for (const ex of exampleQueries) {
      const result = await runSafeSql(ro, ex.sql);
      expect(result.columns.length, `feilet: ${ex.question}`).toBeGreaterThan(0);
    }
  });
});
