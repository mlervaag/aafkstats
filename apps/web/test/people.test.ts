import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { getOrganizationSnapshots, getPeople, getPersonById, getPersonRoles, getPersonSeasons, getPersonTransfers, mergeRoleSpells, type PersonRole } from "../lib/people.js";
import { loadTransfers } from "../lib/archive.js";
import { getSourceRoleUsages, getSourceSeasonUsages, getSourceUsages } from "../lib/sources.js";

const previousDbPath = process.env.AAFK_DB_PATH;

/**
 * Kjører mot `data/`, ikke mot fixturen, på samme premiss som
 * packages/schema/test/archive-truths.test.ts: påstandene her handler om
 * virkelige personer og en virkelig publikasjon fra 1939. En fixture ville
 * bestått uansett hva som skjer med de filene som faktisk blir publisert.
 *
 * De øvrige testene her bygger fixture-arkivet i beforeAll. Uten et slikt steg
 * finnes det ingen arkivfil å åpne, og testen feiler før den rekker å si noe om
 * dataene — slik den gjorde i CI etter #73.
 */
beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-people-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 30_000);

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("person- og organisasjonsarkivet", () => {
  it("samler kampfolk og historiske ledere i samme register", () => {
    const people = getPeople();
    expect(people.some((person) => person.appearances > 0)).toBe(true);
    expect(people.some((person) => person.role_categories.includes("board"))).toBe(true);
  }, 30_000);

  it("viser Georg Hallers stifter-, spiller-, anleggs-, formanns- og hedersroller", () => {
    const person = getPersonById("georg-haller");
    const roles = getPersonRoles("georg-haller");
    expect(person?.role_count).toBeGreaterThanOrEqual(5);
    expect(roles.map((role) => role.title)).toEqual(expect.arrayContaining([
      "Stifter og første formann",
      "Formann i banekomiteen",
      "Spiller",
      "Formann",
      "Æresmedlem",
    ]));
    expect(roles.every((role) => role.sources.length > 0)).toBe(true);
  });

  it("fører pilotkilden tilbake til roller, sesonger og kamper", () => {
    const id = "aalesunds-fotballklub-gjennem-1939-ec28";
    expect(getSourceRoleUsages(id).length).toBeGreaterThan(0);
    expect(getSourceSeasonUsages(id).length).toBeGreaterThan(0);
    expect(getSourceUsages(id).length).toBeGreaterThan(0);
  });

  it("viser kjente draktnummer sammen med koblede kampsesonger", () => {
    const seasons = getPersonSeasons("sten-grytebust");
    for (const season of [2025, 2024, 2023, 2022]) {
      expect(seasons.find((entry) => entry.season === season)).toMatchObject({
        season,
        number: 1,
        position: "keeper",
      });
    }
    expect(seasons.some((season) => season.appearances > 0)).toBe(true);
  });

  it("holder organisasjonssnapshots atskilt fra rolleperioder", () => {
    const snapshots = getOrganizationSnapshots();
    expect(snapshots.some((entry) => entry.snapshot_date === "2009-09-20" && entry.person_id === "einar-welle" && entry.observed_title === "Arenasjef")).toBe(true);
    expect(getPersonRoles("einar-welle")).toHaveLength(0);
  });

  it("fører Geir Steinar Viks felles lederjobb på både AaFK og ÅFAS", () => {
    const roles = getPersonRoles("geir-steinar-vik");
    expect(roles).toEqual(expect.arrayContaining([
      expect.objectContaining({ organization_id: "aafk", from_date: "2017", to_date: "2022" }),
      expect.objectContaining({ organization_id: "aafk-as", title: "Daglig leder", from_date: "2017", to_date: "2022" }),
    ]));
  });

  it("lar bare Sindre Eids dokumenterte nåværende rolle stå åpen", () => {
    const roles = getPersonRoles("sindre-eid");
    expect(roles.filter((role) => role.to_date === null).map((role) => role.title)).toEqual(["Toppspillerutvikler"]);
    expect(roles.find((role) => role.title === "Utviklingsleder")?.to_date).toBe("2020");
  });

  it("bevarer Vågnes' rolleendring i 2008 som to ulike titler", () => {
    const roles = getPersonRoles("reidar-vagnes");
    expect(roles).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Sportslig utviklingsleder", from_date: "2006", to_date: "2008-12-08" }),
      expect.objectContaining({ title: "Spiller- og trenerutvikler", from_date: "2008-12-08", to_date: "2009" }),
    ]));
  });

  it("samler Omenås' spiller- og lederhistorikk på én person", () => {
    const person = getPersonById("tarjei-aase-omenas");
    expect(person).toMatchObject({ name: "Tarjei Gjendemsjø Omenås", appearances: expect.any(Number) });
    expect(getPersonRoles("tarjei-aase-omenas").map((role) => role.title)).toEqual(expect.arrayContaining([
      "Salgs- og partneransvarlig",
      "Daglig leder",
    ]));
    expect(getPersonById("tarjei-gjendemsjo-omenas")).toBeUndefined();
  });

  it("viser organisasjonsbildene for 1961 og 1962 med styre og sportslig ledelse", () => {
    const snapshots = getOrganizationSnapshots();
    expect(snapshots.some((s) => s.snapshot_date === "1961" && s.person_id === "kjell-berentzen" && s.observed_title === "Formann")).toBe(true);
    expect(snapshots.some((s) => s.snapshot_date === "1961" && s.person_id === "hans-j-henriksen" && s.observed_title === "Nestformann")).toBe(true);
    expect(snapshots.some((s) => s.snapshot_date === "1961" && s.person_id === "einar-aas" && s.observed_title === "Oppmann")).toBe(true);
    expect(snapshots.some((s) => s.snapshot_date === "1961" && s.person_id === "hilda-orheim" && s.observed_title === "Formann")).toBe(true);

    expect(snapshots.some((s) => s.snapshot_date === "1962" && s.person_id === "hans-j-henriksen" && s.observed_title === "Formann")).toBe(true);
    expect(snapshots.some((s) => s.snapshot_date === "1962" && s.person_id === "rolf-annaniassen" && s.observed_title === "Sekretær")).toBe(true);
    expect(snapshots.some((s) => s.snapshot_date === "1962" && s.person_id === "peder-puck" && s.observed_title === "Kasserer")).toBe(true);
    expect(snapshots.some((s) => s.snapshot_date === "1962" && s.person_id === "reidar-steen-jensen" && s.observed_title === "Spillende trener")).toBe(true);
    expect(snapshots.some((s) => s.snapshot_date === "1962" && s.person_id === "einar-aas" && s.observed_title === "Oppmann")).toBe(true);
  });

  it("bevarer Rolf Annaniassens parallelle sekretærverv i Hovedstyret og Guttegruppen i 1962", () => {
    const roles = getPersonRoles("rolf-annaniassen");
    const sec1962 = roles.filter((r) => r.from_date === "1962" && r.title === "Sekretær");
    expect(sec1962).toHaveLength(2);
    expect(sec1962.map((r) => r.body)).toEqual(expect.arrayContaining(["Hovedstyret", "Guttegruppen"]));
  });

  it("fører Jarle Kristoffersen som oppmann i 1967, ikke formann, og holder Erling Bjørges formannsverv unna konflikten", () => {
    const jarleTitles = getPersonRoles("jarle-kristoffersen").map((role) => role.title);
    expect(jarleTitles).toContain("Oppmann");
    expect(jarleTitles).not.toContain("Formann");

    const erling = getPersonRoles("erling-bjorge").find((role) => role.title === "Formann");
    expect(erling).toMatchObject({ from_date: "1967", to_date: "1968" });
  });

  it("viser kildeomtaler på personsiden for personer med medlemsbladreferanser", () => {
    const jangaard = getPersonById("nils-jangaard");
    expect(jangaard?.mentions.some((m) => m.sourceId === "medlemsblad-for-aalesunds-fotb-1961-a9f8")).toBe(true);

    const oskar = getPersonById("oskar-pedersen");
    expect(oskar?.mentions.some((m) => m.sourceId === "medlemsblad-for-aalesunds-fotb-1962-5664")).toBe(true);
  });
});

