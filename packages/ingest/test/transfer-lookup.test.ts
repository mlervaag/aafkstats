import { describe, expect, it } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import type { WikipediaTransferRow } from "../src/adapters/wikipedia-transfers.js";
import { addNamesToYaml } from "../src/wikipedia-transfer-store.js";
import { buildTransfer, lookupArrivals } from "../src/transfer-lookup.js";

function row(overrides: Partial<WikipediaTransferRow> = {}): WikipediaTransferRow {
  return {
    name: "Isak Skotheim",
    direction: "in",
    club: "Hødd",
    kind: "transfer",
    number: null,
    nationality: "NOR",
    position: null,
    other: "from Hødd",
    refs: [{
      title: "Isak Skotheim er klar",
      url: "https://www.aafk.no/nyheter/isak-skotheim-er-klar",
      publisher: "Aalesunds FK",
      date: "2026-09-02",
    }],
    ...overrides,
  };
}

function article(rows: WikipediaTransferRow[], windowSeason = 2026) {
  return {
    title: `List of Norwegian football transfers summer ${windowSeason}`,
    revid: 42,
    wikitext: "",
    windowSeason,
    rows,
  };
}

function archive(people: Archive["people"] = []): Archive {
  return {
    clubs: [{ id: "hodd", name: "Hødd", names: [], nameVariants: [], country: "NO", aliases: {} }],
    people,
  } as unknown as Archive;
}

const context = { archive: archive(), retrievedAt: "2026-09-05" };

describe("buildTransfer", () => {
  it("fører klubbmeldingen som egen henvisning, ikke bare Wikipedia", () => {
    const built = buildTransfer({
      row: row(),
      article: { title: "List of Norwegian football transfers summer 2026", revid: 42 },
      windowSeason: 2026,
      clubIdByKey: new Map([["hodd", "hodd"]]),
      taken: new Set(),
      retrievedAt: "2026-09-05",
    });

    expect("transfer" in built).toBe(true);
    if (!("transfer" in built)) return;
    expect(built.transfer).toMatchObject({ id: "inn-hodd-2026", direction: "in", club: "Hødd", date: "2026-09-02" });
    expect(built.transfer.providers.map((entry) => entry.providerId)).toEqual(["wikipedia", "aafk-no"]);
    // Permalenken skal peke på revisjonen vi leste, ikke på artikkelen «i dag».
    expect(built.transfer.providers[0]?.url).toBe("https://en.wikipedia.org/w/index.php?oldid=42");
  });

  it("skriver ikke en rad uten fotnote", () => {
    const built = buildTransfer({
      row: row({ refs: [] }),
      article: { title: "List of Norwegian football transfers summer 2026" },
      windowSeason: 2026,
      clubIdByKey: new Map(),
      taken: new Set(),
      retrievedAt: "2026-09-05",
    });

    expect(built).toEqual({ skipped: "manglerFotnote" });
  });
});

describe("lookupArrivals", () => {
  it("finner overgangen bak et navn fra kamptroppen", () => {
    const { found, missing } = lookupArrivals(
      [{ name: "Isak Skotheim", season: 2026 }],
      [article([row()])],
      context,
    );

    expect(missing).toEqual([]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ personId: "isak-skotheim", newNames: [] });
    expect(found[0]?.transfer.club).toBe("Hødd");
    expect(found[0]?.identityNote).toBeUndefined();
    // Personfila skal være klar til å skrives, med overgangen i.
    expect(found[0]?.person.transfers).toHaveLength(1);
  });

  it("kjenner igjen kamptroppens mellomnavn, og merker at identiteten er en antakelse", () => {
    // FotMob skriver «Isak Gabriel Skotheim» i oppstillingen; klubbmeldingen
    // Wikipedia siterer sier «Isak Skotheim». Ett ord til, ikke en annen mann.
    const { found } = lookupArrivals(
      [{ name: "Isak Gabriel Skotheim", season: 2026 }],
      [article([row()])],
      context,
    );

    expect(found[0]?.identityNote).toContain("Ført som samme person");
    // Skrivemåten fra oppstillingen må inn i fila, ellers er han usynlig i stallen.
    expect(found[0]?.newNames).toEqual(["Isak Gabriel Skotheim"]);
    expect(found[0]?.person.names).toEqual(["Isak Gabriel Skotheim"]);
  });

  it("ser bort fra utgående rader og fra vinduer etter debuten", () => {
    const later = article([row({ name: "Kari Hansen" })], 2027);
    const out = article([row({ name: "Ola Nordmann", direction: "out" })]);

    const { found, missing } = lookupArrivals(
      [{ name: "Kari Hansen", season: 2026 }, { name: "Ola Nordmann", season: 2026 }],
      [later, out],
      context,
    );

    expect(found).toEqual([]);
    expect(missing.map((entry) => entry.name)).toEqual(["Kari Hansen", "Ola Nordmann"]);
  });

  it("melder en rad uten fotnote som et problem, og skriver den ikke", () => {
    const { found, missing, issues } = lookupArrivals(
      [{ name: "Isak Skotheim", season: 2026 }],
      [article([row({ refs: [] })])],
      context,
    );

    expect(found).toEqual([]);
    expect(missing.map((entry) => entry.name)).toEqual(["Isak Skotheim"]);
    expect(issues[0]).toContain("ingen fotnote");
  });

  it("fører ikke en overgang arkivet allerede har", () => {
    const existing = {
      id: "isak-skotheim",
      name: "Isak Skotheim",
      names: [],
      transfers: [{
        id: "inn-hodd-2026",
        direction: "in" as const,
        kind: "transfer" as const,
        club: "Hødd",
        clubId: "hodd",
        date: "2026-09-02",
        sources: [],
        providers: [],
      }],
    };

    const { found, missing } = lookupArrivals(
      [{ name: "Isak Skotheim", personId: "isak-skotheim", season: 2026 }],
      [article([row()])],
      { archive: archive([existing] as unknown as Archive["people"]), retrievedAt: "2026-09-05" },
    );

    expect(found).toEqual([]);
    expect(missing.map((entry) => entry.name)).toEqual(["Isak Skotheim"]);
  });
});

describe("addNamesToYaml", () => {
  const fil = "id: isak-skotheim\nname: Isak Skotheim\n# kommentar som skal overleve\nnames:\n  - Isak S.\n";

  it("legger til skrivemåten uten å røre resten av fila", () => {
    const result = addNamesToYaml(fil, ["Isak Gabriel Skotheim"]);
    expect(result).toContain("# kommentar som skal overleve");
    expect(result).toContain("- Isak S.");
    expect(result).toContain("- Isak Gabriel Skotheim");
  });

  it("lar fila stå urørt når skrivemåten allerede er der", () => {
    expect(addNamesToYaml(fil, ["Isak S."])).toBe(fil);
    expect(addNamesToYaml(fil, [])).toBe(fil);
  });
});
