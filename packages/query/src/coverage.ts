import { PLAYED_SQL, all, one } from "@aafkstats/db";
import type { Db } from "@aafkstats/db";

/**
 * Hva arkivet faktisk inneholder, regnet ut av databasen.
 *
 * Finnes fordi dekningspåstander skrevet som prosa blir gale i samme øyeblikk som
 * neste innhøsting kjører, og ingen merker det. Datasettdokumentasjonen sto en
 * stund og fortalte modellen at «fem kamper fra 2025 har hendelser» lenge etter at
 * tallet var 523. Modellen har ingen måte å oppdage at den blir feilinformert, og
 * svarene ble deretter.
 *
 * Tallene her endrer seg bare når arkivet endrer seg, altså ved utrulling. Da kan
 * de trygt stå i en systemprompt som skal prompt-caches.
 */
export interface DatasetCoverage {
  /** Kamper som har funnet sted. Samme regel som `core_played`. */
  played: number;
  /** Kamper på terminlista som ikke er spilt ennå. */
  scheduled: number;
  /** År med minst én spilt kamp. Ikke det samme som komplette sesonger. */
  years: number;
  firstSeason: number | null;
  lastSeason: number | null;
  opponents: number;
  /** Kamper med minst én registrert hendelse. */
  withEvents: number;
  withAttendance: number;
  withLineups: number;
  /** Egne kampreferat. Null er et helt vanlig tall her. */
  withReport: number;
  /** Seriesesonger merket komplette, og hvor mange serieår arkivet har totalt. */
  completeLeagueSeasons: number;
  leagueSeasons: number;
  /**
   * Serieår uten kamper igjen på terminlista.
   *
   * Nevneren når noe skal sies om hvor mye som er komplett. En sesong som pågår
   * kan ikke være komplett ennå, og talt med trekker den ned et tall som skal
   * si noe om hva arkivet mangler. Sesongoversikten har hele tiden regnet slik;
   * uten feltet her sa `/om` «41 av 46» der `/sesonger` sa «41 av 45».
   */
  finishedLeagueSeasons: number;
  /** Kamper per konkurransetype, flest først. */
  byType: { type: string; matches: number }[];
}

export function readCoverage(db: Db): DatasetCoverage {
  const base = one<{ played: number; years: number; first: number | null; last: number | null }>(
    db,
    `SELECT count(*) AS played, count(DISTINCT season) AS years,
            min(season) AS first, max(season) AS last
     FROM matches WHERE ${PLAYED_SQL}`,
  );
  const n = (sql: string): number => one<{ n: number }>(db, sql)?.n ?? 0;

  return {
    played: base?.played ?? 0,
    scheduled: n(`SELECT count(*) AS n FROM matches WHERE status = 'scheduled'`),
    years: base?.years ?? 0,
    firstSeason: base?.first ?? null,
    lastSeason: base?.last ?? null,
    opponents: n(`SELECT count(*) AS n FROM opponents WHERE played > 0`),
    // Hendelser ligger i sitt eget view, én rad per hendelse, derfor DISTINCT.
    withEvents: n(`SELECT count(DISTINCT match_id) AS n FROM match_events`),
    withAttendance: n(`SELECT count(*) AS n FROM matches WHERE ${PLAYED_SQL} AND attendance IS NOT NULL`),
    // core_appearances er intern, men dette er byggetidskode med full lesetilgang,
    // ikke chattens sti. Oppstillingene finnes ikke i noe publisert view per kamp.
    withLineups: n(`SELECT count(DISTINCT match_id) AS n FROM core_appearances`),
    withReport: n(`SELECT count(*) AS n FROM matches WHERE ${PLAYED_SQL} AND report_summary IS NOT NULL`),
    completeLeagueSeasons: n(
      `SELECT count(*) AS n FROM seasons WHERE competition_type = 'league' AND coverage = 'complete'`,
    ),
    leagueSeasons: n(`SELECT count(*) AS n FROM seasons WHERE competition_type = 'league'`),
    finishedLeagueSeasons: n(
      `SELECT count(*) AS n FROM seasons WHERE competition_type = 'league' AND scheduled = 0`,
    ),
    byType: all<{ type: string; matches: number }>(
      db,
      `SELECT competition_type AS type, count(*) AS matches
       FROM matches WHERE ${PLAYED_SQL}
       GROUP BY competition_type ORDER BY matches DESC`,
    ),
  };
}

const TYPE_NAMES: Record<string, string> = {
  league: "serie",
  national_cup: "cup",
  european: "europacup",
  friendly: "treningskamp",
  playoff: "kvalifisering",
};

/**
 * Dekningen som setninger, én påstand per element.
 *
 * Setninger og ikke en tabell, fordi de skal kunne gjenbrukes ordrett i et svar.
 * Poenget er at modellen skal kunne si «arkivet har ingen kampreferat» uten å
 * måtte spørre om det først, og at leseren på `/data` ser nøyaktig de samme
 * påstandene som modellen fikk.
 */
export function coverageFacts(c: DatasetCoverage): string[] {
  const span =
    c.firstSeason && c.lastSeason && c.firstSeason !== c.lastSeason
      ? ` fra ${c.firstSeason} til ${c.lastSeason}`
      : "";
  const share = (part: number): string =>
    c.played === 0 ? "0 %" : `${Math.round((part / c.played) * 100)} %`;

  const types = c.byType
    .map((row) => `${TYPE_NAMES[row.type] ?? row.type} ${row.matches}`)
    .join(", ");

  return [
    `${c.played} spilte kamper${span}, fordelt på ${types}.`,
    `${c.scheduled} kamper på terminlista som ikke er spilt ennå.`,
    `${c.years} år er representert med minst én kamp. Det er noe annet enn ${c.years} komplette sesonger: ${c.completeLeagueSeasons} av ${c.finishedLeagueSeasons} avsluttede serieår er merket «complete» i seasons.coverage. Sesonger som pågår er holdt utenfor; de kan ikke være komplette ennå.`,
    `${c.opponents} motstandere er møtt minst én gang.`,
    `${c.withEvents} kamper (${share(c.withEvents)}) har hendelser som mål og kort. Dekningen følger kilden, ikke kalenderen.`,
    `${c.withLineups} kamper har lagoppstilling.`,
    `${c.withAttendance} kamper har tilskuertall.`,
    c.withReport === 0
      ? "Arkivet har ingen egne kampreferat. Et tomt treff i reports betyr at referatet ikke er skrevet, ikke at kampen mangler."
      : `${c.withReport} kamper har eget kampreferat.`,
  ];
}

/** De samme setningene som markdown, til systemprompten. */
export function coverageMarkdown(c: DatasetCoverage): string {
  return [
    "## Dekning",
    "",
    "Tallene under er regnet ut av databasen ved bygging, ikke skrevet av hånd. De gjelder",
    "arkivet slik det er akkurat nå, og de er riktige å bruke i et svar om hva arkivet har.",
    "",
    ...coverageFacts(c).map((fact) => `- ${fact}`),
    "",
    "Mangler et tall her, mangler opplysningen i arkivet. Si det framfor å gjette.",
    "",
  ].join("\n");
}
