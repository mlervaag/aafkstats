import { describe, expect, it } from "vitest";
import { findConflicts, observation, observationPath, payloadHash } from "../src/observation.js";
import type { Observation } from "../src/observation.js";

const base = {
  providerId: "rsssf",
  externalId: "1998-first-1998-04-19",
  matchId: "1998-04-19-hamarkameratene-aalesunds-fk",
  retrievedAt: "2026-08-04",
  adapter: "rsssf@1",
  raw: {},
  normalized: {},
};

const entry = (over: Partial<Observation> = {}): Observation =>
  observation.parse({ ...base, payloadHash: payloadHash(over.raw ?? {}), ...over });

describe("observasjonsskjemaet", () => {
  it("krever en hash som ser ut som en hash", () => {
    // Feltet finnes for å kunne sammenlignes mellom kjøringer. En tom streng
    // eller en avkortet hash ville sammenlignet likt for alt.
    expect(observation.safeParse({ ...base, payloadHash: "sha256:kort" }).success).toBe(false);
    expect(observation.safeParse({ ...base, payloadHash: payloadHash({}) }).success).toBe(true);
  });

  it("avviser ukjente felt", () => {
    // Skrivefeil i en observasjon er stille datatap: feltet forsvinner, men fila
    // består. `.strict()` gjør den til en feil i stedet.
    expect(observation.safeParse({ ...base, payloadHash: payloadHash({}), kilde: "rsssf" }).success)
      .toBe(false);
  });

  it("lar matchId være null for en kamp som ikke lot seg plassere", () => {
    expect(entry({ matchId: null }).matchId).toBeNull();
  });
});

describe("payloadHash", () => {
  it("henger på verdiene, ikke på rekkefølgen adapteren leste dem i", () => {
    // Dette er hele poenget: en omskrevet adapter som leser de samme feltene i en
    // annen rekkefølge skal ikke få hver eneste kamp til å se endret ut.
    expect(payloadHash({ home: "Brann", away: "Aalesund" }))
      .toBe(payloadHash({ away: "Aalesund", home: "Brann" }));
  });

  it("endrer seg når kilden endrer en verdi", () => {
    expect(payloadHash({ homeScore: 3 })).not.toBe(payloadHash({ homeScore: 2 }));
  });

  it("skiller en manglende verdi fra en tom", () => {
    expect(payloadHash({})).not.toBe(payloadHash({ attendance: null }));
  });
});

describe("observationPath", () => {
  it("legger fila under kilden sin", () => {
    expect(observationPath("fotmob", "4385655")).toBe("observations/fotmob/4385655.yaml");
  });

  it("vasker en ekstern ID som ikke tåler å være et filnavn", () => {
    // RSSSF-ID-ene er hele setninger med skråstrek og punktum i seg.
    expect(observationPath("rsssf", "1998 First: 19/4 Brann - AaFK"))
      .toBe("observations/rsssf/1998-first-19-4-brann-aafk.yaml");
  });

  it("gir et filnavn selv når ID-en ikke har ett eneste brukbart tegn", () => {
    expect(observationPath("rsssf", "///")).toBe("observations/rsssf/uten-id.yaml");
  });
});

describe("findConflicts", () => {
  it("finner feltet to kilder er uenige om, og bare det", () => {
    const conflicts = findConflicts([
      entry({ providerId: "rsssf", normalized: { "home.score": 3, attendance: 4500 } }),
      entry({ providerId: "fotmob", normalized: { "home.score": 2, attendance: 4500 } }),
    ]);
    expect(conflicts).toEqual([
      {
        field: "home.score",
        values: [{ providerId: "rsssf", value: 3 }, { providerId: "fotmob", value: 2 }],
      },
    ]);
  });

  it("regner taushet som taushet, ikke som uenighet", () => {
    // Én kilde uten tilskuertall motsier ikke den som har det. Uten dette ville
    // konfliktlisten fylles av kamper der ingen er uenige om noe.
    const conflicts = findConflicts([
      entry({ providerId: "rsssf", normalized: { attendance: null } }),
      entry({ providerId: "fotmob", normalized: { attendance: 4500 } }),
    ]);
    expect(conflicts).toEqual([]);
  });

  it("sier ingenting når bare én kilde har uttalt seg", () => {
    expect(findConflicts([entry({ normalized: { "home.score": 3 } })])).toEqual([]);
  });
});
