import { describe, expect, it } from "vitest";
import { parseFotmobTable } from "../src/adapters/fotmob-table.js";
import type { RawLeague } from "../src/adapters/fotmob-table.js";
import { computeProgression, pointsPerWin, progressionAgreesWithTable } from "../src/adapters/rsssf-table.js";

const context = { askedFor: "2026", url: "https://example.invalid/table" };

/**
 * En bitteliten divisjon: fire lag, dobbel serie, siste runde ikke spilt.
 *
 * Nok til å prøve det som faktisk kan gå galt — en sesong som pågår, en avlyst
 * kamp, og at kurven stemmer med tabellen — uten å røre nettet.
 */
function league(overrides: Partial<RawLeague> = {}): RawLeague {
  return {
    details: { name: "Testserien", selectedSeason: "2026" },
    table: [{ data: { table: { all: [
      { id: "1", name: "Alfa", played: 3, wins: 2, draws: 1, losses: 0, scoresStr: "5 - 3", pts: 7 },
      { id: "2", name: "Beta", played: 3, wins: 1, draws: 1, losses: 1, scoresStr: "4 - 3", pts: 4 },
      { id: "3", name: "Gamma", played: 3, wins: 1, draws: 1, losses: 1, scoresStr: "2 - 3", pts: 4 },
      { id: "4", name: "Delta", played: 3, wins: 0, draws: 1, losses: 2, scoresStr: "2 - 4", pts: 1 },
    ] } } }],
    fixtures: { allMatches: [
      fixture(1, "Alfa", "Beta", "2 - 1"),
      fixture(1, "Gamma", "Delta", "1 - 0"),
      fixture(2, "Beta", "Gamma", "2 - 0"),
      fixture(2, "Delta", "Alfa", "1 - 2"),
      fixture(3, "Alfa", "Gamma", "1 - 1"),
      fixture(3, "Delta", "Beta", "1 - 1"),
      { round: "4", home: { name: "Beta" }, away: { name: "Alfa" }, status: { finished: false } },
    ] },
    ...overrides,
  };
}

function fixture(round: number, home: string, away: string, scoreStr: string) {
  return { round: String(round), home: { name: home }, away: { name: away }, status: { finished: true, scoreStr } };
}

describe("parseFotmobTable", () => {
  it("leser tabellen og skiller spilte kamper fra resten", () => {
    const parsed = parseFotmobTable(league(), context);
    expect(parsed.leagueName).toBe("Testserien");
    expect(parsed.rows.map((row) => row.name)).toEqual(["Alfa", "Beta", "Gamma", "Delta"]);
    expect(parsed.rows[0]).toMatchObject({ played: 3, goalsFor: 5, goalsAgainst: 3, points: 7 });
    expect(parsed.results).toHaveLength(6);
    expect(parsed.unfinished).toBe(1);
  });

  it("tar med kildens lag-ID-er, som er koblingen til arkivet", () => {
    // Navnet alene holder ikke: kilden skriver «Aalesund» der arkivet skriver
    // «Aalesunds FK». Uten ID-en sto AaFKs egen rad uten klubb.
    expect(parseFotmobTable(league(), context).externalIds).toEqual(["1", "2", "3", "4"]);
  });

  it("teller en avlyst kamp verken som spilt eller som gjenstående", () => {
    const payload = league();
    payload.fixtures!.allMatches!.push({
      round: "4", home: { name: "Gamma" }, away: { name: "Delta" },
      status: { finished: false, cancelled: true },
    });
    const parsed = parseFotmobTable(payload, context);
    expect(parsed.results).toHaveLength(6);
    expect(parsed.unfinished).toBe(1);
  });

  it("gir ingen rad et utfall — sesongen har ikke ført til noe ennå", () => {
    // Kilden fargelegger europacup- og nedrykksplasser mens tabellen er halvferdig.
    // Det er en spådom om hvor det bærer, ikke noe plasseringen har ført til.
    for (const row of parseFotmobTable(league(), context).rows) expect(row.status).toBe("");
  });

  it("stopper når kilden svarer med en annen sesong enn den vi ba om", () => {
    const payload = league({ details: { name: "Testserien", selectedSeason: "2025" } });
    expect(() => parseFotmobTable(payload, context)).toThrow(/2025/);
  });

  it("stopper på en rad uten målscore framfor å gjette", () => {
    const payload = league();
    delete payload.table![0]!.data!.table!.all![1]!.scoresStr;
    expect(() => parseFotmobTable(payload, context)).toThrow(/Beta/);
  });

  it("gir en kurve som stemmer med tabellen den ble regnet ut av", () => {
    // Den samme kontrollen innhøsteren gjør før den lagrer kurven. Stemmer den
    // ikke, er det utregningen som skal utelates, ikke tabellen.
    const parsed = parseFotmobTable(league(), context);
    const curve = computeProgression(parsed.results, "Alfa", pointsPerWin(parsed.rows));
    expect(curve).toHaveLength(3);
    expect(progressionAgreesWithTable(curve, parsed.rows[0]!, 1)).toEqual({ ok: true });
  });
});
