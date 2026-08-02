import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectReadonly } from "../src/index.js";
import type { Sql } from "../src/index.js";
import { runSafeSql } from "../src/safe-sql.js";

/**
 * Kjører mot en ekte database som rollen aafk_chat.
 *
 * Hoppes over når DATABASE_URL_READONLY ikke er satt, slik at `pnpm test` fungerer
 * uten Postgres. I CI settes variabelen, og da er dette den eneste testen som faktisk
 * beviser at radtaket, timeouten og rollegrensen virker sammen.
 */
const url = process.env.DATABASE_URL_READONLY;
const describeIfDb = url ? describe : describe.skip;

describeIfDb("runSafeSql mot ekte database", () => {
  // Tilkoblingen opprettes i beforeAll, ikke i describe-kroppen. Vitest kjører
  // kroppen også for en skippet suite for å registrere testene, så en connect()
  // her ville kastet på manglende DATABASE_URL og gjort «hoppes over» til «feiler».
  let sql: Sql;
  beforeAll(() => {
    sql = connectReadonly(url);
  });
  afterAll(async () => {
    await sql?.end();
  });

  it("kjører en lovlig spørring og returnerer rader", async () => {
    const r = await runSafeSql(sql, "SELECT match_id, date FROM public_api.matches ORDER BY date");
    expect(r.rowCount).toBeGreaterThan(0);
    expect(r.columns).toEqual(["match_id", "date"]);
    expect(r.truncated).toBe(false);
  });

  it("svarer riktig på testspørsmålet", async () => {
    const r = await runSafeSql(
      sql,
      `SELECT date, opponent, aafk_score, opponent_score
       FROM public_api.matches
       WHERE is_home AND result = 'T' AND goal_difference <= -6
       ORDER BY date DESC LIMIT 1`,
    );
    expect(r.rowCount).toBe(1);
    const row = r.rows[0]!;
    // Fixturen har et større, nyere bortetap (0–7) som felle. Treffer vi det, er
    // is_home-filtreringen — og dermed hele AaFK-perspektivet — feil.
    expect(String(row.date)).toContain("2005-09-18");
    expect(row.opponent).toBe("Rosenborg BK");
  });

  it("håndhever radtaket og melder fra om at det ble kuttet", async () => {
    const r = await runSafeSql(sql, "SELECT * FROM generate_series(1, 500) AS n", {
      maxRows: 10,
    });
    expect(r.rowCount).toBe(10);
    expect(r.truncated).toBe(true);
  });

  it("melder ikke «kuttet» når treffene akkurat fyller taket", async () => {
    const r = await runSafeSql(sql, "SELECT * FROM generate_series(1, 10) AS n", { maxRows: 10 });
    expect(r.rowCount).toBe(10);
    expect(r.truncated).toBe(false);
  });

  it("avbryter en treg spørring på timeout", async () => {
    // repeat() er billig per rad, men 5 millioner rader tar lang nok tid til å
    // treffe taket. pg_sleep ville vært enklere, men er blokkert av denylisten.
    await expect(
      runSafeSql(
        sql,
        "SELECT count(*) FROM generate_series(1, 5000000) AS n, LATERAL (SELECT repeat('x', 200)) AS r",
        { timeoutMs: 250 },
      ),
    ).rejects.toThrow(/timeout|avbrutt|canceling/i);
  });

  it("nektes tilgang til core selv om kodelaget skulle svikte", async () => {
    // Går utenom validateReadOnlySql med vilje: dette tester databasegrensen alene.
    await expect(sql.unsafe("SELECT * FROM core.matches")).rejects.toThrow(/permission denied/i);
  });

  it("kan ikke skrive selv om kodelaget skulle svikte", async () => {
    await expect(
      sql.unsafe("INSERT INTO core.clubs (id, name) VALUES ('x', 'y')"),
    ).rejects.toThrow(/read-only|permission denied/i);
  });
});
