import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTransferSearchQuery,
  fetchWikidataTransferTargets,
  findTransferCandidatesForTarget,
  rankTransferCandidates,
  scoreTransferFragment,
  transferSearchWindow,
} from "../src/adapters/nb-transfer-candidates.js";

vi.mock("../src/http.js", () => ({ fetchJson: vi.fn() }));
const { fetchJson } = await import("../src/http.js");
const fetched = vi.mocked(fetchJson);

beforeEach(() => {
  fetched.mockReset();
});

describe("scoreTransferFragment", () => {
  it("forkaster det ekte støyeksempelet: «lett overgang til bussrutene» langt fra navnet", () => {
    // Ekte støy fra et tidligere søk: «Trond Fredriksen» i 2010 fant «lett
    // overgang til bussrutene», et fragment som nevner navnet et helt annet
    // sted i teksten enn ordet «overgang» — de har ingenting med hverandre å gjøre.
    const filler = "Kommunestyret behandlet flere saker på møtet i går kveld, og debatten gikk livlig for seg blant representantene fra alle partier. ";
    const text = `Trond Fredriksen orienterte om rutetilbudet. ${filler.repeat(2)} Det ble en lett overgang til bussrutene for de reisende i sommer.`;
    const result = scoreTransferFragment(text, "Trond Fredriksen");
    expect(result.matched).toBe(false);
    expect(result.score).toBe(0);
  });

  it("forkaster når overgangsordet står langt fra navnet", () => {
    const filler = "x".repeat(250);
    const text = `Trond Fredriksen var på plass i går. ${filler} Det ble en lett overgang til bussrutene.`;
    const result = scoreTransferFragment(text, "Trond Fredriksen");
    expect(result.matched).toBe(false);
    expect(result.score).toBe(0);
  });

  it("forkaster når fragmentet bare inneholder overgangsordet, ikke navnet", () => {
    const text = "Det ble en lett overgang til bussrutene for de reisende.";
    const result = scoreTransferFragment(text, "Trond Fredriksen");
    expect(result.matched).toBe(false);
  });

  it("forkaster når fragmentet bare inneholder navnet, ikke et overgangsord", () => {
    const text = "Trond Fredriksen scoret to mål i går kveld mot Aalesund.";
    const result = scoreTransferFragment(text, "Trond Fredriksen");
    expect(result.matched).toBe(false);
  });

  it("godtar et ekte treff: etternavnet nær et overgangsord", () => {
    // Ekte formulering: torpedert overgang til Cardiff City, om Bjørn Helge Riise.
    const text = "Manageren torpederte hans overgang til Cardiff City i vinter, og Bjørn Helge Riise ble værende.";
    const result = scoreTransferFragment(text, "Bjørn Helge Riise");
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.join(" ")).toContain("overgang");
  });

  it("tåler OCR-veksling mellom ø/ö og æ/ae i etternavnet", () => {
    const text = "AaFK har hentet Tor Hogne Aaroey fra Hødd, og han er klar for debut.";
    const result = scoreTransferFragment(text, "Tor Hogne Aarøy");
    expect(result.matched).toBe(true);
  });

  it("gir høyere poeng når et klubbnavn finnes i tillegg til overgangsordet", () => {
    const withoutClub = scoreTransferFragment(
      "Bjørn Helge Riise er klar for ny klubb etter en lang prosess.",
      "Bjørn Helge Riise",
    );
    const withClub = scoreTransferFragment(
      "Bjørn Helge Riise er klar for ny klubb, Aalesunds FK bekrefter overgangen.",
      "Bjørn Helge Riise",
      { clubNames: ["Aalesunds FK"] },
    );
    expect(withoutClub.matched).toBe(true);
    expect(withClub.matched).toBe(true);
    expect(withClub.score).toBeGreaterThan(withoutClub.score);
  });

  it("gir høyere poeng når utgaven er i et typisk overgangsvindu", () => {
    const januar = scoreTransferFragment(
      "Bjørn Helge Riise er klar for ny klubb etter forhandlinger.",
      "Bjørn Helge Riise",
      { issued: "20100115" },
    );
    const oktober = scoreTransferFragment(
      "Bjørn Helge Riise er klar for ny klubb etter forhandlinger.",
      "Bjørn Helge Riise",
      { issued: "20101015" },
    );
    expect(januar.score).toBeGreaterThan(oktober.score);
  });

  it("finner treff selv med <em>-uthevingen fra søketjenesten", () => {
    const text = "<em>Riise</em> er <em>klar for</em> ny klubb, sier trener.";
    const result = scoreTransferFragment(text, "Bjørn Helge Riise");
    expect(result.matched).toBe(true);
  });
});

