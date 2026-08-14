import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "../src/build.js";
import { all, open } from "../src/index.js";

describe("kilderesultat koblet til kanonisk kamp", () => {
  it("skrives etter kampen som fremmednøkkelen peker på", async () => {
    const root = mkdtempSync(join(tmpdir(), "aafk-source-results-"));
    const data = join(root, "data");
    cpSync(resolve(import.meta.dirname, "../../../fixtures/data"), data, { recursive: true });

    writeFileSync(
      join(data, "source-results", "aafk-90-ar-1914-2004.yaml"),
      [
        "sourceId: aafk-90-ar-1914-2004",
        "scorePerspective: aafk",
        "seasons:",
        "  - year: 1998",
        "    page: 42",
        "    results:",
        "      - no: 1",
        "        opponent: Raufoss",
        "        opponentClubId: raufoss-il",
        "        score: [2, 2]",
        "        competitionId: treningskamp",
        "        matchId: 1998-01-01-aalesunds-fk-raufoss-il",
        "",
      ].join("\n"),
    );

    const dbPath = join(root, "arkiv.sqlite");
    await loadValidateAndBuild(data, dbPath);
    const db = open(dbPath);
    const rows = all<{ match_id: string | null }>(
      db,
      "SELECT match_id FROM source_results WHERE source_id = 'aafk-90-ar-1914-2004'",
    );
    db.close();

    expect(rows).toEqual([{ match_id: "1998-01-01-aalesunds-fk-raufoss-il" }]);
  }, 30_000);
});
