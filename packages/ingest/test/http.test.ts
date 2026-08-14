import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { repoRoot } from "@aafkstats/schema/load";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBytes } from "../src/http.js";

const URL = "https://binary-cache-test.invalid/report.pdf";
const key = createHash("sha256").update(URL).digest("hex").slice(0, 32);
const cacheFile = resolve(repoRoot(), ".cache/ingest", `${key}.bin`);

describe("binær HTTP-cache", () => {
  beforeEach(async () => {
    await unlink(cacheFile).catch(() => undefined);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await unlink(cacheFile).catch(() => undefined);
  });

  it("skriver .bin atomisk og gjør ingen ny forespørsel ved cachetreff", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 test");
    const mockedFetch = vi.fn(async () => new Response(bytes, { status: 200 }));
    vi.stubGlobal("fetch", mockedFetch);

    expect(await fetchBytes(URL, { refresh: true })).toEqual(bytes);
    expect(await fetchBytes(URL)).toEqual(bytes);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
