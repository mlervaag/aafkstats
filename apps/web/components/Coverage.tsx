import { PLAYED_SQL, all, open } from "@aafkstats/db";
import type { SeasonSummary, SeasonYear } from "@/lib/archive";

/** AaFK ble stiftet i 1914. Alt før det er ikke et hull, det er før klubben fantes. */
const FOUNDED = 1914;

type YearKind = "league" | "fragments" | "missing";

function kindOf(entry: SeasonYear | undefined): YearKind {
  if (!entry) return "missing";
  return entry.primary.competitionType === "league" ? "league" : "fragments";
}

/**
 * Ett merke per år fra stiftelsen til i dag, farget etter hva arkivet har.
 *
 * Sesonglista er 85 kort som ser like ut enten året er en hel serie eller én
 * cupkamp. Formen på arkivet — hvor det er tykt, hvor det er tynt, hvor det
 * mangler helt — er den opplysningen en leser trenger først, og den lot seg ikke
 * lese ut av lista i det hele tatt. Her er hele spennet på fire linjer.
 */
export function CoverageStrip({ years }: { years: SeasonYear[] }) {
  const byYear = new Map(years.map((entry) => [entry.year, entry]));
  const newest = years[0]?.year ?? FOUNDED;
  const span = Array.from({ length: newest - FOUNDED + 1 }, (_, i) => FOUNDED + i);
  // Gruppert i tiår, med samme inndeling som seksjonene under. Uten grupperingen
  // brytes stripa der bredden tilfeldigvis tar slutt, og da er det ikke mulig å
  // telle seg fram til hvilket år et merke gjelder.
  const decades = new Map<number, number[]>();
  for (const year of span) {
    const decade = Math.floor(year / 10) * 10;
    decades.set(decade, [...(decades.get(decade) ?? []), year]);
  }

  return (
    <figure className="coverage-strip">
      <ol aria-label={`Dekning år for år, ${FOUNDED} til ${newest}`}>
        {[...decades].map(([decade, group]) => (
          <li className="strip-decade" key={decade}>
            <ol aria-label={`${decade}-tallet`}>
              {group.map((year) => {
                const entry = byYear.get(year);
                const cell = <span className={`strip-year strip-${kindOf(entry)}`} aria-hidden="true" />;
                const text = entry ? stripTitle(year, entry) : `${year}: ingen kamper i arkivet`;
                return (
                  <li key={year}>
                    {entry ? (
                      <a href={entry.primary.url} title={text}>
                        <span className="sr-only">{text}</span>
                        {cell}
                      </a>
                    ) : (
                      <span title={text}><span className="sr-only">{text}</span>{cell}</span>
                    )}
                  </li>
                );
              })}
            </ol>
            {/* Hele årstallet, ikke «10». Stripa brytes over flere linjer, og
                da står 1910-tallet og 2010-tallet med samme merkelapp. */}
            <span className="strip-decade-label small muted num">{decade}</span>
          </li>
        ))}
      </ol>
      <figcaption className="strip-legend small muted">
        <span><i className="strip-year strip-league" /> Sesong i serien</span>
        <span><i className="strip-year strip-fragments" /> Bare enkeltkamper</span>
        <span><i className="strip-year strip-missing" /> Ingenting ennå</span>
        <span className="strip-ends num">{FOUNDED}–{newest}</span>
      </figcaption>
    </figure>
  );
}

/**
 * Teksten bak hvert merke i stripa.
 *
 * Stripa har tre farger, ikke seks. Den skal svare på ett spørsmål — hvor er
 * arkivet tykt, hvor er det tynt, hvor mangler det helt — og seks farger på 113
 * merker à åtte piksler gjør den til et mønster ingen kan lese. Detaljene ligger
 * i teksten her, som både skjermlesere og et musepek får, og i merkelappen på
 * hvert sesongkort under.
 */
function stripTitle(year: number, entry: SeasonYear): string {
  const kamper = `${entry.totalMatches} ${entry.totalMatches === 1 ? "kamp" : "kamper"}`;
  if (entry.primary.competitionType !== "league") {
    return `${year}: ${kamper}, ingen seriesesong`;
  }
  return `${year}: ${entry.primary.competition}, ${kamper}, ${coverageWord(entry.primary)}`;
}

