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

  it("har personnavn uten wikimarkup", () => {
    // Fire personer sto en periode oppført som «[[Mads Nielsen (fotballspiller)»
    // fordi importen delte stallmalen på røret inne i lenka. Navnet er det
    // leseren ser først på personsidene, og ingen validering fanget det.
    const wrong = archive.people
      .filter((person) => [person.name, ...person.names].some((name) => /[[\]{}|<>]/.test(name)))
      .map((person) => `people/${person.id}.yaml: ${person.name}`);
    expect(wrong).toEqual([]);
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

/**
 * Tallene i README skal stemme med arkivet.
 *
 * Agentreglene sier at den som importerer data «MUST update the statistics» i
 * README. Det er en prosessregel mot et mekanisk problem, og den holdt ikke:
 * kamptallet i `packages/db/README.md` sto på 1 244 lenge etter at arkivet hadde
 * passert 1 300. Et menneske eller en agent glemmer; en test gjør det ikke.
 */
describe("tallene i README", () => {
  let archive: Archive;
  let readme: string;

  beforeAll(async () => {
    const root = resolve(import.meta.dirname, "../../..");
    archive = await loadArchive(resolve(root, "data"));
    const { readFile } = await import("node:fs/promises");
    readme = await readFile(resolve(root, "README.md"), "utf8");
  }, 30_000);

  /** Tallet i «Arkivet i tall» med denne merkelappen, uten tusenskille. */
  function stated(label: RegExp): number | null {
    const row = new RegExp(`\\*\\*([\\d\\u00a0 ]+)\\s*${label.source}`, "u").exec(readme);
    return row ? Number(row[1]!.replace(/\s|\u00a0/gu, "")) : null;
  }

  const forventet: [string, RegExp, () => number][] = [
    ["kamper", /kamper\*\*/, () => archive.matches.length],
    ["år", /år\*\*/, () => new Set(archive.matches.map((m) => m.competition.season)).size],
    ["klubber", /klubber/, () => archive.clubs.length],
    ["personer", /personer\*\*/, () => archive.people.length],
    ["kilder", /kilder\*\*/, () => archive.providers.length],
  ];

  for (const [navn, label, faktisk] of forventet) {
    it(`oppgir riktig antall ${navn}`, () => {
      const oppgitt = stated(label);
      expect(oppgitt, `fant ingen rad for «${navn}» i README`).not.toBeNull();
      expect(oppgitt).toBe(faktisk());
    });
  }

  it("oppgir riktig antall stadion", () => {
    // Står på samme rad som klubbene, etter en midtstilt prikk.
    const match = /(\d+)\s+stadion/.exec(readme);
    expect(match, "fant ingen stadiontall i README").not.toBeNull();
    expect(Number(match![1])).toBe(archive.venues.length);
  });
});
