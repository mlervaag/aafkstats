import { describe, expect, it } from "vitest";
import { match } from "../src/match.js";
import { club } from "../src/entities.js";
import { crossValidate, loadArchive } from "../src/load.js";
import { findConflicts } from "../src/observation.js";
import { resolve } from "node:path";

const base = {
  id: "2024-04-01-aalesunds-fk-molde-fk",
  date: "2024-04-01",
  status: "played",
  competition: { id: "eliteserien", season: 2024 },
  home: { clubId: "aalesunds-fk", score: 2 },
  away: { clubId: "molde-fk", score: 1 },
};

describe("kampskjema", () => {
  it("godtar en minimal gyldig kamp", () => {
    expect(match.safeParse(base).success).toBe(true);
  });

  it("avviser ukjente felt", () => {
    // .strict() er det som fanger skrivefeil i YAML. Uten den blir «attendence: 500»
    // stille ignorert, og tallet forsvinner uten spor.
    const r = match.safeParse({ ...base, attendence: 500 });
    expect(r.success).toBe(false);
  });

  it("krever at ID-en starter med kampdatoen", () => {
    const r = match.safeParse({ ...base, id: "1999-01-01-aalesunds-fk-molde-fk" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain("må starte med kampdatoen");
  });

  it("krever at én av lagene er AaFK", () => {
    const r = match.safeParse({
      ...base,
      home: { clubId: "molde-fk", score: 2 },
      away: { clubId: "sk-brann", score: 1 },
    });
    expect(r.success).toBe(false);
  });

  it("krever resultat på en kamp med status «played»", () => {
    const r = match.safeParse({ ...base, home: { clubId: "aalesunds-fk" } });
    expect(r.success).toBe(false);
  });

  it("godtar manglende resultat på en kamp som ikke er spilt", () => {
    const r = match.safeParse({
      ...base,
      status: "scheduled",
      home: { clubId: "aalesunds-fk" },
      away: { clubId: "molde-fk" },
    });
    expect(r.success).toBe(true);
  });

  it("avviser straffekonkurranse uten uavgjort etter ordinær tid", () => {
    const r = match.safeParse({ ...base, penaltyShootout: { home: 5, away: 4 } });
    expect(r.success).toBe(false);
  });

  it("krever en registrert konflikt når confidence er «disputed»", () => {
    const r = match.safeParse({ ...base, confidence: "disputed" });
    expect(r.success).toBe(false);
  });

  it("godtar en kamp der bare året er kjent", () => {
    const r = match.safeParse({
      ...base,
      id: "1932-01-01-aalesunds-fk-molde-fk",
      date: "1932-01-01",
      dateConfidence: "year",
      confidence: "probable",
    });
    expect(r.success).toBe(true);
  });

  it("normaliserer en Date fra YAML til datostreng", () => {
    const r = match.safeParse({ ...base, date: new Date("2024-04-01T00:00:00Z") });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.date).toBe("2024-04-01");
  });
});

describe("klubbskjema", () => {
  it("godtar motstandere som er eldre enn AaFK", () => {
    // Brann ble stiftet i 1908, seks år før AaFK — stiftelsesår og sesongår er
    // ikke samme type, selv om begge er årstall.
    expect(club.safeParse({ id: "sk-brann", name: "SK Brann", founded: 1908 }).success).toBe(true);
  });

  it("avviser en ID som ikke er en slug", () => {
    expect(club.safeParse({ id: "SK Brann", name: "SK Brann" }).success).toBe(false);
  });
});

describe("fixture-arkivet", () => {
  const root = resolve(import.meta.dirname, "../../../fixtures/data");

  it("laster og validerer uten feil", async () => {
    const archive = await loadArchive(root);
    const issues = [...archive.issues, ...crossValidate(archive)];
    expect(issues).toEqual([]);
    expect(archive.matches.length).toBeGreaterThan(0);
  });

  it("fanger opp brutte referanser", async () => {
    const archive = await loadArchive(root);
    // Fjern en klubb og bekreft at kampene som peker på den gir feil.
    archive.clubs = archive.clubs.filter((c) => c.id !== "molde-fk");
    const issues = crossValidate(archive);
    expect(issues.some((i) => i.message.includes("ukjent klubb «molde-fk»"))).toBe(true);
  });

  it("leser observasjonene, og finner uenigheten mellom de to kildene", async () => {
    const archive = await loadArchive(root);
    const about = archive.observations.filter(
      (entry) => entry.matchId === "1998-08-16-aalesunds-fk-sk-brann",
    );
    expect(about.map((entry) => entry.providerId).sort()).toEqual(["nasjonalbiblioteket", "rsssf"]);
    // RSSSF har 4210, avisen 4200. Begge er enige om resultatet. Konflikten skal
    // altså gjelde tilskuertallet og ingenting annet.
    expect(findConflicts(about).map((conflict) => conflict.field)).toEqual(["attendance"]);
    // Og råverdien skal fortsatt være avisens egen: «4 200», ikke tallet 4200.
    const avis = about.find((entry) => entry.providerId === "nasjonalbiblioteket")!;
    expect(avis.raw.tilskuere).toBe("4 200");
  });

  it("fanger en observasjon som peker på en kamp som ikke finnes", async () => {
    // Den vanligste måten dette oppstår på er at en kampfil slettes som dublett
    // uten at observasjonen følger med.
    const archive = await loadArchive(root);
    archive.matches = archive.matches.filter((m) => m.id !== "1998-08-16-aalesunds-fk-sk-brann");
    const issues = crossValidate(archive);
    expect(issues.some((i) => i.message.includes("ukjent kamp «1998-08-16-aalesunds-fk-sk-brann»")))
      .toBe(true);
  });

  it("fanger to observasjoner med samme kilde og eksterne ID", async () => {
    const archive = await loadArchive(root);
    archive.observations = [archive.observations[0]!, archive.observations[0]!];
    const issues = crossValidate(archive);
    expect(issues.some((i) => i.message.startsWith("duplikat observasjon"))).toBe(true);
  });
});

describe("personfiler i fixturen", () => {
  const root = resolve(import.meta.dirname, "../../../fixtures/data");

  it("fanger to filer som deler Wikidata-ID", async () => {
    // Q-ID-en er den eneste identiteten her som ikke er en gjetning. Deler to
    // filer den, er de samme person, og det er ingenting å vurdere.
    const archive = await loadArchive(root);
    archive.people = [
      { ...archive.people[0]!, wikidata: "Q1" },
      { ...archive.people[1]!, wikidata: "Q1" },
    ];
    const issues = crossValidate(archive);
    expect(issues.some((i) => i.message.includes("slå filene sammen"))).toBe(true);
  });

  it("fanger en skrivemåte som står på to personer", async () => {
    const archive = await loadArchive(root);
    archive.people = [
      { ...archive.people[0]!, names: ["Delt Navn"] },
      { ...archive.people[1]!, names: ["Delt Navn"] },
    ];
    const issues = crossValidate(archive);
    expect(issues.some((i) => i.message.includes("er også ført på"))).toBe(true);
  });
});
