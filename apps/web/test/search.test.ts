import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { parseSearchQuery, searchMatches } from "../lib/search.js";

const previousDbPath = process.env.AAFK_DB_PATH;

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-search-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("parseSearchQuery", () => {
  it("skiller år og motstander", () => {
    expect(parseSearchQuery("2013 Tromsø")).toEqual({ years: [2013], terms: ["tromsø"] });
  });

  it("beholder vanlige tall som søkeord", () => {
    expect(parseSearchQuery("tapte 6 mål")).toEqual({ years: [], terms: ["tapte", "6", "mål"] });
  });

  it("dedupliserer år", () => {
    expect(parseSearchQuery("2025 2025 Sogndal")).toEqual({ years: [2025], terms: ["sogndal"] });
  });

  it("finner alle kamper i et år uten AI", () => {
    expect(searchMatches("2024")).toHaveLength(6);
  });

  it("kombinerer år og motstander", () => {
    const matches = searchMatches("2024 Molde");
    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.date.startsWith("2024") && match.opponent === "Molde FK")).toBe(true);
  });
});
