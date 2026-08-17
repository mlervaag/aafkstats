import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildContentFragmentsUrl,
  buildNewspaperSearchUrl,
  newspaperSearchQueries,
  rankNewspaperCandidate,
  scoreFragment,
  searchNewspaperForMatch,
} from "../src/adapters/nb-newspaper-search.js";

vi.mock("../src/http.js", () => ({ fetchJson: vi.fn() }));
const { fetchJson } = await import("../src/http.js");
const fetched = vi.mocked(fetchJson);

/** NM-kampen mot Sunndal 29. juni 1976, referert i Sunnmørsposten dagen etter. */
const SUNNDAL_1976 = { opponent: "Sunndal", year: 1976, score: "2-0", competition: "nm", round: 2 } as const;
const REFERAT_ID = "00a63e24f382edacf6ed3b5972d4c308";

describe("newspaperSearchQueries", () => {
  it("søker både klubbnavn og forkortelser sammen med motstanderen", () => {
    expect(newspaperSearchQueries("Sunndal")).toEqual([
      "Sunndal Aalesund",
      "Sunndal Aalesunds",
      "Sunndal ÅFK",
      "Sunndal AAFK",
    ]);
  });
});

describe("buildNewspaperSearchUrl", () => {
  it("avgrenser til Sunnmørsposten, aviser og valgt år", () => {
    const url = new URL(buildNewspaperSearchUrl("Sunndal Aalesund", { year: 1976 }));
    expect(url.origin + url.pathname).toBe("https://api.nb.no/catalog/v1/items");
    expect(url.searchParams.get("q")).toBe("Sunndal Aalesund");
    expect(url.searchParams.getAll("filter")).toEqual([
      "mediatype:aviser",
      "api_title:Sunnmørsposten",
      "date:[19760101 TO 19761231]",
    ]);
    expect(url.searchParams.get("searchType")).toBe("FULL_TEXT_SEARCH");
    expect(url.searchParams.getAll("snippets")).toEqual(["aviser"]);
  });

  it("lar avis, datovindu og antall treff overstyres", () => {
    const url = new URL(buildNewspaperSearchUrl("Sunndal ÅFK", {
      year: 1976,
      newspaper: "Sunnmøringen",
      from: "1976-06-25",
      to: "1976-07-05",
      limit: 50,
    }));
    expect(url.searchParams.getAll("filter")).toContain("api_title:Sunnmøringen");
    expect(url.searchParams.getAll("filter")).toContain("date:[19760625 TO 19760705]");
    expect(url.searchParams.get("size")).toBe("50");
  });

  it("nekter datoer som ikke er ÅÅÅÅ-MM-DD", () => {
    expect(() => buildNewspaperSearchUrl("Sunndal ÅFK", { year: 1976, from: "juni 1976" }))
      .toThrow(/Ugyldig dato/);
  });
});

describe("buildContentFragmentsUrl", () => {
  it("peker på OCR-en til én utgave", () => {
    const url = new URL(buildContentFragmentsUrl(REFERAT_ID, "Sunndal"));
    expect(url.pathname).toBe(`/catalog/v1/items/${REFERAT_ID}/contentfragments`);
    expect(url.searchParams.get("q")).toBe("Sunndal");
  });
});

