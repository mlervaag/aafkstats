import { describe, expect, it } from "vitest";
import {
  breadcrumbJsonLd,
  collectionJsonLd,
  datasetJsonLd,
  matchJsonLd,
  organizationJsonLd,
  personJsonLd,
  websiteJsonLd,
} from "../lib/jsonld.js";
import { SITE_ORIGIN } from "../lib/site.js";

/**
 * Strukturerte data skal si det samme som siden, og ikke mer.
 *
 * Testene her holder på den ene regelen som betyr noe: ingenting påstås som ikke
 * står i arkivet. En kamp uten klokkeslett får ikke et klokkeslett, en person
 * uten Wikidata-kobling får ikke en `sameAs`, og en kamp som ble avlyst står
 * ikke som gjennomført.
 */

const played = {
  id: "2010-09-26-aalesunds-fk-fk-haugesund",
  homeName: "Aalesunds FK",
  awayName: "FK Haugesund",
  date: "2010-09-26",
  kickoff: "18:00",
  status: "played",
  competition: "Tippeligaen",
  venue: "Color Line Stadion",
  attendance: 8104,
  name: "Aalesunds FK 2–1 FK Haugesund, 26. september 2010",
  description: "Aalesunds FK 2–1 FK Haugesund i Tippeligaen 26. september 2010.",
};

describe("kamp som SportsEvent", () => {
  it("beskriver kampen med begge lagene og banen", () => {
    const data = matchJsonLd(played);
    expect(data["@type"]).toBe("SportsEvent");
    expect(data.homeTeam).toEqual({ "@type": "SportsTeam", name: "Aalesunds FK" });
    expect(data.awayTeam).toEqual({ "@type": "SportsTeam", name: "FK Haugesund" });
    expect(data.location).toEqual({ "@type": "Place", name: "Color Line Stadion" });
    expect(data.url).toBe(`${SITE_ORIGIN}/kamp/${played.id}`);
  });

  it("tar klokkeslettet med i startDate bare når kilden har det", () => {
    expect(matchJsonLd(played).startDate).toBe("2010-09-26T18:00");
    // De eldste kampene har bare en dato. En oppdiktet 00:00 ville sagt at kampen
    // startet ved midnatt.
    expect(matchJsonLd({ ...played, kickoff: null }).startDate).toBe("2010-09-26");
  });

  it("utelater banen helt når arkivet ikke vet hvor kampen ble spilt", () => {
    expect(matchJsonLd({ ...played, venue: null })).not.toHaveProperty("location");
  });

  it("skiller avlyst og utsatt fra gjennomført", () => {
    expect(matchJsonLd({ ...played, status: "cancelled" }).eventStatus).toBe(
      "https://schema.org/EventCancelled",
    );
    expect(matchJsonLd({ ...played, status: "postponed" }).eventStatus).toBe(
      "https://schema.org/EventPostponed",
    );
    expect(matchJsonLd({ ...played, status: "scheduled" }).eventStatus).toBe(
      "https://schema.org/EventScheduled",
    );
  });

  it("har ingen nøkler uten verdi", () => {
    for (const [key, value] of Object.entries(matchJsonLd({ ...played, venue: null }))) {
      expect(value, key).not.toBeNull();
    }
  });
});

describe("person som Person", () => {
  const base = {
    id: "ola-hansen",
    name: "Ola Hansen",
    nationality: "Norge",
    description: "Ola Hansen: 42 kamper for AaFK 1975–1980.",
    wikidata: null,
    roles: [] as string[],
    played: true,
  };

  it("kobler til Wikidata når arkivet har koblingen", () => {
    expect(personJsonLd({ ...base, wikidata: "Q12345" }).sameAs).toEqual([
      "https://www.wikidata.org/wiki/Q12345",
    ]);
  });

  it("finner ikke på en kobling som ikke finnes", () => {
    expect(personJsonLd(base)).not.toHaveProperty("sameAs");
  });

  it("knytter bare dem som faktisk hører til klubben, til klubben", () => {
    expect(personJsonLd(base).memberOf).toEqual({
      "@type": "SportsTeam",
      name: "Aalesunds Fotballklubb",
    });
    expect(personJsonLd({ ...base, played: false })).not.toHaveProperty("memberOf");
    expect(personJsonLd({ ...base, played: false, roles: ["Styreleder"] })).toHaveProperty("memberOf");
  });

  it("utelater nasjonalitet arkivet ikke har", () => {
    expect(personJsonLd({ ...base, nationality: null })).not.toHaveProperty("nationality");
  });
});