describe("mergeRoleSpells", () => {
  const role = (over: Partial<PersonRole>): PersonRole => ({
    person_id: "sigurd-norve", name: "Sigurd Nørve", role_id: "r", category: "board",
    title: "Formann", organization_id: null, organization_name: null,
    body: "Hovedstyret", from_date: "1946", to_date: null,
    sources: [], note: null, ...over,
  });

  it("slår en enkeltårskilde inn i perioden den ligger inni", () => {
    const merged = mergeRoleSpells([
      role({ role_id: "a", from_date: "1946", to_date: "1949", sources: [{ sourceId: "bok" }] }),
      role({ role_id: "b", from_date: "1948", sources: [{ sourceId: "tango", page: "235" }] }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ from_date: "1946", to_date: "1949" });
    expect(merged[0]!.sources.map((s) => s.sourceId)).toEqual(["bok", "tango"]);
  });

  it("slår sammenhengende år til én periode", () => {
    const trener = (year: string) => role({ role_id: year, category: "coach", title: "Trener", body: null, from_date: year });
    const merged = mergeRoleSpells([trener("2009"), trener("2010"), trener("2011"), trener("2012")]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ from_date: "2009", to_date: "2012" });
  });

  it("regner tomt organ som hovedstyret", () => {
    const merged = mergeRoleSpells([
      role({ person_id: "lauritz-giske", role_id: "a", from_date: "1953", to_date: "1954", body: "Hovedstyret" }),
      role({ person_id: "lauritz-giske", role_id: "b", from_date: "1954", body: null }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.body).toBe("Hovedstyret");
  });

  it("holder en navngitt komité utenfor hovedstyret", () => {
    const merged = mergeRoleSpells([
      role({ person_id: "per-anker-eriksen", role_id: "a", from_date: "1951", body: null }),
      role({ person_id: "per-anker-eriksen", role_id: "b", from_date: "1952", body: "Banekomiteen" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("holder to organ fra hverandre selv om årene overlapper", () => {
    const merged = mergeRoleSpells([
      role({ person_id: "erling-bjorge", role_id: "a", from_date: "1967", to_date: "1968", body: "Hovedstyret" }),
      role({ person_id: "erling-bjorge", role_id: "b", from_date: "1968", body: "Redaksjonskomiteen" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("holder samme tittel i ulike organisasjoner fra hverandre", () => {
    const merged = mergeRoleSpells([
      role({ role_id: "a", organization_id: "aafk", from_date: "1994", to_date: "2008" }),
      role({ role_id: "b", organization_id: "aafk-as", from_date: "1994", to_date: "2008" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("regner «Trener» og «Hovedtrener» som samme jobb", () => {
    const merged = mergeRoleSpells([
      role({ person_id: "kjetil-rekdal", role_id: "oppgitt", category: "coach", title: "Hovedtrener", body: "A-laget", from_date: "2008-09-04", to_date: "2012-11-26" }),
      role({ person_id: "kjetil-rekdal", role_id: "bok", category: "coach", title: "Trener", body: null, from_date: "2009", sources: [{ sourceId: "tango", page: "351" }] }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ title: "Hovedtrener", from_date: "2008-09-04", to_date: "2012-11-26" });
    // Bokas sidetall skal ikke forsvinne i sammenslåingen.
    expect(merged[0]!.sources.map((source) => source.page)).toEqual(["351"]);
  });

  it("regner «Formann» og «Styreleder» som samme verv", () => {
    const merged = mergeRoleSpells([
      role({ person_id: "peder-puck", role_id: "a", title: "Formann", from_date: "1938", to_date: "1945" }),
      role({ person_id: "peder-puck", role_id: "b", title: "Styreleder", body: null, from_date: "1945", to_date: "1946" }),
    ]);
    expect(merged).toHaveLength(1);
    // Ordet fra den kilden som dekker mest: sju år mot to.
    expect(merged[0]).toMatchObject({ title: "Formann", from_date: "1938", to_date: "1946" });
  });

  it("holder assistenttreneren utenfor hovedtrenerperioden", () => {
    const merged = mergeRoleSpells([
      role({ person_id: "x", role_id: "a", category: "coach", title: "Hovedtrener", body: null, from_date: "2008", to_date: "2012" }),
      role({ person_id: "x", role_id: "b", category: "coach", title: "Assistenttrener", body: null, from_date: "2009" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("beholder et opphold mellom to perioder", () => {
    const merged = mergeRoleSpells([
      role({ role_id: "a", from_date: "1946", to_date: "1949" }),
      role({ role_id: "b", from_date: "1955", to_date: "1957" }),
    ]);
    expect(merged.map((r) => r.from_date)).toEqual(["1946", "1955"]);
  });

  it("lar en åpen periode være åpen", () => {
    const merged = mergeRoleSpells([role({ role_id: "a", from_date: "2024" })]);
    expect(merged[0]!.to_date).toBeNull();
  });
});

/**
 * Overgangene, hele veien fra YAML til det sidene faktisk viser.
 *
 * Kjører mot `data/` som resten av fila: påstanden gjelder fire virkelige
 * overganger medlemsbladet dokumenterte høsten 1950, ikke en oppdiktet fixture.
 */
describe("overganger", () => {
  it("viser Knut Hjelles overgang til Volda med kilde og klubbkobling", () => {
    // To rader: ut til Volda om høsten, og tilbake igjen i neste utgave. Uten
    // returen ville arkivet bare vist at han dro.
    const transfers = getPersonTransfers("knut-hjelle");
    expect(transfers).toHaveLength(2);
    expect(transfers.map((entry) => entry.direction).sort()).toEqual(["in", "out"]);
    expect(transfers.find((entry) => entry.direction === "out")).toMatchObject({
      direction: "out",
      kind: "transfer",
      season: 1950,
      // Kildens egen skrivemåte står, selv om klubben er identifisert.
      club: "Volda T. & I.L.",
      club_id: "volda",
    });
    expect(transfers[0]!.sources[0]?.sourceId).toContain("medlemsblad");
  }, 30_000);

  it("lar klubben stå uten ID når arkivet ikke kjenner den", () => {
    // Wing er ikke en klubb AaFK har møtt, og finnes derfor ikke i data/clubs.
    // Navnet skal likevel vises; en tom club_id er ikke en mangel.
    const [transfer] = getPersonTransfers("helge-odegaard");
    expect(transfer).toMatchObject({ club: "Wing", club_id: null });
  }, 30_000);

  it("samler sesongens bevegelser på sesongen kilden oppgir", () => {
    const transfers = loadTransfers(1950);
    expect(transfers).toHaveLength(5);
    expect(transfers.filter((entry) => entry.direction === "out")).toHaveLength(4);
    expect(transfers.filter((entry) => entry.direction === "in")).toHaveLength(1);
  }, 30_000);

  it("gir ingen overganger for et år ingen kilde er ført inn for", () => {
    // Tomt er en manglende kilde, ikke en sesong uten bevegelser, og
    // sesongsiden skal da ikke vise seksjonen i det hele tatt.
    expect(loadTransfers(1951)).toEqual([]);
  }, 30_000);
});
