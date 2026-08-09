import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import {
  loadCoverage,
  loadDeclaredCoaches,
  loadNeighbourSeasons,
  loadNextMatch,
  loadOpponents,
  loadOverview,
  loadSeason,
  loadSeasonCoaches,
  loadSeasons,
  loadSquad,
  loadStandings,
} from "../lib/archive.js";

const previousDbPath = process.env.AAFK_DB_PATH;

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "aafk-overview-")), "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
});

/**
 * Forsiden sier «N AaFK-kamper». Terminlista for inneværende sesong ligger i
 * arkivet på lik linje med resten, så uten et skille teller overskriften kamper
 * som ikke er spilt, og «til 2026» henter årstallet fra en kamp i desember.
 *
 * Fixturen har tolv kamper: én står som `scheduled`, én som `awarded`.
 */
describe("forsidetallene", () => {
  it("teller bare kamper som har funnet sted", () => {
    const { totals } = loadOverview();
    expect(totals.matches).toBe(11);
    expect(totals.upcoming).toBe(1);
  });

  it("henter siste årstall fra siste spilte kamp, ikke fra terminlista", () => {
    const { totals } = loadOverview();
    // Terminlistekampen i fixturen er 2024-11-24. Den skal ikke være «siste».
    expect(totals.last).toBe("2024-05-02");
  });

  it("holder dekningsnotisen på samme tall som forsiden", () => {
    // De to sto tidligere på hver sin spørring. Da kan de si ulike ting om det
    // samme arkivet på samme side, og en leser har ingen måte å se hvem som lyver.
    expect(loadCoverage().matches).toBe(loadOverview().totals.matches);
    expect(loadCoverage().upcoming).toBe(loadOverview().totals.upcoming);
  });

  it("holder terminlistekampen utenfor konkurransefordelingen også", () => {
    const coverage = loadCoverage();
    const sum = coverage.byCompetition.reduce((total, row) => total + row.matches, 0);
    expect(sum).toBe(coverage.matches);
  });
});

/**
 * Én definisjon av «spilt», brukt likt overalt.
 *
 * Regelen sto tre steder med tre litt ulike svar: `seasons` tok bare status
 * 'played', `opponents` talte kamper på én måte og seire på en annen, og
 * nettstedet hadde sin egen streng. Kampen på grønt bord i fixturen er nettopp
 * den som avslørte forskjellen, og testene her holder de tre på samme tall.
 */
describe("spilt betyr det samme overalt", () => {
  it("teller kampen på grønt bord med i forsidens totalsum", () => {
    expect(loadOverview().totals.matches).toBe(11);
  });

  it("teller den med i sesongsammendraget", () => {
    // 1998 har fire kamper i fixturen: tre i serien, hvorav én på grønt bord.
    const serien = loadSeason(1998)!.summaries.find((s) => s.competitionId === "forstedivisjon")!;
    expect(serien.played).toBe(3);
    expect(serien.wins).toBe(2);
  });

  it("teller den med i motstanderstatistikken", () => {
    const rbk = loadOpponents().find((o) => o.id === "rosenborg-bk")!;
    // Seirene kan ikke overstige antall kamper. De kunne før: kampantallet så
    // bare etter 'played', mens seiersteljingen tok enhver rad med et resultat.
    expect(rbk.wins + rbk.draws + rbk.losses).toBe(rbk.played);
    expect(rbk.lastMeeting).not.toBeNull();
  });

  it("gir samme sum i sesongene som på forsiden", () => {
    const fromSeasons = loadSeasons().reduce((sum, s) => sum + s.played, 0);
    // Sesongsummen holder kvalifiseringskamper utenfor serietabellen, så den kan
    // være lavere. Den kan aldri være høyere: da telles noe to ganger.
    expect(fromSeasons).toBeLessThanOrEqual(loadOverview().totals.matches);
  });
});

describe("neste kamp", () => {
  it("finner den første kampen som ikke er spilt", () => {
    const next = loadNextMatch("2024-01-01");
    expect(next?.matchId).toBe("2024-11-24-sk-brann-aalesunds-fk");
    expect(next?.kickoff).toBe("17:00");
  });

  it("regner ikke en gammel terminlistekamp som neste kamp", () => {
    // Kampen står som `scheduled` i fixturen, men datoen er passert. Uten
    // datofilteret ville forsiden lovet en kamp som aldri kommer.
    expect(loadNextMatch("2025-01-01")).toBeUndefined();
  });
});

describe("sesongdekning", () => {
  it("teller kampene som står igjen på terminlista", () => {
    const summaries = loadSeason(2024)!.summaries;
    const eliteserien = summaries.find((s) => s.competitionId === "eliteserien")!;
    expect(eliteserien.scheduled).toBe(1);
    // Sesongtallene teller den ikke med. Det er nettopp skillet merket bygger på.
    expect(eliteserien.played + eliteserien.scheduled).toBeGreaterThan(eliteserien.played);
  });
});

describe("naboårene", () => {
  it("hopper over årene arkivet ikke har", () => {
    // Fixturen har 1998, 2005 og 2024. En lenke til 2004 ville vært en blindvei.
    expect(loadNeighbourSeasons(2005)).toEqual({ previous: 1998, next: 2024 });
  });

  it("gir null i hver ende", () => {
    expect(loadNeighbourSeasons(1998).previous).toBeNull();
    expect(loadNeighbourSeasons(2024).next).toBeNull();
  });
});

