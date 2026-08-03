import { describe, expect, it } from "vitest";
import {
  UnsafeSqlError,
  revealIdentifiers,
  runnerEnv,
  stripLiterals,
  validateReadOnlySql,
} from "../src/safe-sql.js";

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

describe("revealIdentifiers", () => {
  it("beholder lengden", () => {
    const input = 'SELECT "en kolonne" FROM t';
    expect(revealIdentifiers(input)).toHaveLength(input.length);
  });

  it("pakker ut alle tre sitatformene SQLite godtar", () => {
    expect(revealIdentifiers('SELECT * FROM "core_matches"')).toContain("core_matches");
    expect(revealIdentifiers("SELECT * FROM [core_matches]")).toContain("core_matches");
    expect(revealIdentifiers("SELECT * FROM `core_matches`")).toContain("core_matches");
  });

  it("nøytraliserer fortsatt tekststrenger", () => {
    // Et navn skrevet som streng har ikke rørt en tabell, og skal ikke avvises.
    expect(revealIdentifiers("SELECT * FROM reports WHERE body LIKE '%core_matches%'")).not.toContain(
      "core_matches",
    );
  });

  it("nøytraliserer fortsatt kommentarer", () => {
    expect(revealIdentifiers("SELECT 1 -- core_matches\nFROM t")).not.toContain("core_matches");
  });
});

describe("runnerEnv", () => {
  it("gir ikke child-prosessen hemmeligheter eller NODE_OPTIONS", () => {
    // Prosessen som kjører modellens SQL skal åpne én fil og ikke mer. Arver den
    // hele miljøet, bærer det innerste og minst privilegerte laget også
    // API-nøkkelen — og NODE_OPTIONS kan inneholde --require, som ville kjørt
    // fremmed kode nettopp der.
    const before = { key: process.env.ANTHROPIC_API_KEY, opts: process.env.NODE_OPTIONS };
    process.env.ANTHROPIC_API_KEY = "sk-ant-skal-ikke-arves";
    process.env.NODE_OPTIONS = "--require /tmp/ondsinnet.js";
    try {
      const env = runnerEnv();
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      expect(env.NODE_OPTIONS).toBeUndefined();
      expect(Object.keys(env)).toContain("PATH");
    } finally {
      if (before.key === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = before.key;
      if (before.opts === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = before.opts;
    }
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

  it("avviser siterte navn like godt som usiterte", () => {
    // Kontrollen leste tidligere spørringen med identifikatorene blanket ut, mens
    // det var råteksten som ble kjørt. Sitattegn holdt derfor navnet skjult for
    // filteret og synlig for SQLite — hele grensen mot core_ og sqlite_ falt på
    // ett par anførselstegn.
    rejects('SELECT * FROM "core_matches"');
    rejects("SELECT * FROM [core_matches]");
    rejects("SELECT * FROM `core_matches`");
    rejects('SELECT name FROM "sqlite_master"');
    rejects("SELECT name FROM [sqlite_master]");
  });

  it("avviser PRAGMA-tabellfunksjonene", () => {
    // `\\bpragma\\b` traff ingen av disse, for understrek er et ordtegn.
    // pragma_database_list røper hvor arkivfilen ligger på disk.
    rejects("SELECT * FROM pragma_database_list");
    rejects("SELECT * FROM pragma_table_info('matches')");
    rejects("SELECT * FROM pragma_table_list");
  });

  it("avviser hele sqlite_-navnerommet, ikke bare de kjente navnene", () => {
    // sqlite_dbpage leser rå sider ut av filen og sto ikke i den gamle lista.
    rejects("SELECT * FROM sqlite_dbpage");
    rejects("SELECT * FROM sqlite_temp_schema");
  });

  it("lar sqlite_version() stå, den røper ingenting", () => {
    accepts("SELECT sqlite_version()");
  });

  it("avviser tom spørring", () => rejects("   "));

  it("avviser en urimelig lang spørring", () => {
    rejects("SELECT " + "1,".repeat(3000) + "1");
  });
});
