import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { beforeEach, describe, expect, it } from "vitest";
import type { Person, ResolvedRole } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import { applyPersonMentions, applyResolvedRoles } from "../src/adapters/nb-apply.js";
import type { MentionFinding, RoleFinding } from "../src/adapters/nb-apply.js";

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "ola-nordmann",
    name: "Ola Nordmann",
    names: [],
    squadNumbers: [],
    coachSpells: [],
    roles: [],
    providers: [],
    sources: [],
    ...overrides,
  } as Person;
}

function archiveWith(people: Person[]): Archive {
  return { people } as Archive;
}

function finding(overrides: Partial<ResolvedRole> = {}): RoleFinding {
  return {
    sourceId: "en-publikasjon",
    role: {
      id: "rolle-1",
      page: "18",
      column: 0,
      personName: "Ola Nordmann",
      personId: "ola-nordmann",
      category: "board",
      title: "Formann",
      from: "1917",
      to: null,
      confidence: "high",
      rule: "year_row",
      ...overrides,
    },
  };
}

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aafk-apply-"));
  await mkdir(join(root, "people"), { recursive: true });
});

async function readPerson(id: string): Promise<Person> {
  return parse(await readFile(join(root, "people", `${id}.yaml`), "utf8")) as Person;
}

describe("applyResolvedRoles", () => {
  it("legger en ny rolle på en person arkivet alt har", async () => {
    const report = await applyResolvedRoles(archiveWith([person()]), [finding()], root);
    expect(report).toMatchObject({ added: 1, corroborated: 0 });

    const written = await readPerson("ola-nordmann");
    expect(written.roles).toHaveLength(1);
    expect(written.roles[0]).toMatchObject({ title: "Formann", from: "1917", category: "board" });
    expect(written.roles[0]!.sources[0]).toMatchObject({ sourceId: "en-publikasjon", page: "18" });
  });

  /**
   * De samme vervene kommer fra flere kanter: piloten leste dem for hånd,
   * aafk.no-høstingen legger inn formannsrekkene, og denne kjøringen leser dem
   * i medlemsbladene. Treffer to kilder samme verv, skal det bli én rolle med
   * to kilder — ellers står Georg Haller oppført som formann to ganger.
   */
  it("legger kilden på en rolle som alt står der, i stedet for å lage en til", async () => {
    const existing = person({
      roles: [{
        id: "formann-1917",
        category: "board",
        title: "Formann",
        from: "1917",
        to: null,
        sources: [{ sourceId: "en-annen-kilde", page: "4" }],
      }],
    });

    const report = await applyResolvedRoles(archiveWith([existing]), [finding()], root);
    expect(report).toMatchObject({ added: 0, corroborated: 1 });

    const written = await readPerson("ola-nordmann");
    expect(written.roles).toHaveLength(1);
    expect(written.roles[0]!.sources.map((source) => source.sourceId)).toEqual(["en-annen-kilde", "en-publikasjon"]);
  });

  it("legger ikke samme kilde på samme rolle to ganger", async () => {
    const existing = person({
      roles: [{
        id: "formann-1917",
        category: "board",
        title: "Formann",
        from: "1917",
        to: null,
        sources: [{ sourceId: "en-publikasjon", page: "18" }],
      }],
    });

    const report = await applyResolvedRoles(archiveWith([existing]), [finding()], root);
    expect(report).toMatchObject({ added: 0, corroborated: 0 });
  });

  describe("hva som holdes utenfor", () => {
    it("lager aldri en ny person av et navn arkivet ikke kjenner", async () => {
      // Her kommer feilene inn: av 630 navn i kandidatlaget fantes 14 fra før,
      // og 16 % av resten var OCR-fragmenter.
      const role: Partial<ResolvedRole> = { personName: "Petter Ukjent", confidence: "medium" };
      const without = { ...finding(role), role: { ...finding(role).role } };
      delete (without.role as { personId?: string }).personId;

      const report = await applyResolvedRoles(archiveWith([person()]), [without], root);
      expect(report).toMatchObject({ added: 0, skipped: 1 });
    });

    it("slipper ikke gjennom en lesning som ikke er sikker", async () => {
      const report = await applyResolvedRoles(archiveWith([person()]), [finding({ confidence: "medium" })], root);
      expect(report).toMatchObject({ added: 0, skipped: 1 });
    });

    it("slipper ikke gjennom en rolle uten årstall", async () => {
      const uten = finding();
      delete (uten.role as { from?: string }).from;
      const report = await applyResolvedRoles(archiveWith([person()]), [uten], root);
      expect(report).toMatchObject({ added: 0, skipped: 1 });
    });
  });

  it("gir to ulike verv i samme år hver sin ID", async () => {
    const report = await applyResolvedRoles(archiveWith([person()]), [
      finding(),
      finding({ id: "rolle-2", title: "Kasserer", category: "administration" }),
    ], root);
    expect(report.added).toBe(2);

    const written = await readPerson("ola-nordmann");
    expect(new Set(written.roles.map((role) => role.id)).size).toBe(2);
  });

  it("rører ikke personer ingen resolusjon peker på", async () => {
    await writeFile(join(root, "people", "kari-nordmann.yaml"), "rørt: nei\n", "utf8");
    await applyResolvedRoles(archiveWith([person(), person({ id: "kari-nordmann", name: "Kari Nordmann" })]), [finding()], root);
    expect(await readFile(join(root, "people", "kari-nordmann.yaml"), "utf8")).toBe("rørt: nei\n");
  });
});

