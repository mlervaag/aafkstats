import { describe, expect, it } from "vitest";
import type { Match } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import { reconcile } from "../src/reconcile.js";
import type { SourceMatch } from "../src/types.js";

const archive: Archive = {
  clubs: [{ id: "aalesunds-fk", name: "Aalesunds FK", shortName: "AaFK", names: [], country: "NO", aliases: { fotmob: 8404 } }],
  venues: [],
  competitions: [{ id: "forstedivisjon", name: "1. divisjon", names: [], type: "league", tier: 2, country: "NO" }],
  sources: [{ id: "fotmob", name: "FotMob", priority: 50 }],
  seasons: [],
  matches: [],
  issues: [],
};

const source: SourceMatch = {
  externalId: "4385655",
  date: "2024-04-01",
  kickoff: "17:00",
  status: "played",
  home: { externalId: "8404", name: "Aalesund" },
  away: { externalId: "9918", name: "Stabæk" },
  homeScore: 1,
  awayScore: 1,
  competitionExternalId: "203",
  competitionName: "1. Divisjon",
  season: 2024,
  round: 1,
  venueName: "Color Line Stadion",
  fields: ["date", "home.score", "away.score"],
};

describe("reconcile", () => {
  it("lager en deterministisk plan med kilde-ID-er og proveniens", () => {
    const first = reconcile(archive, [source], { sourceId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03" });
    const second = reconcile(archive, [source], { sourceId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03" });
    expect(first).toEqual(second);
    expect(first.issues).toEqual([]);
    expect(first.summary).toEqual({ matchesCreated: 1, matchesSkipped: 0, matchesUpdated: 0, clubsCreated: 1, clubsUpdated: 0, venuesCreated: 1, seasonsCreated: 1 });
    const match = first.files.find((file) => file.relativePath.includes("/matches/"))?.value;
    expect(match).toMatchObject({
      id: "2024-04-01-aalesunds-fk-stabaek",
      aliases: { fotmob: "4385655" },
      sources: [{ sourceId: "fotmob", retrievedAt: "2026-08-03", fields: ["date", "home.score", "away.score"] }],
    });
  });

  it("kobler et kort kildenavn til en eksisterende klubb", () => {
    const withRaufoss: Archive = {
      ...archive,
      clubs: [...archive.clubs, {
        id: "raufoss-il", name: "Raufoss IL", shortName: "Raufoss", names: [], country: "NO", aliases: {},
      }],
    };
    const raufoss: SourceMatch = {
      ...source,
      externalId: "kamp-raufoss",
      away: { externalId: "9812", name: "Raufoss" },
      venueName: undefined,
    };
    const plan = reconcile(withRaufoss, [raufoss], {
      sourceId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    expect(plan.summary.clubsCreated).toBe(0);
    expect(plan.summary.clubsUpdated).toBe(1);
    expect(plan.files.some((file) => file.relativePath.endsWith("aalesunds-fk-raufoss-il.yaml"))).toBe(true);
  });

  it("bevarer manuelt låste felt ved ny innhøsting", () => {
    const withoutVenue = { ...source, venueName: undefined };
    const initial = reconcile(archive, [withoutVenue], {
      sourceId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    const created = initial.files.find((file) => file.relativePath.includes("/matches/"))?.value as Match;
    const existing: Match & { file: string } = {
      ...created,
      attendance: 999,
      manual: ["attendance"],
      file: `seasons/2024/matches/${created.id}.yaml`,
    };
    const stabaek = initial.files.find((file) => file.relativePath === "clubs/stabaek.yaml")?.value;
    const withExisting: Archive = {
      ...archive,
      clubs: [...archive.clubs, stabaek as Archive["clubs"][number]],
      seasons: [{ year: 2024, competitionId: "forstedivisjon", finalPosition: null, promoted: false, relegated: false, file: "seasons/2024/season.yaml" }],
      matches: [existing],
    };
    const update = reconcile(withExisting, [{ ...withoutVenue, attendance: 3944 }], {
      sourceId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    const updated = update.files.find((file) => file.relativePath.includes("/matches/"))?.value as Match;
    expect(updated.attendance).toBe(999);
    expect(updated.manual).toEqual(["attendance"]);
  });

  it("bevarer tidligere detaljfelt og andre kilder ved en oversiktshøsting", () => {
    const detailedSource: SourceMatch = {
      ...source,
      venueName: undefined,
      events: [{ minute: 12, type: "goal", team: "home", player: "Testspiller" }],
      fields: [...source.fields, "events"],
    };
    const initial = reconcile(archive, [detailedSource], {
      sourceId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-02",
    });
    const created = initial.files.find((file) => file.relativePath.includes("/matches/"))?.value as Match;
    const existing: Match & { file: string } = {
      ...created,
      sources: [
        ...created.sources,
        { sourceId: "fotball-no", retrievedAt: "2026-08-01", fields: ["date"] },
      ],
      file: `seasons/2024/matches/${created.id}.yaml`,
    };
    const stabaek = initial.files.find((file) => file.relativePath === "clubs/stabaek.yaml")?.value;
    const withExisting: Archive = {
      ...archive,
      clubs: [...archive.clubs, stabaek as Archive["clubs"][number]],
      seasons: [{ year: 2024, competitionId: "forstedivisjon", finalPosition: null, promoted: false, relegated: false, file: "seasons/2024/season.yaml" }],
      matches: [existing],
    };

    const update = reconcile(withExisting, [{ ...source, venueName: undefined }], {
      sourceId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    const updated = update.files.find((file) => file.relativePath.includes("/matches/"))?.value as Match;

    expect(updated.events).toEqual(detailedSource.events);
    expect(updated.sources).toEqual([
      expect.objectContaining({ sourceId: "fotmob", retrievedAt: "2026-08-03", fields: expect.arrayContaining(["events"]) }),
      { sourceId: "fotball-no", retrievedAt: "2026-08-01", fields: ["date"] },
    ]);
  });
});
