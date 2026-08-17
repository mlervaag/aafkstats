import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import type { Club, Match } from "@aafkstats/schema";
import {
  additionsFor,
  clubNames,
  datelessQueries,
  dayOffset,
  discoverMatchDate,
  matchesForBatch,
  monthWindows,
  scoreVariants,
  searchWindow,
} from "../src/adapters/nb-newspaper-batch.js";

vi.mock("../src/http.js", () => ({ fetchJson: vi.fn() }));
const { fetchJson } = await import("../src/http.js");
const fetched = vi.mocked(fetchJson);

const match = (overrides: Partial<Match> & Pick<Match, "id" | "date">): Match => ({
  dateConfidence: "exact",
  status: "played",
  competition: { id: "forstedivisjon", season: Number(overrides.date.slice(0, 4)), stage: "regular_season" },
  home: { clubId: "aalesunds-fk", score: 2, halfTimeScore: null },
  away: { clubId: "hodd", score: 0, halfTimeScore: null },
  neutralVenue: false,
  events: [],
  externalReports: [],
  providers: [],
  sources: [],
  confidence: "probable",
  conflicts: [],
  tags: [],
  aliases: {},
  manual: [],
  ...overrides,
} as Match);

describe("matchesForBatch", () => {
  const archive = {
    matches: [
      match({ id: "1976-06-29-aafk-sunndal", date: "1976-06-29" }),
      match({ id: "1980-05-01-uten-dato", date: "1980-05-01", dateConfidence: "month" }),
      match({ id: "1981-05-01-ikke-spilt", date: "1981-05-01", status: "postponed" }),
      match({ id: "1982-05-01-uten-resultat", date: "1982-05-01", home: { clubId: "aalesunds-fk", score: null, halfTimeScore: null } }),
      match({ id: "1983-05-01-med-kilde", date: "1983-05-01", sources: [{ sourceId: "en-kilde", fields: ["home.score"] }] }),
      match({ id: "1999-05-01-utenfor", date: "1999-05-01" }),
    ],
  } as unknown as Archive;

  it("tar bare spilte kamper med eksakt dato og resultat i årsspennet", () => {
    expect(matchesForBatch(archive, { from: 1976, to: 1990 }).map((entry) => entry.id))
      .toEqual(["1976-06-29-aafk-sunndal", "1983-05-01-med-kilde"]);
  });

  it("kan avgrenses til kamper uten kildehenvisning", () => {
    expect(matchesForBatch(archive, { from: 1976, to: 1990, onlyMissingSources: true }).map((entry) => entry.id))
      .toEqual(["1976-06-29-aafk-sunndal"]);
  });
});

describe("clubNames", () => {
  it("tar med forkortelse, varianter og historiske navn", () => {
    const club = {
      id: "kfk",
      name: "Kristiansund Fotballklubb",
      shortName: "KFK",
      nameVariants: ["K. F. K."],
      names: [{ name: "Kristiansunds Fotballklub", from: null, to: null }],
    } as unknown as Club;
    expect(clubNames(club)).toEqual(["Kristiansund Fotballklubb", "KFK", "K. F. K.", "Kristiansunds Fotballklub"]);
  });

  /** Resultatboksen skriver «ÅFK», aldri «Aalesunds FK». Uten den forkortelsen ankrer ingenting. */
  it("gir AaFK forkortelsene avisa faktisk bruker", () => {
    const club = { id: "aalesunds-fk", name: "Aalesunds FK", shortName: "AaFK", nameVariants: [], names: [] } as unknown as Club;
    expect(clubNames(club)).toContain("ÅFK");
  });

  it("gir tom liste for en klubb arkivet ikke har", () => {
    expect(clubNames(undefined)).toEqual([]);
  });
});