describe("applyPersonMentions", () => {
  function mention(overrides: Partial<MentionFinding> = {}): MentionFinding {
    return { personId: "ola-nordmann", sourceId: "en-publikasjon", page: "12", ...overrides };
  }

  it("fører publikasjonen som kilde på personen", async () => {
    const report = await applyPersonMentions(archiveWith([person()]), [mention()], root);
    expect(report).toMatchObject({ added: 1, people: 1 });

    const written = await readPerson("ola-nordmann");
    expect(written.sources).toHaveLength(1);
    expect(written.sources[0]).toMatchObject({ sourceId: "en-publikasjon", page: "12" });
  });

  /**
   * Lauritz Giske er nevnt på 283 sider. Én henvisning per side ville gjort
   * personfila ulesbar uten å si mer enn at bladene skrev om ham.
   */
  it("gir én henvisning per publikasjon, med den første siden", async () => {
    const report = await applyPersonMentions(archiveWith([person()]), [
      mention({ page: "40" }),
      mention({ page: "12" }),
      mention({ page: "77" }),
    ], root);
    expect(report.added).toBe(1);
    expect((await readPerson("ola-nordmann")).sources[0]?.page).toBe("12");
  });

  it("dobbeltfører ikke en publikasjon som alt står på personen", async () => {
    const existing = person({ sources: [{ sourceId: "en-publikasjon", fields: [] }] });
    const report = await applyPersonMentions(archiveWith([existing]), [mention()], root);
    expect(report.added).toBe(0);
  });

  it("dobbeltfører ikke en publikasjon som alt belegger en rolle", async () => {
    const existing = person({
      roles: [{
        id: "formann-1917", category: "board", title: "Formann", from: "1917", to: null,
        sources: [{ sourceId: "en-publikasjon", page: "18", fields: [] }],
      }],
    });
    const report = await applyPersonMentions(archiveWith([existing]), [mention()], root);
    expect(report.added).toBe(0);
  });

  it("rører ikke en person omtalen ikke peker på", async () => {
    const report = await applyPersonMentions(archiveWith([person()]), [mention({ personId: "ukjent" })], root);
    expect(report).toMatchObject({ added: 0, people: 0 });
  });
});

