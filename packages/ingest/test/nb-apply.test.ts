import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { beforeEach, describe, expect, it } from "vitest";
import type { Person, ResolvedRole } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import { applyResolvedRoles } from "../src/adapters/nb-apply.js";
import type { RoleFinding } from "../src/adapters/nb-apply.js";

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