describe("scoreFragment", () => {
  it("teller motstander og AaFK i samme avsnitt som ett ekstra signal", () => {
    const sammen = scoreFragment("ÅFK slo Sunndal på Aksla", SUNNDAL_1976);
    const hverForSeg = scoreFragment("Sunndal kommune fikk ny riksveg", SUNNDAL_1976);
    expect(sammen.reasons).toContain("motstander og AaFK i samme avsnitt");
    expect(sammen.score).toBeGreaterThan(hverForSeg.score);
  });

  it("lar seg ikke stoppe av søketjenestens uthevingsmerking", () => {
    const withMarkup = scoreFragment("<em>ÅFK</em> til 3. runde med 2—0 mot <em>Sunndal</em>", SUNNDAL_1976);
    const withoutMarkup = scoreFragment("ÅFK til 3. runde med 2—0 mot Sunndal", SUNNDAL_1976);
    expect(withMarkup).toEqual(withoutMarkup);
    expect(withMarkup.reasons).toContain("resultat: 2-0");
  });

  /**
   * Avisnavnet inneholder bokstavene «nm», og æ, ø og å er ikke ordtegn for
   * `\b` i JavaScript. Uten eget ordskille fikk hver eneste Sunnmørsposten
   * cuppoeng, og signalet skilte ingenting fra noe.
   */
  it("gir ikke cuppoeng for avisnavnet Sunnmørsposten", () => {
    expect(scoreFragment("Sunnmørsposten melder om trafikken", SUNNDAL_1976).reasons)
      .not.toContain("NM/cup-kontekst");
    expect(scoreFragment("Sunndal møter ÅFK i cupen", SUNNDAL_1976).reasons)
      .toContain("NM/cup-kontekst");
  });

  /**
   * Serietabellene på sportssidene inneholder hvert tenkelige sifferpar. Uten
   * tabellvernet ble «resultat: 2-0» delt ut til utgaver som bare hadde trykt
   * tabellen.
   */
  it("regner ikke sifferpar i en tabellrad som kampresultat", () => {
    const tabell = scoreFragment("Sunndal 7 2 0 5 5-16 3 Bryn 7 0 3 4 5-13 3 ÅFK 6 1 2 3", SUNNDAL_1976);
    expect(tabell.reasons).not.toContain("resultat: 2-0");

    const referat = scoreFragment("ÅFK vant 2-0 over Sunndal etter to mål på slutten", SUNNDAL_1976);
    expect(referat.reasons).toContain("resultat: 2-0");
  });

  it("krever et lagnavn i samme avsnitt som resultatet", () => {
    expect(scoreFragment("Kampen endte 2-0 etter en jevn omgang", SUNNDAL_1976).reasons)
      .not.toContain("resultat: 2-0");
  });

  it("kjenner igjen runden både med siffer og med ord", () => {
    expect(scoreFragment("Sunndal er ÅFKs gjester i 2. runde i cupen", SUNNDAL_1976).reasons)
      .toContain("runde: 2");
    expect(scoreFragment("ÅFK møter Sunndal i andre runde", SUNNDAL_1976).reasons)
      .toContain("runde: 2");
    expect(scoreFragment("ÅFK møter Sunndal i 3. runde", SUNNDAL_1976).reasons)
      .not.toContain("runde: 2");
  });

  it("gir ingen poeng til et avsnitt uten kampfakta", () => {
    expect(scoreFragment("Leteaksjon i Grødalen etter tre menn", SUNNDAL_1976))
      .toEqual({ score: 0, reasons: [] });
  });
});

