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
    accepts("SELECT * FROM public_api.matches");
  });

  it("godtar WITH", () => {
    accepts("WITH t AS (SELECT 1 AS x) SELECT x FROM t");
  });

  it("godtar avsluttende semikolon og fjerner det", () => {
    expect(validateReadOnlySql("SELECT 1;").query).toBe("SELECT 1");
  });

  it("godtar semikolon inne i en streng", () => {
    // Den klassiske falske positiven. En naiv .includes(';') avviser dette.
    accepts("SELECT * FROM public_api.matches WHERE referee = 'Berg; Ola'");
  });

  it("godtar et forbudt ord inne i en streng", () => {
    accepts("SELECT * FROM public_api.reports WHERE body LIKE '%drop%'");
  });

  it("godtar OFFSET uten å forveksle det med SET", () => {
    accepts("SELECT * FROM public_api.matches ORDER BY date LIMIT 5 OFFSET 10");
  });

  it("godtar testspørsmålet", () => {
    accepts(`SELECT date, opponent, aafk_score, opponent_score
             FROM public_api.matches
             WHERE is_home AND result = 'T' AND goal_difference <= -6
             ORDER BY date DESC LIMIT 1`);
  });
});

describe("validateReadOnlySql — det som skal avvises", () => {
  it("avviser flere setninger", () => {
    rejects("SELECT 1; SELECT 2");
  });

  it("avviser en skjult andre setning etter kommentar", () => {
    rejects("SELECT 1 -- kommentar\n; DROP TABLE core.matches");
  });

  it("avviser DROP", () => rejects("DROP TABLE core.matches"));
  it("avviser INSERT", () => rejects("INSERT INTO core.clubs VALUES ('x')"));
  it("avviser UPDATE", () => rejects("UPDATE core.matches SET result = 'S'"));
  it("avviser DELETE", () => rejects("DELETE FROM core.matches"));
  it("avviser TRUNCATE", () => rejects("TRUNCATE core.matches"));
  it("avviser GRANT", () => rejects("GRANT ALL ON public_api.matches TO aafk_chat"));
  it("avviser COPY", () => rejects("COPY public_api.matches TO '/tmp/ut.csv'"));
  it("avviser pg_sleep", () => rejects("SELECT pg_sleep(30)"));
  it("avviser pg_read_file", () => rejects("SELECT pg_read_file('/etc/passwd')"));
  it("avviser SET", () => rejects("SET statement_timeout = 0"));

  it("avviser tilgang til core-skjemaet", () => {
    // Rollen ville stoppet det uansett; her handler det om å gi modellen en
    // forståelig melding i stedet for en rå rettighetsfeil.
    rejects("SELECT * FROM core.matches");
  });

  it("avviser tilgang til pg_catalog og information_schema", () => {
    rejects("SELECT * FROM pg_catalog.pg_tables");
    rejects("SELECT * FROM information_schema.columns");
  });

  it("avviser skriveoperasjon skjult i en CTE", () => {
    rejects("WITH x AS (DELETE FROM core.matches RETURNING *) SELECT * FROM x");
  });

  it("avviser tom spørring", () => rejects("   "));

  it("avviser en urimelig lang spørring", () => {
    rejects("SELECT " + "1,".repeat(3000) + "1");
  });
});
