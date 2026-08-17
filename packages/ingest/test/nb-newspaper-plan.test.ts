import { describe, expect, it } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import type { Match } from "@aafkstats/schema";
import { planMonths } from "../src/adapters/nb-newspaper-plan.js";
import { newspaperTitleCandidates, newspaperTitleForYear } from "../src/adapters/nb-newspaper-search.js";

const dated = (id: string, date: string, competitionId: string, round?: number): Match => ({
  id,
  date,
  dateConfidence: "exact",
  status: "played",
  competition: { id: competitionId, season: Number(date.slice(0, 4)), stage: "regular_season", ...(round === undefined ? {} : { round }) },
  home: { clubId: "aalesunds-fk", score: 1, halfTimeScore: null },
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
} as Match);

/** Fordelingen ligner arkivets egen: NM andre runde ligger i juni og mai. */
const archive = {
  matches: [
    dated("a", "1970-06-10", "nm", 2),
    dated("b", "1971-06-12", "nm", 2),
    dated("c", "1972-06-14", "nm", 2),
    dated("d", "1973-05-30", "nm", 2),
    dated("e", "1974-05-28", "nm", 2),
    dated("f", "1975-08-02", "nm", 2),
    dated("g", "1970-09-20", "nm", 4),
    dated("h", "1970-04-20", "forstedivisjon", 1),
  ],
} as unknown as Archive;

describe("planMonths", () => {
  it("setter månedene en NM-runde pleier å ligge i først", () => {
    const plan = planMonths(archive, { season: 1976, competitionId: "nm", round: 2 });
    expect(plan.months.slice(0, 3)).toEqual([6, 5, 8]);
    expect(plan.likelyCount).toBe(3);
    expect(plan.reason).toContain("juni, mai, august");
  });

  /**
   * Prioren er en rekkefølge, ikke et filter. Feiler den, koster det noen søk
   * ekstra — men en kamp som faller utenfor et filter er en kamp ingen finner
   * igjen.
   */
  it("beholder alle sesongmånedene bak de sannsynlige", () => {
    const plan = planMonths(archive, { season: 1976, competitionId: "nm", round: 2 });
    expect([...plan.months].sort((a, b) => a - b)).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });

  it("lar nabokampene avgjøre når begge er datert", () => {
    const plan = planMonths(archive, { season: 1935, after: "1935-06-20", before: "1935-08-05" });
    expect(plan.months.slice(0, 3)).toEqual([6, 7, 8]);
    expect(plan.likelyCount).toBe(3);
    expect(plan.reason).toContain("1935-06-20");
  });

  it("bruker sesongstart eller sesongslutt når bare den ene naboen er datert", () => {
    expect(planMonths(archive, { season: 1935, before: "1935-05-31" }).months.slice(0, 2)).toEqual([4, 5]);
    expect(planMonths(archive, { season: 1935, after: "1935-09-01" }).months.slice(0, 2)).toEqual([9, 10]);
  });

  it("faller tilbake til hele sesongen uten grunnlag", () => {
    const plan = planMonths(archive, { season: 1935, competitionId: "ukjent-cup" });
    expect(plan.months).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(plan.likelyCount).toBe(7);
    expect(plan.reason).toContain("ingen prior");
  });

  it("krever et minste grunnlag før prioren brukes", () => {
    const plan = planMonths(archive, { season: 1976, competitionId: "nm", round: 4 });
    expect(plan.reason).toContain("ingen prior");
  });
});

describe("newspaperTitleCandidates", () => {
  /**
   * Skillet er kontrollert mot NB-API-et: 1926 gir 308 utgaver som
   * Søndmørsposten og null som Sunnmørsposten, 1927 er speilvendt.
   */
  it("kjenner navneskiftet i 1927", () => {
    expect(newspaperTitleForYear(1926)).toBe("Søndmørsposten");
    expect(newspaperTitleForYear(1927)).toBe("Sunnmørsposten");
    expect(newspaperTitleForYear(1976)).toBe("Sunnmørsposten");
  });

  it("har det andre navnet som sikkerhetsnett", () => {
    expect(newspaperTitleCandidates(1926)).toEqual(["Søndmørsposten", "Sunnmørsposten"]);
    expect(newspaperTitleCandidates(1976)).toEqual(["Sunnmørsposten", "Søndmørsposten"]);
  });

  it("gir begge navnene for år utenfor det digitaliserte spennet", () => {
    expect(newspaperTitleCandidates(1900)).toEqual(["Søndmørsposten", "Sunnmørsposten"]);
  });
});
