import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { clubNameForms } from "@aafkstats/schema";
import { loadSeason, loadStandings } from "../lib/archive.js";
import { searchMatches } from "../lib/search.js";
import { groupUnlinkedResults } from "../components/UnlinkedResults.js";

const previousDbPath = process.env.AAFK_DB_PATH;
beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-opponents-test-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 30_000);
afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("Historiske motstandernavn og klubbidentiteter", () => {
  it("har dokumenterte navnevarianter i clubNameForms for Braatt, Rollon, Sverre og Clausenengen", () => {
    const braatt = {
      id: "braatt",
      name: "Braatt",
      identityKey: "braatt",
      nameVariants: ["Brått", "Braat"],
    };
    const rollon = {
      id: "rollon",
      name: "Rollon",
      identityKey: "rollon",
      nameVariants: ["S.K. Rollon", "SK Rollon"],
    };
    const sverre = {
      id: "sverre",
      name: "Sverre",
      identityKey: "sverre",
      nameVariants: ["F.K. Sverre", "FK Sverre"],
    };
    const cfk = {
      id: "clausenengen",
      name: "Clausenengen",
      shortName: "CFK",
      identityKey: "clausenengen",
      nameVariants: ["C. F. K.", "C.F.K."],
    };

    expect(clubNameForms(braatt)).toContain("Brått");
    expect(clubNameForms(braatt)).toContain("Braat");
    expect(clubNameForms(rollon)).toContain("S.K. Rollon");
    expect(clubNameForms(sverre)).toContain("F.K. Sverre");
    expect(clubNameForms(cfk)).toContain("C. F. K.");
  });

  it("finner Braatt-kamper ved søk på Brått og Braatt", () => {
    const brattMatches = searchMatches("Brått");
    expect(brattMatches.length).toBeGreaterThan(0);
    expect(brattMatches.some((m) => m.opponent.includes("Braatt") || m.opponent.includes("Brått"))).toBe(true);

    const braattMatches = searchMatches("Braatt");
    expect(braattMatches.length).toBeGreaterThan(0);
  });

  it("finner Rollon-kamper ved søk på S.K. Rollon og Sverre-kamper ved F.K. Sverre", () => {
    const rollonMatches = searchMatches("S.K. Rollon");
    expect(rollonMatches.length).toBeGreaterThan(0);

    const sverreMatches = searchMatches("F.K. Sverre");
    expect(sverreMatches.length).toBeGreaterThan(0);
  });

  it("bevarer original kildetekst og setter riktig opponentClubId i uavklarte kildedokumenterte resultater", () => {
    const unlinked = groupUnlinkedResults([
      {
        id: "1917-008",
        sourceId: "25-aarsbok",
        season: 1917,
        page: 83,
        date: null,
        opponent: "Brått",
        opponentClubId: "braatt",
        aafkScore: 1,
        opponentScore: 4,
        result: "T",
        competitionId: null,
        status: "played",
        replay: false,
        afterExtraTime: false,
        round: null,
        resultGroupId: null,
        matchId: null,
        note: null,
      },
      {
        id: "1934-001",
        sourceId: "25-aarsbok",
        season: 1934,
        page: 87,
        date: null,
        opponent: "C. F. K.",
        opponentClubId: "clausenengen",
        aafkScore: 1,
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

    expect(unlinked).toHaveLength(2);
    expect(unlinked[0]?.opponent).toBe("Brått");
    expect(unlinked[0]?.opponentClubId).toBe("braatt");
    expect(unlinked[1]?.opponent).toBe("C. F. K.");
    expect(unlinked[1]?.opponentClubId).toBe("clausenengen");
  });

  it("bevarer kildens lagnavn i historiske sluttabeller med riktig clubId", () => {
    const table1918 = loadStandings("romsdalske-kreds", 1918);
    expect(table1918).toBeDefined();
    const braat = table1918!.table.find((r) => r.clubId === "braatt");
    expect(braat).toBeDefined();
    expect(braat!.team).toBe("Braat fotballklub, Kristiansund");

    const rollon = table1918!.table.find((r) => r.clubId === "rollon");
    expect(rollon).toBeDefined();
    expect(rollon!.team).toBe("Rollon fotballklub, Aalesund");

    const table1920 = loadStandings("sondmore-kreds-klasse-a", 1920);
    expect(table1920).toBeDefined();
    const rollon1920 = table1920!.table.find((r) => r.clubId === "rollon");
    expect(rollon1920).toBeDefined();
    expect(rollon1920!.team).toBe("Sportskl. Rollon");
  });

  it("kobler kilderesultater for 1919 til samlede resultatgrupper for Fremad og Braatt", () => {
    const season = loadSeason(1919);
    expect(season).toBeDefined();
    const unlinked = groupUnlinkedResults(season!.sourceResults);
    expect(unlinked.length).toBeGreaterThan(0);

    // NM 1. runde mot Fremad finnes i begge kilder, men grupperes sammen
    const fremadDoc = unlinked.find((r) => r.key === "nm-1919-fremad-runde-1");
    expect(fremadDoc).toBeDefined();
    expect(fremadDoc!.claims).toHaveLength(3);
    expect(fremadDoc!.opponentClubId).toBe("fremad");

    // NM 2. runde mot Braatt/Brått finnes i begge kilder, men grupperes sammen
    const braattDoc = unlinked.find((r) => r.key === "nm-1919-braatt-runde-2");
    expect(braattDoc).toBeDefined();
    expect(braattDoc!.claims).toHaveLength(3);
    expect(braattDoc!.opponentClubId).toBe("braatt");
  });
});
