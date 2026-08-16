import { beforeAll, describe, expect, it } from "vitest";
import { historicalObservation } from "../src/historical-observation.js";
import { crossValidate, loadArchive, type Archive } from "../src/load.js";

const valid = {
  id: "testobservasjon",
  title: "Et historisk funn",
  text: "En kort kildebasert parafrase.",
  seasonYears: [1919],
  sources: [{ sourceId: "nff-arbok-1919", page: "67-69" }],
};

let archive: Archive;
beforeAll(async () => { archive = await loadArchive(); }, 30000);

describe("HistoricalObservation", () => {
  it("krever minst én kilde", () => {
    expect(historicalObservation.safeParse({ ...valid, sources: [] }).success).toBe(false);
  });

  it("godtar en observasjon uten person så lenge den har en sesong", () => {
    expect(historicalObservation.safeParse(valid).success).toBe(true);
  });

  it.each(["personIds", "matchIds", "venueIds"] as const)("godtar %s alene som visningsrelasjon", (field) => {
    const { seasonYears: _unused, ...rest } = valid;
    expect(historicalObservation.safeParse({ ...rest, [field]: ["noe"] }).success).toBe(true);
  });

  it("avviser en observasjon uten noen relasjon som gir den en side", () => {
    // Uten dette kravet ville observasjonen ligget i basen, validert grønt og
    // aldri blitt vist noe sted — heller ikke i søket, som filtrerer bort
    // rader uten url.
    const { seasonYears: _unused, ...rest } = valid;
    expect(historicalObservation.safeParse(rest).success).toBe(false);
  });

  it("avviser en observasjon som bare peker på en konkurranse", () => {
    // Arkivet har ingen konkurranseside. competitionIds er derfor en relasjon
    // for spørringer, ikke et sted å bli vist.
    const { seasonYears: _unused, ...rest } = valid;
    expect(historicalObservation.safeParse({ ...rest, competitionIds: ["cupen"] }).success).toBe(false);
  });

  it.each([
    ["personIds", ["ukjent-person"], "ukjent person"],
    ["matchIds", ["ukjent-kamp"], "ukjent kamp"],
    ["competitionIds", ["ukjent-konkurranse"], "ukjent konkurranse"],
    ["venueIds", ["ukjent-bane"], "ukjent bane"],
  ] as const)("avviser ukjent relasjon i %s", (field, value, message) => {
    const copy = structuredClone(archive);
    copy.historicalObservations.push({
      ...historicalObservation.parse({ ...valid, id: `test-${field.toLowerCase()}`, [field]: value }),
      file: `observations/test-${field.toLowerCase()}.yaml`,
    });
    expect(crossValidate(copy).some((issue) => issue.message.includes(message))).toBe(true);
  });

  it("avviser ukjent sourceRef", () => {
    const copy = structuredClone(archive);
    copy.historicalObservations.push({
      ...historicalObservation.parse({ ...valid, id: "ukjent-kilde", sources: [{ sourceId: "finnes-ikke" }] }),
      file: "observations/ukjent-kilde.yaml",
    });
    expect(crossValidate(copy).some((issue) => issue.message.includes("ukjent historisk kilde"))).toBe(true);
  });

  it("avviser duplikat-ID", () => {
    const copy = structuredClone(archive);
    copy.historicalObservations.push({ ...copy.historicalObservations[0]!, file: "observations/duplikat.yaml" });
    expect(crossValidate(copy).some((issue) => issue.message.includes("duplikat ID"))).toBe(true);
  });
});
