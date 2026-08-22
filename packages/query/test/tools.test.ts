import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { toolsByName, tools } from "../src/tools.js";
import type { ToolContext } from "../src/tools.js";

describe("verktøydefinisjoner", () => {
  it("har unike navn", () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("har beskrivelse på hvert verktøy", () => {
    // Beskrivelsen er det modellen bruker til å velge verktøy. Et verktøy uten
    // beskrivelse blir enten oversett eller brukt feil.
    for (const t of tools) expect(t.description.length).toBeGreaterThan(20);
  });
});

describe("verktøy mot ekte arkivfil", () => {
  // Bygger fixture-arkivet til en midlertidig fil. Ingen tjeneste å sette opp, så
  // testene kjører likt lokalt og i CI.
  let ctx: ToolContext;
  const queries: string[] = [];

  beforeAll(async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-tools-")), "arkiv.sqlite");
    await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
    ctx = { dbPath, onQuery: (i) => queries.push(i.sql) };
  }, 30_000);

  const call = async (name: string, input: unknown) => {
    const tool = toolsByName.get(name)!;
    return tool.run(tool.inputSchema.parse(input), ctx);
  };

  it("search_matches finner hjemmetapet med seks måls margin", async () => {
    const r = await call("search_matches", {
      isHome: true,
      result: "T",
      maxGoalDifference: -6,
      limit: 5,
    });
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.date).toBe("2005-09-18");
    expect(rows[0]!.url).toBe("/kamp/2005-09-18-aalesunds-fk-rosenborg-bk");
  });

  it("head_to_head slår opp på delvis navn", async () => {
    const r = await call("head_to_head", { opponent: "brann" });
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows[0]!.opponent).toBe("SK Brann");
  });

  it("get_match henter kamp, hendelser og referat", async () => {
    const r = await call("get_match", { matchId: "2024-04-01-aalesunds-fk-raufoss-il" });
    const c = r.content as Record<string, { rows: unknown[] }>;
    expect(c.match!.rows).toHaveLength(1);
    expect(c.events!.rows.length).toBeGreaterThan(0);
    expect(c.report!.rows).toHaveLength(1);
    expect(c.match!.rows[0]).toMatchObject({
      has_stats: 1,
      aafk_xg: 1.8,
      opponent_xg: 0.9,
      aafk_shots_on_target: 6,
    });
  });

  it("search_matches filtrerer på xG og statistikkdekning", async () => {
    const r = await call("search_matches", { hasStats: true, minXg: 1.5, maxXg: 2, limit: 10 });
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      match_id: "2024-04-01-aalesunds-fk-raufoss-il",
      has_stats: 1,
      aafk_xg: 1.8,
    });
  });

  it("snur statistikken til AaFK-perspektiv i en bortekamp", async () => {
    const r = await call("get_match", { matchId: "2024-04-07-molde-fk-aalesunds-fk" });
    const c = r.content as Record<string, { rows: Record<string, unknown>[] }>;
    expect(c.match!.rows[0]).toMatchObject({
      is_home: 0,
      aafk_xg: 0.7,
      opponent_xg: 2.1,
      aafk_shots: 7,
      opponent_shots: 16,
    });
  });

  it("search_reports finner tekst i referat", async () => {
    const r = await call("search_reports", { q: "snuoperasjon" });
    const rows = (r.content as { rows: unknown[] }).rows;
    expect(rows.length).toBeGreaterThan(0);
  });

  it("run_sql kjører en aggregering", async () => {
    const r = await call("run_sql", {
      sql: "SELECT count(*) AS n FROM matches WHERE status = 'played'",
    });
    expect(r.isError).toBeFalsy();
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(Number(rows[0]!.n)).toBeGreaterThan(0);
  });

  it("run_sql kan spørre direkte etter xG", async () => {
    const r = await call("run_sql", {
      sql: "SELECT match_id, aafk_xg, opponent_xg FROM matches WHERE aafk_xg IS NOT NULL",
    });
    expect(r.isError).toBeFalsy();
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows[0]).toMatchObject({ aafk_xg: 1.8, opponent_xg: 0.9 });
  });

  // Meldingene skal si hva som er galt, ikke bare at det gikk galt — ellers kan
  // modellen ikke formulere om og prøve igjen.
  it.each([
    ["DROP TABLE core_matches", /begynte med «DROP»/i],
    ["SELECT * FROM core_matches", /core_-tabellene/i],
    ["SELECT 1; SELECT 2", /én setning/i],
    ["PRAGMA table_list", /begynte med «PRAGMA»/i],
  ])("run_sql avviser «%s» med en forklarende melding", async (sql, expected) => {
    const r = await call("run_sql", { sql });
    expect(r.isError).toBe(true);
    expect((r.content as { error: string }).error).toMatch(expected);
  });

  it("run_sql gir en brukbar melding når kolonnenavnet ikke finnes", async () => {
    // Den vanligste ekte feilen: modellen gjetter et kolonnenavn. Meldingen må peke
    // tilbake på datasettdokumentasjonen så den kan slå opp i stedet for å gjette igjen.
    const r = await call("run_sql", { sql: "SELECT finnesikke FROM matches" });
    expect(r.isError).toBe(true);
    expect((r.content as { error: string }).error).toMatch(/datasettdokumentasjonen/i);
  });

  it("run_sql returnerer spørringen slik den ble skrevet", async () => {
    // Grensesnittet viser denne under svaret. Med SQLite håndheves radtaket i
    // child-prosessen i stedet for ved å pakke spørringen inn i en ytre SELECT,
    // så det brukeren ser er modellens egen SQL — ikke vår innpakning rundt den.
    // Radtaket testes for seg i safe-sql.integration.test.ts.
    const r = await call("run_sql", { sql: "SELECT 1 AS x" });
    expect((r.content as { executedSql: string }).executedSql).toBe("SELECT 1 AS x");
  });

  it("logger hver spørring som kjøres", async () => {
    const before = queries.length;
    await call("get_season_summary", { season: 2024 });
    expect(queries.length).toBeGreaterThan(before);
  });
});

