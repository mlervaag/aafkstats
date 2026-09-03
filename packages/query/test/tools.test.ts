import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { toolsByName, tools } from "../src/tools.js";
import type { ToolContext } from "../src/tools.js";

describe("verktøydefinisjoner", () => {
  it("har unike navn", () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("har beskrivelse på hvert verktøy", () => {
    // Beskrivelsen er det modellen bruker til å velge verktøy. Et verktøy uten
    // beskrivelse blir enten oversett eller brukt feil.
    for (const t of tools) expect(t.description.length).toBeGreaterThan(20);
  });
});

describe("verktøy mot ekte arkivfil", () => {
  // Bygger fixture-arkivet til en midlertidig fil. Ingen tjeneste å sette opp, så
  // testene kjører likt lokalt og i CI.
  let ctx: ToolContext;
  const queries: string[] = [];

  beforeAll(async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-tools-")), "arkiv.sqlite");
    await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
    ctx = { dbPath, onQuery: (i) => queries.push(i.sql) };
  }, 30_000);

  const call = async (name: string, input: unknown) => {
    const tool = toolsByName.get(name)!;
    return tool.run(tool.inputSchema.parse(input), ctx);
  };

  it("search_matches finner hjemmetapet med seks måls margin", async () => {
    const r = await call("search_matches", {
      isHome: true,
      result: "T",
      maxGoalDifference: -6,
      limit: 5,
    });
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.date).toBe("2005-09-18");
    expect(rows[0]!.url).toBe("/kamp/2005-09-18-aalesunds-fk-rosenborg-bk");
  });

  it("head_to_head slår opp på delvis navn", async () => {
    const r = await call("head_to_head", { opponent: "brann" });
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows[0]!.opponent).toBe("SK Brann");
    expect(rows[0]).toHaveProperty("unlinked_results");
    expect((r.content as { evidencePolicy: Record<string, unknown> }).evidencePolicy).toMatchObject({
      contract: "archive-head-to-head-evidence@1",
    });
  });

  it("get_match henter kamp, hendelser og referat", async () => {
    const r = await call("get_match", { matchId: "2024-04-01-aalesunds-fk-raufoss-il" });
    const c = r.content as Record<string, { rows: unknown[] }>;
    expect(c.match!.rows).toHaveLength(1);
    expect(c.events!.rows.length).toBeGreaterThan(0);
    expect(c.report!.rows).toHaveLength(1);
    expect(c.match!.rows[0]).toMatchObject({
      has_stats: 1,
      aafk_xg: 1.8,
      opponent_xg: 0.9,
      aafk_shots_on_target: 6,
    });
  });

  it("search_matches filtrerer på xG og statistikkdekning", async () => {
    const r = await call("search_matches", { hasStats: true, minXg: 1.5, maxXg: 2, limit: 10 });
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      match_id: "2024-04-01-aalesunds-fk-raufoss-il",
      has_stats: 1,
      aafk_xg: 1.8,
    });
  });

  it("snur statistikken til AaFK-perspektiv i en bortekamp", async () => {
    const r = await call("get_match", { matchId: "2024-04-07-molde-fk-aalesunds-fk" });
    const c = r.content as Record<string, { rows: Record<string, unknown>[] }>;
    expect(c.match!.rows[0]).toMatchObject({
      is_home: 0,
      aafk_xg: 0.7,
      opponent_xg: 2.1,
      aafk_shots: 7,
      opponent_shots: 16,
    });
  });

  it("search_reports finner tekst i referat", async () => {
    const r = await call("search_reports", { q: "snuoperasjon" });
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.snippet).toEqual(expect.any(String));
    expect(["summary", "body"]).toContain(rows[0]!.matched_field);
  });

  it("run_sql kjører en aggregering", async () => {
    const r = await call("run_sql", {
      sql: "SELECT count(*) AS n FROM matches WHERE status = 'played'",
    });
    expect(r.isError).toBeFalsy();
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(Number(rows[0]!.n)).toBeGreaterThan(0);
  });

  it("run_sql kan spørre direkte etter xG", async () => {
    const r = await call("run_sql", {
      sql: "SELECT match_id, aafk_xg, opponent_xg FROM matches WHERE aafk_xg IS NOT NULL",
    });
    expect(r.isError).toBeFalsy();
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows[0]).toMatchObject({ aafk_xg: 1.8, opponent_xg: 0.9 });
  });

  // Meldingene skal si hva som er galt, ikke bare at det gikk galt — ellers kan
  // modellen ikke formulere om og prøve igjen.
  it.each([
    ["DROP TABLE core_matches", /begynte med «DROP»/i],
    ["SELECT * FROM core_matches", /core_-tabellene/i],
    ["SELECT 1; SELECT 2", /én setning/i],
    ["PRAGMA table_list", /begynte med «PRAGMA»/i],
  ])("run_sql avviser «%s» med en forklarende melding", async (sql, expected) => {
    const r = await call("run_sql", { sql });
    expect(r.isError).toBe(true);
    expect((r.content as { error: { code: string; message: string } }).error.code).toBe("QUERY_FAILED");
    expect((r.content as { error: { message: string } }).error.message).toMatch(expected);
  });

  it("run_sql gir en brukbar melding når kolonnenavnet ikke finnes", async () => {
    // Den vanligste ekte feilen: modellen gjetter et kolonnenavn. Meldingen må peke
    // tilbake på datasettdokumentasjonen så den kan slå opp i stedet for å gjette igjen.
    const r = await call("run_sql", { sql: "SELECT finnesikke FROM matches" });
    expect(r.isError).toBe(true);
    expect((r.content as { error: { message: string } }).error.message).toMatch(/datasettdokumentasjonen/i);
  });

  it("run_sql returnerer spørringen slik den ble skrevet", async () => {
    // Grensesnittet viser denne under svaret. Med SQLite håndheves radtaket i
    // child-prosessen i stedet for ved å pakke spørringen inn i en ytre SELECT,
    // så det brukeren ser er modellens egen SQL — ikke vår innpakning rundt den.
    // Radtaket testes for seg i safe-sql.integration.test.ts.
    const r = await call("run_sql", { sql: "SELECT 1 AS x" });
    expect((r.content as { executedSql: string }).executedSql).toBe("SELECT 1 AS x");
  });

  it("logger hver spørring som kjøres", async () => {
    const before = queries.length;
    await call("get_season_summary", { season: 2024 });
    expect(queries.length).toBeGreaterThan(before);
  });

  it("search_transfers skiller retning, type og proveniens", async () => {
    const r = await call("search_transfers", { season: 2024 });
    const rows = (r.content as { rows: Record<string, unknown>[] }).rows;
    expect(rows).toHaveLength(2);

    const arrival = rows.find((row) => row.direction === "in")!;
    expect(arrival).toMatchObject({ kind: "transfer", club: "Molde FK", club_id: "molde-fk" });
    // En nettmelding har ingen kildefil. Uten providers ville raden stått helt
    // uten proveniens, og det er nettopp det documented_by skal avsløre.
    expect(arrival.documented_by).toBe("provider");

    const departure = rows.find((row) => row.direction === "out")!;
    expect(departure).toMatchObject({ kind: "loan", documented_by: "source" });
    // Klubben finnes ikke i klubbkatalogen, og det er ikke en mangel.
    expect(departure.club_id).toBeNull();
  });

  it("search_transfers teller hele filteret, ikke bare siden", async () => {
    const r = await call("search_transfers", { limit: 1 });
    const content = r.content as {
      rows: unknown[];
      totals: { matched: number; in: number; out: number; byKind: Record<string, number> };
      evidencePolicy: { contract: string };
    };
    expect(content.rows).toHaveLength(1);
    expect(content.totals).toMatchObject({ matched: 2, in: 1, out: 1 });
    expect(content.totals.byKind).toEqual({ transfer: 1, loan: 1 });
    expect(content.evidencePolicy.contract).toBe("archive-transfer-evidence@1");
  });

  it("search_transfers filtrerer på klubb og type", async () => {
    const byClub = (await call("search_transfers", { club: "molde" })).content as { rows: Record<string, unknown>[] };
    expect(byClub.rows.map((row) => row.direction)).toEqual(["in"]);

    const loans = (await call("search_transfers", { kind: "loan" })).content as { rows: Record<string, unknown>[] };
    expect(loans.rows.every((row) => row.kind === "loan")).toBe(true);
  });

  it("get_squad gir stall, sesongens overganger og trenere", async () => {
    const content = (await call("get_squad", { season: 2024 })).content as {
      players: Record<string, unknown>[];
      transfers: { in: unknown[]; out: unknown[] };
      coverage: { lineups: string };
    };
    expect(content.players.length).toBeGreaterThan(0);
    expect(content.players[0]).toHaveProperty("appearances");
    expect(content.coverage.lineups).toBe("present");
    expect(content.transfers.in).toHaveLength(1);
    expect(content.transfers.out).toHaveLength(1);
  });

  it("get_squad sier at en tom stall er en manglende kilde", async () => {
    // 1998 har kamper, men ingen oppstillinger. Uten dette svaret ville en tom
    // liste blitt lest som at AaFK ikke hadde spillere det året.
    const content = (await call("get_squad", { season: 1998 })).content as {
      players: unknown[];
      coverage: { lineups: string; note: string };
    };
    expect(content.players).toHaveLength(0);
    expect(content.coverage.lineups).toBe("missing");
    expect(content.coverage.note).toContain("manglende kilde");
  });

  it("get_squad svarer med feilkode for en sesong arkivet ikke kjenner", async () => {
    const r = await call("get_squad", { season: 1990 });
    expect(r.isError).toBe(true);
    expect((r.content as { error: { code: string } }).error.code).toBe("SEASON_NOT_FOUND");
  });

  it("get_standings løfter fram AaFKs egen rad", async () => {
    const content = (await call("get_standings", { season: 1998, includeProgression: true })).content as {
      tables: { competition_id: string; aafk: Record<string, unknown> | null; table: unknown[]; progression: unknown[] }[];
    };
    expect(content.tables).toHaveLength(1);
    const table = content.tables[0]!;
    expect(table.competition_id).toBe("forstedivisjon");
    expect(table.aafk).toMatchObject({ club_id: "aalesunds-fk", position: 3 });
    expect(table.table.length).toBeGreaterThan(1);
    expect(table.progression.length).toBeGreaterThan(0);
  });

  it("get_standings holder rundeutviklingen utenfor med mindre den bes om", async () => {
    const content = (await call("get_standings", { season: 1998 })).content as {
      tables: Record<string, unknown>[];
    };
    expect(content.tables[0]).not.toHaveProperty("progression");
  });

  it("get_standings skiller en manglende tabell fra en sesong uten serie", async () => {
    const r = await call("get_standings", { season: 2024 });
    expect(r.isError).toBe(true);
    const error = (r.content as { error: { code: string; suggestions: string[] } }).error;
    expect(error.code).toBe("STANDINGS_NOT_FOUND");
    expect(error.suggestions.join(" ")).toContain("manglende kilde");
  });
});

