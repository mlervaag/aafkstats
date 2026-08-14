import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import MatchImage, { alt, contentType, size } from "../app/kamp/[id]/opengraph-image.js";
import TwitterImage, {
  alt as twitterAlt,
  contentType as twitterContentType,
  size as twitterSize,
} from "../app/kamp/[id]/twitter-image.js";

const previousDbPath = process.env.AAFK_DB_PATH;

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-match-og-test-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
}, 30_000);

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

describe("Kamp OpenGraph- og Twitter-bilder", () => {
  it("har riktige metadata-konstanter for bildestørrelse og type", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(alt).toBe("Kamp i AaFK-arkivet");

    expect(twitterSize).toEqual(size);
    expect(twitterContentType).toBe(contentType);
    expect(twitterAlt).toBe(alt);
  });

  it("genererer et gyldig ImageResponse for en spilt hjemmekamp", async () => {
    const response = await MatchImage({
      params: Promise.resolve({ id: "1998-08-16-aalesunds-fk-sk-brann" }),
    });

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
  });

  it("genererer et gyldig ImageResponse for en bortekamp", async () => {
    const response = await MatchImage({
      params: Promise.resolve({ id: "2024-11-24-sk-brann-aalesunds-fk" }),
    });

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
  });

  it("genererer et fallback-bilde ved ugyldig eller ukjent kamp-ID", async () => {
    const response = await MatchImage({
      params: Promise.resolve({ id: "ugyldig-kamp-id-9999" }),
    });

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
  });

  it("Twitter-bilde peker til samme implementasjon som OpenGraph-bilde", () => {
    expect(TwitterImage).toBe(MatchImage);
  });
});
