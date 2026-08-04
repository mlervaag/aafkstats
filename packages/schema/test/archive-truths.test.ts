import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { canonicalClubKey } from "../src/identity.js";
import { crossValidate, loadArchive } from "../src/load.js";
import type { Archive } from "../src/load.js";

/**
 * Regresjonstester mot det ekte arkivet, ikke mot en fixture.
 *
 * Enhetstestene rundt sier at reglene er riktige. Disse sier at dataene faktisk
 * følger dem — og de er skrevet etter en runde der arkivet inneholdt to klubber
 * for Haugesund, to for Sykkylven og to for Odd, uten at noe sa fra.
 *
 * De kjører mot `data/` med vilje. En fixture ville bestått for alltid uansett
 * hva som skjer med de virkelige filene, og det er de virkelige filene som blir
 * publisert.
 */
describe("arkivet", () => {
  let archive: Archive;

  beforeAll(async () => {
    archive = await loadArchive(resolve(import.meta.dirname, "../../../data"));
  }, 30_000);

  it("validerer uten feil", () => {
    const issues = [...archive.issues, ...crossValidate(archive)];
    // Feilene skrives ut i sin helhet, ikke bare som et antall: en test som sier
    // «forventet 0, fikk 4» tvinger deg til å kjøre pnpm validate for å se hva.
    expect(issues.map((issue) => `${issue.file} ${issue.path}: ${issue.message}`)).toEqual([]);
  });

  it("har én klubb per kanonisk identitet", () => {
    const byIdentity = new Map<string, string[]>();
    for (const club of archive.clubs) {
      const key = canonicalClubKey(club);
      byIdentity.set(key, [...(byIdentity.get(key) ?? []), club.id]);
    }
    const collisions = [...byIdentity].filter(([, ids]) => ids.length > 1);
    expect(collisions).toEqual([]);
  });

  it("lar hvert kildealias peke på nøyaktig én klubb", () => {
    // To klubber med samme alias betyr at neste innhøsting kan lande på hvilken
    // som helst av dem, avhengig av lesrekkefølgen.
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const club of archive.clubs) {
      for (const [source, external] of Object.entries(club.aliases)) {
        const key = `${source}:${external}`;
        const existing = seen.get(key);
        if (existing !== undefined) collisions.push(`${key} → ${existing} og ${club.id}`);
        seen.set(key, club.id);
      }
    }
    expect(collisions).toEqual([]);
  });

  it("har ingen kamp registrert to ganger under ulike ID-er", () => {
    const identityOf = new Map(archive.clubs.map((club) => [club.id, canonicalClubKey(club)]));
    const byFixture = new Map<string, string[]>();
    for (const match of archive.matches) {
      const sides = [match.home.clubId, match.away.clubId]
        .map((id) => identityOf.get(id) ?? id)
        .sort();
      const key = `${match.date}|${sides.join("|")}`;
      byFixture.set(key, [...(byFixture.get(key) ?? []), match.file]);
    }
    const duplicates = [...byFixture].filter(([, files]) => files.length > 1);
    expect(duplicates).toEqual([]);
  });

  it("har en komplett seriesesong i 2010", () => {
    // Sesongen viste 31 kamper fordi Haugesund lå inne to ganger. Runde 1-30,
    // alle spilt, er fasiten for en Tippeliga-sesong med 16 lag.
    const league = archive.matches.filter(
      (match) => match.competition.season === 2010 && match.competition.id === "eliteserien",
    );
    expect(league).toHaveLength(30);
    expect(league.every((match) => match.status === "played")).toBe(true);
    expect([...new Set(league.map((match) => match.competition.round))].sort((a, b) => Number(a) - Number(b)))
      .toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("har filnavn som stemmer med klubb-ID-ene i fila", () => {
    // Etter en klubbsammenslåing er dette det som ryker først: innholdet peker på
    // den nye klubben, mens filnavnet fortsatt bærer den gamle.
    const wrong = archive.matches
      .filter((match) => match.id !== `${match.date}-${match.home.clubId}-${match.away.clubId}`)
      .map((match) => match.file);
    expect(wrong).toEqual([]);
  });
});