describe("datasettet som Dataset", () => {
  it("oppgir tidsspennet arkivet dekker", () => {
    const data = datasetJsonLd({ firstSeason: 1914, lastSeason: 2026, matches: 3200 });
    expect(data["@type"]).toBe("Dataset");
    expect(data.temporalCoverage).toBe("1914/2026");
    expect(data.isAccessibleForFree).toBe(true);
    expect(String(data.description)).toContain("3200 kamper");
  });

  it("påstår ikke et tidsspenn på et tomt arkiv", () => {
    expect(datasetJsonLd({ firstSeason: null, lastSeason: null, matches: 0 })).not.toHaveProperty(
      "temporalCoverage",
    );
  });
});

describe("brødsmuler", () => {
  it("setter arkivet først og nummererer stien fra én", () => {
    const data = breadcrumbJsonLd([
      { name: "Sesonger", path: "/sesonger" },
      { name: "1998", path: "/sesong/1998" },
    ]);
    const items = data.itemListElement as { position: number; name: string; item: string }[];
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items[0]!.item).toBe(SITE_ORIGIN);
    expect(items[2]!.item).toBe(`${SITE_ORIGIN}/sesong/1998`);
  });
});

describe("nettstedet og registrene", () => {
  it("lar nettstedet peke på prosjektet som utgiver", () => {
    expect(websiteJsonLd().publisher).toEqual({ "@id": `${SITE_ORIGIN}/#organization` });
    expect(organizationJsonLd()["@id"]).toBe(`${SITE_ORIGIN}/#organization`);
  });

  it("sier at prosjektet er uoffisielt, slik resten av nettstedet gjør", () => {
    expect(String(organizationJsonLd().description)).toContain("uoffisielt");
  });

  it("oppgir hvor mange oppføringer et register har", () => {
    const data = collectionJsonLd({ name: "Personer", description: "…", path: "/personer", size: 712 });
    expect(data.mainEntity).toEqual({ "@type": "ItemList", numberOfItems: 712 });
    expect(data.url).toBe(`${SITE_ORIGIN}/personer`);
  });

  it("finner ikke på et antall når det ikke er oppgitt", () => {
    expect(
      collectionJsonLd({ name: "Kilder", description: "…", path: "/kilder" }),
    ).not.toHaveProperty("mainEntity");
  });
});

/**
 * Kanonisk adresse skal peke på den adressen som svarer 200, ikke på en som
 * omdirigerer dit.
 *
 * Første forsøk satte den varianten som omdirigerte i stedet for den som svarte.
 * Resultatet var at hver eneste side sa «jeg er her» mens adressen svarte «nei,
 * gå dit», og at sitemapet listet nesten to tusen slike.
 *
 * Testen sier med vilje ikke om det skal være med eller uten `www`. Det er en
 * driftsavgjørelse som kan snus i Vercel, og en test som låste den, ville vært
 * feil dagen den ble snudd. Den holder på det som faktisk gikk galt: at valget
 * er tatt ett sted, og at alt annet bygger på det stedet.
 */
describe("adressen arkivet oppgir som sin egen", () => {
  it("er en absolutt https-adresse uten sti eller avsluttende skråstrek", () => {
    expect(SITE_ORIGIN).toMatch(/^https:\/\/[^/]+$/);
  });

  it("brukes av hver absolutte adresse i strukturerte data", () => {
    for (const url of [
      websiteJsonLd().url,
      organizationJsonLd().url,
      datasetJsonLd({ firstSeason: 1914, lastSeason: 2026, matches: 1 }).url,
      matchJsonLd(played).url,
    ]) {
      expect(String(url).startsWith(SITE_ORIGIN)).toBe(true);
    }
  });
});
