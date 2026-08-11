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

  it("lar ikke nestede script-elementer bli til ny HTML under tekstuttrekket", () => {
    const html = [
      "<table><tr><th>Position</th><td>",
      "<script><script>alert(1)</script></script>",
      "<style><style>.skjult{}</style></style>",
      "<b>Midfielder</b><sup><sup>[1]</sup></sup>",
      "</td></tr></table>",
    ].join("");
    expect(parseProfileInfobox(html)).toEqual({ position: "midtbane", rawPosition: "Midfielder" });
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

  /**
   * Den dyreste feilen kommandoen kan gjøre er å opprette en person arkivet
   * allerede har. ID-krasjet fanger ikke det: «Daniel Gretarsson» ville fått
   * `daniel-gretarsson`, mens fila heter `daniel-leo-gretarsson`, og de to
   * ligner ikke på hverandre i det hele tatt. Han står med 140 kamper.
   */
  it("nekter å lage en ny fil når navnet er en form av en person som finnes", () => {
    const archive = archiveWithLineups("Daniel Gretarsson", "Motspiller", {
      id: "daniel-leo-gretarsson",
      name: "Daníel Leó Grétarsson",
      names: [],
      nationality: "Island",
      position: "forsvar",
      squadNumbers: [], coachSpells: [], roles: [], providers: [], sources: [], conflicts: [],
    });
    expect(() => resolvePlayerTarget(archive, "Daniel Gretarsson"))
      .toThrow("navneform av daniel-leo-gretarsson");
  });

  it("stopper også når kilden har den lengste formen", () => {
    // Samme feil speilvendt: fila er kort, oppstillingen lang.
    const archive = archiveWithLineups("Sten Michael Grytebust", "Motspiller", {
      id: "sten-grytebust",
      name: "Sten Grytebust",
      names: [],
      position: "keeper",
      squadNumbers: [], coachSpells: [], roles: [], providers: [], sources: [], conflicts: [],
    });
    expect(() => resolvePlayerTarget(archive, "Sten Michael Grytebust"))
      .toThrow("navneform av sten-grytebust");
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