describe("verktøy mot det historiske kandidatlaget", () => {
  let ctx: ToolContext;

  beforeAll(async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-history-tools-")), "arkiv.sqlite");
    await loadValidateAndBuild(resolve(import.meta.dirname, "../../../data"), dbPath);
    ctx = { dbPath };
  }, 30_000);

  const call = async (name: string, input: unknown) => {
    const tool = toolsByName.get(name)!;
    return tool.run(tool.inputSchema.parse(input), ctx);
  };

  const rows = (result: Awaited<ReturnType<typeof call>>): Record<string, unknown>[] =>
    (result.content as { rows: Record<string, unknown>[] }).rows;

  it("søker i kontrollerte personroller", async () => {
    const result = rows(await call("search_people", { q: "formann", year: 1961 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("person_id");
    expect(result[0]).toHaveProperty("url");
  });

  it("søker i kildedokumenterte resultater uten full kampkobling", async () => {
    const result = rows(await call("search_historical_results", { season: 1915 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({ season: 1915 });
    expect(result[0]).toHaveProperty("source_title");
    expect(result[0]).toHaveProperty("claim_id");
    expect(result[0]).toHaveProperty("date");
    expect(result[0]).toHaveProperty("result_group_id");
  });

  it("finner rekordresultater i både kampmodellen og kildelaget", async () => {
    const response = await call("search_all_results", { ranking: "largest_win", limit: 10 });
    const result = rows(response);

    expect(result[0]).toMatchObject({
      evidence_level: "canonical_match",
      opponent: "Vigra",
      aafk_score: 15,
      opponent_score: 0,
      goal_difference: 15,
    });

    const langevaag1924 = result.filter((row) => row.result_group_id === "1924-langevag-14-0");
    expect(langevaag1924).toHaveLength(1);
    expect(langevaag1924[0]).toMatchObject({
      evidence_level: "source_claim",
      opponent: "Langevåg",
      aafk_score: 14,
      opponent_score: 0,
      result_group_id: "1924-langevag-14-0",
      source_count: 3,
      match_id: null,
      has_conflicts: 0,
    });
    expect(JSON.parse(String(langevaag1924[0]!.missing_fields))).toEqual([
      "canonical_match",
      "home_away",
      "date",
    ]);
    expect(JSON.parse(String(langevaag1924[0]!.sources))).toHaveLength(3);
    expect(JSON.parse(String(langevaag1924[0]!.claims)).map((claim: { opponentAsPrinted: string }) => claim.opponentAsPrinted))
      .toContain("Langevaag fotballkl.");

    const ostersund1931 = result.filter((row) => row.result_group_id === "1931-null-12-1");
    expect(ostersund1931).toHaveLength(1);
    expect(JSON.parse(String(ostersund1931[0]!.claims)).map((claim: { opponentAsPrinted: string }) => claim.opponentAsPrinted))
      .toEqual(expect.arrayContaining(["Kamraterna, Östersund", "Östersund", "Østersundskam., Sverige"]));

    const vigra1964 = result.filter((row) =>
      row.season === 1964 && row.opponent === "Vigra" && row.aafk_score === 15,
    );
    expect(vigra1964).toHaveLength(1);
    expect(vigra1964[0]!.evidence_level).toBe("canonical_match");

    const content = response.content as { evidencePolicy: Record<string, unknown> };
    expect(content.evidencePolicy).toMatchObject({ contract: "archive-result-evidence@2" });
  });

  it("holder kildenotatene fra hverandre og skiller konkurranse-ID fra visningsnavn", async () => {
    const response = await call("search_all_results", { opponent: "Langevåg", ranking: "largest_win", limit: 10 });
    const claim = rows(response).find((row) => row.record_id === "1924-langevag-14-0")!;

    // Notatene kom fra hver sin kilde. Slått sammen med komma ble de tidligere til
    // «Ingen dato er oppgitt.,trykt «AFK—Langevåg 14—0».» — én setning ingen kilde skrev.
    expect(JSON.parse(String(claim.notes))).toEqual([
      "Ingen dato er oppgitt.",
      "Trykt «AFK—Langevåg 14—0».",
    ]);
    expect(String(claim.note)).not.toContain(".,");

    expect(claim.competition_id).toBe("sondmore-kreds-klasse-a");
    expect(claim.competition).toBe("Søndmøre kreds, Klasse A");

    // Enigheten mellom kildene, ikke et sannhetsmål.
    expect(JSON.parse(String(claim.claim_summary))).toMatchObject({
      claimCount: 3, sourceCount: 3, scoreConsistent: true, opponentIdentityConsistent: true,
    });

    // Et kanonisk treff har begge konkurransefeltene på samme form.
    const canonical = rows(response).find((row) => row.evidence_level === "canonical_match")!;
    expect(canonical.competition_id).toBe("nm");
    expect(canonical.competition).toBe("Norgesmesterskapet");
  });

  it("merker en sammensatt motstanderstreng som svakere identitetstreff", async () => {
    const response = await call("head_to_head", { opponent: "Langevåg" });
    const possible = (response.content as { possible_identity_matches: Record<string, unknown>[] }).possible_identity_matches;
    const composite = possible.find((row) => row.opponent_as_printed === "Langevåg—Raufoss")!;

    // «Langevåg—Raufoss» treffer på klubbnavnet, men beskriver neppe ett oppgjør mot
    // Langevåg. Raden filtreres ikke bort — usikkerheten gjøres eksplisitt.
    expect(composite.identity_confidence).toBe("low");
    expect(composite.match_basis).toBe("text");
    expect(String(composite.reason)).toMatch(/sammensatt/i);
    expect(possible.every((row) => row.identity_confidence !== "high")).toBe(true);
  });

  it("summerer sesongen uten å skjule at dekningen er ufullstendig", async () => {
    const response = await call("get_season_summary", { season: 1925 });
    const content = response.content as {
      season: number;
      overall: { played: number; goals_for: number; competitions: number; coverage: string; note: string };
      competitions: Record<string, unknown>[];
    };

    expect(content.season).toBe(1925);
    expect(content.competitions.length).toBeGreaterThan(1);
    // overall skal være nøyaktig summen av radene under, ikke et eget tall.
    expect(content.overall.played).toBe(content.competitions.reduce((sum, row) => sum + Number(row.played), 0));
    expect(content.overall.goals_for).toBe(content.competitions.reduce((sum, row) => sum + Number(row.goals_for), 0));
    expect(content.overall.competitions).toBe(content.competitions.length);
    expect(["complete", "partial"]).toContain(content.overall.coverage);
    expect(content.overall.note.length).toBeGreaterThan(0);
  });

  it("svarer med en maskinlesbar feilkode når noe ikke finnes", async () => {
    const missingMatch = await call("get_match", { matchId: "finnes-ikke-2024" });
    expect(missingMatch.isError).toBe(true);
    expect((missingMatch.content as { error: { code: string; suggestions: string[] } }).error)
      .toMatchObject({ code: "MATCH_NOT_FOUND" });
    expect((missingMatch.content as { error: { suggestions: string[] } }).error.suggestions.length).toBeGreaterThan(0);

    const missingSeason = await call("get_season_summary", { season: 1899 });
    expect((missingSeason.content as { error: { code: string } }).error.code).toBe("SEASON_NOT_FOUND");

    const missingPerson = await call("get_person", { personId: "finnes-ikke" });
    expect((missingPerson.content as { error: { code: string } }).error.code).toBe("PERSON_NOT_FOUND");

    const missingSource = await call("get_source", { sourceId: "finnes-ikke" });
    expect((missingSource.content as { error: { code: string } }).error.code).toBe("SOURCE_NOT_FOUND");
  });

  it("holder kanonisk og ukoblet Molde-statistikk adskilt", async () => {
    const response = await call("head_to_head", { opponent: "Molde", includeEvidence: true });
    const result = rows(response);
    const molde = result.find((row) => row.opponent_club_id === "molde-fk");
    const molde2 = result.find((row) => row.opponent_club_id === "molde-2");

    expect(molde).toBeDefined();
    expect(molde2).toBeDefined();
    expect(Number(molde!.unlinked_results)).toBeGreaterThan(0);
    expect(Number(molde!.unlinked_wins) + Number(molde!.unlinked_draws) + Number(molde!.unlinked_losses))
      .toBe(Number(molde!.unlinked_consistent_results));
    expect(JSON.parse(String(molde!.unlinked_source_references)).length).toBeGreaterThan(0);
    expect(Number(molde!.unlinked_source_count)).toBeGreaterThan(0);
    expect(molde).not.toHaveProperty("combined_played");
    expect(Number(molde2!.played)).toBeLessThan(Number(molde!.played));
  });

  it("holder et mulig Viking-treff fra 1954 utenfor kanonisk statistikk", async () => {
    const response = await call("head_to_head", { opponent: "Viking" });
    const result = rows(response);
    const viking = result.find((row) => row.opponent_club_id === "viking")!;
    const possible = (response.content as { possible_identity_matches: Record<string, unknown>[] }).possible_identity_matches;

    expect(viking.played).toBe(42);
    expect(viking.unlinked_results).toBe(0);
    expect(viking).not.toHaveProperty("unlinked_source_references");
    expect(possible).toEqual(expect.arrayContaining([
      expect.objectContaining({ season: 1954, opponent_as_printed: "Viking, St.vanger", match_basis: "text", identity_confidence: "medium" }),
    ]));
  });

  it("forklarer overlappende personroller med rolle-ID og organisasjon", async () => {
    const result = rows(await call("search_people", { q: "Henrik Hoff", year: 2000, limit: 20 }));
    const dailyManagers = result.filter((row) => row.title === "Daglig leder");
    expect(dailyManagers).toHaveLength(2);
    expect(new Set(dailyManagers.map((row) => row.role_id)).size).toBe(2);
    expect(new Set(dailyManagers.map((row) => row.organization_id))).toEqual(new Set(["aafk", "aafk-as"]));
    expect(dailyManagers.every((row) => row.role_kind === "explicit")).toBe(true);
  });

  it("gir referatsnutt fra body når summary mangler", async () => {
    const result = rows(await call("search_reports", { q: "AaFK", limit: 10 }));
    const langevaag = result.find((row) => row.match_id === "1929-08-04-langevag-aalesunds-fk")!;
    expect(langevaag.summary).toBeNull();
    expect(langevaag.snippet).toContain("AaFK vant 7-0");
    expect(langevaag.matched_field).toBe("body");
  });

  it("henter én person og én kilde gjennom offentlige views", async () => {
    const person = await call("get_person", { personId: "henrik-hoff" });
    expect(person.isError).toBeFalsy();
    expect((person.content as { roles: Record<string, unknown>[] }).roles.some((role) => role.organization_id === "aafk-as")).toBe(true);

    const sources = rows(await call("search_sources", { q: "fotballklub gjennem", limit: 5 }));
    expect(sources.length).toBeGreaterThan(0);
    const source = await call("get_source", { sourceId: String(sources[0]!.source_id), claimLimit: 3 });
    expect(source.isError).toBeFalsy();
    expect((source.content as { resultClaims: unknown[] }).resultClaims.length).toBeLessThanOrEqual(3);
  });

  it("filtrerer konkrete motstanderresultater på kanonisk klubb-ID", async () => {
    const response = await call("search_all_results", {
      opponentClubId: "molde-fk",
      ranking: "newest",
      limit: 100,
    });
    const result = rows(response);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((row) => row.opponent_club_id === "molde-fk")).toBe(true);
    expect(result.some((row) => row.opponent === "Molde 2")).toBe(false);
    expect(result.some((row) => String(row.opponent).includes("Træff"))).toBe(false);
  });

  it("bevarer kilde, side og sikkerhet for rollekandidater", async () => {
    const result = rows(await call("search_resolved_roles", { q: "formann", limit: 5 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("source_title");
    expect(result[0]).toHaveProperty("page");
    expect(["high", "medium", "low"]).toContain(result[0]!.confidence);
  });

  it("bevarer kilde, side og sikkerhet for lagkandidater", async () => {
    const result = rows(await call("search_resolved_lineups", { limit: 5 }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("source_title");
    expect(result[0]).toHaveProperty("page");
    expect(result[0]).toHaveProperty("confidence");
  });

  it("finner de kildeførte overgangene i det ekte arkivet", async () => {
    const response = await call("search_transfers", { direction: "in", limit: 50 });
    const result = rows(response);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((row) => row.direction === "in")).toBe(true);
    // Hver rad hviler på noe. Står den som verken publikasjon eller nettmelding,
    // er proveniensen tapt på veien fra YAML til svar.
    expect(result.every((row) => ["source", "provider", "both"].includes(String(row.documented_by)))).toBe(true);

    const totals = (response.content as { totals: { matched: number; in: number; out: number } }).totals;
    expect(totals.matched).toBe(totals.in);
    expect(totals.out).toBe(0);
  });

  it("holder lån og permanente overganger fra hverandre", async () => {
    const loans = rows(await call("search_transfers", { kind: "loan", limit: 50 }));
    expect(loans.length).toBeGreaterThan(0);
    expect(loans.every((row) => row.kind === "loan")).toBe(true);
    expect(loans.some((row) => row.kind === "transfer")).toBe(false);
  });

  it("tar med providers på personens overganger", async () => {
    const person = await call("get_person", { personId: "mikkel-kirkeskov" });
    const transfers = (person.content as { transfers: Record<string, unknown>[] }).transfers;
    expect(transfers.length).toBeGreaterThan(0);
    // Overgangen er dokumentert av en klubbmelding og ikke av en publikasjon.
    // Uten providers i svaret ville den sett ut som en påstand uten kilde.
    expect(transfers.some((row) => String(row.documented_by) !== "source")).toBe(true);
    expect(transfers.every((row) => row.providers !== undefined && row.sources !== undefined)).toBe(true);
  });

  it("gjør personkonfliktene tilgjengelige for fri SQL", async () => {
    const result = rows(await call("run_sql", {
      sql: "SELECT person_id, field, value, decision FROM person_conflicts LIMIT 10",
    }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({ decision: "unresolved" });
  });
});