describe("sluttabellen", () => {
  it("leser tabellen med kildens lagnavn", () => {
    const { table } = loadStandings("forstedivisjon", 1998);
    expect(table).toHaveLength(5);
    expect(table[0]).toMatchObject({ position: 1, team: "Molde", clubId: "molde-fk", points: 13 });
    // Laget uten klubbfil skal stå der med navn og uten lenke.
    expect(table.at(-1)).toMatchObject({ team: "Eik-Tønsberg", clubId: null, url: null });
  });

  it("regner ut målforskjellen i viewet", () => {
    const { table } = loadStandings("forstedivisjon", 1998);
    expect(table[0]!.goalDifference).toBe(6);
    expect(table.at(-1)!.goalDifference).toBe(-5);
  });

  it("gir sesongen sin sluttplass fra tabellen", () => {
    // core_seasons har feltet, men ingen har fylt det for en eneste sesong.
    // Fixturens season.yaml sier 8. plass; tabellen sier 3., og tabellen vinner.
    const summary = loadSeason(1998)!.summaries.find((s) => s.competitionId === "forstedivisjon")!;
    expect(summary.finalPosition).toBe(3);
  });

  it("gir ingen tabell for en sesong vi ikke har hentet", () => {
    expect(loadStandings("eliteserien", 2024).table).toEqual([]);
  });

  it("leser kurven i rundenes rekkefølge", () => {
    const { progression } = loadStandings("forstedivisjon", 1998);
    expect(progression.map((p) => p.round)).toEqual([1, 2, 3, 4, 5, 6]);
    // Siste punkt skal stemme med tabellraden. Det er hele kontrakten kurven
    // slipper gjennom innhøstingen på.
    expect(progression.at(-1)).toMatchObject({ position: 3, points: 8, played: 6 });
  });
});

/**
 * Stallen og trenerhistorikken utledes av lagoppstillingene ved bygging.
 *
 * Fixturen har to kamper med oppstilling, og skrivemåtene i dem er ekte: kilden
 * veksler mellom «Jönsson» og «Joensson» og mellom «Aarøy» og «Aaroey» fra kamp
 * til kamp. Testene her holder på at det blir én person av hver.
 */
describe("stall og trener", () => {
  it("gjør to skrivemåter av samme navn til én spiller", () => {
    const squad = loadSquad(2024);
    const aaroy = squad.filter((p) => p.name.toLowerCase().includes("hogne"));
    expect(aaroy).toHaveLength(1);
    expect(aaroy[0]).toMatchObject({ name: "Tor Hogne Aarøy", appearances: 2, starts: 2 });
  });

  it("teller benken som en kamp, men ikke som en start", () => {
    const squad = loadSquad(2024);
    const c = squad.find((p) => p.name === "Fixture Spiller C")!;
    expect(c).toMatchObject({ appearances: 2, starts: 1 });
  });

  it("holder motstanderens spillere utenfor stallen", () => {
    // Oppstillingene deres er registrert, men de er ikke vår stall. Uten
    // filteret ville en sesong hatt dobbelt så mange spillere som den hadde.
    const names = loadSquad(2024).map((p) => p.name);
    expect(names).not.toContain("Moldespiller En");
    expect(names).not.toContain("Fixture Spiller A");
  });

  it("teller mål fra hendelsene", () => {
    const squad = loadSquad(2024);
    expect(squad.find((p) => p.name === "Fixture Spiller B")!.goals).toBe(2);
    expect(squad.find((p) => p.name === "Fixture Spiller C")!.goals).toBe(0);
  });

  it("gjør to skrivemåter av trenernavnet til én periode", () => {
    const coaches = loadSeasonCoaches(2024);
    expect(coaches).toHaveLength(1);
    expect(coaches[0]).toMatchObject({ name: "Jan Jönsson", matches: 2 });
  });

  it("gir ingen stall for sesonger uten lagoppstilling", () => {
    // 1998 har kamper, men ingen oppstillinger. Tom stall er riktig svar: det
    // er en manglende kilde, ikke et lag uten spillere.
    expect(loadSquad(1998)).toEqual([]);
    expect(loadSeasonCoaches(1998)).toEqual([]);
  });

  it("kaller ingen ny når vi ikke har fjoråret å sammenligne med", () => {
    // 2023 finnes ikke i fixturen, så alle i 2024 ville sett nye ut.
    expect(loadSquad(2024).every((p) => !p.isNew)).toBe(true);
  });
});

/**
 * Personregisteret svarer på hvem noen er; oppstillingene på når de spilte.
 *
 * Fixturen har to personfiler. Den ene har en skrivemåte i `names` som er den
 * kampen brukte, slik at oppslaget testes hele veien.
 */
describe("personregisteret", () => {
  it("finner personen selv når kampen brukte en annen skrivemåte", () => {
    // Kampen i 2024 har «Tor Hogne Aaroey»; fila heter «Tor Hogne Aarøy».
    const player = loadSquad(2024).find((p) => p.name.includes("Hogne"))!;
    expect(player).toMatchObject({ number: 9, position: "angrep", nationality: "Norge" });
    expect(player.wikidata).toBe("Q167167");
  });

  it("lar spillere uten personfil stå med tomme felt", () => {
    // De fleste som har spilt har ingen fil, og det er en normal tilstand.
    const player = loadSquad(2024).find((p) => p.name === "Fixture Spiller B")!;
    expect(player).toMatchObject({ number: null, position: null, wikidata: null });
    expect(player.appearances).toBeGreaterThan(0);
  });

  it("holder oppgitte trenerperioder atskilt fra de utledede", () => {
    // Den utledede har eksakte datoer fra kampene; den oppgitte bare årstall.
    const declared = loadDeclaredCoaches(2014);
    expect(declared).toEqual([{ name: "Jan Jönsson", fromSeason: 2013, toSeason: 2014 }]);
    expect(loadSeasonCoaches(2014)).toEqual([]);
  });

  it("gir ingen oppgitt periode for et år ingen kilde dekker", () => {
    expect(loadDeclaredCoaches(1998)).toEqual([]);
  });
});
