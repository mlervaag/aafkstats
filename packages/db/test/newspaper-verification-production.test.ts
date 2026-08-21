import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crossValidate, loadArchive } from "@aafkstats/schema/load";
import type { Archive } from "@aafkstats/schema/load";
import { all, open } from "../src/index.js";
import { loadValidateAndBuild } from "../src/build.js";

const dataRoot = resolve(import.meta.dirname, "../../../data");
let archive: Archive;
let databaseDir: string;
let databasePath: string;

beforeAll(async () => {
  archive = await loadArchive(dataRoot);
  databaseDir = mkdtempSync(join(tmpdir(), "aafk-newspaper-production-"));
  databasePath = join(databaseDir, "archive.sqlite");
  await loadValidateAndBuild(dataRoot, databasePath);
}, 60_000);

afterAll(() => rmSync(databaseDir, { recursive: true, force: true }));

describe("produksjonskøen for avisverifisering", () => {
  it("laster manifestet sammen med manuelle saker uten duplikater", () => {
    expect([...archive.issues, ...crossValidate(archive)]).toEqual([]);
    const newspaperCases = archive.verificationCases.filter((item) => item.newspaper);
    expect(newspaperCases).toHaveLength(247);
    expect(newspaperCases.filter((item) => item.status === "open")).toHaveLength(50);
    expect(newspaperCases.filter((item) => item.status === "draft")).toHaveLength(197);
    expect(new Set(archive.verificationCases.map((item) => item.id)).size).toBe(archive.verificationCases.length);
    expect(new Set(archive.verificationCases.map((item) => `${item.target.type}|${item.target.id}|${item.target.field}`)).size)
      .toBe(archive.verificationCases.length);
    expect(newspaperCases.every((item) => item.revision.match(/^sha256:[a-f0-9]{64}$/))).toBe(true);
    expect(archive.verificationCases.filter((item) => !item.newspaper)).toHaveLength(25);
  });

  it("bygger alle genererte saker, men gjør bare åpne saker offentlige", () => {
    const db = open(databasePath);
    try {
      const newspaperRows = all<{ status: string }>(db, "SELECT status FROM verification_cases WHERE newspaper IS NOT NULL");
      const publicRows = all<{ status: string }>(db, "SELECT status FROM verification_cases WHERE newspaper IS NOT NULL AND status = 'open'");
      expect(newspaperRows).toHaveLength(247);
      expect(publicRows).toHaveLength(50);
      expect(newspaperRows.filter((item) => item.status === "draft")).toHaveLength(197);
    } finally {
      db.close();
    }
  });
});
