import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import SeasonImage, { alt, contentType, size } from "../app/sesong/[year]/opengraph-image.js";
import TwitterImage, {
  alt as twitterAlt,
  contentType as twitterContentType,
  size as twitterSize,
} from "../app/sesong/[year]/twitter-image.js";

const previousDbPath = process.env.AAFK_DB_PATH;

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-season-og-test-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 30_000);

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("Sesong OpenGraph- og Twitter-bilder", () => {
  it("har riktige metadata-konstanter for bildestørrelse og type", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(alt).toBe("Sesong i AaFK-arkivet");

    expect(twitterSize).toEqual(size);
    expect(twitterContentType).toBe(contentType);
    expect(twitterAlt).toBe(alt);
  });

  it("genererer et gyldig ImageResponse for en kjent sesong", async () => {
    const response = await SeasonImage({
      params: Promise.resolve({ year: "1998" }),
    });

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
  });

  it("genererer et gyldig ImageResponse for en historisk sesong med kilderesultater", async () => {
    const response = await SeasonImage({
      params: Promise.resolve({ year: "1914" }),
    });

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
  });

  it("genererer et fallback-bilde ved ugyldig eller ukjent år", async () => {
    const response = await SeasonImage({
      params: Promise.resolve({ year: "1800" }),
    });

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
  });

  it("Twitter-bilde peker til samme implementasjon som OpenGraph-bilde", () => {
    expect(TwitterImage).toBe(SeasonImage);
  });
});
