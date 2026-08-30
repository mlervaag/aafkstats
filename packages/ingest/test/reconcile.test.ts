import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Match, Observation } from "@aafkstats/schema";
import { crossValidate, loadArchive } from "@aafkstats/schema/load";
import type { Archive } from "@aafkstats/schema/load";
import { reconcile, writePlan } from "../src/reconcile.js";
import type { SourceMatch } from "../src/types.js";

const archive: Archive = {
  clubs: [{ id: "aalesunds-fk", name: "Aalesunds FK", shortName: "AaFK", names: [], country: "NO", aliases: { fotmob: 8404 } }],
  venues: [],
  competitions: [{ id: "forstedivisjon", name: "1. divisjon", names: [], type: "league", tier: 2, country: "NO" }],
  providers: [{ id: "fotmob", name: "FotMob", priority: 50 }],
  seasons: [],
  matches: [],
  observations: [],
  standings: [],
  people: [],
  issues: [],
};

const source: SourceMatch = {
  externalId: "4385655",
  date: "2024-04-01",
  kickoff: "17:00",
  status: "played",
  home: { externalId: "8404", name: "Aalesund" },
  away: { externalId: "9918", name: "Stabæk", country: "NO" },
  homeScore: 1,
  awayScore: 1,
  competitionExternalId: "203",
  competitionName: "1. Divisjon",
  season: 2024,
  round: 1,
  venueName: "Color Line Stadion",
  fields: ["date", "home.score", "away.score"],
};

/** En terminfestet kamp, slik den ser ut i arkivet før den er spilt. */
const SCHEDULED: SourceMatch = {
  ...source,
  date: "2024-04-20",
  status: "scheduled",
  homeScore: undefined,
  awayScore: undefined,
  season: 2024,
  fields: ["date", "status"],
};

const MOVE_OPTIONS = { providerId: "fotmob", competitionId: "eliteserien", retrievedAt: "2026-08-03" };

/** Fixturarkivet på disk, med én kamp fra kilden allerede skrevet inn. */
async function seedFixture(seed: SourceMatch): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "aafk-flyttet-"));
  await cp(resolve(import.meta.dirname, "../../../fixtures/data"), root, { recursive: true });
  const plan = reconcile(await loadArchive(root), [seed], MOVE_OPTIONS);
  if (plan.issues.length > 0) throw new Error(plan.issues.join("; "));
  await writePlan(root, plan);
  return root;
}