describe("rankTransferCandidates", () => {
  it("holder bare fragmenter som består sperren, sterkeste øverst, maks 5", () => {
    const items = [
      {
        id: "item-1",
        metadata: { title: "Sunnmørsposten", originInfo: { issued: "20100201" } },
        contentFragments: [
          { text: "Riise er klar for ny klubb, sier kilder nær spilleren.", pageNumber: "5" },
          { text: "Ingenting om fotball her, bare en notis om bussruter.", pageNumber: "6" },
        ],
      },
      {
        id: "item-2",
        metadata: { title: "Sunnmørsposten", originInfo: { issued: "20100203" } },
        contentFragments: [
          { text: "Bjørn Helge Riise signerte for Aalesunds FK i går, en overgang mange ventet på.", pageNumber: "3" },
        ],
      },
    ];
    const ranked = rankTransferCandidates(items, "Bjørn Helge Riise", ["Aalesunds FK"]);
    expect(ranked.length).toBe(2);
    expect(ranked[0]!.itemId).toBe("item-2");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
    expect(ranked.every((candidate) => candidate.text.includes("<em>") === false)).toBe(true);
  });

  it("returnerer maks fem kandidater selv med flere treff", () => {
    const item = {
      id: "item-many",
      metadata: { originInfo: { issued: "20100201" } },
      contentFragments: Array.from({ length: 8 }, (_unused, index) => ({
        text: `Riise er klar for ny klubb i variant ${index}, sier en kilde.`,
        pageNumber: String(index + 1),
      })),
    };
    const ranked = rankTransferCandidates([item], "Bjørn Helge Riise");
    expect(ranked.length).toBe(5);
  });
});

describe("buildTransferSearchQuery", () => {
  it("kombinerer navnet i anførselstegn med overgangsord", () => {
    expect(buildTransferSearchQuery("Tor Hogne Aarøy")).toBe(
      '"Tor Hogne Aarøy" AND (overgang OR "klar for" OR signerte OR "går til" OR hentet OR solgt OR lånes)',
    );
  });
});

describe("transferSearchWindow", () => {
  it("spenner året før til året etter, for å fange vintervinduet over årsskiftet", () => {
    expect(transferSearchWindow(2010)).toEqual({ from: "2009-01-01", to: "2011-12-31" });
  });
});

describe("fetchWikidataTransferTargets", () => {
  it("behandler ÅÅÅÅ-01-01 fra Wikidata som et årstall, ikke en eksakt dag", async () => {
    fetched.mockResolvedValueOnce({
      results: {
        bindings: [
          {
            player: { value: "http://www.wikidata.org/entity/Q123" },
            playerLabel: { value: "Tor Hogne Aarøy" },
            start: { value: "2003-01-01T00:00:00Z" },
            end: { value: "2007-01-01T00:00:00Z" },
          },
        ],
      },
    });

    const targets = await fetchWikidataTransferTargets(2000, 2012);
    expect(targets).toEqual([
      { qid: "Q123", player: "Tor Hogne Aarøy", direction: "in", year: 2003 },
      { qid: "Q123", player: "Tor Hogne Aarøy", direction: "out", year: 2007 },
    ]);
  });

  it("holder bare mål med årstall innenfor det spurte intervallet", async () => {
    fetched.mockResolvedValueOnce({
      results: {
        bindings: [
          {
            player: { value: "http://www.wikidata.org/entity/Q999" },
            playerLabel: { value: "Utenfor Vinduet" },
            start: { value: "1995-01-01T00:00:00Z" },
            end: { value: "2001-01-01T00:00:00Z" },
          },
        ],
      },
    });

    const targets = await fetchWikidataTransferTargets(2000, 2012);
    expect(targets).toEqual([
      { qid: "Q999", player: "Utenfor Vinduet", direction: "out", year: 2001 },
    ]);
  });

  it("dropper mål uten dato i det hele tatt", async () => {
    fetched.mockResolvedValueOnce({
      results: {
        bindings: [
          {
            player: { value: "http://www.wikidata.org/entity/Q1" },
            playerLabel: { value: "Uten Dato" },
          },
        ],
      },
    });

    const targets = await fetchWikidataTransferTargets(2000, 2012);
    expect(targets).toEqual([]);
  });
});

describe("findTransferCandidatesForTarget", () => {
  it("søker NB med det utvidede vinduet og rangerer de returnerte fragmentene", async () => {
    fetched.mockResolvedValueOnce({
      _embedded: {
        items: [
          {
            id: "item-x",
            metadata: { title: "Sunnmørsposten", originInfo: { issued: "20100115" } },
            contentFragments: [
              { text: "Tor Hogne Aarøy er klar for Aalesunds FK etter en lang overgang.", pageNumber: "9" },
            ],
          },
        ],
      },
    });

    const candidates = await findTransferCandidatesForTarget(
      { qid: "Q1", player: "Tor Hogne Aarøy", direction: "in", year: 2010 },
      { clubNames: ["Aalesunds FK"] },
    );

    expect(candidates.length).toBe(1);
    expect(candidates[0]!.itemUrl).toBe("https://www.nb.no/items/item-x");
    expect(fetched).toHaveBeenCalledTimes(1);
    const url = new URL(fetched.mock.calls[0]![0] as string);
    expect(url.searchParams.getAll("filter")).toContain("date:[20090101 TO 20111231]");
  });
});
