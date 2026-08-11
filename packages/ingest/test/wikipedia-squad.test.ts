import { describe, expect, it } from "vitest";
import { parseSquadTemplate } from "../src/adapters/wikipedia-squad.js";

/**
 * Malen skrives med `|` mellom feltene, og en lenke med visningstekst har et
 * `|` inni seg. Feltdelingen må skille de to, ellers blir navnefeltet stående
 * med en halv lenke — slik fire personer havnet i arkivet som
 * «[[Mads Nielsen (fotballspiller)».
 */
describe("parseSquadTemplate", () => {
  it("leser navnet ut av en enkel lenke", () => {
    expect(parseSquadTemplate("{{Fs player|no=14|nat=Danmark|name=[[Mathias Kristensen]]|pos=MB}}")).toEqual([
      { name: "Mathias Kristensen", number: 14, position: "midtbane", nationality: "Danmark" },
    ]);
  });

  it("deler ikke feltene på røret inne i en lenke", () => {
    const players = parseSquadTemplate(
      "{{Fs player|no=3|nat=Island|name=[[Ólafur Guðmundsson (islandsk fotballspiller)|Ólafur Gudmundsson]]|pos=MB}}",
    );
    expect(players).toEqual([
      { name: "Ólafur Gudmundsson", number: 3, position: "midtbane", nationality: "Island" },
    ]);
  });

  it("beholder visningsteksten, ikke Wikipedias disambiguering", () => {
    const [player] = parseSquadTemplate(
      "{{Fs player|no=2|nat=Danmark|name=[[Mads Nielsen (fotballspiller)|Mads Nielsen]]|pos=FW}}",
    );
    expect(player?.name).toBe("Mads Nielsen");
  });

  it("leser resten av malen selv om lenka står først", () => {
    // Rekkefølgen på feltene er ikke gitt. Med en delefeil ville feltene etter
    // navnet blitt lest som navnløse ledd, og posisjon og nummer forsvunnet.
    const [player] = parseSquadTemplate(
      "{{Fs player|name=[[Erikson Spinola Lima|Nenass]]|no=7|nat=Kapp Verde|pos=MB}}",
    );
    expect(player).toEqual({ name: "Nenass", number: 7, position: "midtbane", nationality: "Kapp Verde" });
  });

  it("hopper over de tomme radene malen bruker som spalteskille", () => {
    expect(parseSquadTemplate("{{Fs player|no=|nat=|name=|pos=}}")).toEqual([]);
  });
});
