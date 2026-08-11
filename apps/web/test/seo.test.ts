import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import sitemap from "../app/sitemap.js";
import { SITE_ORIGIN } from "../lib/site.js";
import { loadMatchIndex, loadSeasonYears } from "../lib/archive.js";
import { getProviderNames, getSourceChildren, getSourceIds, getSources } from "../lib/sources.js";
import {
  matchDescription,
  matchTitle,
  opponentDescription,
  opponentTitle,
  pageMetadata,
  seasonDescription,
  sourceDescription,
} from "../lib/metadata.js";

const previousDbPath = process.env.AAFK_DB_PATH;

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-seo-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

/**
 * Sitemap hadde tre feil samtidig: duplikate sesong-URL-er, ingen kampsider, og
 * ingen lastModified. Testene her holder på alle tre.
 */
describe("sitemap", () => {
  it("har hver adresse nøyaktig én gang", () => {
    // Sesong-URL-ene kom fra `seasons`, som har én rad per sesong OG konkurranse.
    // Et år med serie, cup og treningskamper sto dermed tre ganger med samme
    // adresse. Fixturens 2024 er nettopp et slikt år.
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.length).toBe(new Set(urls).size);
  });

  it("har én oppføring per år, ikke én per konkurranse", () => {
    const seasonUrls = sitemap().filter((entry) => entry.url.includes("/sesong/"));
    expect(seasonUrls).toHaveLength(loadSeasonYears().length);
  });

  it("har alle kampsidene, også de som ikke er spilt", () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const match of loadMatchIndex()) {
      expect(urls.has(`${SITE_ORIGIN}/kamp/${match.matchId}`)).toBe(true);
    }
  });

  it("har kildearkivet og alle kildedetaljsidene", () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    expect(urls.has(`${SITE_ORIGIN}/kilder`)).toBe(true);
    for (const source of getSources()) {
      expect(urls.has(`${SITE_ORIGIN}/kilder/${source.id}`)).toBe(true);
    }
  });

  it("har den offentlige arbeidskøen", () => {
    expect(sitemap().map((entry) => entry.url)).toContain(`${SITE_ORIGIN}/mangler`);
  });

  it("finner en kjent kamp", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain(`${SITE_ORIGIN}/kamp/1998-08-16-aalesunds-fk-sk-brann`);
  });

  it("gir hver oppføring en dato", () => {
    for (const entry of sitemap()) {
      expect(entry.lastModified, entry.url).toBeInstanceOf(Date);
      expect(Number.isNaN(new Date(entry.lastModified!).getTime())).toBe(false);
    }
  });

  it("bruker kampens egen kildedato der den finnes", () => {
    const entry = sitemap().find((row) => row.url.endsWith("/kamp/1998-08-16-aalesunds-fk-sk-brann"))!;
    expect(new Date(entry.lastModified!).toISOString().slice(0, 10)).toBe("2026-08-02");
  });
});

/**
 * En delt kamp skal vise kampen, ikke prosjektet.
 */
describe("kampmetadata", () => {
  const played = {
    homeName: "Aalesunds FK",
    awayName: "FK Haugesund",
    homeScore: 2,
    awayScore: 1,
    date: "2010-09-26",
    status: "played",
    competition: "Tippeligaen",
    venue: "Color Line Stadion",
    attendance: 8104,
  };

  const upcoming = {
    homeName: "HamKam",
    awayName: "Aalesunds FK",
    homeScore: null,
    awayScore: null,
    date: "2026-08-09",
    status: "scheduled",
    competition: "Eliteserien",
    venue: "Briskeby",
    attendance: null,
  };

  it("setter resultatet i tittelen på en spilt kamp", () => {
    expect(matchTitle(played)).toBe("Aalesunds FK 2–1 FK Haugesund, 26. september 2010");
  });

  it("skriver «mot» i stedet for et tomt resultat på en kamp som kommer", () => {
    expect(matchTitle(upcoming)).toBe("HamKam mot Aalesunds FK, 9. august 2026");
    expect(matchTitle(upcoming)).not.toContain("–");
  });

  it("sier i beskrivelsen at kampen ikke er spilt", () => {
    expect(matchDescription(upcoming)).toContain("ikke spilt ennå");
  });

  it("skiller avlyst fra utsatt fra ikke spilt", () => {
    expect(matchDescription({ ...upcoming, status: "cancelled" })).toContain("avlyst");
    expect(matchDescription({ ...upcoming, status: "postponed" })).toContain("utsatt");
  });

  it("teller en kamp på grønt bord som spilt", () => {
    expect(matchTitle({ ...played, status: "awarded" })).toContain("2–1");
  });

  it("tar med tilskuertall når kilden har det", () => {
    expect(matchDescription(played)).toContain("8104 tilskuere");
    expect(matchDescription({ ...played, attendance: null })).not.toContain("tilskuere");
  });

  it("legger kanonisk adresse og delingskort på siden", () => {
    const meta = pageMetadata(matchTitle(played), matchDescription(played), "/kamp/abc");
    expect(meta.alternates.canonical).toBe("/kamp/abc");
    expect(meta.openGraph.title).toBe(meta.title);
    expect(meta.twitter.description).toBe(meta.description);
  });
});