/** Dekningen som ett ord, til stripa. Merkelappen på kortet sier det samme lengre. */
function coverageWord(season: SeasonSummary): string {
  switch (season.coverage) {
    case "complete":
      return "komplett sesong";
    case "in_progress":
      return "sesongen pågår";
    case "partial":
      return "delvis sesong";
    case "unverified":
      return "sammenhengende runder, ukjent omfang";
    default:
      return "løsrevne kamper";
  }
}

/**
 * Merkelappen som sier hvor mye av en sesong arkivet faktisk har.
 *
 * «85 sesonger» har hele tiden betydd 85 år med minst én registrert kamp. For en
 * leser er det ikke til å skille fra 85 komplette sesonger, og forskjellen er
 * stor: 2011 er en hel serie, mens 1951 er tre løsrevne kamper.
 *
 * Verdien regnes ut i byggesteget fra rundenumrene i kampene, så den kan ikke bli
 * utdatert slik en håndskrevet setning kan. Se `seasons`-viewet.
 *
 * Cup og treningskamper får ingen merkelapp. En cupsesong slutter når laget ryker
 * ut, så «ufullstendig» ville vært feil ord for en helt normal sesong.
 */
export function CoverageTag({ season }: { season: SeasonSummary }) {
  // En sesong som pågår er ikke ufullstendig, den er ikke ferdig. Merket sier det
  // rett ut, og gjelder også cupen — der er «vi er fortsatt med» hele poenget.
  if (season.scheduled > 0) {
    const total = season.played + season.scheduled;
    return (
      <span className="coverage-tag coverage-ongoing" title="Sesongen pågår. Resten står på terminlista.">
        Pågår · {season.played} av {total} kamper
      </span>
    );
  }
  if (season.coverage === "not_applicable") return null;

  return (
    <span className={`coverage-tag coverage-${season.coverage}`} title={coverageExplanation(season)}>
      {coverageText(season)}
    </span>
  );
}

function coverageText(season: SeasonSummary): string {
  switch (season.coverage) {
    case "complete":
      return `Komplett · ${season.lastRound} runder`;
    case "partial":
      return season.expectedMatches
        ? `Delvis · ${season.played} av ${season.expectedMatches} kamper`
        : `Delvis · ${season.played} av ${season.lastRound ?? "?"} runder`;
    case "unverified":
      // Merket sier hva vi har og hva vi ikke vet, ikke «komplett». Sesongen kan
      // være hel, men ingen kilde i arkivet sier hvor mange runder den hadde.
      return `${season.played} runder · omfang ukjent`;
    case "in_progress":
      return `Pågår · ${season.played} kamper spilt`;
    default:
      return `${season.played} kjente ${season.played === 1 ? "kamp" : "kamper"}`;
  }
}

/**
 * Grunnlaget for merket, i klartekst.
 *
 * «Komplett» uten grunnlag er en påstand leseren ikke kan vurdere. Her står det
 * hva den hviler på: sluttabellen, et tall oppgitt for hånd, eller bare
 * rundenumrene.
 */
function coverageExplanation(season: SeasonSummary): string {
  switch (season.coverage) {
    case "complete":
      return season.coverageEvidence === "rounds_and_standings"
        ? `Sluttabellen sier at AaFK spilte ${season.expectedMatches} kamper, og arkivet har like mange, med hver runde fra første til siste.`
        : `Arkivet har hver runde fra første til siste, ${season.expectedMatches} kamper, som er det omfanget sesongfila oppgir.`;
    case "partial":
      return season.expectedMatches
        ? `Sesongen hadde ${season.expectedMatches} kamper. Arkivet har ${season.played}.`
        : "Det mangler runder i denne sesongen.";
    case "unverified":
      return "Rundene henger sammen, men ingen kilde i arkivet sier hvor mange runder sesongen hadde. Da kan den ikke kalles komplett.";
    case "in_progress":
      return "Sesongen pågår. Resten står på terminlista.";
    default:
      return "Kampene mangler rundenummer, så arkivet vet bare at de ble spilt.";
  }
}

