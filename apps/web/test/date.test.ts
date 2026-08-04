import { describe, expect, it } from "vitest";
import { formatDate, formatDateShort, formatDayMonth, formatWeekdayDate } from "../lib/date.js";

/**
 * Datoene på siden.
 *
 * ISO-formen er riktig i databasen og feil i teksten. Testene her holder på
 * begge halvdelene av den avgjørelsen: at en hel dato blir skrevet ut på norsk,
 * og at en streng vi ikke kan lese blir stående som den er framfor å bli gjettet
 * om til en dag som ikke finnes.
 */
describe("norske datoer", () => {
  it("skriver hele datoen ut", () => {
    expect(formatDate("2016-04-09")).toBe("9. april 2016");
    expect(formatDate("1980-12-01")).toBe("1. desember 1980");
  });

  it("dropper ledende null i dagen", () => {
    // «09. april» er skjemaspråk. En dato i en setning har ikke ledende null.
    expect(formatDate("2016-04-09")).not.toContain("09.");
  });

  it("forkorter måneden der kolonnen er trang", () => {
    expect(formatDateShort("2016-09-24")).toBe("24. sep. 2016");
    // Mars, mai, juni og juli står uforkortet. En forkortelse som er like lang
    // som ordet er bare en prikk til.
    expect(formatDateShort("2016-05-17")).toBe("17. mai 2016");
    expect(formatDateShort("2016-03-01")).toBe("1. mars 2016");
  });

  it("skriver dag og måned uten år", () => {
    expect(formatDayMonth("2023-07-02")).toBe("2. juli");
  });

  it("finner ukedagen", () => {
    expect(formatWeekdayDate("2026-08-09")).toBe("søndag 9. august");
  });

  it("lar en dato den ikke forstår stå urørt", () => {
    // `dateConfidence` åpner for kamper der bare året eller måneden er kjent.
    // Da er «1930» det arkivet vet, og en visning som gjorde det om til
    // 1. januar 1930 ville lagt til en opplysning ingen kilde har.
    expect(formatDate("1930")).toBe("1930");
    expect(formatDate("1930-05")).toBe("1930-05");
    expect(formatDate("")).toBe("");
  });

  it("lar en dato som ikke finnes stå urørt", () => {
    // Riktig fasong, feil kalender. Uten kontrollen ville dette blitt
    // «2. mars 2016», altså et annet svar enn kilden ga.
    expect(formatDate("2016-02-31")).toBe("2016-02-31");
    expect(formatDate("2016-13-01")).toBe("2016-13-01");
  });
});
