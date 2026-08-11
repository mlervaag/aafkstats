import { describe, expect, it } from "vitest";
import { getPeople, getPersonById, getPersonRoles } from "../lib/people.js";
import { getSourceRoleUsages, getSourceSeasonUsages, getSourceUsages } from "../lib/sources.js";

describe("person- og organisasjonsarkivet", () => {
  it("samler kampfolk og historiske ledere i samme register", () => {
    const people = getPeople();
    expect(people.some((person) => person.appearances > 0)).toBe(true);
    expect(people.some((person) => person.role_categories.includes("board"))).toBe(true);
  });

  it("viser at Georg Haller var både formann og æresmedlem", () => {
    const person = getPersonById("georg-haller");
    const roles = getPersonRoles("georg-haller");
    expect(person?.role_count).toBe(2);
    expect(roles.map((role) => role.title)).toEqual(["Formann", "Æresmedlem"]);
    expect(roles.every((role) => role.sources.length > 0)).toBe(true);
  });

  it("fører pilotkilden tilbake til roller, sesonger og kamper", () => {
    const id = "aalesunds-fotballklub-gjennem-1939-ec28";
    expect(getSourceRoleUsages(id).length).toBeGreaterThan(0);
    expect(getSourceSeasonUsages(id).length).toBeGreaterThan(0);
    expect(getSourceUsages(id).length).toBeGreaterThan(0);
  });
});