describe("rankNewspaperCandidate", () => {
  it("rangerer kjent Sunndal-artikkel høyt ut fra kampfakta", () => {
    const candidate = rankNewspaperCandidate(
      {
        id: REFERAT_ID,
        metadata: { title: "Sunnmørsposten", originInfo: { issued: "19760630" } },
      },
      ["Sunndal Aalesund", "Sunndal ÅFK"],
      [{
        pageNumber: "6",
        text: "ÅFK til 3. runde med 2-0. Begge mål siste 7 minuttene mot Sunndal. Med to scoringer i de siste 7 minuttene av cupkampen mot Sunndal på Aksla i går ...",
      }],
      SUNNDAL_1976,
    );

    expect(candidate.score).toBeGreaterThanOrEqual(90);
    expect(candidate.reasons).toContain("motstander: Sunndal");
    expect(candidate.reasons).toContain("resultat: 2-0");
    expect(candidate.itemUrl).toContain(REFERAT_ID);
    expect(candidate.urn).toBeUndefined();
  });

  it("gir et generisk Sunndal-treff uten AaFK-kontekst klart lavere score", () => {
    const candidate = rankNewspaperCandidate(
      { id: "annen", metadata: { title: "Sunnmørsposten", originInfo: { issued: "19760630" } } },
      ["Sunndal Aalesund"],
      [{ text: "Nyheter fra Sunndal kommune og trafikken på riksvegen." }],
      SUNNDAL_1976,
    );

    expect(candidate.score).toBeLessThan(50);
  });

  /**
   * Hele poenget med vindusvis poengsetting: en utgave som har tabellen på side
   * 6 og en Sunndal-notis på side 4 har ingen kamp å vise til, uansett hvor mye
   * av kampfakta som finnes i utgaven som helhet.
   */
  it("slår ikke sammen signaler som står i hvert sitt avsnitt", () => {
    const spredt = rankNewspaperCandidate(
      { id: "spredt", metadata: { title: "Sunnmørsposten", originInfo: { issued: "19760630" } } },
      ["Sunndal Aalesund"],
      [
        { pageNumber: "4", text: "Sunndal kommune har fått ny riksveg." },
        { pageNumber: "6", text: "Cupkampen mellom Os og Varegg endte 2-0." },
      ],
      SUNNDAL_1976,
    );
    expect(spredt.reasons).not.toContain("resultat: 2-0");

    const samlet = rankNewspaperCandidate(
      { id: "samlet", metadata: { title: "Sunnmørsposten", originInfo: { issued: "19760630" } } },
      ["Sunndal Aalesund"],
      [{ pageNumber: "6", text: "Cupkampen mot Sunndal endte 2-0 for ÅFK." }],
      SUNNDAL_1976,
    );
    expect(samlet.reasons).toContain("resultat: 2-0");
    expect(samlet.score).toBeGreaterThan(spredt.score);
  });

  it("legger det sterkeste tekstvinduet først", () => {
    const candidate = rankNewspaperCandidate(
      { id: "sortering", metadata: { title: "Sunnmørsposten", originInfo: { issued: "19760630" } } },
      ["Sunndal ÅFK"],
      [
        { pageNumber: "4", text: "Sunndal kommune har fått ny riksveg." },
        { pageNumber: "6", text: "ÅFK slo Sunndal 2-0 i cupkampen på Aksla." },
      ],
      SUNNDAL_1976,
    );
    expect(candidate.fragments.map((fragment) => fragment.pageNumber)).toEqual(["6", "4"]);
    expect(candidate.fragments[0]!.score).toBeGreaterThan(candidate.fragments[1]!.score);
    // Utgavepoengene er små med vilje: avis (3), år (2) og én søkevariant (2).
    expect(candidate.score).toBe(candidate.fragments[0]!.score + 7);
  });

  it("tar med URN og dato når metadataen har dem", () => {
    const candidate = rankNewspaperCandidate(
      {
        id: REFERAT_ID,
        metadata: {
          title: "Sunnmørsposten ",
          identifiers: { urn: "URN:NBN:no-nb_digavis_sunnmorsposten_null_null_19760630_94_147_1" },
          originInfo: { issued: "19760630" },
        },
      },
      ["Sunndal ÅFK"],
      [],
      SUNNDAL_1976,
    );
    expect(candidate.urn).toBe("URN:NBN:no-nb_digavis_sunnmorsposten_null_null_19760630_94_147_1");
    expect(candidate.issued).toBe("19760630");
    expect(candidate.title).toBe("Sunnmørsposten");
  });
});

