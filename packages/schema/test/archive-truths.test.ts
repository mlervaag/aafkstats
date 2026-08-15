import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { canonicalClubKey } from "../src/identity.js";
import { mayFetch, mayPublish } from "../src/entities.js";
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

  it("fører årsrapport 1966 med kontrollert sesong, tabell og NM-resultater", () => {
    const provider = archive.providers.find((item) => item.id === "sunnmore-fotballkrets");
    const series = archive.sources.find((item) => item.id === "sunnmore-fotballkrets-arsrapporter");
    const report = archive.sources.find((item) => item.id === "sunnmore-fotballkrets-arsrapport-1966");
    const season = archive.seasons.find((item) => item.year === 1966);
    const standing = archive.standings.find(
      (item) => item.competitionId === "andredivisjon" && item.season === 1966,
    );
    const results = archive.sourceResults.find(
      (item) => item.sourceId === "sunnmore-fotballkrets-arsrapport-1966",
    )?.seasons[0];

    expect(provider).toBeDefined();
    expect(mayFetch(provider!)).toBe(true);
    expect(mayPublish(provider!)).toBe(true);
    expect(series?.sourceType).toBe("series");
    expect(report).toMatchObject({ sourceType: "annual_report", parentSourceId: series?.id, year: 1966 });
    expect(season).toMatchObject({ competitionId: "andredivisjon", finalPosition: 3, teamsInLeague: 8 });
    expect(standing?.table).toHaveLength(8);
    expect(standing?.table.find((row) => row.clubId === "aalesunds-fk")).toMatchObject({
      position: 3, played: 14, wins: 8, draws: 2, losses: 4,
      goalsFor: 29, goalsAgainst: 23, points: 18,
    });
    expect(results).toMatchObject({
      year: 1966,
      page: 4,
      results: [
        expect.objectContaining({ opponentClubId: "andalsnes", score: [7, 1], matchId: null }),
        expect.objectContaining({ opponentClubId: "eid-il", score: [3, 2], matchId: null }),
        expect.objectContaining({ opponentClubId: "frigg", score: [1, 2], matchId: "1966-07-31-frigg-aalesunds-fk" }),
      ],
    });
  });

  it("bevarer den manuelle NFF-runden 1914–1920 uten å blande inn B-laget", () => {
    const series = archive.sources.find((item) => item.id === "nff-arbok");
    const issues = ["1914-1915", "1916", "1917", "1918", "1919", "1920"]
      .map((issue) => archive.sources.find((item) => item.id === `nff-arbok-${issue}`));

    expect(series?.sourceType).toBe("series");
    expect(issues.every((item) => item?.parentSourceId === series?.id)).toBe(true);
    expect(issues.every((item) => item?.providers.some((provider) => provider.providerId === "nasjonalbiblioteket"))).toBe(true);

    const season1918 = archive.seasons.find((item) => item.year === 1918);
    expect(season1918).toMatchObject({ competitionId: "romsdalske-kreds", expectedMatches: 2 });

    const results1920 = archive.sourceResults.find((item) => item.sourceId === "nff-arbok-1920")?.seasons[0]?.results;
    expect(results1920?.find((item) => item.opponent === "Rollon" && item.score?.[0] === 4)).toMatchObject({
      competitionId: "nm",
      round: null,
      note: "Kvalifiserende runde i årbokas diagram.",
    });
    expect(results1920?.find((item) => item.opponent === "Braatt" && item.status === "walkover"))
      .toMatchObject({ competitionId: "nm", round: 1 });

    const brann1917 = archive.matches.find((item) => item.id === "1917-08-26-aalesunds-fk-sk-brann");
    expect(brann1917).toMatchObject({ home: { score: 0 }, away: { score: 14 } });
    expect(brann1917?.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "nff-arbok-1917", page: "68–69" }),
    ]));

    const sverre1919 = archive.matches.find((item) => item.id === "1919-09-07-sverre-aalesunds-fk");
    expect(sverre1919).toMatchObject({ home: { score: 3 }, away: { score: 2 }, manual: ["away.score"] });
    expect(sverre1919?.conflicts.find((item) => item.field === "away.score")).toMatchObject({
      resolved: true,
      chosen: 2,
      decision: "independent_source",
      locked: true,
    });

    const rollonJune = archive.matches.filter((item) =>
      item.competition.season === 1920 &&
      item.home.clubId === "aalesunds-fk" && item.away.clubId === "rollon" &&
      item.home.score === 3 && item.away.score === 1,
    );
    expect(rollonJune).toHaveLength(1);
    expect(rollonJune[0]).toMatchObject({
      id: "1920-06-13-aalesunds-fk-rollon",
      competition: { id: "sondmore-kreds-klasse-a" },
      referee: "Th. Høgberg",
    });
    expect(rollonJune[0]?.conflicts.find((item) => item.field === "date")?.values.map((item) => item.value))
      .toEqual(["1920-06-13", "1920-06-14"]);

    const result = (id: string) => archive.matches.find((item) => item.id === id);
    expect(result("1920-05-23-aalesunds-fk-frigg")).toMatchObject({ home: { score: 3 }, away: { score: 5 } });
    expect(result("1920-06-20-aalesunds-fk-freidig")).toMatchObject({ home: { score: 2 }, away: { score: 3 } });

    const earlyFirstTeam = archive.matches.filter((item) => [1917, 1918, 1919, 1920].includes(item.competition.season));
    expect(earlyFirstTeam.some((item) => item.home.clubId === "aalesund-2" || item.away.clubId === "aalesund-2")).toBe(false);
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

  it("fører Georg Haller som formann og Ole Jangaard som oppmann i 1915", () => {
    const georg = archive.people.find((person) => person.id === "georg-haller");
    const ole = archive.people.find((person) => person.id === "ole-jangaard");
    const verification = archive.verificationCases.find((item) => item.id === "ole-jangaard-formann-1915");
    const extraction = archive.extractions.find((item) => item.sourceId === "aalesunds-fotballklubb-1914-50-1964-3815");

    expect(georg?.roles).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Formann", from: "1914", to: "1915" }),
    ]));
    expect(ole?.roles.filter((role) => role.from === "1915").map((role) => role.title)).toContain("Oppmann");
    expect(ole?.roles.some((role) => role.title === "Formann")).toBe(false);
    expect(ole?.conflicts.some((conflict) => conflict.field === "formann.1915")).toBe(false);
    expect(extraction?.resolvedRoles.some((role) => role.personId === "ole-jangaard" && role.title === "Formann" && role.from === "1915")).toBe(false);
    expect(verification).toMatchObject({ status: "resolved", resolution: { answer: "no" } });
  });

  it("har 13 seriekamper i Landsdelsserien 1962 med konsistente datoer og resultater", () => {
    const landsdelOpponents = new Set(["hodd", "clausenengen", "langevag", "molde-fk", "braatt", "kfk", "skarbovik"]);
    const matches1962 = archive.matches.filter(
      (m) =>
        m.competition.season === 1962 &&
        m.competition.id === "forstedivisjon" &&
        (landsdelOpponents.has(m.home.clubId) || landsdelOpponents.has(m.away.clubId)),
    );
    expect(matches1962).toHaveLength(13);
    expect(matches1962.every((m) => m.date && m.dateConfidence === "exact")).toBe(true);

    let aafkWins = 0;
    let draws = 0;
    let aafkLosses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    for (const match of matches1962) {
      const isHome = match.home.clubId === "aalesunds-fk";
      const aafkScore = isHome ? match.home.score! : match.away.score!;
      const oppScore = isHome ? match.away.score! : match.home.score!;

      goalsFor += aafkScore;
      goalsAgainst += oppScore;
      if (aafkScore > oppScore) aafkWins++;
      else if (aafkScore === oppScore) draws++;
      else aafkLosses++;
    }

    expect(aafkWins).toBe(9);
    expect(draws).toBe(3);
    expect(aafkLosses).toBe(1);
    expect(goalsFor).toBe(35);
    expect(goalsAgainst).toBe(8);
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

  /**
   * «År» og «kilder» betyr to ting hver, og radene het før det samme.
   *
   * 87 år har kanoniske kamper, mens sesongoversikten viser 91 fordi fire år
   * foreløpig bare har kildedokumenterte resultater. Begge tallene er riktige,
   * og et arkiv som oppgir dem uten å skille dem ser ut til å motsi seg selv.
   *
   * Det samme gjelder «kilder»: åtte dataleverandører er der data hentes
   * digitalt fra, mens de historiske kildene er dokumentene en enkelt opplysning
   * peker på. Arkitekturen skiller dem allerede; nå gjør README det også.
   */
  const forventet: [string, RegExp, () => number][] = [
    ["kamper", /kamper\*\*/, () => archive.matches.length],
    [
      "år med kanoniske kamper",
      /år med kanoniske kamper\*\*/,
      () => new Set(archive.matches.map((m) => m.competition.season)).size,
    ],
    [
      "år med historisk kampinformasjon",
      /år med historisk kampinformasjon\*\*/,
      () => new Set([
        ...archive.matches.map((m) => m.competition.season),
        // Kildedokumenterte resultater ligger samlet per kilde, med årene inni.
        // `sourceResults` er altså én rad per kildefil, ikke én per resultat.
        ...archive.sourceResults.flatMap((c) => c.seasons.map((s) => s.year)),
      ]).size,
    ],
    ["klubber", /klubber/, () => archive.clubs.length],
    ["personer", /personer\*\*/, () => archive.people.length],
    ["dataleverandører", /dataleverandører\*\*/, () => archive.providers.length],
    ["historiske kilder", /historiske kilder\*\*/, () => archive.sources.length],
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

  it("skiller alle kildedokumenterte oppføringer fra dem uten kampkobling", () => {
    const resultater = archive.sourceResults.flatMap((collection) =>
      collection.seasons.flatMap((season) => season.results)
    );
    const utenKampkobling = resultater.filter((result) => result.matchId === null).length;

    expect(stated(/kildedokumenterte resultatoppføringer/)).toBe(resultater.length);
    const match = /\*\*([\d\u00a0 ]+)\s+mangler fortsatt kobling/.exec(readme);
    expect(match, "fant ikke antallet uten kanonisk kampkobling i README").not.toBeNull();
    expect(Number(match![1].replace(/\s|\u00a0/gu, ""))).toBe(utenKampkobling);
  });
});
