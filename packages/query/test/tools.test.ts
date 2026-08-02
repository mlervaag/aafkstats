import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectReadonly } from "@aafkstats/db";
import type { Sql } from "@aafkstats/db";
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

const url = process.env.DATABASE_URL_READONLY;
const describeIfDb = url ? describe : describe.skip;

describeIfDb("verktøy mot ekte database", () => {
  // Se kommentaren i safe-sql.integration.test.ts: tilkoblingen må opprettes i
  // beforeAll for at suiten faktisk skal kunne hoppes over uten database.
  let sql: Sql;
  let ctx: ToolContext;
  const queries: string[] = [];
  beforeAll(() => {
    sql = connectReadonly(url);
    ctx = { sql, onQuery: (i) => queries.push(i.sql) };
  });
  afterAll(async () => {
    await sql?.end();
  });

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
  });

  it("search_reports finner tekst i referat", async () => {
    const r = await call("search_reports", { q: "snuoperasjon" });
    const rows = (r.content as { rows: unknown[] }).rows;
    expect(rows.length).toBeGreaterThan(0);
  });

  it("run_sql kjører en aggregering", async () => {
    const r = await call("run_sql", {
      sql: "SELECT count(*) AS n FROM public_api.matches WHERE status = 'played'",
    });
    expect(r.isError).toBeFalsy();
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(Number(rows[0]!.n)).toBeGreaterThan(0);
  });

  // Meldingene skal si hva som er galt, ikke bare at det gikk galt — ellers kan
  // modellen ikke formulere om og prøve igjen.
  it.each([
    ["DROP TABLE core.matches", /begynte med «DROP»/i],
    ["SELECT * FROM core.matches", /kun public_api/i],
    ["SELECT 1; SELECT 2", /én setning/i],
    ["SELECT pg_sleep(10)", /pg_sleep/i],
  ])("run_sql avviser «%s» med en forklarende melding", async (sql, expected) => {
    const r = await call("run_sql", { sql });
    expect(r.isError).toBe(true);
    expect((r.content as { error: string }).error).toMatch(expected);
  });

  it("run_sql gir en brukbar melding når kolonnenavnet ikke finnes", async () => {
    // Den vanligste ekte feilen: modellen gjetter et kolonnenavn. Meldingen må peke
    // tilbake på datasettdokumentasjonen så den kan slå opp i stedet for å gjette igjen.
    const r = await call("run_sql", { sql: "SELECT finnesikke FROM public_api.matches" });
    expect(r.isError).toBe(true);
    expect((r.content as { error: string }).error).toMatch(/datasettdokumentasjonen/i);
  });

  it("run_sql returnerer spørringen som faktisk ble kjørt", async () => {
    // Grensesnittet viser denne under svaret. Uten den kan ikke brukeren
    // etterprøve hva modellen faktisk spurte om.
    const r = await call("run_sql", { sql: "SELECT 1 AS x" });
    expect((r.content as { executedSql: string }).executedSql).toContain("LIMIT");
  });

  it("logger hver spørring som kjøres", async () => {
    const before = queries.length;
    await call("get_season_summary", { season: 2024 });
    expect(queries.length).toBeGreaterThan(before);
  });
});
