import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { loadSeason } from "../lib/archive.js";
import { getSunnmorspostenArticles } from "../lib/newspaper-articles.js";

const previousDbPath = process.env.AAFK_DB_PATH;
let databaseDir: string;

beforeAll(async () => {
  databaseDir = mkdtempSync(join(tmpdir(), "aafk-newspaper-articles-"));
  const dbPath = join(databaseDir, "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 60_000);

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
  rmSync(databaseDir, { recursive: true, force: true });
});

describe("Sunnmørsposten-artikler i webarkivet", () => {
  it("lister alle kampkoblede artikler med kamp og faksimile", () => {
    const articles = getSunnmorspostenArticles();
    expect(articles).toHaveLength(180);
    expect(new Set(articles.map((article) => article.matchId)).size).toBe(173);
    expect(articles.every((article) => article.publisher === "Sunnmørsposten")).toBe(true);
    expect(articles.every((article) => article.url?.startsWith("https://www.nb.no/"))).toBe(true);
  });

  it("merker kampene i sesonglista med antall artikler", () => {
    const season = loadSeason(1951)!;
    const aksla = season.matches.find((match) => match.matchId === "1951-04-15-aalesunds-fk-aksla");
    const fremad = season.matches.find((match) => match.matchId === "1951-07-13-aalesunds-fk-fremad");
    expect(aksla?.newspaperArticleCount).toBe(1);
    expect(fremad?.newspaperArticleCount).toBe(1);
    expect(season.matches.some((match) => match.newspaperArticleCount === 0)).toBe(true);
  });
});
