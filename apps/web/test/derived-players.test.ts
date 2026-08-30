import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { openForBuild } from "@aafkstats/db";
import { getPeople } from "../lib/people.js";
import {
  derivedAsSummaries,
  getDerivedPlayerById,
  getDerivedPlayerNameForms,
  getDerivedPlayerSeasons,
  getDerivedPlayers,
  getPlayersWithoutMatches,
} from "../lib/derived-players.js";

const previousDbPath = process.env.AAFK_DB_PATH;

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-derived-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  const db = openForBuild(dbPath);
  db.exec(`
    INSERT INTO core_people (id, person_key, name) VALUES ('review-only-player', 'review only player', 'Review Only Player');
    INSERT INTO core_person_names (person_id, person_key, name) VALUES ('review-only-player', 'review only player', 'Review Only Player');
    INSERT INTO core_squad_numbers (person_id, season, number) VALUES ('review-only-player', 1999, 12);
  `);
  db.close();
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

/**
 * Spillere arkivet kjenner fra kampene uten å ha en personfil for dem.
 *
 * Michael Barrantes sto med 134 kamper og 48 mål i arkivet og hadde ingen side
 * i det hele tatt, fordi registeret valgte på «har noen skrevet en fil». Det er
 * den feilen disse testene holder lukket.
 */
describe("utledede spillere", () => {
  it("finner spillere med kamper, men uten personfil", () => {
    const players = getDerivedPlayers();
    expect(players.length).toBeGreaterThan(0);
    for (const player of players) {
      expect(player.appearances).toBeGreaterThan(0);
      expect(player.id).not.toBe("");
    }
  });

  it("tar aldri en adresse som allerede tilhører en personfil", () => {
    // Kollisjonen skal ikke kunne oppstå: en spiller hvis person_key finnes i
    // registeret får person_id satt og er dermed ikke utledet. Men filnavnet er
    // valgt for hånd, så garantien er ikke gratis, og en utledet side som stille
    // overskrev en personside ville vært vanskelig å oppdage.
    const fileIds = new Set(getPeople().map((person) => person.id));
    for (const player of getDerivedPlayers()) {
      expect(fileIds.has(player.id), `${player.id} kolliderer med en personfil`).toBe(false);
    }
  });

  it("sorterer på kamper, slik at den viktigste jobben står først", () => {
    const counts = getDerivedPlayers().map((player) => player.appearances);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("slår opp en spiller på den utledede ID-en", () => {
    const first = getDerivedPlayers()[0]!;
    expect(getDerivedPlayerById(first.id)).toEqual(first);
    expect(getDerivedPlayerById("finnes-ikke")).toBeUndefined();
  });

  it("summerer sesongene til det samme som totalen", () => {
    const player = getDerivedPlayers()[0]!;
    const seasons = getDerivedPlayerSeasons(player.personKey);
    expect(seasons.reduce((sum, row) => sum + row.appearances, 0)).toBe(player.appearances);
    expect(seasons.reduce((sum, row) => sum + row.goals, 0)).toBe(player.goals);
    // Nyeste først, slik personsida ellers viser sesonger.
    const years = seasons.map((row) => row.season);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it("oppgir skrivemåtene kildene bruker, så et bidrag kan nevne dem", () => {
    const player = getDerivedPlayers()[0]!;
    const forms = getDerivedPlayerNameForms(player.personKey);
    expect(forms.length).toBeGreaterThan(0);
    expect(forms).toContain(player.name);
  });

  it("påstår ingenting som bare en personfil kan vite", () => {
    // En utledet side har ingen kilde for nasjonalitet, posisjon eller verv.
    // Å gjette på dem ville vært en påstand uten belegg, og det er nettopp det
    // som skiller dette laget fra en personfil.
    for (const summary of derivedAsSummaries()) {
      expect(summary.nationality).toBeNull();
      expect(summary.position).toBeNull();
      expect(summary.role_count).toBe(0);
      expect(summary.role_categories).toEqual([]);
    }
  });
});

describe("personfiler uten kamper", () => {
  it("bevarer draktnummersesonger også når personen ikke har posisjon", () => {
    expect(getPlayersWithoutMatches()).toContainEqual({
      id: "review-only-player",
      name: "Review Only Player",
      url: "/personer/review-only-player",
      position: null,
      squadSeasons: [1999],
    });
  });

  it("tar bare med filer som er ført som spillere", () => {
    // En styreformann uten kamper mangler ingenting. Det er filene med posisjon
    // eller draktnummer som ser ut som spillere, og som derfor kan ha en
    // navnekobling som ikke traff.
    for (const person of getPlayersWithoutMatches()) {
      expect(person.position !== null || person.squadSeasons.length > 0).toBe(true);
    }
  });
});
