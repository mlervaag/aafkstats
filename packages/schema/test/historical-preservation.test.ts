import { describe, expect, it } from "vitest";
import type { Person } from "../src/person.js";
import { runPreservationAudit } from "../src/historical/preservation.js";
import { preservationException, type PreservationException } from "../src/preservation-exceptions.js";

describe("Historical Preservation (PR #158)", () => {
  const baseSamplePerson: Person = {
    id: "karsten-nedregard",
    name: "Karsten Nedregård",
    names: ["Carsten Nedregård", "Karsten Nedregaard"],
    nationality: "Norge",
    position: "angrep",
    wikidata: "Q123456",
    roles: [
      {
        id: "formann-1950",
        category: "board",
        title: "Formann",
        body: "Hovedstyret",
        from: "1950",
        to: null,
        sources: [
          {
            sourceId: "medlemsblad-1950",
            page: "12",
            fields: ["roles", "note"],
          },
        ],
        note: "Valgt på årsmøtet",
      },
    ],
    sources: [
      {
        sourceId: "medlemsblad-1950",
        page: "12",
        fields: ["roles", "names"],
      },
      {
        sourceId: "medlemsblad-1961",
        page: "59",
        fields: ["roles"],
      },
    ],
    conflicts: [
      {
        field: "formann.1950",
        values: [
          { value: "Karsten Nedregård", providerId: "aafk-medlemsblad" },
          { value: "K. Nedregaard", providerId: "sunnmoersposten" },
        ],
        resolved: false,
        decision: "unresolved",
        locked: false,
      },
    ],
    coachSpells: [
      {
        fromSeason: 1952,
        toSeason: null,
      },
    ],
    squadNumbers: [
      {
        season: 1948,
        number: 9,
      },
    ],
    providers: [
      {
        providerId: "aafk-medlemsblad",
        fields: ["roles"],
      },
    ],
  };

  it("godtar uendret person og YAML-reformatering som 0 destructive changes (PASS)", () => {
    const headPerson: Person = JSON.parse(JSON.stringify(baseSamplePerson));
    const result = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", headPerson]]),
    );

    expect(result.passed).toBe(true);
    expect(result.summary.destructiveChanges).toBe(0);
    expect(result.summary.additions).toBe(0);
    expect(result.summary.safeEnrichments).toBe(0);
    expect(result.changes.length).toBe(0);
  });

  it("godtar additiv berikelse: nye roller, ekstra kilder, avsluttet dato, nytt navn, løst konflikt (SAFE_ENRICHMENT & PASS)", () => {
    const headPerson: Person = JSON.parse(JSON.stringify(baseSamplePerson));

    // 1. Ny rolle lagt til
    headPerson.roles.push({
      id: "banekomite-1956",
      category: "board",
      title: "Medlem banekomiteen",
      body: "Banekomiteen",
      from: "1956",
      to: "1956",
      sources: [{ sourceId: "medlemsblad-1956", page: "4", fields: ["roles"] }],
    });

    // 2. Eksisterende rolle kildeberiket og dato presisert
    headPerson.roles[0]!.to = "1951";
    headPerson.roles[0]!.sources.push({
      sourceId: "medlemsblad-1951",
      page: "2",
      fields: ["roles"],
    });

    // 3. Ny person-kilde
    headPerson.sources.push({
      sourceId: "medlemsblad-1956",
      page: "4",
      fields: ["roles"],
    });

    // 4. Nytt navn lagt til
    headPerson.names.push("K. Nedregård");

    // 5. Løst konflikt med bevarte verdier
    headPerson.conflicts[0] = {
      field: "formann.1950",
      values: [
        { value: "Karsten Nedregård", providerId: "aafk-medlemsblad" },
        { value: "K. Nedregaard", providerId: "sunnmoersposten" },
      ],
      resolved: true,
      decision: "manual",
      chosen: "Karsten Nedregård",
      chosenProviderId: "aafk-medlemsblad",
      decidedAt: "2026-08-15",
      reason: "Samstemt medlemsblad s. 12 bekrefter fullt navn.",
      locked: true,
    };

    // 6. Trenerperiode presisert
    headPerson.coachSpells[0]!.toSeason = 1953;

    // 7. Nytt draktnummer
    headPerson.squadNumbers.push({ season: 1949, number: 10 });

    const result = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", headPerson]]),
    );

    expect(result.passed).toBe(true);
    expect(result.summary.destructiveChanges).toBe(0);
    expect(result.summary.additions).toBeGreaterThan(0);
    expect(result.summary.safeEnrichments).toBeGreaterThan(0);
  });

  it("avviser fjerning av eksisterende rolle (FAIL)", () => {
    const headPerson: Person = JSON.parse(JSON.stringify(baseSamplePerson));
    headPerson.roles = [];

    const result = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", headPerson]]),
    );

    expect(result.passed).toBe(false);
    expect(result.summary.destructiveChanges).toBe(1);
    expect(result.changes[0]?.path).toBe("roles/formann-1950");
    expect(result.changes[0]?.status).toBe("DESTRUCTIVE_CHANGE");
  });

  it("avviser fjerning av person-kildehenvisning eller krymping av fields (FAIL)", () => {
    // 1. Kildehenvisning slettet
    const head1: Person = JSON.parse(JSON.stringify(baseSamplePerson));
    head1.sources = [head1.sources[0]!]; // fjernet medlemsblad-1961:59

    const res1 = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", head1]]),
    );
    expect(res1.passed).toBe(false);
    expect(res1.summary.destructiveChanges).toBe(1);
    expect(res1.changes[0]?.path).toBe("sources[medlemsblad-1961:59]");

    // 2. Fields krympet på kildereferanse
    const head2: Person = JSON.parse(JSON.stringify(baseSamplePerson));
    head2.sources[0]!.fields = ["roles"]; // mistet "names"

    const res2 = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", head2]]),
    );
    expect(res2.passed).toBe(false);
    expect(res2.summary.destructiveChanges).toBe(1);
    expect(res2.changes[0]?.path).toBe("sources[medlemsblad-1950:12]/fields");
  });

  it("avviser sletting av konflikt eller tap av konfliktverdi (FAIL)", () => {
    // Slettet verdi i konflikt
    const headPerson: Person = JSON.parse(JSON.stringify(baseSamplePerson));
    headPerson.conflicts[0]!.values = [headPerson.conflicts[0]!.values[0]!];

    const result = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", headPerson]]),
    );

    expect(result.passed).toBe(false);
    expect(result.summary.destructiveChanges).toBe(1);
    expect(result.changes[0]?.path).toBe("conflicts/formann.1950/values");
  });

  it("avviser sletting av navnevariant, trenerperiode, draktnummer eller metadata (FAIL)", () => {
    const headPerson: Person = JSON.parse(JSON.stringify(baseSamplePerson));
    headPerson.names = ["Karsten Nedregård"]; // mistet 2 varianter
    headPerson.coachSpells = []; // mistet trenerperiode
    headPerson.squadNumbers = []; // mistet draktnummer
    headPerson.wikidata = undefined; // mistet wikidata
    headPerson.position = undefined; // mistet posisjon

    const result = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", headPerson]]),
    );

    expect(result.passed).toBe(false);
    expect(result.summary.destructiveChanges).toBeGreaterThanOrEqual(5);
  });

  it("gjenskaper og feller den reelle feilklassen fra tidligere batch (minimal erstatning av personfil)", () => {
    // En person med historiske roller blir erstattet av en minimal fil som kun har en ny 1956-rolle
    const minimalReplacement: Person = {
      id: "karsten-nedregard",
      name: "Karsten Nedregård",
      names: [],
      roles: [
        {
          id: "banekomite-1956",
          category: "board",
          title: "Banekomiteen",
          from: "1956",
          to: "1956",
          sources: [{ sourceId: "medlemsblad-1956", page: "4", fields: ["roles"] }],
        },
      ],
      sources: [{ sourceId: "medlemsblad-1956", page: "4", fields: ["roles"] }],
      conflicts: [],
      coachSpells: [],
      squadNumbers: [],
      providers: [],
    };

    const result = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", minimalReplacement]]),
    );

    expect(result.passed).toBe(false);
    // Skal fange tap av formann-1950, kilder, konflikt, navnevarianter, trenerperiode, draktnummer, wikidata, position
    expect(result.summary.destructiveChanges).toBeGreaterThanOrEqual(7);

    const paths = result.changes.filter((c) => c.status === "DESTRUCTIVE_CHANGE").map((c) => c.path);
    expect(paths).toContain("roles/formann-1950");
    expect(paths).toContain("sources[medlemsblad-1961:59]");
    expect(paths).toContain("conflicts/formann.1950");
    expect(paths).toContain("wikidata");
    expect(paths).toContain("position");
  });

  it("avviser sletting av en hel personfil uten unntak (FAIL)", () => {
    const result = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map(),
    );

    expect(result.passed).toBe(false);
    expect(result.summary.peopleDeleted).toBe(1);
    expect(result.summary.destructiveChanges).toBe(1);
    expect(result.changes[0]?.path).toBe("file");
    expect(result.changes[0]?.changeType).toBe("delete_file");
  });

  it("godtar sletting når en målrettet exception er registrert (APPROVED_EXCEPTION & PASS)", () => {
    const headPerson: Person = JSON.parse(JSON.stringify(baseSamplePerson));
    headPerson.roles = []; // sletter formann-1950

    const exception: PreservationException = {
      entity: "person",
      id: "karsten-nedregard",
      path: "roles/formann-1950",
      change: "remove",
      reason: "Duplikatrolle slått sammen etter eksplisitt kildeavstemming mot primærkilde.",
      sources: [{ sourceId: "medlemsblad-1950", page: "12", fields: ["roles"] }],
      approvedIn: 158,
    };

    const result = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", headPerson]]),
      [exception],
    );

    expect(result.passed).toBe(true);
    expect(result.summary.destructiveChanges).toBe(0);
    expect(result.summary.approvedExceptions).toBe(1);
    expect(result.changes[0]?.status).toBe("APPROVED_EXCEPTION");
  });

  it("avviser brede wildcards i schema for exceptions", () => {
    const invalidException = {
      entity: "person",
      id: "karsten-nedregard",
      path: "roles/*",
      change: "remove",
      reason: "Bredt unntak for alle roller.",
    };

    expect(() => preservationException.parse(invalidException)).toThrow();
  });

  it("rapporterer ubrukte/stale exceptions som advarsel", () => {
    const unusedException: PreservationException = {
      entity: "person",
      id: "karsten-nedregard",
      path: "roles/ikke-eksisterende-rolle",
      change: "remove",
      reason: "Gammel dispensasjon som ikke lenger treffer noen endring.",
    };

    const headPerson: Person = JSON.parse(JSON.stringify(baseSamplePerson));
    const result = runPreservationAudit(
      new Map([["karsten-nedregard", baseSamplePerson]]),
      new Map([["karsten-nedregard", headPerson]]),
      [unusedException],
    );

    expect(result.passed).toBe(true);
    expect(result.summary.staleExceptions.length).toBe(1);
    expect(result.summary.staleExceptions[0]?.id).toBe("karsten-nedregard");
  });
});
