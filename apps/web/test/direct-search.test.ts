import { describe, expect, it } from "vitest";
import { firstDirectResult, type DirectSearchData } from "../components/DirectSearch.js";

function results(overrides: Partial<DirectSearchData>): DirectSearchData {
  return { people: [], sources: [], matches: [], observations: [], ...overrides };
}

describe("første direktetreff", () => {
  it("beholder den synlige prioriteringen person, kilde, kamp", () => {
    expect(firstDirectResult(results({
      people: [{ url: "/personer/test" }],
      sources: [{ url: "/kilder/test" }],
      matches: [{ url: "/kamp/test" }],
    } as unknown as Partial<DirectSearchData>))).toEqual({
      kind: "person",
      url: "/personer/test",
      position: 1,
    });

    expect(firstDirectResult(results({
      sources: [{ url: "/kilder/test" }],
      matches: [{ url: "/kamp/test" }],
    } as unknown as Partial<DirectSearchData>))).toEqual({
      kind: "source",
      url: "/kilder/test",
      position: 1,
    });
  });

  it("returnerer null uten treff", () => {
    expect(firstDirectResult(results({}))).toBeNull();
  });
});
