import { describe, expect, it } from "vitest";
import type { Archive } from "@aafkstats/schema/load";
import {
  assertFotmobGapTarget,
  buildFotmobGapReport,
  classifyFotmobCompetition,
  prepareFotmobGapMatch,
} from "../src/fotmob-gap.js";
import type { SourceMatch } from "../src/types.js";

const candidate = (overrides: Partial<SourceMatch> = {}): SourceMatch => ({
  externalId: "870503",
  date: "2010-07-29",
  status: "played",
  home: { externalId: "8404", name: "Aalesund" },
  away: { externalId: "9927", name: "Motherwell" },
  homeScore: 1,
  awayScore: 1,
  competitionExternalId: "10613",
  competitionName: "Et lokalisert visningsnavn",
  season: 2010,
  fields: ["date", "home.score", "away.score"],
  ...overrides,
});

const archive = (date = "2010-07-29", fotmobAlias?: string): Archive => ({
  clubs: [
    { id: "aalesunds-fk", name: "Aalesunds FK", names: [], country: "NO", aliases: { fotmob: 8404 } },
    { id: "motherwell", name: "Motherwell FC", names: [], country: "GB", aliases: { fotmob: 9927 } },
  ],
  matches: [{
    id: `${date}-aalesunds-fk-motherwell`, date, dateConfidence: "exact", status: "played",
    competition: { id: "europa-liga", season: 2010, stage: "qualifying" },
    home: { clubId: "aalesunds-fk", score: 1, halfTimeScore: null },
    away: { clubId: "motherwell", score: 1, halfTimeScore: null },
    neutralVenue: false, events: [], externalReports: [], providers: [], sources: [], confidence: "probable",
    conflicts: [], tags: [], aliases: fotmobAlias ? { fotmob: fotmobAlias } : {}, manual: [], file: "kamp.yaml",
  }],
  venues: [], competitions: [], providers: [], seasons: [], observations: [], standings: [], people: [], contributions: [], sources: [], issues: [],
});

describe("FotMob-gap", () => {
  it("klassifiserer etter stabil turnerings-ID før visningsnavn", () => {
    expect(classifyFotmobCompetition(candidate())).toBe("europe");
  });

  it("skiller eliteseriekvalifisering fra ordinær liga", () => {
    expect(classifyFotmobCompetition(candidate({
      competitionExternalId: "60",
      competitionName: "Eliteserien Qualification",
    }))).toBe("qualification");
  });

  it("legger på arkivsesong og nedrykkskvalifisering eksplisitt", () => {
    const prepared = prepareFotmobGapMatch(candidate({
      date: "2026-03-09",
      season: 2026,
      competitionExternalId: "60",
      competitionName: "Eliteserien Qualification",
      stage: "qualifying",
    }), { archiveSeason: 2025, competitionClass: "qualification" });

    expect(prepared).toMatchObject({ season: 2025, stage: "relegation_playoff" });
    expect(prepared.fields).toContain("competition.stage");
  });

  it("nekter å skrive en klasse til feil arkivkonkurranse", () => {
    expect(() => assertFotmobGapTarget("cup", "eliteserien")).toThrow(/skal skrives til nm/);
    expect(() => assertFotmobGapTarget("qualification", "eliteserien")).not.toThrow();
  });

  it("finner en eksisterende kamp uten FotMob-alias som berikbar", () => {
    const report = buildFotmobGapReport(archive(), [candidate()], { from: "2010-01-01", to: "2010-12-31", generatedAt: "2026-08-09" });
    expect(report.entries[0]).toMatchObject({ status: "enrichable", matchId: "2010-07-29-aalesunds-fk-motherwell" });
  });

  it("sender et datoforskjøvet treff til kontroll", () => {
    const report = buildFotmobGapReport(archive("2010-07-30"), [candidate()], { from: "2010-01-01", to: "2010-12-31", generatedAt: "2026-08-09" });
    expect(report.entries[0]).toMatchObject({ status: "uncertain" });
  });
});
