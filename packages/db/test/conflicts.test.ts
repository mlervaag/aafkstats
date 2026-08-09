import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "../src/build.js";
import { all, open } from "../src/index.js";

interface ConflictRow {
  match_id: string;
  field: string;
  provider_id: string;
  value: string | number | null;
  is_chosen: number;
  decision: string;
  decided_at: string | null;
  reason: string | null;
  locked: number;
}

/**
 * Den offentlige modellen hadde bare `has_conflicts`, et null eller ett.
 *
 * Det er nok til å si «kildene er uenige» og ingenting mer, så både leseren og
 * spørrefunksjonen måtte enten tie eller dikte. Fixturen har nå to konflikter:
 * én åpen og én avgjort, slik at begge tilstandene er dekket.
 */
describe("match_conflicts", () => {
  let rows: ConflictRow[];

  beforeAll(async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-conflicts-")), "arkiv.sqlite");
    await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
    const db = open(dbPath);
    rows = all<ConflictRow>(
      db,
      `SELECT match_id, field, provider_id, value, is_chosen, decision, decided_at, reason, locked
       FROM match_conflicts ORDER BY match_id, field, provider_id`,
    );
    db.close();
  }, 30_000);

  it("gir én rad per verdi, ikke én per konflikt", () => {
    const open_ = rows.filter((row) => row.field === "away.score");
    expect(open_).toHaveLength(2);
    expect(new Set(open_.map((row) => row.value))).toEqual(new Set([1, 2]));
    expect(new Set(open_.map((row) => row.provider_id))).toEqual(
      new Set(["nasjonalbiblioteket", "rsssf"]),
    );
  });

  it("velger ingen verdi når ingen har tatt stilling", () => {
    // Dette er den ærlige tilstanden, og den skal være synlig som en tilstand,
    // ikke som et hull. Ingenting velger etter kildeprioritet av seg selv.
    const open_ = rows.filter((row) => row.field === "away.score");
    expect(open_.every((row) => row.is_chosen === 0)).toBe(true);
    expect(open_.every((row) => row.decision === "unresolved")).toBe(true);
    expect(open_.every((row) => row.reason === null)).toBe(true);
  });

  it("merker verdien arkivet bruker når konflikten er avgjort", () => {
    const resolved = rows.filter((row) => row.field === "attendance");
    expect(resolved).toHaveLength(2);
    const chosen = resolved.filter((row) => row.is_chosen === 1);
    expect(chosen).toHaveLength(1);
    expect(chosen[0]).toMatchObject({ value: 4210, provider_id: "nasjonalbiblioteket" });
  });

  it("krever begrunnelse, dato og beslutningstype på en avgjort konflikt", () => {
    // En «løst» konflikt uten begrunnelse er skjult, ikke løst. Skjemaet avviser
    // den; testen her holder på at feltene faktisk kommer helt ut i viewet.
    const resolved = rows.find((row) => row.field === "attendance" && row.is_chosen === 1)!;
    expect(resolved.decision).toBe("independent_source");
    expect(resolved.decided_at).toBe("2026-08-03");
    expect(resolved.reason).toContain("Avisreferatet");
    expect(resolved.locked).toBe(1);
  });

  it("knytter hver rad til kampen den gjelder", () => {
    expect(rows.every((row) => row.match_id.startsWith("1998-"))).toBe(true);
  });
});
