import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    // Testen bytter ut hele kildens resultatliste. Community-sakene i fixturen
    // spør om rader som da forsvinner, og integritetskontrollen ville med rette
    // stoppe bygget — de hører ikke til det denne testen kontrollerer.
    for (const caseFile of ["nb-avis-1946-15-4ee1a1e2f3.yaml", "fixture-nb-research-sibling.yaml"]) {
      rmSync(join(data, "verification-cases", caseFile), { force: true });
    }

    writeFileSync(
      join(data, "source-results", "aafk-90-ar-1914-2004.yaml"),
      [
        "sourceId: aafk-90-ar-1914-2004",
        "scorePerspective: aafk",
        "seasons:",
        "  - year: 1998",
        "    page: 42",
        "    results:",
        "      - claimId: srcclaim-00000000000000000000000019980001",
        "        no: 1",
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

  it("lagrer og eksponerer strukturert dato samt NULL for udaterte resultater", async () => {
    const root = mkdtempSync(join(tmpdir(), "aafk-source-results-date-"));
    const data = join(root, "data");
    cpSync(resolve(import.meta.dirname, "../../../fixtures/data"), data, { recursive: true });
    // Testen bytter ut hele kildens resultatliste. Community-sakene i fixturen
    // spør om rader som da forsvinner, og integritetskontrollen ville med rette
    // stoppe bygget — de hører ikke til det denne testen kontrollerer.
    for (const caseFile of ["nb-avis-1946-15-4ee1a1e2f3.yaml", "fixture-nb-research-sibling.yaml"]) {
      rmSync(join(data, "verification-cases", caseFile), { force: true });
    }

    writeFileSync(
      join(data, "source-results", "aafk-90-ar-1914-2004.yaml"),
      [
        "sourceId: aafk-90-ar-1914-2004",
        "scorePerspective: aafk",
        "seasons:",
        "  - year: 1998",
        "    page: 42",
        "    results:",
        "      - claimId: srcclaim-00000000000000000000000019980001",
        "        no: 1",
        "        date: 1998-04-15",
        "        opponent: Raufoss",
        "        opponentClubId: raufoss-il",
        "        score: [2, 2]",
        "        competitionId: treningskamp",
        "        matchId: 1998-01-01-aalesunds-fk-raufoss-il",
        "      - claimId: srcclaim-00000000000000000000000019980002",
        "        no: 2",
        "        opponent: Rollon",
        "        opponentClubId: null",
        "        score: [1, 0]",
        "        competitionId: null",
        "        matchId: null",
        "",
      ].join("\n"),
    );

    const dbPath = join(root, "arkiv.sqlite");
    await loadValidateAndBuild(data, dbPath);
    const db = open(dbPath);
    const rows = all<{ id: string; date: string | null }>(
      db,
      "SELECT id, date FROM source_results WHERE source_id = 'aafk-90-ar-1914-2004' ORDER BY source_order",
    );
    db.close();

    expect(rows).toEqual([
      { id: "1998-001", date: "1998-04-15" },
      { id: "1998-002", date: null },
    ]);
  }, 30_000);
});