describe("verktøy mot det historiske kandidatlaget", () => {
  let ctx: ToolContext;

  beforeAll(async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-history-tools-")), "arkiv.sqlite");
    await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
    ctx = { dbPath };
  }, 30_000);

  const call = async (name: string, input: unknown) => {
    const tool = toolsByName.get(name)!;
    return tool.run(tool.inputSchema.parse(input), ctx);
  };

  const rows = (result: Awaited<ReturnType<typeof call>>): Record<string, unknown>[] =>
    (result.content as { rows: Record<string, unknown>[] }).rows;

  it("søker i kontrollerte personroller", async () => {
    const result = rows(await call("search_people", { q: "formann", year: 1961 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("person_id");
    expect(result[0]).toHaveProperty("url");
  });

  it("søker i kildedokumenterte resultater uten full kampkobling", async () => {
    const result = rows(await call("search_historical_results", { season: 1915 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({ season: 1915 });
    expect(result[0]).toHaveProperty("source_title");
    expect(result[0]).toHaveProperty("claim_id");
    expect(result[0]).toHaveProperty("date");
    expect(result[0]).toHaveProperty("result_group_id");
  });

  it("finner rekordresultater i både kampmodellen og kildelaget", async () => {
    const response = await call("search_all_results", { ranking: "largest_win", limit: 10 });
    const result = rows(response);

    expect(result[0]).toMatchObject({
      evidence_level: "canonical_match",
      opponent: "Vigra",
      aafk_score: 15,
      opponent_score: 0,
      goal_difference: 15,
    });

    const langevaag1924 = result.filter((row) =>
      row.evidence_level === "source_claim" && row.season === 1924 && row.opponent === "Langevåg",
    );
    expect(langevaag1924).toHaveLength(1);
    expect(langevaag1924[0]).toMatchObject({
      aafk_score: 14,
      opponent_score: 0,
      result_group_id: "1924-langevag-14-0",
      source_count: 2,
      match_id: null,
    });
    expect(JSON.parse(String(langevaag1924[0]!.missing_fields))).toEqual([
      "canonical_match",
      "home_away",
      "date",
      "competition",
    ]);
    expect(JSON.parse(String(langevaag1924[0]!.sources))).toHaveLength(2);

    const vigra1964 = result.filter((row) =>
      row.season === 1964 && row.opponent === "Vigra" && row.aafk_score === 15,
    );
    expect(vigra1964).toHaveLength(1);
    expect(vigra1964[0]!.evidence_level).toBe("canonical_match");

    const content = response.content as { evidencePolicy: Record<string, unknown> };
    expect(content.evidencePolicy).toMatchObject({ contract: "archive-result-evidence@1" });
  });

  it("bevarer kilde, side og sikkerhet for rollekandidater", async () => {
    const result = rows(await call("search_resolved_roles", { q: "formann", limit: 5 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("source_title");
    expect(result[0]).toHaveProperty("page");
    expect(["high", "medium", "low"]).toContain(result[0]!.confidence);
  });

  it("bevarer kilde, side og sikkerhet for lagkandidater", async () => {
    const result = rows(await call("search_resolved_lineups", { limit: 5 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("source_title");
    expect(result[0]).toHaveProperty("page");
    expect(result[0]).toHaveProperty("confidence");
  });

  it("gjør personkonfliktene tilgjengelige for fri SQL", async () => {
    const result = rows(await call("run_sql", {
      sql: "SELECT person_id, field, value, decision FROM person_conflicts LIMIT 10",
    }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({ decision: "unresolved" });
  });
});