describe("searchNewspaperForMatch", () => {
  beforeEach(() => {
    fetched.mockReset();
  });

  it("slår sammen treff fra alle søkevariantene og henter OCR bare for de beste", async () => {
    const item = (id: string, text: string) => ({
      id,
      metadata: { title: "Sunnmørsposten", originInfo: { issued: "19760630" } },
      contentFragments: [{ pageNumber: "6", text }],
    });
    fetched.mockImplementation(async (url: string) => {
      if (url.includes("/contentfragments")) {
        return { contentFragments: [{ pageNumber: "7", text: "ÅFK slo Sunndal 2-0 i cupkampen." }] };
      }
      const query = new URL(url).searchParams.get("q");
      if (query === "Sunndal Aalesund") return { _embedded: { items: [item("felles", "Sunndal i tabellen"), item("bare-en", "Sunndal kommune")] } };
      if (query === "Sunndal ÅFK") return { _embedded: { items: [item("felles", "ÅFK møter Sunndal")] } };
      return { _embedded: { items: [] } };
    });

    const candidates = await searchNewspaperForMatch({ ...SUNNDAL_1976, detailsLimit: 1 });

    expect(candidates.map((candidate) => candidate.id)).toEqual(["felles", "bare-en"]);
    expect(candidates[0]!.matchedQueries).toEqual(["Sunndal Aalesund", "Sunndal ÅFK"]);
    // Fire søk og nøyaktig ett OCR-oppslag: detaljene hentes bare for toppen.
    expect(fetched.mock.calls.filter(([url]) => (url as string).includes("/contentfragments"))).toHaveLength(1);
    expect(fetched.mock.calls).toHaveLength(5);
    // OCR-en ga et sterkere avsnitt enn søketreffet, og kandidaten er rangert på nytt.
    expect(candidates[0]!.reasons).toContain("resultat: 2-0");
    expect(candidates[0]!.fragments[0]!.pageNumber).toBe("7");
  });

  it("hopper over OCR-oppslaget når --details er 0", async () => {
    fetched.mockResolvedValue({ _embedded: { items: [] } });
    await searchNewspaperForMatch({ ...SUNNDAL_1976, detailsLimit: 0 });
    expect(fetched.mock.calls.every(([url]) => !(url as string).includes("/contentfragments"))).toBe(true);
  });

  /**
   * Regresjonsfixturen er svaret NB-API-et faktisk ga på de fire søkene for
   * 1976, med de tre første tekstvinduene per utgave. Den er hele grunnen til at
   * poengsettingen ble skrevet om: med signaler talt over hele utgaven kom
   * kampreferatet på fjerdeplass, likt med utgaver som bare hadde trykt
   * serietabellen, bak en notis om skiturer.
   */
  it("setter kampreferatet fra 30. juni 1976 øverst i det virkelige søkeresultatet", async () => {
    const fixture = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "fixtures", "nb-newspaper-search-1976.json"), "utf8"),
    ) as Record<string, unknown>;
    fetched.mockImplementation(async (url: string) => {
      if (url.includes("/contentfragments")) return { contentFragments: [] };
      return fixture[new URL(url).searchParams.get("q")!] ?? { _embedded: { items: [] } };
    });

    const candidates = await searchNewspaperForMatch({ ...SUNNDAL_1976, detailsLimit: 0 });

    expect(candidates).toHaveLength(63);
    expect(candidates[0]!.id).toBe(REFERAT_ID);
    expect(candidates[0]!.issued).toBe("19760630");
    expect(candidates[0]!.reasons).toContain("resultat: 2-0");
    // Forhåndsomtalen av den samme cupkampen dagen før er nest best.
    expect(candidates[1]!.issued).toBe("19760629");
    expect(candidates[1]!.reasons).toContain("runde: 2");

    // Utgaven som tidligere lå øverst har ingen kamp — bare bynavnet, en notis
    // om skiturer og tabellen — og skal ikke lenger konkurrere med referatet.
    const skiturer = candidates.find((candidate) => candidate.id === "9a057d8fa81e9aaed3d5dfa0f052f312")!;
    expect(skiturer.reasons).not.toContain("resultat: 2-0");
    expect(skiturer.score).toBeLessThan(candidates[0]!.score);
  });
});
