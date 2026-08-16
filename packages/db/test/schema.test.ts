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

/**
 * Viewene uten `core_`-prefiks er den offentlige kontrakten, og README-en her
 * lister dem. Lista sto ufullstendig i flere måneder — `historical_observations`,
 * `verification_cases`, `match_stats`, `coach_spells`, `declared_coach_spells` og
 * `standings_progression` ble alle lagt til uten å bli skrevet inn — fordi
 * ingenting kontrollerte den. Nå gjør denne testen det.
 */
describe("README-lista over den offentlige kontrakten", () => {
  it("nevner nøyaktig de viewene skjemaet lager", () => {
    const readme = readFileSync(resolve(import.meta.dirname, "../README.md"), "utf8");
    const start = readme.indexOf("kontrakten:");
    const end = readme.indexOf("Spørrefunksjonen ser bare viewene.", start);
    expect(start, "fant ikke kontraktlista i README").toBeGreaterThan(-1);
    expect(end, "fant ikke slutten på kontraktlista i README").toBeGreaterThan(start);

    // `reports` er en FTS-tabell, ikke et view, og nevnes i lista som nettopp det.
    const listed = new Set(
      [...readme.slice(start, end).matchAll(/`([a-z_]+)`/g)].map((m) => m[1]!),
    );
    listed.delete("reports");

    const inSchema = new Set(
      [...schema.matchAll(/CREATE VIEW ([a-z_]+)/g)]
        .map((m) => m[1]!)
        .filter((name) => !name.startsWith("core_")),
    );

    expect({
      mangler: [...inSchema].filter((name) => !listed.has(name)).sort(),
      finnesIkke: [...listed].filter((name) => !inSchema.has(name)).sort(),
    }).toEqual({ mangler: [], finnesIkke: [] });
  });
});