describe("søkevindu og datoregning", () => {
  it("dekker kampdagen og tre dager etter", () => {
    expect(searchWindow("1976-06-29")).toEqual({ from: "1976-06-29", to: "1976-07-02" });
  });

  it("regner ut hvor mange dager etter kampen utgaven kom", () => {
    expect(dayOffset("1976-06-29", "19760630")).toBe(1);
    expect(dayOffset("1986-05-03", "19860505")).toBe(2);
    expect(dayOffset("1976-06-29", undefined)).toBeUndefined();
  });

  it("deler sesongen i månedsvinduer", () => {
    const windows = monthWindows(1976, [6, 7]);
    expect(windows).toEqual([
      { month: "1976-06", from: "1976-06-01", to: "1976-06-30" },
      { month: "1976-07", from: "1976-07-01", to: "1976-07-31" },
    ]);
  });

  it("prøver resultatet i begge lagrekkefølger", () => {
    expect(scoreVariants([2, 0])).toEqual(["2-0", "0-2"]);
    expect(scoreVariants([1, 1])).toEqual(["1-1"]);
  });
});

describe("additionsFor", () => {
  it("lister bare felt kampen faktisk mangler", () => {
    const withReferee = match({ id: "x", date: "1986-05-03", referee: "Kjent Dommer", attendance: 500 });
    const facts = { goals: [], cards: [], lineups: [], sources: [], attendance: 646, referee: "Eirik Heim" };
    expect(additionsFor(withReferee, facts)).toEqual(["kildehenvisning"]);
  });

  it("foreslår tilskuere, dommer og pausestilling når de mangler", () => {
    const facts = {
      goals: [{ standing: "1-0", scorer: "Arild Holm", minute: 21 }],
      cards: [], lineups: [], sources: [],
      attendance: 646, referee: "Eirik Heim", halfTime: { home: 0, away: 2 },
    };
    expect(additionsFor(match({ id: "x", date: "1986-05-03" }), facts)).toEqual([
      "kildehenvisning",
      "tilskuere: 646",
      "dommer: Eirik Heim",
      "pausestilling: 0-2",
      "1 målhendelser",
    ]);
  });
});

describe("datelessQueries", () => {
  const archive = {
    clubs: [{ id: "sunndal", name: "Sunndal", shortName: "SIL", nameVariants: [], names: [] }],
    sourceResults: [{
      sourceId: "medlemsblad-1965",
      scorePerspective: "aafk",
      seasons: [{
        year: 1965,
        page: 12,
        results: [
          { no: 1, opponent: "Sunndal", opponentClubId: "sunndal", score: [3, 1], status: "played", replay: false, extraTime: false, round: null, competitionId: null, matchId: null },
          { no: 2, opponent: "Molde", opponentClubId: null, score: [0, 2], status: "played", replay: false, extraTime: false, round: null, competitionId: null, matchId: null },
          { no: 3, opponent: "Alt kanonisert", opponentClubId: null, score: [1, 1], status: "played", replay: false, extraTime: false, round: null, competitionId: null, matchId: "1965-01-01-x" },
          { no: 4, opponent: "Med dato", date: "1965-06-01", opponentClubId: null, score: [1, 0], status: "played", replay: false, extraTime: false, round: null, competitionId: null, matchId: null },
        ],
      }],
    }],
  } as unknown as Archive;

  it("tar bare resultater som verken har dato eller er koblet til en kamp", () => {
    const queries = datelessQueries(archive, { season: 1965 });
    expect(queries.map((query) => query.opponent)).toEqual(["Sunndal", "Molde"]);
    expect(queries[0]!.opponentAliases).toEqual(["SIL"]);
    expect(queries[0]!.score).toEqual([3, 1]);
  });

  it("respekterer årsavgrensningen", () => {
    expect(datelessQueries(archive, { from: 1970, to: 1980 })).toEqual([]);
  });
});

