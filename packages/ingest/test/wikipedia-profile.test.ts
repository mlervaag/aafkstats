import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import { parseProfileInfobox } from "../src/adapters/wikipedia-profile.js";
import { planWikipediaProfile, resolvePlayerTarget } from "../src/wikipedia-profile.js";

const fixture = readFileSync(
  fileURLToPath(new URL("fixtures/wikipedia-player-infobox.html", import.meta.url)),
  "utf8",
);

describe("Wikipedia-spillerprofil", () => {
  it("leser bare de navngitte faktaradene fra infoboksen", () => {
    expect(parseProfileInfobox(fixture)).toEqual({
      nationality: "Island",
      position: "forsvar",
      rawPosition: "Forsvarsspiller",
    });
  });

  it("lar en tvetydig posisjon stå urørt", () => {
    const html = "<table><tr><th>Position</th><td>Defender / Midfielder</td></tr></table>";
    expect(parseProfileInfobox(html)).toEqual({ rawPosition: "Defender / Midfielder" });
  });

  it("lager en personfil for et eksakt navn som allerede finnes i AaFK-oppstillinger", () => {
    const archive = archiveWithLineups("Fredrik Ulvestad", "Motspiller");
    const target = resolvePlayerTarget(archive, "Fredrik Ulvestad");
    const plan = planWikipediaProfile(target, {
      language: "no",
      title: "Fredrik Ulvestad",
      revisionId: 123,
      timestamp: "2026-08-12",
      url: "https://no.wikipedia.org/w/index.php?title=Fredrik+Ulvestad&oldid=123",
      wikidata: "Q2005608",
      position: "midtbane",
      nationality: "Norge",
      rawPosition: "Midtbanespiller",
    });

    expect(plan.create).toBe(true);
    expect(plan.person).toMatchObject({
      id: "fredrik-ulvestad",
      name: "Fredrik Ulvestad",
      position: "midtbane",
      nationality: "Norge",
      wikidata: "Q2005608",
    });
  });

  it("godtar ikke en motspiller eller en løs Wikipedia-tittel som ny identitet", () => {
    const archive = archiveWithLineups("Fredrik Ulvestad", "Motspiller");
    expect(() => resolvePlayerTarget(archive, "Motspiller")).toThrow("fant ikke");
    expect(() => resolvePlayerTarget(archive, "Tilfeldig Person")).toThrow("fant ikke");
  });

  it("bevarer eksisterende fakta og rapporterer motstrid", () => {
    const archive = archiveWithLineups("Daníel Leó Grétarsson", "Motspiller", {
      id: "daniel-leo-gretarsson",
      name: "Daníel Leó Grétarsson",
      names: ["Daniel Gretarsson"],
      nationality: "Island",
      position: "forsvar",
      squadNumbers: [], coachSpells: [], roles: [], providers: [], sources: [], conflicts: [],
    });
    const target = resolvePlayerTarget(archive, "daniel-leo-gretarsson");
    const plan = planWikipediaProfile(target, {
      language: "no", title: "Daníel Leó Grétarsson", revisionId: 456,
      timestamp: "2026-08-12", url: "https://no.wikipedia.org/?oldid=456",
      position: "midtbane", nationality: "Island", wikidata: "Q20140318",
    });

    expect(plan.person.position).toBe("forsvar");
    expect(plan.person.wikidata).toBe("Q20140318");
    expect(plan.conflicts).toEqual([
      "posisjon: arkivet har «forsvar», Wikipedia viser «midtbane»",
    ]);
  });
});

function archiveWithLineups(aafkPlayer: string, opponentPlayer: string, person?: Archive["people"][number]): Archive {
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
      lineups: {
        home: { starters: [aafkPlayer], subs: [] },
        away: { starters: [opponentPlayer], subs: [] },
      },
    }],
  };
}