describe("omtaler som ikke kan stemme", () => {
  /**
   * Arne Hansen spilte i 1986. Medlemsbladene fra 1961 til 1976 omtaler en
   * annen Arne Hansen — navnetreff skiller ikke to som heter det samme, og uten
   * denne prøven ble alle seksten ført på ham. En tredjedel av koblingene i
   * første forsøk var slike.
   */
  it("fører ikke en publikasjon som er eldre enn personen selv", async () => {
    const spiller = person({ squadNumbers: [{ season: 1986, number: 9 }] });
    const report = await applyPersonMentions(archiveWith([spiller]), [
      { personId: "ola-nordmann", sourceId: "et-blad-fra-1961", page: "4", sourceYear: 1961 },
    ], root);
    expect(report).toMatchObject({ added: 0, anachronistic: 1 });
  });

  it("lar en jubileumsbok omtale spillere fra før den ble skrevet", async () => {
    // Prøven er ensidig med vilje: en bok fra 2013 skriver selvsagt om
    // 1920-tallet. Det motsatte er umulig.
    const gammel = person({ roles: [{
      id: "spiller-1925", category: "player", title: "Spiller", from: "1925", to: null,
      sources: [{ sourceId: "en-annen", fields: [] }],
    }] });
    const report = await applyPersonMentions(archiveWith([gammel]), [
      { personId: "ola-nordmann", sourceId: "jubileumsbok-2013", page: "312", sourceYear: 2013 },
    ], root);
    expect(report).toMatchObject({ added: 1, anachronistic: 0 });
  });

  it("gir litt slark for den som er omtalt før debuten", async () => {
    const spiller = person({ squadNumbers: [{ season: 1986, number: 9 }] });
    const report = await applyPersonMentions(archiveWith([spiller]), [
      { personId: "ola-nordmann", sourceId: "et-blad-fra-1983", page: "4", sourceYear: 1983 },
    ], root);
    expect(report.added).toBe(1);
  });

  it("fører omtalen når arkivet ikke vet når personen var aktiv", async () => {
    const report = await applyPersonMentions(archiveWith([person()]), [
      { personId: "ola-nordmann", sourceId: "et-blad", page: "4", sourceYear: 1950 },
    ], root);
    expect(report.added).toBe(1);
  });
});

describe("roller som ville motsagt arkivet", () => {
  it("gir ikke to personer samme klubbverv samme år", async () => {
    // To formenn i 1948 kan ikke begge stemme, og maskinen kan ikke avgjøre
    // hvem. Da skal ingen av dem skrives.
    const sittende = person({
      id: "kari-nordmann", name: "Kari Nordmann",
      roles: [{ id: "formann-1948", category: "board", title: "Formann", from: "1948", to: null,
        sources: [{ sourceId: "en-annen", fields: [] }] }],
    });
    const report = await applyResolvedRoles(archiveWith([person(), sittende]), [
      finding({ from: "1948" }),
    ], root);
    expect(report).toMatchObject({ added: 0, conflicting: 1 });
  });

  it("regner styreleder og formann som samme verv", async () => {
    const sittende = person({
      roles: [{ id: "formann-1998", category: "board", title: "Formann", from: "1998", to: null,
        sources: [{ sourceId: "en-annen", fields: [] }] }],
    });
    const report = await applyResolvedRoles(archiveWith([sittende]), [
      finding({ title: "Styreleder", from: "1998" }),
    ], root);
    expect(report).toMatchObject({ added: 0, corroborated: 1 });
  });

  it("legger ikke et mindre presist verv oppå et mer presist samme år", async () => {
    // «Formann» ved siden av «Formann i banekomiteen» er nesten alltid den
    // samme opplysningen, lest uten leddet som forklarer den.
    const sittende = person({
      roles: [{ id: "bane-1951", category: "project", title: "Formann i banekomiteen", from: "1951", to: null,
        sources: [{ sourceId: "en-annen", fields: [] }] }],
    });
    const report = await applyResolvedRoles(archiveWith([sittende]), [finding({ from: "1951" })], root);
    expect(report).toMatchObject({ added: 0, conflicting: 1 });
  });

  it("lar to personer ha samme verv samme år i hvert sitt organ", async () => {
    const sittende = person({
      id: "kari-nordmann", name: "Kari Nordmann",
      roles: [{ id: "formann-1948", category: "board", title: "Formann", from: "1948", to: null,
        sources: [{ sourceId: "en-annen", fields: [] }] }],
    });
    const report = await applyResolvedRoles(archiveWith([person(), sittende]), [
      finding({ from: "1948", body: "Juniorgruppa" }),
    ], root);
    expect(report.added).toBe(1);
  });
});