describe("reconcile", () => {
  /**
   * En klubb uten land fra kilden får «NO» av skjemaet, og den verdien ser
   * nøyaktig ut som en hentet i den ferdige fila. Tretten utenlandske klubber
   * ble importert med norsk landkode på den måten før innhøstingen sa fra.
   */
  it("sier fra når kilden ikke oppgir land for en ny klubb", () => {
    const utenLand: SourceMatch = { ...source, away: { externalId: "9918", name: "Stabæk" } };
    const plan = reconcile(archive, [utenLand], { providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03" });
    expect(plan.issues).toEqual([
      "klubb stabaek (Stabæk): kilden oppgir ikke land, «NO» er satt som plassholder",
    ]);
  });

  it("lager en deterministisk plan med kilde-ID-er og proveniens", () => {
    const first = reconcile(archive, [source], { providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03" });
    const second = reconcile(archive, [source], { providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03" });
    expect(first).toEqual(second);
    expect(first.issues).toEqual([]);
    expect(first.summary).toEqual({ matchesCreated: 1, matchesSkipped: 0, matchesMoved: 0, matchesUpdated: 0, clubsCreated: 1, clubsUpdated: 0, venuesCreated: 1, seasonsCreated: 1, observationsWritten: 1 });
    const match = first.files.find((file) => file.relativePath.includes("/matches/"))?.value;
    expect(match).toMatchObject({
      id: "2024-04-01-aalesunds-fk-stabaek",
      aliases: { fotmob: "4385655" },
      providers: [{ providerId: "fotmob", retrievedAt: "2026-08-03", fields: ["date", "home.score", "away.score"] }],
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
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    expect(plan.summary.clubsCreated).toBe(0);
    expect(plan.summary.clubsUpdated).toBe(1);
    expect(plan.files.some((file) => file.relativePath.endsWith("aalesunds-fk-raufoss-il.yaml"))).toBe(true);
  });

  it("bevarer manuelt låste felt ved ny innhøsting", () => {
    const withoutVenue = { ...source, venueName: undefined };
    const initial = reconcile(archive, [withoutVenue], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
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
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    const updated = update.files.find((file) => file.relativePath.includes("/matches/"))?.value as Match;
    expect(updated.attendance).toBe(999);
    expect(updated.manual).toEqual(["attendance"]);
  });

  /**
   * Viking–AaFK sto på terminlista til 29. august 2026 og ble spilt den 30.
   * Kamp-ID-en er bygget av datoen, så resultatet havner i en ny fil. Ble den
   * gamle stående, ville arkivet hatt to kamper der det er én.
   */
  it("fjerner den gamle datofila når kilden har flyttet kampen", async () => {
    const root = await seedFixture(SCHEDULED);
    try {
      const before = await loadArchive(root);
      const plan = reconcile(before, [{ ...SCHEDULED, date: "2024-04-21", status: "played", homeScore: 1, awayScore: 2 }], MOVE_OPTIONS);
      expect(plan.issues).toEqual([]);
      expect(plan.removed).toEqual(["seasons/2024/matches/2024-04-20-aalesunds-fk-stabaek.yaml"]);
      expect(plan.summary.matchesMoved).toBe(1);
      expect(plan.files.map((file) => file.relativePath)).toContain("seasons/2024/matches/2024-04-21-aalesunds-fk-stabaek.yaml");

      await writePlan(root, plan);
      const after = await loadArchive(root);
      const ours = after.matches.filter((entry) => entry.aliases.fotmob === "4385655");
      expect(ours.map((entry) => entry.id)).toEqual(["2024-04-21-aalesunds-fk-stabaek"]);
      expect(ours[0]?.home.score).toBe(1);
      expect([...after.issues, ...crossValidate(after)]).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("nekter å flytte en kamp inn på en dato en annen kamp allerede har", async () => {
    const root = await seedFixture(SCHEDULED);
    try {
      const before = await loadArchive(root);
      const ours = before.matches.find((entry) => entry.aliases.fotmob === "4385655")!;
      const occupied: Match & { file: string } = {
        ...ours,
        id: "2024-04-21-aalesunds-fk-stabaek",
        date: "2024-04-21",
        aliases: { fotmob: "9999999" },
        file: "seasons/2024/matches/2024-04-21-aalesunds-fk-stabaek.yaml",
      };
      const plan = reconcile({ ...before, matches: [...before.matches, occupied] }, [{ ...SCHEDULED, date: "2024-04-21" }], MOVE_OPTIONS);
      expect(plan.issues).toHaveLength(1);
      expect(plan.issues[0]).toContain("krever manuell reconcile");
      expect(plan.removed).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("bevarer tidligere detaljfelt og andre kilder ved en oversiktshøsting", () => {
    const detailedSource: SourceMatch = {
      ...source,
      venueName: undefined,
      events: [{ minute: 12, type: "goal", team: "home", player: "Testspiller" }],
      fields: [...source.fields, "events"],
    };
    const initial = reconcile(archive, [detailedSource], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-02",
    });
    const created = initial.files.find((file) => file.relativePath.includes("/matches/"))?.value as Match;
    const existing: Match & { file: string } = {
      ...created,
      providers: [
        ...created.providers,
        { providerId: "fotball-no", retrievedAt: "2026-08-01", fields: ["date"] },
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
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    const updated = update.files.find((file) => file.relativePath.includes("/matches/"))?.value as Match;

    expect(updated.events).toEqual(detailedSource.events);
    expect(updated.providers).toEqual([
      expect.objectContaining({ providerId: "fotmob", retrievedAt: "2026-08-03", fields: expect.arrayContaining(["events"]) }),
      { providerId: "fotball-no", retrievedAt: "2026-08-01", fields: ["date"] },
    ]);
  });
});

/**
 * Observasjonslaget finnes for at kampfila ikke skal være det eneste sporet etter
 * en innhøsting. Da Haugesund-dubletten skulle rettes, måtte det rekonstrueres
 * fra adapterkoden hva kilden hadde stått med. Testene under holder på nettopp
 * den forskjellen: kildens egen streng ved siden av det arkivet gjorde den til.
 */
describe("observasjoner fra reconcile", () => {
  const observationsIn = (plan: { files: { relativePath: string; value: unknown }[] }) =>
    plan.files
      .filter((file) => file.relativePath.startsWith("observations/"))
      .map((file) => file.value as Observation);

  it("tar vare på kildens eget klubbnavn ved siden av klubb-ID-en", () => {
    const plan = reconcile(archive, [source], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03", adapter: "fotmob@1",
    });
    const [entry] = observationsIn(plan);
    expect(entry).toBeDefined();
    // «Aalesund» er det FotMob skriver; `aalesunds-fk` er det arkivet bestemte.
    // Begge skal stå, ellers er forskjellen borte for godt.
    expect(entry!.raw.home).toBe("Aalesund");
    expect(entry!.normalized["home.clubId"]).toBe("aalesunds-fk");
    expect(entry!.matchId).toBe("2024-04-01-aalesunds-fk-stabaek");
    expect(entry!.adapter).toBe("fotmob@1");
  });

  it("legger fila der skjemaet sier den skal ligge", () => {
    const plan = reconcile(archive, [source], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    expect(plan.files.map((file) => file.relativePath)).toContain("observations/fotmob/4385655.yaml");
  });

  it("utelater felt kilden ikke sa noe om", () => {
    // Forskjellen mellom «kilden oppga ikke tilskuertall» og «kilden sa at det
    // ikke finnes» er hele grunnen til at laget er verdt å ha.
    const plan = reconcile(archive, [source], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    const [entry] = observationsIn(plan);
    expect(entry!.raw).not.toHaveProperty("attendance");
    expect(entry!.normalized).not.toHaveProperty("attendance");
  });

  it("skriver observasjonen også for en kamp en annen kilde eier", () => {
    const initial = reconcile(archive, [source], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    const created = initial.files.find((file) => file.relativePath.includes("/matches/"))!.value as Match;
    const stabaek = initial.files.find((file) => file.relativePath === "clubs/stabaek.yaml")!.value;
    const withExisting: Archive = {
      ...archive,
      clubs: [
        { ...archive.clubs[0]!, aliases: { fotmob: 8404, rsssf: "8404" } },
        stabaek as Archive["clubs"][number],
      ],
      providers: [...archive.providers, { id: "rsssf", name: "RSSSF Norway", priority: 40 }],
      matches: [{ ...created, file: `seasons/2024/matches/${created.id}.yaml` }],
    };

    const plan = reconcile(withExisting, [{ ...source, externalId: "1998-first" }], {
      providerId: "rsssf", competitionId: "forstedivisjon", retrievedAt: "2026-08-04", skipExisting: true,
    });

    expect(plan.skipped).toEqual(["2024-04-01-aalesunds-fk-stabaek"]);
    expect(plan.files.some((file) => file.relativePath.includes("/matches/"))).toBe(false);
    const [entry] = observationsIn(plan);
    // Kampen skrives ikke, men det RSSSF sa om den skal ikke gå tapt — og den
    // skal peke på kampen den gjelder, ikke bli hengende uten adresse.
    expect(entry!.providerId).toBe("rsssf");
    expect(entry!.matchId).toBe("2024-04-01-aalesunds-fk-stabaek");
  });

  it("oppdaterer en observasjon som finnes fra før i stedet for å lage en ny", () => {
    const existing = reconcile(archive, [source], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    const previous = observationsIn(existing)[0]!;
    const withObservation: Archive = {
      ...archive,
      observations: [{ ...previous, file: "observations/fotmob/4385655.yaml" }],
    };
    const plan = reconcile(withObservation, [source], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-05",
    });
    const file = plan.files.find((f) => f.relativePath === "observations/fotmob/4385655.yaml");
    expect(file!.action).toBe("update");
  });

  it("skriver en observasjon arkivet kan lese tilbake, og som validerer", async () => {
    // Den viktigste kontrollen i hele laget: en observasjon som skrives, men ikke
    // kan leses tilbake, er verre enn ingen — den ser ut som dokumentasjon og er
    // det ikke. Her går den hele veien gjennom YAML og inn i valideringen.
    const dir = await mkdtemp(join(tmpdir(), "aafk-observasjon-"));
    try {
      await cp(resolve(import.meta.dirname, "../../../fixtures/data"), dir, { recursive: true });
      const before = await loadArchive(dir);
      const plan = reconcile(before, [{
        externalId: "1998 First 24/5 Aalesund - Molde",
        date: "1998-05-24",
        status: "played",
        // Navnene er slik RSSSF faktisk skriver dem, ikke slik arkivet gjør det.
        home: { externalId: "aalesunds", name: "Aalesunds" },
        away: { externalId: "molde", name: "Molde" },
        homeScore: 2,
        awayScore: 1,
        competitionExternalId: "first",
        competitionName: "First Division",
        season: 1998,
        round: 9,
        fields: ["home.score", "away.score"],
      }], {
        providerId: "rsssf",
        competitionId: "forstedivisjon",
        retrievedAt: "2026-08-04",
        adapter: "rsssf@1",
        // Kampen finnes i fixturen fra før. Det er nettopp da observasjonen betyr
        // noe: kampfila blir ikke rørt, så uten den forsvinner det RSSSF sa.
        skipExisting: true,
      });
      expect(plan.issues).toEqual([]);
      expect(plan.files.some((file) => file.relativePath.includes("/matches/"))).toBe(false);

      await writePlan(dir, plan);
      const after = await loadArchive(dir);
      expect([...after.issues, ...crossValidate(after)]).toEqual([]);

      const written = after.observations.find((entry) => entry.providerId === "rsssf"
        && entry.externalId === "1998 First 24/5 Aalesund - Molde");
      expect(written).toBeDefined();
      expect(written!.raw.home).toBe("Aalesunds");
      expect(written!.normalized["home.clubId"]).toBe("aalesunds-fk");
      expect(written!.matchId).toBe("1998-05-24-aalesunds-fk-molde-fk");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("gir samme hash når kilden ikke har endret seg", () => {
    // Uten dette kan ikke neste kjøring se hvilke kamper som er verdt å se på.
    const first = reconcile(archive, [source], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    const later = reconcile(archive, [source], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2027-01-01",
    });
    expect(observationsIn(first)[0]!.payloadHash).toBe(observationsIn(later)[0]!.payloadHash);
    const changed = reconcile(archive, [{ ...source, homeScore: 4 }], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-03",
    });
    expect(observationsIn(changed)[0]!.payloadHash).not.toBe(observationsIn(first)[0]!.payloadHash);
  });

  it("skiller nøyaktig mellom KFK og KBK og nekter å gjette ved tvetydighet", () => {
    const withKfkAndKbk: Archive = {
      ...archive,
      clubs: [
        ...archive.clubs,
        {
          id: "kfk",
          name: "Kristiansund Fotballklubb",
          shortName: "KFK",
          identityKey: "kristiansund-fk",
          nameVariants: ["K.F.K.", "K. F. K.", "Kristiansunds Fotballklub"],
          names: [],
          country: "NO",
          aliases: {},
        },
        {
          id: "kristiansund",
          name: "Kristiansund Ballklubb",
          shortName: "KBK",
          identityKey: "kristiansund-bk",
          nameVariants: ["Kristiansund BK"],
          names: [],
          country: "NO",
          aliases: {},
        },
      ],
    };

    const makeMatch = (extId: string, awayName: string): SourceMatch => ({
      ...source,
      externalId: extId,
      away: { externalId: `ext-${extId}`, name: awayName },
    });

    // 1. KFK via kortnavn
    const planKfkShort = reconcile(withKfkAndKbk, [makeMatch("m1", "KFK")], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-14",
    });
    expect(planKfkShort.issues).toEqual([]);
    expect(planKfkShort.summary.clubsCreated).toBe(0);
    expect(planKfkShort.files.some((f) => f.relativePath.endsWith("aalesunds-fk-kfk.yaml"))).toBe(true);

    // 2. KFK via punktumvariant
    const planKfkDots = reconcile(withKfkAndKbk, [makeMatch("m2", "K.F.K.")], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-14",
    });
    expect(planKfkDots.issues).toEqual([]);
    expect(planKfkDots.files.some((f) => f.relativePath.endsWith("aalesunds-fk-kfk.yaml"))).toBe(true);

    // 3. KFK via historisk skrivemåte
    const planKfkOld = reconcile(withKfkAndKbk, [makeMatch("m3", "Kristiansunds Fotballklub")], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-14",
    });
    expect(planKfkOld.issues).toEqual([]);
    expect(planKfkOld.files.some((f) => f.relativePath.endsWith("aalesunds-fk-kfk.yaml"))).toBe(true);

    // 4. KFK via fullt navn
    const planKfkFull = reconcile(withKfkAndKbk, [makeMatch("m4", "Kristiansund Fotballklubb")], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-14",
    });
    expect(planKfkFull.issues).toEqual([]);
    expect(planKfkFull.files.some((f) => f.relativePath.endsWith("aalesunds-fk-kfk.yaml"))).toBe(true);

    // 5. KBK via fullt navn
    const planKbkFull = reconcile(withKfkAndKbk, [makeMatch("m5", "Kristiansund Ballklubb")], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-14",
    });
    expect(planKbkFull.issues).toEqual([]);
    expect(planKbkFull.files.some((f) => f.relativePath.endsWith("aalesunds-fk-kristiansund.yaml"))).toBe(true);

    // 6. Tvetydig «Kristiansund» skal feile med issue og ikke opprette ny klubb eller feilaktig velge KBK
    const planAmbiguous = reconcile(withKfkAndKbk, [makeMatch("m6", "Kristiansund")], {
      providerId: "fotmob", competitionId: "forstedivisjon", retrievedAt: "2026-08-14",
    });
    expect(planAmbiguous.issues.length).toBeGreaterThan(0);
    expect(planAmbiguous.issues[0]).toContain("tvetydig klubbnavn «Kristiansund»");
    expect(planAmbiguous.summary.clubsCreated).toBe(0);
    expect(planAmbiguous.files.some((f) => f.relativePath.includes("/matches/"))).toBe(false);
  });
});
