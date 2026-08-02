import { describe, expect, it } from "vitest";
import { completeness, missingFields, toAafkPerspective } from "../src/derive.js";
import { match } from "../src/match.js";
import type { Match } from "../src/match.js";

/** Bygger en gyldig kamp med minimale felt, så hver test bare setter det den bryr seg om. */
function makeMatch(overrides: Record<string, unknown> = {}): Match {
  return match.parse({
    id: "2024-04-01-aalesunds-fk-molde-fk",
    date: "2024-04-01",
    status: "played",
    competition: { id: "eliteserien", season: 2024 },
    home: { clubId: "aalesunds-fk", score: 2 },
    away: { clubId: "molde-fk", score: 1 },
    ...overrides,
  });
}

describe("toAafkPerspective", () => {
  it("snur en hjemmeseier riktig", () => {
    const p = toAafkPerspective(makeMatch());
    expect(p.isHome).toBe(true);
    expect(p.opponentClubId).toBe("molde-fk");
    expect(p.aafkScore).toBe(2);
    expect(p.opponentScore).toBe(1);
    expect(p.goalDifference).toBe(1);
    expect(p.result).toBe("S");
  });

  it("snur en bortekamp slik at AaFK alltid er «oss»", () => {
    const p = toAafkPerspective(
      makeMatch({
        id: "2024-04-07-molde-fk-aalesunds-fk",
        date: "2024-04-07",
        home: { clubId: "molde-fk", score: 3 },
        away: { clubId: "aalesunds-fk", score: 0 },
      }),
    );
    expect(p.isHome).toBe(false);
    expect(p.opponentClubId).toBe("molde-fk");
    expect(p.aafkScore).toBe(0);
    expect(p.opponentScore).toBe(3);
    expect(p.goalDifference).toBe(-3);
    expect(p.result).toBe("T");
  });

  it("gir negativ målforskjell for tap uansett hvilken side vi spilte på", () => {
    // Dette er invarianten testspørsmålet hviler på: «tapte med 6 mål» må bety
    // goalDifference <= -6, uavhengig av hjemme eller borte.
    const home = toAafkPerspective(
      makeMatch({ home: { clubId: "aalesunds-fk", score: 0 }, away: { clubId: "molde-fk", score: 6 } }),
    );
    const away = toAafkPerspective(
      makeMatch({
        id: "2024-04-07-molde-fk-aalesunds-fk",
        date: "2024-04-07",
        home: { clubId: "molde-fk", score: 6 },
        away: { clubId: "aalesunds-fk", score: 0 },
      }),
    );
    expect(home.goalDifference).toBe(-6);
    expect(away.goalDifference).toBe(-6);
    expect(home.isHome).toBe(true);
    expect(away.isHome).toBe(false);
  });

  it("markerer uavgjort", () => {
    const p = toAafkPerspective(
      makeMatch({ home: { clubId: "aalesunds-fk", score: 1 }, away: { clubId: "molde-fk", score: 1 } }),
    );
    expect(p.result).toBe("U");
    expect(p.goalDifference).toBe(0);
  });

  it("legger ekstraomgang til resultatet", () => {
    const p = toAafkPerspective(
      makeMatch({
        competition: { id: "nm", season: 2024, stage: "quarter_final" },
        home: { clubId: "aalesunds-fk", score: 1 },
        away: { clubId: "molde-fk", score: 1 },
        extraTime: { home: 1, away: 0 },
      }),
    );
    expect(p.aafkScore).toBe(2);
    expect(p.opponentScore).toBe(1);
    expect(p.result).toBe("S");
  });

  it("teller straffeseier som uavgjort, men registrerer avansementet", () => {
    // Fotballstatistikk regner straffekonkurranse som uavgjort. Blander vi dette
    // sammen blir alle seriestatistikker feil så snart cupkamper er med.
    const p = toAafkPerspective(
      makeMatch({
        competition: { id: "nm", season: 2024, stage: "quarter_final" },
        home: { clubId: "aalesunds-fk", score: 1 },
        away: { clubId: "molde-fk", score: 1 },
        extraTime: { home: 0, away: 0 },
        penaltyShootout: { home: 5, away: 4 },
      }),
    );
    expect(p.result).toBe("U");
    expect(p.decidedOnPenalties).toBe(true);
    expect(p.wonOnPenalties).toBe(true);
  });

  it("registrerer straffetap", () => {
    const p = toAafkPerspective(
      makeMatch({
        competition: { id: "nm", season: 2024, stage: "quarter_final" },
        home: { clubId: "aalesunds-fk", score: 0 },
        away: { clubId: "molde-fk", score: 0 },
        penaltyShootout: { home: 3, away: 4 },
      }),
    );
    expect(p.result).toBe("U");
    expect(p.wonOnPenalties).toBe(false);
  });

  it("lar resultat være ukjent for en kamp som ikke er spilt", () => {
    const p = toAafkPerspective(
      makeMatch({
        status: "scheduled",
        home: { clubId: "aalesunds-fk" },
        away: { clubId: "molde-fk" },
      }),
    );
    expect(p.aafkScore).toBeNull();
    expect(p.goalDifference).toBeNull();
    expect(p.result).toBeNull();
  });
});

describe("completeness", () => {
  it("gir lav score til en kamp med bare resultat", () => {
    const c = completeness(makeMatch());
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(0.5);
    expect(missingFields(makeMatch())).toContain("report");
  });

  it("gir full score når alt er fylt ut", () => {
    const full = makeMatch({
      venueId: "color-line-stadion",
      attendance: 7412,
      referee: "Dommer",
      events: [{ minute: 10, type: "goal", team: "home", player: "A" }],
      lineups: { home: { formation: "4-3-3", starters: ["A"], subs: [] } },
      report: { body: "Tekst" },
      sources: [{ sourceId: "fotmob", fields: ["home.score"] }],
    });
    expect(completeness(full)).toBe(1);
    expect(missingFields(full)).toEqual([]);
  });
});
