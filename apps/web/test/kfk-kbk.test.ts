import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { canonicalClubKey, clubNameForms } from "@aafkstats/schema";
import { loadOpponent, loadOpponents, loadOpponentIds, loadStandings, loadSeason } from "../lib/archive.js";
import { searchMatches } from "../lib/search.js";
import { groupUnlinkedResults } from "../components/UnlinkedResults.js";

const previousDbPath = process.env.AAFK_DB_PATH;
beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-kfk-kbk-test-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 30_000);
afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("KFK og KBK klubbidentitet og historikkskille", () => {
  it("skiller KFK og KBK i canonicalClubKey og inkluderer alle navneformer", () => {
    const kfkClub = {
      id: "kfk",
      name: "Kristiansund Fotballklubb",
      shortName: "KFK",
      identityKey: "kristiansund-fk",
      nameVariants: ["KFK", "K.F.K.", "K. F. K.", "Kristiansunds Fotballklub"],
    };
    const kbkClub = {
      id: "kristiansund",
      name: "Kristiansund Ballklubb",
      shortName: "KBK",
      identityKey: "kristiansund-bk",
      nameVariants: ["Kristiansund BK", "KBK"],
    };

    expect(canonicalClubKey(kfkClub)).toBe("kristiansund-fk");
    expect(canonicalClubKey(kbkClub)).toBe("kristiansund-bk");
    expect(canonicalClubKey(kfkClub)).not.toBe(canonicalClubKey(kbkClub));

    const kfkForms = clubNameForms(kfkClub);
    expect(kfkForms).toContain("KFK");
    expect(kfkForms).toContain("K.F.K.");
    expect(kfkForms).toContain("K. F. K.");
    expect(kfkForms).toContain("Kristiansunds Fotballklub");
  });

  it("skiller innbyrdes motstanderstatistikk for KFK og KBK", () => {
    const kfk = loadOpponent("kfk");
    const kbk = loadOpponent("kristiansund");

    expect(kfk).toBeDefined();
    expect(kbk).toBeDefined();

    expect(kfk!.summary.opponent).toBe("Kristiansund Fotballklubb");
    expect(kbk!.summary.opponent).toBe("Kristiansund Ballklubb");

    // Sjekk at historiske kamper (1925, 1945, 1982, 1990, 1991, 1993) ligger på KFK
    const kfkYears = new Set(kfk!.matches.map((m) => Number(m.date.slice(0, 4))));
    expect(kfkYears.has(1925)).toBe(true);
    expect(kfkYears.has(1945)).toBe(true);
    expect(kfkYears.has(1982)).toBe(true);
    expect(kfkYears.has(1990)).toBe(true);
    expect(kfkYears.has(1991)).toBe(true);
    expect(kfkYears.has(1993)).toBe(true);

    // Sjekk at moderne kamper (2014+) ligger på KBK
    const kbkYears = new Set(kbk!.matches.map((m) => Number(m.date.slice(0, 4))));
    expect(kbkYears.has(2014)).toBe(true);
    expect(kbkYears.has(2024)).toBe(true);
    expect(kbkYears.has(1925)).toBe(false);
    expect(kbkYears.has(1945)).toBe(false);

    // Ingen kamp forekommer i begge
    const kfkMatchIds = new Set(kfk!.matches.map((m) => m.matchId));
    for (const kbkMatch of kbk!.matches) {
      expect(kfkMatchIds.has(kbkMatch.matchId)).toBe(false);
    }

    // Begge finnes i loadOpponents
    const opponents = loadOpponents();
    const opponentIds = new Set(opponents.map((o) => o.id));
    expect(opponentIds.has("kfk")).toBe(true);
    expect(opponentIds.has("kristiansund")).toBe(true);
  });

  it("viser riktig clubId i historiske sluttabeller", () => {
    // 1918 Romsdalske krets
    const table1918 = loadStandings("romsdalske-kreds", 1918);
    expect(table1918).toBeDefined();
    const kfk1918 = table1918!.table.find((r) => r.team.toLowerCase().includes("kristiansund"));
    expect(kfk1918?.clubId).toBe("kfk");

    // 1958 1. divisjon
    const table1958 = loadStandings("forstedivisjon", 1958);
    expect(table1958).toBeDefined();
    const kfk1958 = table1958!.table.find((r) => r.team === "K.F.K.");
    expect(kfk1958?.clubId).toBe("kfk");
  });

  it("bruker opponentClubId kfk for historiske kilderesultater", () => {
    const season1917 = loadSeason(1917);
    expect(season1917).toBeDefined();
    const kretsfinale1917 = season1917!.sourceResults.find(
      (r) => r.sourceId === "nff-arbok-1917" && r.opponent === "Kristiansunds Fotballklub",
    );
    expect(kretsfinale1917?.opponentClubId).toBe("kfk");

    const season1918 = loadSeason(1918);
    expect(season1918).toBeDefined();
    const nm1918 = season1918!.sourceResults.find(
      (r) => r.sourceId === "nff-arbok-1918" && r.opponent === "Kristiansund",
    );
    expect(nm1918?.opponentClubId).toBe("kfk");
  });

  it("finner KFK-kamper i søk ved søk på KFK, K.F.K. og KBK-kamper ved KBK", () => {
    const kfkMatches = searchMatches("KFK");
    expect(kfkMatches.length).toBeGreaterThan(0);
    expect(kfkMatches.some((m) => m.date.startsWith("1925-08-30"))).toBe(true);

    const kfkDotMatches = searchMatches("K.F.K.");
    expect(kfkDotMatches.length).toBeGreaterThan(0);

    const kbkMatches = searchMatches("KBK");
    expect(kbkMatches.length).toBeGreaterThan(0);
    expect(kbkMatches.every((m) => Number(m.date.slice(0, 4)) >= 2003)).toBe(true);
  });

  it("bevarer kildens skrivemåte og oppretter motstanderkobling i unlinked results", () => {
    const unlinked = groupUnlinkedResults([
      {
        id: "1915-004",
        sourceId: "25-aarsbok",
        season: 1915,
        page: 83,
        date: null,
        opponent: "K. F. K.",
        opponentClubId: "kfk",
        aafkScore: 3,
        opponentScore: 0,
        result: "S",
        competitionId: null,
        status: "played",
        replay: false,
        afterExtraTime: false,
        round: null,
        resultGroupId: null,
        matchId: null,
        note: null,
      },
    ]);

    expect(unlinked).toHaveLength(1);
    expect(unlinked[0]?.opponent).toBe("K. F. K.");
    expect(unlinked[0]?.opponentClubId).toBe("kfk");
  });

  it("inkluderer både kfk og kristiansund i loadOpponentIds siden begge har kanoniske kamper", () => {
    const opponentIds = loadOpponentIds();
    expect(opponentIds.has("kfk")).toBe(true);
    expect(opponentIds.has("kristiansund")).toBe(true);
    expect(opponentIds.has("klubb-uten-kamper")).toBe(false);
  });
});