describe("discoverMatchDate", () => {
  beforeEach(() => {
    fetched.mockReset();
  });

  const query = { id: "kilde#1965-001", season: 1986, opponent: "Hødd", score: [2, 0] as [number, number] };
  const aafk = ["Aalesunds FK", "AaFK", "ÅFK"];

  it("bekrefter datoen når resultatboksen navngir kampen", async () => {
    const box = "ÅFK-HØDD 2-0 (1-0) Kråmyra stadion 3200 tilskuere Mål: 1-0 Arild Holm (straffe, 37). Dommer: Sjur Hatløy, Hødd.";
    fetched.mockImplementation(async (url: string) => {
      if (url.includes("/contentfragments")) return { contentFragments: [{ pageNumber: "9", text: box }] };
      const from = new URL(url).searchParams.getAll("filter").find((filter) => filter.startsWith("date:"))!;
      if (!from.includes("19860501")) return { _embedded: { items: [] } };
      return {
        _embedded: {
          items: [{
            id: "utgave",
            metadata: { title: "Sunnmørsposten", originInfo: { issued: "19860509" } },
            contentFragments: [{ pageNumber: "9", text: "ÅFK slo Hødd" }],
          }],
        },
      };
    });

    const entry = await discoverMatchDate(query, aafk, { months: [5, 6] });

    expect(entry.outcome).toBe("dato_funnet");
    expect(entry.confirmed?.issued).toBe("19860509");
    // Kampen er spilt før utgaven. Dagen før er vanligst, to dager forekommer,
    // så lista over mulige datoer følger med forslaget.
    expect(entry.confirmed?.likelyDate).toBe("1986-05-08");
    expect(entry.confirmed?.dateRange).toEqual({ from: "1986-05-06", to: "1986-05-09" });
    expect(entry.confirmed?.facts.attendance).toBe(3200);
  });

  /**
   * Før resultatboksen fantes — grovt sagt før 1976 — ser alle kandidatene i en
   * måned like ut for en maskin. Da skal verktøyet levere en liste med sitat, og
   * ikke kåre en vinner blant like.
   */
  it("leverer kandidatliste når ingen boks kan ankres", async () => {
    fetched.mockImplementation(async (url: string) => {
      if (url.includes("/contentfragments")) return { contentFragments: [] };
      const filter = new URL(url).searchParams.getAll("filter").find((entry) => entry.startsWith("date:"))!;
      const month = filter.slice(6, 12);
      return {
        _embedded: {
          items: [{
            id: `utgave-${month}`,
            metadata: { title: "Sunnmørsposten", originInfo: { issued: `${month}15` } },
            contentFragments: [{ pageNumber: "6", text: "ÅFK møtte Hødd i går kveld" }],
          }],
        },
      };
    });

    const entry = await discoverMatchDate(query, aafk, { months: [5, 6] });

    expect(entry.outcome).toBe("kandidatliste");
    expect(entry.confirmed).toBeUndefined();
    expect(entry.shortlist.map((candidate) => candidate.month)).toEqual(["1986-05", "1986-06"]);
    expect(entry.shortlist[0]!.quote).toBe("ÅFK møtte Hødd i går kveld");
  });

  it("skiller mellom udigitalisert årgang og manglende treff", async () => {
    fetched.mockResolvedValue({ _embedded: { items: [] } });
    const entry = await discoverMatchDate(query, aafk, { months: [5] });
    expect(entry.outcome).toBe("ikke_digitalisert");
  });

  it("henter OCR bare for de øverste kandidatene i hver måned", async () => {
    fetched.mockImplementation(async (url: string) => {
      if (url.includes("/contentfragments")) return { contentFragments: [] };
      return {
        _embedded: {
          items: [1, 2, 3, 4, 5].map((number) => ({
            id: `utgave-${number}`,
            metadata: { title: "Sunnmørsposten", originInfo: { issued: `1986050${number}` } },
            contentFragments: [{ text: `ÅFK og Hødd ${number}` }],
          })),
        },
      };
    });

    const entry = await discoverMatchDate(query, aafk, { months: [5], probesPerMonth: 2, shortlistPerMonth: 4 });

    expect(entry.shortlist).toHaveLength(4);
    expect(fetched.mock.calls.filter(([url]) => (url as string).includes("/contentfragments"))).toHaveLength(2);
  });
});