/**
 * Én setning om hvor mange av årene som faktisk er hele sesonger.
 *
 * Står under sesongoversikten, der påstanden «85 sesonger» ellers ville stått
 * alene og lovet mer enn arkivet har.
 */
export function CoverageSummary({ seasons }: { seasons: SeasonSummary[] }) {
  // Sesonger som pågår holdes utenfor. De kan ikke være komplette ennå, og telt
  // med ville de trukket ned et tall som skal si noe om hva arkivet mangler.
  const leagues = seasons.filter(
    (season) => season.coverage !== "not_applicable" && season.scheduled === 0,
  );
  const complete = leagues.filter((season) => season.coverage === "complete").length;
  const fragments = leagues.filter((season) => season.coverage === "isolated").length;
  const unverified = leagues.filter((season) => season.coverage === "unverified").length;
  if (leagues.length === 0) return null;

  return (
    <p className="small muted coverage-summary">
      {complete} av {leagues.length} seriesesonger ligger inne komplett. Det betyr hver runde
      fra første til siste, og like mange kamper som sluttabellen sier at AaFK spilte.
      {unverified > 0 && (
        <> {unverified} {unverified === 1 ? "sesong har" : "sesonger har"} sammenhengende runder
        uten at noen kilde sier hvor mange det skulle vært.</>
      )}
      {fragments > 0 && (
        <> {fragments} år har bare enkeltkamper vi kjenner til.</>
      )}{" "}
      Cupen telles ikke her: den slutter når laget ryker ut, så det finnes ingen komplett
      cupsesong å måle mot.
    </p>
  );
}

/**
 * Hva arkivet dekker per konkurransetype, regnet ut av arkivet.
 *
 * Sto som en fast setning: «Cupen er godt dekket helt tilbake til 1917 …
 * Europacupkampene mangler, og treningskamper finnes bare for inneværende
 * sesong.» Det var sant da kommentaren ble skrevet, men ikke etter FotMob-gapimporten.
 * Hvert ledd var en påstand om et tall, og den blir gal av neste
 * innhøsting uten at noen merker det. «Godt dekket» var dessuten ikke
 * etterprøvbart: ingen vet hvor mange cupkamper AaFK har spilt.
 */
export const TYPE_LABELS: Record<string, string> = {
  league: "Serien",
  national_cup: "Cupen",
  european: "Europacup",
  friendly: "Treningskamper",
  playoff: "Kvalifisering",
};

/**
 * Konkurransetypene i småbokstav, til bruk midt i en setning.
 *
 * `TYPE_LABELS` står som første ord i en punktliste og er derfor store
 * bokstaver. «Arkivet dekker Serien og Cupen» er ikke norsk.
 */
export const TYPE_WORDS: Record<string, string> = {
  league: "serie",
  national_cup: "cup",
  european: "europacup",
  friendly: "treningskamper",
  playoff: "kvalifisering",
};

export function CompetitionSpread() {
  const db = open();
  let rows: { type: string; matches: number; first: number; last: number }[];
  try {
    rows = all<{ type: string; matches: number; first: number; last: number }>(
      db,
      `SELECT competition_type AS type, count(*) AS matches,
              min(season) AS first, max(season) AS last
       FROM matches WHERE ${PLAYED_SQL}
       GROUP BY competition_type ORDER BY matches DESC`,
    );
  } finally {
    db.close();
  }

  const present = new Set(rows.map((row) => row.type));
  const missing = Object.keys(TYPE_LABELS).filter((type) => !present.has(type));

  return (
    <p className="notice prose">
      {rows.map((row, index) => (
        <span key={row.type}>
          {index > 0 ? " " : ""}
          {TYPE_LABELS[row.type] ?? row.type}: {row.matches} kamper
          {row.first === row.last ? ` fra ${row.first}` : ` fra ${row.first} til ${row.last}`}.
        </span>
      ))}
      {missing.length > 0 && (
        <>
          {" "}
          {missing.map((type) => TYPE_LABELS[type]).join(" og ")} mangler helt.
        </>
      )}{" "}
      Et årstall her sier når den første og siste kampen ble spilt, ikke at årene mellom
      er hele. Se <a href="/om">kilder og forbehold</a>.
    </p>
  );
}
