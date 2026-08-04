import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAYED_SQL, PLAYED_STATUSES } from "../src/index.js";

const schema = readFileSync(resolve(import.meta.dirname, "../src/schema.sql"), "utf8");

/**
 * Regelen for hva som teller som en spilt kamp bor to steder: i `PLAYED_STATUSES`
 * for TypeScript, og i `core_played` for SQL. De kan ikke slås sammen, for SQLite
 * har ingen konstanter, men de kan holdes like av en test.
 */
describe("core_played", () => {
  it("bruker de samme statusene som PLAYED_STATUSES", () => {
    const match = schema.match(/CREATE VIEW core_played AS\s+SELECT \* FROM core_matches WHERE ([^;]+);/);
    expect(match, "fant ikke core_played i skjemaet").not.toBeNull();

    const inSql = [...match![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(inSql).toEqual([...PLAYED_STATUSES]);
  });

  it("holder awarded inne og abandoned ute", () => {
    // En kamp avgjort på grønt bord har et resultat og ligger bak oss. En avbrutt
    // kamp har ingen sluttstilling å telle, og hører derfor ikke med.
    expect(PLAYED_SQL).toContain("'awarded'");
    expect(PLAYED_SQL).not.toContain("'abandoned'");
    expect(PLAYED_SQL).not.toContain("'scheduled'");
  });

  it("lar ingen aggregatview filtrere på status for hånd", () => {
    // Hele poenget med core_played er at regelen finnes ett sted. Skriver noen
    // «status = 'played'» inn i et view igjen, er den to steder på nytt.
    const publicViews = schema.slice(schema.indexOf("-- ── Publisert kontrakt"));
    expect(publicViews).not.toMatch(/status\s*=\s*'played'/);
  });
});
