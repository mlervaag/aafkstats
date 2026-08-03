import { describe, expect, it } from "vitest";
import { UnsafeSqlError, stripLiterals, validateReadOnlySql } from "../src/safe-sql.js";

const rejects = (sql: string) => {
  expect(() => validateReadOnlySql(sql)).toThrow(UnsafeSqlError);
};
const accepts = (sql: string) => {
  expect(() => validateReadOnlySql(sql)).not.toThrow();
};

describe("stripLiterals", () => {
  it("beholder lengden så feilposisjoner fortsatt stemmer", () => {
    const input = "SELECT 'abc' FROM t";
    expect(stripLiterals(input)).toHaveLength(input.length);
  });

  it("nøytraliserer enkeltfnutt-strenger", () => {
    expect(stripLiterals("SELECT 'a;b'")).toBe("SELECT      ");
  });

  it("håndterer escapet apostrof inni streng", () => {
    // 'it''s' er én streng, ikke to. Bommer vi her tolkes resten av spørringen feil.
    const out = stripLiterals("SELECT 'it''s ok;' , 1");
    expect(out).not.toContain(";");
    expect(out).toContain(", 1");
  });

  it("nøytraliserer linjekommentarer", () => {
    expect(stripLiterals("SELECT 1 -- DROP TABLE x\nFROM t")).not.toMatch(/DROP/i);
  });

  it("nøytraliserer nestede blokkommentarer", () => {
    const out = stripLiterals("SELECT /* ytre /* indre */ fortsatt inne */ 1");
    expect(out).not.toContain("indre");
    expect(out).toContain("1");
  });

  it("nøytraliserer dollar-siterte strenger", () => {
    expect(stripLiterals("SELECT $tag$ DROP TABLE x; $tag$")).not.toMatch(/DROP/i);
  });

  it("nøytraliserer siterte identifikatorer", () => {
    expect(stripLiterals('SELECT "rar;kolonne" FROM t')).not.toContain(";");
  });
});

describe("validateReadOnlySql — det som skal slippe gjennom", () => {
  it("godtar en enkel SELECT", () => {
    accepts("SELECT * FROM matches");
  });

  it("godtar WITH", () => {
    accepts("WITH t AS (SELECT 1 AS x) SELECT x FROM t");
  });

  it("godtar avsluttende semikolon og fjerner det", () => {
    expect(validateReadOnlySql("SELECT 1;").query).toBe("SELECT 1");
  });

  it("godtar semikolon inne i en streng", () => {
    // Den klassiske falske positiven. En naiv .includes(';') avviser dette.
    accepts("SELECT * FROM matches WHERE referee = 'Berg; Ola'");
  });

  it("godtar et forbudt ord inne i en streng", () => {
    accepts("SELECT * FROM reports WHERE body LIKE '%drop%'");
  });

  it("godtar OFFSET uten å forveksle det med SET", () => {
    accepts("SELECT * FROM matches ORDER BY date LIMIT 5 OFFSET 10");
  });

  it("godtar testspørsmålet", () => {
    accepts(`SELECT date, opponent, aafk_score, opponent_score
             FROM matches
             WHERE is_home = 1 AND result = 'T' AND goal_difference <= -6
             ORDER BY date DESC LIMIT 1`);
  });
});

describe("validateReadOnlySql — det som skal avvises", () => {
  it("avviser flere setninger", () => {
    rejects("SELECT 1; SELECT 2");
  });

  it("avviser en skjult andre setning etter kommentar", () => {
    rejects("SELECT 1 -- kommentar\n; DROP TABLE core_matches");
  });

  it("avviser DROP", () => rejects("DROP TABLE core_matches"));
  it("avviser INSERT", () => rejects("INSERT INTO core_clubs VALUES ('x')"));
  it("avviser UPDATE", () => rejects("UPDATE core_matches SET result = 'S'"));
  it("avviser DELETE", () => rejects("DELETE FROM core_matches"));
  it("avviser ATTACH", () => rejects("SELECT 1 FROM matches WHERE 1=1 /* */ ATTACH DATABASE '/tmp/x' AS p"));
  it("avviser PRAGMA", () => rejects("PRAGMA table_list"));
  it("avviser load_extension", () => rejects("SELECT load_extension('/tmp/x.so')"));
  it("avviser readfile", () => rejects("SELECT readfile('/etc/passwd')"));
  it("avviser WITH RECURSIVE", () => rejects("WITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM t) SELECT n FROM t"));
  it("avviser VACUUM", () => rejects("VACUUM"));

  it("avviser tilgang til de interne core_-tabellene", () => {
    // SQLite har ingen roller, så denne avvisningen ER grensen — ikke bare en
    // hjelpsom melding slik den var med en Postgres-rolle bak.
    rejects("SELECT * FROM core_matches");
    rejects("SELECT * FROM core_clubs JOIN matches ON 1=1");
  });

  it("avviser SQLites systemtabeller", () => {
    rejects("SELECT name FROM sqlite_master");
    rejects("SELECT * FROM sqlite_schema");
  });

  it("avviser skriveoperasjon skjult i en CTE", () => {
    rejects("WITH x AS (DELETE FROM core_matches RETURNING *) SELECT * FROM x");
  });

  it("avviser tom spørring", () => rejects("   "));

  it("avviser en urimelig lang spørring", () => {
    rejects("SELECT " + "1,".repeat(3000) + "1");
  });
});
