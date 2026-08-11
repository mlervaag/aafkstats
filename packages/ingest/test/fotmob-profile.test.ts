import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import {
  mapFotmobPosition,
  parseFotmobPlayerCandidates,
  parseFotmobPlayerProfile,
} from "../src/adapters/fotmob-profile.js";
import { planFotmobProfile } from "../src/fotmob-profile.js";
import { resolvePlayerTarget } from "../src/player-profile.js";

const searchFixture = JSON.parse(readFileSync(
  fileURLToPath(new URL("fixtures/fotmob-player-search.json", import.meta.url)), "utf8",
));
const profileFixture = JSON.parse(readFileSync(
  fileURLToPath(new URL("fixtures/fotmob-player-profile.json", import.meta.url)), "utf8",
));

describe("FotMob-spillerprofil", () => {
  it("slår sammen gjentatte søketreff og utelater andre objekttyper", () => {
    expect(parseFotmobPlayerCandidates(searchFixture)).toEqual([{
      id: "180283",
      name: "Fredrik Ulvestad",
      isCoach: false,
      teamName: "Pogoń Szczecin",
    }]);
  });

  it("normaliserer bare personfakta og AaFK-perioden", () => {
    expect(parseFotmobPlayerProfile(profileFixture, "180283")).toEqual({
      id: "180283",
      name: "Fredrik Ulvestad",
      url: "https://www.fotmob.com/players/180283/fredrik-ulvestad",
      position: "midtbane",
      rawPosition: "Defensive Midfielder",
      nationality: "Norge",
      rawNationality: "Norway",
      countryCode: "NOR",
      aafkCareer: [{ from: "2010-04-01", to: "2015-01-01", appearances: 124, goals: 18 }],
    });
  });

  it("tolker defensive midtbanespillere som midtbane, ikke forsvar", () => {
    expect(mapFotmobPosition("centerdefensivemidfielder", "Defensive Midfielder")).toBe("midtbane");
    expect(mapFotmobPosition("centerback", "Centre-Back")).toBe("forsvar");
    expect(mapFotmobPosition("goalkeeper", "Goalkeeper")).toBe("keeper");
  });

  it("gjør ikke manglende karrieretall om til null", () => {
    const raw = structuredClone(profileFixture);
    raw.careerHistory.careerItems.senior.teamEntries[0].appearances = null;
    raw.careerHistory.careerItems.senior.teamEntries[0].goals = null;
    expect(parseFotmobPlayerProfile(raw, "180283").aafkCareer).toEqual([
      { from: "2010-04-01", to: "2015-01-01" },
    ]);
  });

  it("leser datoene i både ISO- og eldre millisekundformat", () => {
    const raw = structuredClone(profileFixture);
    raw.careerHistory.careerItems.senior.teamEntries[0].startDate = "";
    raw.careerHistory.careerItems.senior.teamEntries[0].endDate = 1_389_139_200_000;
    expect(parseFotmobPlayerProfile(raw, "180283").aafkCareer[0]).toMatchObject({
      to: "2014-01-08",
    });
  });

  it("lager personfil først etter at FotMob-profilen viser en AaFK-periode", () => {
    const target = resolvePlayerTarget(archiveWithPlayer("Fredrik Ulvestad"), "Fredrik Ulvestad");
    const profile = parseFotmobPlayerProfile(profileFixture, "180283");
    const plan = planFotmobProfile(target, profile, "2026-08-12");
    expect(plan.person).toMatchObject({
      id: "fredrik-ulvestad",
      name: "Fredrik Ulvestad",
      position: "midtbane",
      nationality: "Norge",
      providers: [{
        providerId: "fotmob",
        retrievedAt: "2026-08-12",
        fields: ["name", "position", "nationality"],
      }],
    });
  });

  it("avviser en profil uten dokumentert AaFK-periode", () => {
    const target = resolvePlayerTarget(archiveWithPlayer("Fredrik Ulvestad"), "Fredrik Ulvestad");
    const profile = { ...parseFotmobPlayerProfile(profileFixture, "180283"), aafkCareer: [] };
    expect(() => planFotmobProfile(target, profile)).toThrow("ingen periode i Aalesund");
  });

  it("bevarer eksisterende fakta og rapporterer FotMob-motstrid", () => {
    const archive = archiveWithPlayer("Fredrik Ulvestad", {
      id: "fredrik-ulvestad", name: "Fredrik Ulvestad", names: [],
      position: "forsvar", nationality: "Norge", squadNumbers: [], coachSpells: [],
      roles: [], providers: [], sources: [], conflicts: [],
    });
    const target = resolvePlayerTarget(archive, "fredrik-ulvestad");
    const plan = planFotmobProfile(target, parseFotmobPlayerProfile(profileFixture, "180283"));
    expect(plan.person.position).toBe("forsvar");
    expect(plan.conflicts).toEqual([
      "posisjon: arkivet har «forsvar», FotMob viser «midtbane»",
    ]);
  });
});

function archiveWithPlayer(name: string, person?: Archive["people"][number]): Archive {
  return {
    clubs: [], venues: [], competitions: [], providers: [], seasons: [], observations: [], standings: [],
    contributions: [], sources: [], extractions: [], sourceResults: [], issues: [],
    people: person ? [person] : [],
    matches: [{
      id: "2020-01-01-aalesunds-fk-motstander", file: "matches/2020/test.yaml", date: "2020-01-01",
      dateConfidence: "exact", status: "played", competition: { id: "treningskamp", season: 2020, stage: "friendly" },
      home: { clubId: "aalesunds-fk", score: 1, halfTimeScore: null },
      away: { clubId: "motstander", score: 0, halfTimeScore: null }, neutralVenue: false,
      events: [], externalReports: [], providers: [], sources: [], confidence: "confirmed", conflicts: [], tags: [], aliases: {}, manual: [],
      lineups: { home: { starters: [name], subs: [] }, away: { starters: [], subs: [] } },
    }],
  };
}
