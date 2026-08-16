import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { all, open } from "@aafkstats/db";
import { getMatchObservations, getPersonObservations, getSeasonObservations, getSeasonSources, getVenueObservations } from "../lib/historical-observations.js";
import { getPersonRoles } from "../lib/people.js";
import { searchHistoricalObservations } from "../lib/search.js";
import { getSourceObservationUsages } from "../lib/sources.js";

const previousDbPath = process.env.AAFK_DB_PATH;
beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-historical-observations-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 30_000);
afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("historiske observasjoner", () => {
  it("viser Haller-funnet uten å opprette et nytt AaFK-verv", () => {
    const observations = getPersonObservations("georg-haller");
    expect(observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "georg-haller-romsdalsturneen", text: expect.stringContaining("særskilt takk") }),
    ]));
    const hallerTurne = observations.find((entry) => entry.id === "georg-haller-romsdalsturneen");
    expect(hallerTurne?.sources).toEqual(expect.arrayContaining([{ sourceId: "nff-arbok-1914-1915", page: "24", fields: [], note: undefined }]));
    expect(getPersonRoles("georg-haller").filter((role) => role.title === "Formann")).toHaveLength(1);
  });

  it("viser begge presise Jangaard-observasjonene separat fra roller", () => {
    const observations = getPersonObservations("nils-jangaard");
    expect(observations.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "nils-jangaard-kretsinndeling-1919", "nils-jangaard-representantforsamling-1919",
    ]));
    expect(observations.flatMap((entry) => entry.sources.map((source) => source.page))).toEqual(expect.arrayContaining(["67-69", "76-79"]));
    expect(observations.every((entry) => !entry.text.includes("representerte AaFK"))).toBe(true);
  });

  it("bruker samme kanoniske Jangaard-post på personen og 1919-sesongen", () => {
    const id = "nils-jangaard-kretsinndeling-1919";
    expect(getPersonObservations("nils-jangaard").filter((entry) => entry.id === id)).toHaveLength(1);
    expect(getSeasonObservations(1919).filter((entry) => entry.id === id)).toHaveLength(1);
  });

  it("holder Paivas-fakta utenfor 1918-forbeholdet og rydder 1920", () => {
    expect(getSeasonObservations(1918).some((entry) => entry.id === "aafk-paivas-pokal-1918")).toBe(true);
    expect(getSeasonObservations(1920).map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "nff-banelan-aafk-1920", "aafk-paivas-pokal-odel-og-eie-1920", "aafk-kretsmester-1920",
    ]));
  });

  it("viser sesongkilden og kilde-backlinks", () => {
    expect(getSeasonSources(1920)).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "nff-arbok-1920", page: "100" })]));
    expect(getSourceObservationUsages("nff-arbok-1919").map((entry) => entry.id)).toContain("nils-jangaard-kretsinndeling-1919");
  });

  it.each([
    ["banelån", "nff-banelan-aafk-1920"],
    ["Jangaard krets", "nils-jangaard-kretsinndeling-1919"],
    ["Romsdalsturneen", "georg-haller-romsdalsturneen"],
  ])("søker etter %s", (query, id) => {
    expect(searchHistoricalObservations(query).map((entry) => entry.observationId)).toContain(id);
  });
});

describe("relasjoner med en side å stå på", () => {
  it("viser publikumsrekorden på kampen den gjaldt", () => {
    // Relasjonen fantes fra PR 142, men ingen side leste den. Faktumet lå i
    // basen uten å stå på kampen det handlet om.
    expect(getMatchObservations("1962-11-04-aalesunds-fk-gjovik-lyn")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "1962-publikumsrekord-12000-aksla" }),
    ]));
  });

  it("viser Kråmyra-funnene på banen", () => {
    const ids = getVenueObservations("kramyra-stadion").map((entry) => entry.id);
    expect(ids).toContain("1955-kramyra-forste-bruk");
  });

  it("gir hver observasjon en url", () => {
    // Søket filtrerer bort rader uten url. Var kjeden ufullstendig, ville
    // observasjonen forsvunnet stille i stedet for å feile.
    const db = open();
    try {
      const rows = all<{ id: string; url: string | null }>(db, "SELECT id, url FROM historical_observations");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.filter((row) => row.url === null)).toEqual([]);
    } finally { db.close(); }
  });

  it("leser observasjonene kronologisk på både person og sesong", () => {
    // Udaterte funn står sist: de kan ikke plasseres på tidslinjen, og skal
    // ikke innlede den heller.
    const dates = (entries: { date: string | null }[]) => entries.map((entry) => entry.date);
    for (const entries of [getPersonObservations("georg-haller"), getSeasonObservations(1920)]) {
      const actual = dates(entries);
      const expected = [...actual].sort((a, b) => (a ?? "\uffff").localeCompare(b ?? "\uffff"));
      expect(actual).toEqual(expected);
    }
  });
});
