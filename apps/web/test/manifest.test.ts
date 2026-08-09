import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../app/manifest.js";

describe("web app manifest", () => {
  it("har stabil identitet og oppstartsadresse", () => {
    expect(manifest()).toMatchObject({
      id: "/",
      name: "AaFK-arkivet",
      short_name: "AaFK-arkivet",
      start_url: "/",
      scope: "/",
      display: "standalone",
    });
  });

  it("refererer bare til ikoner som finnes", () => {
    for (const icon of manifest().icons ?? []) {
      expect(icon.src.startsWith("/icons/")).toBe(true);
      const path = resolve(process.cwd(), "apps", "web", "public", icon.src.slice(1));
      expect(existsSync(path), path).toBe(true);
    }
  });

  it("har et eget maskable ikon", () => {
    expect(manifest().icons).toContainEqual(expect.objectContaining({ purpose: "maskable" }));
  });
});
