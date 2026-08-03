import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadValidateAndBuild } from "../src/build.js";
import { runSafeSql } from "../src/safe-sql.js";

/**
 * Kjører mot en ekte arkivfil.
 *
 * Til forskjell fra Postgres-utkastet trenger dette ingen tjeneste: fixture-arkivet
 * bygges til en midlertidig fil i beforeAll og kastes etterpå. Testene kjører derfor
 * likt lokalt og i CI — ingen «hoppes over uten database».
 */
const fixtures = resolve(import.meta.dirname, "../../../fixtures/data");
let dbPath: string;

beforeAll(async () => {
  dbPath = join(mkdtempSync(join(tmpdir(), "aafk-test-")), "arkiv.sqlite");
  await loadValidateAndBuild(fixtures, dbPath);
}, 30_000);

describe("runSafeSql mot ekte arkivfil", () => {
  it("kjører en lovlig spørring og returnerer rader", async () => {
    const r = await runSafeSql("SELECT match_id, date FROM matches ORDER BY date", { dbPath });
    expect(r.rowCount).toBeGreaterThan(0);
    expect(r.columns).toEqual(["match_id", "date"]);
    expect(r.truncated).toBe(false);
  });

  it("svarer riktig på testspørsmålet", async () => {
    const r = await runSafeSql(
      `SELECT date, opponent, aafk_score, opponent_score
       FROM matches
       WHERE is_home = 1 AND result = 'T' AND goal_difference <= -6
       ORDER BY date DESC LIMIT 1`,
      { dbPath },
    );
    expect(r.rowCount).toBe(1);
    const row = r.rows[0]!;
    // Fixturen har et større, nyere bortetap (0–7) som felle. Treffer vi det, er
    // is_home-filtreringen — og dermed hele AaFK-perspektivet — feil.
    expect(row.date).toBe("2005-09-18");
    expect(row.opponent).toBe("Rosenborg BK");
  });

  it("gir datoer som rene kalenderdatoer, ikke tidsstempler", async () => {
    // I Postgres-utkastet kom datoer tilbake som JS-Date og ble til
    // «Sun Sep 18 2005 00:00:00 GMT+0000» i JSON-en modellen fikk. Med TEXT-datoer
    // i SQLite finnes ikke problemet — men det skal ikke kunne snike seg inn igjen.
    const r = await runSafeSql("SELECT date FROM matches ORDER BY date LIMIT 1", { dbPath });
    expect(r.rows[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("håndhever radtaket og melder fra om at det ble kuttet", async () => {
    const r = await runSafeSql("SELECT m1.match_id FROM matches m1, matches m2", {
      dbPath,
      maxRows: 10,
    });
    expect(r.rowCount).toBe(10);
    expect(r.truncated).toBe(true);
  });

  it("melder ikke «kuttet» når treffene akkurat fyller taket", async () => {
    const r = await runSafeSql("SELECT match_id FROM matches LIMIT 3", { dbPath, maxRows: 3 });
    expect(r.rowCount).toBe(3);
    expect(r.truncated).toBe(false);
  });

  it("avbryter en treg spørring på timeout", async () => {
    // Et kryssprodukt av åtte kopier av kamptabellen. SQLite har ingen
    // statement_timeout, så dette beviser at SIGKILL-en mot child-prosessen
    // faktisk virker — en worker-tråd ville ikke latt seg avbryte her.
    await expect(
      runSafeSql(
        `SELECT count(*) FROM matches a, matches b, matches c, matches d,
                                matches e, matches f, matches g, matches h`,
        { dbPath, timeoutMs: 800 },
      ),
    ).rejects.toThrow(/for lang tid/i);
  }, 15_000);

  it("nektes skriving av SQLite selv om kodelaget skulle svikte", async () => {
    // Går utenom validateReadOnlySql med vilje: dette tester motorgrensen alene.
    // runSafeSql validerer, så vi kjører spørringen direkte mot en readOnly-fil.
    const { createRequire } = await import("node:module");
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    expect(() => db.exec("INSERT INTO core_clubs (id, name) VALUES ('x', 'y')")).toThrow(
      /readonly/i,
    );
    db.close();
  });
});
