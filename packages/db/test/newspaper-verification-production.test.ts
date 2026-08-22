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
    expect(newspaperCases).toHaveLength(246);
    expect(newspaperCases.filter((item) => item.status === "open")).toHaveLength(46);
    expect(newspaperCases.filter((item) => item.status === "draft")).toHaveLength(200);
    expect(new Set(archive.verificationCases.map((item) => item.id)).size).toBe(archive.verificationCases.length);
    expect(new Set(archive.verificationCases.map((item) => `${item.target.type}|${item.target.id}|${item.target.field}`)).size)
      .toBe(archive.verificationCases.length);
    expect(newspaperCases.every((item) => item.revision.match(/^sha256:[a-f0-9]{64}$/))).toBe(true);
    const researchCases = archive.verificationCases.filter((item) => item.researchTask);
    expect(researchCases).toHaveLength(23);
    expect(researchCases.filter((item) => item.status === "open")).toHaveLength(23);
    expect(archive.verificationCases.filter((item) => !item.newspaper && !item.researchTask)).toHaveLength(26);
    const casesById = new Map(archive.verificationCases.map((item) => [item.id, item]));
    expect([
      "nb-avis-1946-23-e5805ff7ec",
      "nb-avis-1947-8-2baa8fe66e",
      "nb-avis-1954-7-71f95989eb",
      "nb-avis-1955-1-7874478aa3",
    ].map((id) => casesById.get(id)?.status)).toEqual(["draft", "draft", "draft", "draft"]);
    expect(casesById.get("nb-research-medlemsblad-for-aalesunds-fotb-1965-a2c9-1954-7-score-conflict")?.status).toBe("open");
  });

  it("bygger alle genererte saker, men gjør bare åpne saker offentlige", () => {
    const db = open(databasePath);
    try {
      const newspaperRows = all<{ status: string }>(db, "SELECT status FROM verification_cases WHERE newspaper IS NOT NULL");
      const publicRows = all<{ status: string }>(db, "SELECT status FROM verification_cases WHERE newspaper IS NOT NULL AND status = 'open'");
      const researchRows = all<{ status: string }>(db, "SELECT status FROM verification_cases WHERE research_task IS NOT NULL");
      expect(newspaperRows).toHaveLength(246);
      expect(publicRows).toHaveLength(46);
      expect(newspaperRows.filter((item) => item.status === "draft")).toHaveLength(200);
      expect(researchRows).toHaveLength(23);
    } finally {
      db.close();
    }
  });
});
