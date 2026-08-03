import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { alias, parseSeasonPage, readTail } from "../src/adapters/rsssf.js";

const fixture = (name: string): string =>
  readFileSync(resolve(import.meta.dirname, "fixtures", name), "utf8");

describe("RSSSF-parseren mot ekte sider", () => {
  const first1998 = () => parseSeasonPage(fixture("rsssf-first-1998.html"), 1998, "First");
  const cup2009 = () => parseSeasonPage(fixture("rsssf-cup-2009.html"), 2009, "Cup");

  it("finner alle AaFKs kamper i 1. divisjon 1998", () => {
    const r = first1998();
    // 14 lag gir 26 kamper. Færre betyr at parseren mister linjer.
    expect(r.matches).toHaveLength(26);
    expect(r.failures).toHaveLength(0);
    expect(r.total).toBeGreaterThan(150);
  });

  /**
   * Den farligste feilen i hele parseren. Datoen står bare på den første kampen
   * i en gruppe og gjelder nedover — leses den feil, får en hel runde samme dato,
   * og ingenting i ettertid avslører det.
   */
  it("arver datoen nedover, og bytter når en ny dato dukker opp", () => {
    const r = first1998();
    const byDate = new Map(r.matches.map((m) => [m.date, m]));
    // Runde 1: AaFK står under «19/4», ikke under «7/5» lenger nede i samme runde.
    expect(byDate.has("1998-04-19")).toBe(true);
    // Runde 3 har tre datoer; AaFK-kampen står under den siste av dem.
    const round3 = r.matches.find((m) => m.round === 3);
    expect(round3?.date).toBe("1998-05-28");
  });

  it("gir hver kamp riktig runde", () => {
    const rounds = first1998().matches.map((m) => m.round).sort((a, b) => a! - b!);
    expect(rounds).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  });

  it("leser hjemmelag, bortelag og resultat", () => {
    const opener = first1998().matches.find((m) => m.date === "1998-04-19");
    expect(opener).toMatchObject({
      home: { name: "Hamarkameratene" },
      away: { name: "Aalesunds FK" },
      homeScore: 3,
      awayScore: 0,
      status: "played",
    });
  });

  it("kjenner igjen cupens navngitte runder", () => {
    const r = cup2009();
    expect(r.matches).toHaveLength(7);
    // Tidlige cuprunder føres som tall, slik FotMob-dataene også gjør — ellers er
    // samme turnering modellert på to måter avhengig av kilde.
    expect(r.matches.map((m) => m.round)).toEqual([1, 2, 3, 4, undefined, undefined, undefined]);
    expect(r.matches.map((m) => m.stage)).toEqual([
      undefined, undefined, undefined, undefined,
      "quarter_final", "semi_final", "final",
    ]);
  });

  it("leser cupfinalen i 2009 med ekstraomganger og straffer", () => {
    const final = cup2009().matches.at(-1)!;
    expect(final).toMatchObject({
      date: "2009-11-08",
      home: { name: "Aalesunds FK" },
      away: { name: "Molde" },
      homeScore: 2,
      awayScore: 2,
    });
    expect(final.penaltyShootout).toEqual({ home: 5, away: 4 });
    expect(final.extraTime).toEqual({ home: 0, away: 0 });
    expect(final.note).toMatch(/ekstraomganger/i);
  });

  it("lager stabile kilde-ID-er, så ny høsting oppdaterer i stedet for å duplisere", () => {
    const a = first1998().matches.map((m) => m.externalId);
    const b = first1998().matches.map((m) => m.externalId);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    expect(a[0]).toMatch(/^1998-first-1998-04-19-/);
  });
});

describe("halen på en resultatlinje", () => {
  it("kjenner igjen ekstraomganger", () => {
    const r = readTail("aet");
    expect(r.extraTime).toBe(true);
    expect(r.shootout).toBeUndefined();
    expect(r.note).toMatch(/ukjent/i);
  });

  it("leser straffesparkkonkurranse etter ekstraomganger", () => {
    expect(readTail("aet, 3-4 on pen.")).toMatchObject({
      extraTime: true,
      shootout: { home: 3, away: 4 },
    });
  });

  // Norsk særordning på 1980-tallet: uavgjorte seriekamper ble avgjort på straffer
  // for et bonuspoeng. Klammeformen er den eneste markøren.
  it("leser straffer i seriekamp skrevet i klammer", () => {
    expect(readTail("[3-2]")).toMatchObject({ extraTime: false, shootout: { home: 3, away: 2 } });
  });

  it("ignorerer fotnotemarkører", () => {
    expect(readTail("(*)")).toEqual({ extraTime: false });
    expect(readTail("")).toEqual({ extraTime: false });
  });
});

describe("klubbnavn", () => {
  // Uten denne koblingen blir AaFK sin egen klubb ved siden av seg selv, og hver
  // eneste kamp avvises fordi ingen av sidene er arkivets AaFK.
  it("kobler kildens navn til arkivets navn", () => {
    expect(alias("Aalesund")).toBe("Aalesunds FK");
    expect(alias("Odd Grenland")).toBe("Odds Ballklubb");
    expect(alias("Lyn Oslo")).toBe("Lyn");
  });

  it("lar ukjente navn stå urørt, så nye motstandere blir nye klubber", () => {
    expect(alias("Brattvåg")).toBe("Brattvåg");
  });
});
