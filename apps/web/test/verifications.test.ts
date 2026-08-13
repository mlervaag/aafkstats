import { describe, expect, it } from "vitest";
import { checkedOutCaseIds, claimVerificationCase, releaseVerificationCase } from "../lib/verification-checkout.js";
import { loadVerificationCase, loadVerificationCases } from "../lib/verifications.js";

describe("verifiseringskøen", () => {
  it("publiserer pilotkøen i prioritert rekkefølge", () => {
    const cases = loadVerificationCases("open");
    expect(cases).toHaveLength(25);
    expect(cases[0]?.id).toBe("bryne-aafk-resultat-1996-09-08");
    expect(cases.every((item, index) => index === 0 || cases[index - 1]!.priority >= item.priority)).toBe(true);
  });

  it("hydraterer kilder og stabile revisjoner", () => {
    const item = loadVerificationCase("anders-mogstad-formann-1921");
    expect(item?.revision).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(item?.sources[0]).toMatchObject({ title: expect.any(String), page: "81" });
    expect(item?.target.href).toBe("/personer/anders-mogstad");
  });
});

describe("myk reservasjon", () => {
  it("fornyes av samme besøkende og avviser en annen", () => {
    const caseId = "test-reservasjon";
    const first = "c7347db5-ff53-4eb7-bf86-fd267aa49c84";
    const second = "a92dcddf-5098-4663-84ca-19fa77a412e1";
    expect(claimVerificationCase(caseId, first).acquired).toBe(true);
    expect(claimVerificationCase(caseId, first).acquired).toBe(true);
    expect(claimVerificationCase(caseId, second).acquired).toBe(false);
    expect(checkedOutCaseIds(second)).toContain(caseId);
    expect(releaseVerificationCase(caseId, second)).toBe(false);
    expect(releaseVerificationCase(caseId, first)).toBe(true);
    expect(checkedOutCaseIds(second)).not.toContain(caseId);
  });
});