describe("sesong- og motstandermetadata", () => {
  it("beskriver sesongen med tallene fra sesongen", () => {
    const text = seasonDescription({
      year: 2011,
      competition: "Tippeligaen",
      played: 30,
      wins: 12,
      draws: 8,
      losses: 10,
      finalPosition: 7,
      scheduled: 0,
    });
    expect(text).toContain("Tippeligaen 2011");
    expect(text).toContain("7. plass");
    expect(text).not.toContain("terminlista");
  });

  it("sier fra når sesongen pågår", () => {
    const text = seasonDescription({
      year: 2026,
      competition: "Eliteserien",
      played: 15,
      wins: 5,
      draws: 5,
      losses: 5,
      finalPosition: null,
      scheduled: 15,
    });
    expect(text).toContain("15 kamper står igjen");
  });

  it("beskriver et oppgjør som ennå ikke er spilt", () => {
    const text = opponentDescription({
      opponent: "Kongsvinger",
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      firstMeeting: "2026-09-01",
      lastMeeting: null,
    });
    expect(text).toContain("ikke møtt");
    expect(opponentTitle({
      opponent: "Kongsvinger",
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      firstMeeting: "2026-09-01",
      lastMeeting: null,
    })).toBe("AaFK mot Kongsvinger");
  });
});

/**
 * Alle 99 kildesidene delte «Fakta og historiske kamper dokumentert av …», også de
 * som ikke er brukt på en eneste kamp. Beskrivelsen skal være sann uten dekning, og
 * bare nevne dekning der den finnes.
 */
describe("kildemetadata", () => {
  const base = {
    title: "Cupminner",
    description: null,
    year: 2009,
    publisher: "Sunnmørsposten",
    issues: 0,
    usages: 0,
  };

  it("bruker en generell grunnbeskrivelse når kilden ikke har sin egen", () => {
    const text = sourceDescription(base);
    expect(text).toContain("Historisk kilde om Aalesunds Fotballklubb: Cupminner");
    expect(text).toContain("Utgitt av Sunnmørsposten, 2009");
  });

  it("lover ikke dekning kilden ikke har", () => {
    expect(sourceDescription(base)).not.toMatch(/kamp/);
  });

  it("tar med bruk og utgaver der de finnes", () => {
    const text = sourceDescription({ ...base, issues: 86, usages: 1 });
    expect(text).toContain("86 utgaver i arkivet");
    expect(text).toContain("Brukt på 1 kamp i arkivet");
    expect(text).not.toContain("1 kamper");
  });

  it("lar kildens egen beskrivelse gå foran den generelle", () => {
    const text = sourceDescription({ ...base, description: "Klubbens eget medlemsblad." });
    expect(text.startsWith("Klubbens eget medlemsblad.")).toBe(true);
    expect(text).not.toContain("Historisk kilde om");
  });
});

/**
 * Kildesidene forhåndsgenereres. Uten en fullstendig ID-liste blir en kilde som
 * ligger i arkivet stående uten side, og feilen ville bare vist seg i produksjon.
 */
describe("kildesidene som statiske sider", () => {
  it("har en ID per kilde i arkivet", () => {
    const ids = getSourceIds();
    expect(new Set(ids)).toEqual(new Set(getSources().map((source) => source.id)));
    expect(ids.length).toBe(new Set(ids).size);
  });
});

/**
 * Utgavene i en serie sorteres år for år, nyeste år først, men nummer 1 før nummer 2
 * innenfor året. Baklengs nummerering er ikke slik noen leser et blad.
 */
describe("utgaver i en serie", () => {
  it("sorterer nyeste årgang først og utgavene stigende innenfor året", () => {
    const issues = getSourceChildren("aafk-medlemsblad");
    expect(issues.map((issue) => `${issue.year}/${issue.issue}`)).toEqual(["1971/2", "1970/1"]);
  });
});

/**
 * Kildesiden hadde «Nasjonalbiblioteket» skrevet inn i JSX-en. Navnet står i
 * providerfila, og det er det ene stedet det skal stå.
 */
describe("providernavn", () => {
  it("leser visningsnavnet fra core_providers", () => {
    expect(getProviderNames().get("nasjonalbiblioteket")).toBe("Nasjonalbiblioteket");
  });
});
