import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTRIBUTION_TEMPLATES,
  contributionIssueUrl,
} from "../lib/contribution-links.js";

describe("contributionIssueUrl", () => {
  it("åpner den valgte issue-malen", () => {
    expect(contributionIssueUrl("datafeil"))
      .toBe("https://github.com/mlervaag/aafkstats/issues/new?template=datafeil.yml");
  });

  it("tar med sidekontekst i tittelen", () => {
    const url = new URL(contributionIssueUrl("ny-kilde", "AaFK mot Brann 1. april 2024"));
    expect(url.searchParams.get("template")).toBe("ny-kilde.yml");
    expect(url.searchParams.get("title")).toBe("Kilde: AaFK mot Brann 1. april 2024");
  });

  it("peker bare på issue-maler som finnes", () => {
    for (const template of CONTRIBUTION_TEMPLATES) {
      const path = resolve(process.cwd(), ".github", "ISSUE_TEMPLATE", `${template}.yml`);
      expect(existsSync(path), path).toBe(true);
    }
  });
});
