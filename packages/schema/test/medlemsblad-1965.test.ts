import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadArchive, type Archive } from "../src/load.js";

const SOURCE_ID = "medlemsblad-for-aalesunds-fotb-1965-a2c9";

describe("Medlemsblad 1965 (Vol. 16 nr. 1–6)", () => {
  let archive: Archive;

  beforeAll(async () => {
    archive = await loadArchive(resolve(import.meta.dirname, "../../../data"));
  }, 30_000);

  it("fører alle 36 A-lagskampene i 1965 som kildepåstander uten oppdiktet dato", () => {
    const collection = archive.sourceResults.find((c) => c.sourceId === SOURCE_ID);
    const season = collection?.seasons.find((s) => s.year === 1965);

    expect(season?.results).toHaveLength(36);
    // Kilden parer aldri dato og resultat, så ingen oppføring har egen dato.
    expect(season?.results.every((r) => r.date === undefined)).toBe(true);
  });

  it("kobler bare de to oppgjørene der runde og motstander gjør kampen entydig", () => {
    const season = archive.sourceResults
      .find((c) => c.sourceId === SOURCE_ID)
      ?.seasons.find((s) => s.year === 1965);
    const koblet = (season?.results ?? []).filter((r) => r.matchId !== null);

    // Manglende dato betyr «ikke oppfinn dato», ikke «ikke koble til kjent kamp».
    // De to NM-kampene står i sesongarkivet, og runden er trykt i kilden.
    expect(koblet.map((r) => [r.round, r.matchId])).toEqual([
      [3, "1965-08-01-aalesunds-fk-rosenborg-bk"],
      [4, "1965-08-22-valerenga-aalesunds-fk"],
    ]);
    // De øvrige 34 mangler entydig kampidentitet og skal stå ukoblet.
    expect((season?.results ?? []).filter((r) => r.matchId === null)).toHaveLength(34);
  });

  it("stemmer med bladets egne kontrollsummer for sesongen", () => {
    const season = archive.sourceResults
      .find((c) => c.sourceId === SOURCE_ID)
      ?.seasons.find((s) => s.year === 1965);
    const results = season?.results ?? [];

    const seier = results.filter((r) => r.score![0] > r.score![1]).length;
    const uavgjort = results.filter((r) => r.score![0] === r.score![1]).length;
    const tap = results.filter((r) => r.score![0] < r.score![1]).length;
    const scoret = results.reduce((sum, r) => sum + r.score![0], 0);
    const sluppet = results.reduce((sum, r) => sum + r.score![1], 0);

    // Bladet oppgir 21-6-9 og målforhold 125–75 på samme side som kamplista.
    expect([seier, uavgjort, tap]).toEqual([21, 6, 9]);
    expect([scoret, sluppet]).toEqual([125, 75]);
  });

  it("legger årsmøtevalgene fra november 1965 på arbeidsåret 1966", () => {
    const snapshot1966 = archive.organizationSnapshots.find((s) => s.date === "1966");

    expect(snapshot1966?.people.find((p) => p.observedTitle === "Formann")?.personId).toBe(
      "rolf-annaniassen",
    );
    expect(snapshot1966?.people.find((p) => p.observedTitle === "Nestformann")?.personId).toBe(
      "asbjorn-rutgerson",
    );
    expect(snapshot1966?.people.find((p) => p.observedTitle === "Oppmann")?.personId).toBe(
      "olaf-bigseth",
    );
    // Valget fant sted i 1965, men gjelder 1966: det skal ikke ligge på 1965.
    const snapshot1965 = archive.organizationSnapshots.find((s) => s.date === "1965");
    expect(snapshot1965).toBeUndefined();
  });

  it("dokumenterer sølvmerket for 150 A-kamper på alle tre mottakerne", () => {
    for (const personId of ["kjell-iversen", "jarle-kristoffersen", "harald-johansen"]) {
      const role = archive.people
        .find((p) => p.id === personId)
        ?.roles.find((r) => r.id === "spillemerke-solv-150-kamper-1965");

      expect(role, `${personId} mangler sølvmerket`).toBeDefined();
      expect(role?.category).toBe("honorary");
      expect(role?.from).toBe("1965");
      expect(role?.sources.some((s) => s.sourceId === SOURCE_ID)).toBe(true);
    }
  });

  it("bekrefter trenerrollen fra jubileumsboka med en samtidig kilde", () => {
    const role = archive.people
      .find((p) => p.id === "torbjorn-aaro")
      ?.roles.find((r) => r.id === "trener-1965");

    // Rollen fantes fra 2013-boka; medlemsbladet er den samtidige bekreftelsen.
    expect(role?.sources.map((s) => s.sourceId)).toEqual(
      expect.arrayContaining(["tango-siden-1914-2013-806b", SOURCE_ID]),
    );
    expect(role?.to).toBe("1965");
  });

  it("beriker de to kanoniske NM-kampene uten å endre resultatet", () => {
    const rosenborg = archive.matches.find((m) => m.id === "1965-08-01-aalesunds-fk-rosenborg-bk");
    const valerenga = archive.matches.find((m) => m.id === "1965-08-22-valerenga-aalesunds-fk");

    expect(rosenborg?.home.score).toBe(3);
    expect(rosenborg?.away.score).toBe(2);
    expect(rosenborg?.sources?.some((s) => s.sourceId === SOURCE_ID)).toBe(true);

    expect(valerenga?.home.score).toBe(4);
    expect(valerenga?.away.score).toBe(1);
    expect(valerenga?.sources?.some((s) => s.sourceId === SOURCE_ID)).toBe(true);
  });

  it("kobler ikke Måløy til Tornado Måløy, og ikke Brage i Trondheim til Sportsklubben Brage", () => {
    const rows = (archive.sourceResults.find((c) => c.sourceId === SOURCE_ID)?.seasons ?? [])
      .flatMap((s) => s.results);

    // Måløy IL og Tornado Måløy er to forskjellige klubber, og entiteten
    // tornado-maloy dokumenterer ingen historisk navneform «Måløy».
    const maloy = rows.filter((r) => r.opponent === "Måløy");
    expect(maloy.length).toBeGreaterThan(0);
    expect(maloy.every((r) => r.opponentClubId !== "tornado-maloy")).toBe(true);

    // Sportsklubben Brage hører til Drammen; kildens stedsangivelse motsier
    // koblingen. «Brage» uten sted står fortsatt koblet.
    const brageTrondheim = rows.filter((r) => r.opponent === "Brage, Tr.heim");
    expect(brageTrondheim.length).toBeGreaterThan(0);
    expect(brageTrondheim.every((r) => r.opponentClubId === null)).toBe(true);
    expect(rows.some((r) => r.opponent === "Brage" && r.opponentClubId === "brage")).toBe(true);
  });

  it("kobler bare motstandere som treffer en dokumentert navneform på klubben", () => {
    const rows = (archive.sourceResults.find((c) => c.sourceId === SOURCE_ID)?.seasons ?? [])
      .flatMap((s) => s.results);
    const normalize = (value: string) =>
      value
        .normalize("NFKD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/ø/gu, "o")
        .replace(/æ/gu, "a")
        .replace(/å/gu, "a")
        .replace(/[^a-z0-9]/gu, "");

    // Stedsangivelse og foreningsledd er godtatte avvik; alt annet skal treffe.
    const accepted = new Set(["eid", "djerv", "kvik", "sverrelevanger"]);
    const suspicious: string[] = [];

    for (const row of rows) {
      if (!row.opponentClubId || !row.opponent) continue;
      const club = archive.clubs.find((c) => c.id === row.opponentClubId);
      expect(club, `ukjent klubb ${row.opponentClubId}`).toBeDefined();
      const nameForms = [
        club!.name,
        club!.shortName,
        ...(club!.names ?? []),
        ...(club!.nameVariants ?? []),
      ].flatMap((value) => (typeof value === "string" ? [value] : []));
      const forms = new Set(nameForms.map((value) => normalize(value)));
      const printed = normalize(row.opponent);
      const base = normalize(row.opponent.split(",")[0]!);
      if (forms.has(printed) || forms.has(base) || accepted.has(base)) continue;
      suspicious.push(`${row.opponent} → ${row.opponentClubId}`);
    }

    expect([...new Set(suspicious)]).toEqual([]);
  });
});
