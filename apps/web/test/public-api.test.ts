import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { GET as getMeta } from "../app/api/v1/meta/route.js";
import { GET as getResults } from "../app/api/v1/results/route.js";
import { GET as getMatches } from "../app/api/v1/matches/route.js";
import { GET as getMatch } from "../app/api/v1/matches/[id]/route.js";
import { GET as getCases } from "../app/api/v1/research/cases/route.js";
import { GET as getCase } from "../app/api/v1/research/cases/[id]/route.js";
import { GET as getOpenApi } from "../app/api/v1/openapi.json/route.js";

const previousDbPath = process.env.AAFK_DB_PATH;
let fixtureDir: string;

beforeAll(async () => {
  fixtureDir = mkdtempSync(join(tmpdir(), "aafk-public-api-"));
  const dbPath = join(fixtureDir, "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe("offentlig REST API v1", () => {
  it("publiserer versjoner, rettigheter, CORS og cache", async () => {
    const response = getMeta(new Request("https://aafkarkivet.no/api/v1/meta", { headers: { "x-real-ip": "meta-test" } }));
    const body = await response.json();
    expect(body.meta).toMatchObject({ apiVersion: "1", datasetVersion: "4" });
    expect(body.data.coverage.canonicalMatches).toBe(11);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toContain("s-maxage");
  });

  it("bevarer evidensskillet og lager kanoniske lenker", async () => {
    const response = await getResults(new Request("https://aafkarkivet.no/api/v1/results?season=1955&limit=10"));
    const body = await response.json();
    expect(body.data.some((row: { evidenceLevel: string }) => row.evidenceLevel === "source_claim")).toBe(true);
    expect(body.data.every((row: { canonicalUrl: string }) => row.canonicalUrl.startsWith("https://aafkarkivet.no/"))).toBe(true);
    expect(body.data[0].missingFields).toBeInstanceOf(Array);
    expect(body.data[0].sources).toBeInstanceOf(Array);
  });

  it("avviser ugyldig limit og skiller 404 fra tom liste", async () => {
    expect((await getMatches(new Request("https://aafkarkivet.no/api/v1/matches?limit=101"))).status).toBe(400);
    const notFound = await getMatch(new Request("https://aafkarkivet.no/api/v1/matches/ukjent"), { params: Promise.resolve({ id: "ukjent" }) });
    expect(notFound.status).toBe(404);
    expect(notFound.headers.get("cache-control")).toBe("no-store");
    expect(notFound.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("lekker aldri draft, paused eller resolved research cases", async () => {
    const response = getCases(new Request("https://aafkarkivet.no/api/v1/research/cases?limit=100"));
    const body = await response.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((item: { status: string; publishedAt: string | null }) => item.status === "open" && item.publishedAt !== null)).toBe(true);
    for (const id of ["fixture-draft", "fixture-paused", "fixture-resolved"]) {
      const single = getCase(new Request(`https://aafkarkivet.no/api/v1/research/cases/${id}`), { params: Promise.resolve({ id }) });
      expect((await single).status).toBe(404);
    }
  });

  it("publiserer en OpenAPI-kontrakt uten skrive- eller SQL-ruter", async () => {
    const document = await getOpenApi(new Request("https://aafkarkivet.no/api/v1/openapi.json")).json();
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/results"]).toBeDefined();
    expect(JSON.stringify(document)).not.toContain("run_sql");
    expect(Object.values(document.paths).every((path) => !(path as { post?: unknown }).post)).toBe(true);
  });
});
