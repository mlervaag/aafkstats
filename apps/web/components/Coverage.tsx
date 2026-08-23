import { PLAYED_SQL, all, open } from "@aafkstats/db";
import type { SeasonCoverage, SeasonDetailLevel, SeasonSummary, SeasonYear } from "@/lib/archive";
import { FIELD_NAMES } from "@/components/SeasonGaps";

/** AaFK ble stiftet i 1914. Alt før det er ikke et hull, det er før klubben fantes. */
const FOUNDED = 1914;

type YearKind = "league" | "fragments" | "missing";

function kindOf(entry: SeasonYear | undefined): YearKind {
  if (!entry) return "missing";
  return entry.primary?.competitionType === "league" ? "league" : "fragments";
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
                      <a href={entry.primary?.url ?? `/sesong/${year}`} title={text}>
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
  if (!entry.primary) return `${year}: ${entry.documentedResults} kildedokumenterte resultater uten full kampdato`;
  if (entry.primary.competitionType !== "league") {
    return `${year}: ${kamper}, ingen seriesesong`;
  }
  return `${year}: ${entry.primary.competition}, ${kamper}, ${coverageWord(entry.primary)}`;
}

/** Dekningen som ett ord, til stripa. Merkelappen på kortet sier det samme lengre. */
function coverageWord(season: SeasonSummary): string {
  switch (season.coverage) {
    case "complete":
      return "komplett kampliste i serien";
    case "in_progress":
      return "sesongen pågår";
    case "partial":
      return "delvis sesong";
    case "unverified":
      return "sammenhengende runder, ukjent omfang";
    default:
      return season.expectedMatches
        ? `${season.played} av ${season.expectedMatches} seriekamper`
        : "løsrevne kamper";
  }
}

/**
 * Merkelappen som sier hvor mye av en sesong arkivet faktisk har.
 *
 * «87 sesonger» betyr her 87 år med minst én registrert kamp. For en
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

/**
 * Merket sier nå hva det har telt, ikke bare hvor godt det gikk.
 *
 * «Komplett · 26 runder» leses som at sesongen 1997 er ferdig dokumentert. Det
 * merket måler er kamplista i serien: at arkivet har hver runde fra første til
 * siste, og like mange kamper som sluttabellen sier. Det sier ingenting om cupen,
 * og ingenting om hva som står på hver kamp — de 22 kampene i 1982 er alle uten
 * lagoppstilling, dommer og tilskuertall. «26 av 26 seriekamper» er den samme
 * påstanden med målestokken skrevet ut, og den kan leseren etterprøve mot
 * sluttabellen rett under.
 */
function coverageText(season: SeasonSummary): string {
  switch (season.coverage) {
    case "complete":
      return `${season.played} av ${season.expectedMatches ?? season.played} seriekamper`;
    case "partial":
      return season.expectedMatches
        ? `Delvis · ${season.played} av ${season.expectedMatches} seriekamper`
        : `Delvis · ${season.played} av ${season.lastRound ?? "?"} runder`;
    case "unverified":
      // Merket sier hva vi har og hva vi ikke vet, ikke «komplett». Sesongen kan
      // være hel, men ingen kilde i arkivet sier hvor mange runder den hadde.
      return `${season.played} runder · omfang ukjent`;
    case "in_progress":
      return `Pågår · ${season.played} kamper spilt`;
    default:
      // Uten rundetall het dette «5 kjente kamper», også for 1955, der
      // sluttabellen i arkivet sier at AaFK spilte fjorten. Nevneren fantes; den
      // ble bare ikke brukt. Da sa merket mindre enn arkivet vet.
      return season.expectedMatches
        ? `${season.played} av ${season.expectedMatches} seriekamper`
        : `${season.played} ${season.played === 1 ? "kjent kamp" : "kjente kamper"}`;
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
      return `${season.coverageEvidence === "rounds_and_standings"
        ? `Sluttabellen sier at AaFK spilte ${season.expectedMatches} kamper, og arkivet har like mange, med hver runde fra første til siste.`
        : `Arkivet har hver runde fra første til siste, ${season.expectedMatches} kamper, som er det omfanget sesongfila oppgir.`
      } Merket gjelder kamplista i serien, ikke hvor mye som står på hver kamp.`;
    case "partial":
      return season.expectedMatches
        ? `Sesongen hadde ${season.expectedMatches} kamper. Arkivet har ${season.played}.`
        : "Det mangler runder i denne sesongen.";
    case "unverified":
      return "Rundene henger sammen, men ingen kilde i arkivet sier hvor mange runder sesongen hadde. Da kan den ikke kalles komplett.";
    case "in_progress":
      return "Sesongen pågår. Resten står på terminlista.";
    default:
      return season.expectedMatches
        ? `Sluttabellen sier at AaFK spilte ${season.expectedMatches} kamper. Arkivet har ${season.played}, og de mangler rundenummer, så vi vet ikke hvilke av rundene de var.`
        : "Kampene mangler rundenummer, så arkivet vet bare at de ble spilt.";
  }
}

/**
 * Er hele sesongen kanonisert?
 *
 * «Komplett» sto på konkurransemerket, ved siden av «1. divisjon», og målte
 * kamplista i serien. En leser leser det som året. 2019 hadde hele serien inne
 * og sto som komplett, mens cupkvartfinalen mot Viking ligger i arkivet som 1–1
 * uten straffesparkkonkurranse — sesongen var merket komplett med et cupresultat
 * arkivet ikke kjenner.
 *
 * Ordet hører derfor til her, på året, og betyr det samme som det ser ut som:
 * serien hel, cupen spilt til laget røk ut, europacupen likeså. Konkurransemerket
 * sier fortsatt hva det har, bare uten å låne ordet.
 */
export function SeasonCoverageTag({ coverage }: { coverage: SeasonCoverage | null }) {
  if (!coverage) return null;

  if (coverage.status === "complete") {
    const parts = ["Serien er hel: hver runde fra første til siste, like mange kamper som"
      + (coverage.hasStandings ? " sluttabellen sier." : " omfanget sesongfila oppgir.")];
    if (coverage.cupMatches > 0) parts.push("Cupen er spilt til laget røk ut.");
    if (coverage.europeanMatches > 0) parts.push("Europacupen likeså.");
    parts.push("Treningskamper teller ikke: ingen kilde sier hvor mange de var.");
    return (
      <span className="coverage-tag coverage-complete" title={parts.join(" ")}>
        Komplett sesong{coverage.hasStandings ? "" : " · uten tabell"}
      </span>
    );
  }

  // Står serien igjen, sier konkurransemerket det allerede, med tall. To merker
  // som sier det samme ved siden av hverandre er ett merke for mye.
  const unfinished = coverage.status === "partial"
    && (coverage.blocker === "cup_unfinished" || coverage.blocker === "european_unfinished");
  if (!unfinished) return null;

  const cup = coverage.blocker === "cup_unfinished";
  return (
    <span
      className="coverage-tag coverage-partial"
      title={`Den siste ${cup ? "cupkampen" : "europacupkampen"} i arkivet er verken et tap, en finale eller en uavgjort avgjort på straffer. Enten mangler neste kamp, eller så mangler resultatet av den siste. Serien er hel.`}
    >
      {cup ? "Cupen" : "Europacupen"} står åpen
    </span>
  );
}

/**
 * Hva merket over ikke har målt, i én setning.
 *
 * Sesongsiden viste stripa med seire, uavgjorte og mål rett over sluttabellen. For
 * 1955 sto det 1 seier, 1 uavgjort, 3 tap og 5–9 i mål — over en tabell der AaFK
 * står med 5-4-5 og 25–24. Begge var riktige: stripa teller de fem kampene
 * arkivet har, tabellen hele sesongen. Ingenting på sida sa det, så to tallsett
 * motsa hverandre en halv skjerm fra hverandre.
 *
 * Den andre halvdelen gjelder de komplette sesongene. «Komplett» teller kamper, og
 * alle de 22 kampene i 1982 er uten lagoppstilling, dommer og tilskuertall.
 * Sesongen er en hel resultatliste og et tynt sesongarkiv på samme tid, og
 * merkelappen har bare plass til det ene.
 */
export function SeasonMeasure({
  season,
  detail,
  detailed,
}: {
  season: SeasonSummary;
  detail: SeasonDetailLevel;
  /**
   * Om setningen om detaljnivået skal med. Den gjelder hele sesongen like mye,
   * men står bare én gang: gjentatt under cupen og treningskampene sier den det
   * samme tre ganger på samme side.
   */
  detailed: boolean;
}) {
  const short = season.expectedMatches !== null
    && season.coverage !== "complete"
    && season.coverage !== "not_applicable"
    && season.scheduled === 0
    && season.expectedMatches > season.played;

  const missing = detailed ? missingWords(detail.missingOnAll) : [];
  if (!short && missing.length === 0) return null;

  return (
    <p className="small muted season-measure">
      {short ? (
        <>
          Tallene over gjelder {season.played === 1 ? "den ene kampen" : `de ${season.played} kampene`}{" "}
          arkivet har. Sluttabellen sier at AaFK spilte {season.expectedMatches}.{" "}
        </>
      ) : null}
      {missing.length > 0 ? (
        <>
          {season.played === 1 ? "Kampen mangler " : `Ingen av de ${season.played} kampene har `}
          {joinWords(missing)}.
        </>
      ) : null}
    </p>
  );
}

/** Hvor mange felt setningen rekker å nevne før den slutter å bli lest. */
const MAX_FIELDS = 4;

/**
 * Feltene som mangler, i den rekkefølgen en leser savner dem.
 *
 * `missing_fields` kommer alfabetisk sortert fra spørringen, og «tilskuertall,
 * mål og kort, lagoppstilling, dommer, kampreferat og stadion» er seks ledd der
 * det viktigste står tredje. Rekkefølgen her er den samme som i
 * `COMPLETENESS_FIELDS`, altså den arkivet selv vekter etter.
 */
function missingWords(fields: string[]): string[] {
  const order = Object.keys(FIELD_NAMES);
  const named = fields
    .filter((field) => FIELD_NAMES[field] !== undefined)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((field) => FIELD_NAMES[field]!);
  if (named.length <= MAX_FIELDS) return named;
  const rest = named.length - MAX_FIELDS;
  return [...named.slice(0, MAX_FIELDS), `${rest} felt til`];
}

/** «lagoppstilling, dommer og tilskuertall» — norsk oppramsing, ikke kommaliste. */
function joinWords(words: string[]): string {
  if (words.length === 1) return words[0]!;
  return `${words.slice(0, -1).join(", ")} og ${words.at(-1)}`;
}

/**
 * Én setning om hvor mange av årene som faktisk er hele sesonger.
 *
 * Står under sesongoversikten, der påstanden «85 sesonger» ellers ville stått
 * alene og lovet mer enn arkivet har.
 */
export function CoverageSummary({ years }: { years: SeasonYear[] }) {
  const seasons = years.flatMap((year) => (year.primary ? [year.primary] : []));
  // Sesonger som pågår holdes utenfor. De kan ikke være komplette ennå, og telt
  // med ville de trukket ned et tall som skal si noe om hva arkivet mangler.
  const leagues = seasons.filter(
    (season) => season.coverage !== "not_applicable" && season.scheduled === 0,
  );
  const complete = leagues.filter((season) => season.coverage === "complete").length;
  const fragments = leagues.filter((season) => season.coverage === "isolated").length;
  const unverified = leagues.filter((season) => season.coverage === "unverified").length;
  if (leagues.length === 0) return null;

  // Året sett under ett, ikke bare serien. Forskjellen på de to tallene er hele
  // poenget: en hel serie er ikke en hel sesong.
  const whole = years.filter((year) => year.coverage?.status === "complete").length;
  const cupOpen = years.filter(
    (year) => year.coverage?.blocker === "cup_unfinished"
      || year.coverage?.blocker === "european_unfinished",
  ).length;

  return (
    <p className="small muted coverage-summary">
      {whole} år er komplette: serien hel, cupen spilt til laget røk ut, og europacupen
      likeså de årene den ble spilt. Treningskamper teller ikke — ingen kilde sier hvor
      mange de var, så et krav om dem ville gjort hvert år ufullstendig for alltid.{" "}
      {complete} av {leagues.length} seriesesonger er hele hver for seg. Det betyr hver runde
      fra første til siste, og like mange kamper som sluttabellen sier at AaFK spilte — en
      hel kampliste, ikke en sesong der alt er kjent om hver kamp.
      {cupOpen > 0 && (
        <> {cupOpen} {cupOpen === 1 ? "år har hel serie, men" : "år har hel serie, men"} en
        cuprekke som slutter et sted laget ikke røk ut.</>
      )}
      {unverified > 0 && (
        <> {unverified} {unverified === 1 ? "sesong har" : "sesonger har"} sammenhengende runder
        uten at noen kilde sier hvor mange det skulle vært.</>
      )}
      {fragments > 0 && (
        <> {fragments} år har bare enkeltkamper vi kjenner til.</>
      )}
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
  // «Kvalifisering» alene er tvetydig: arkivet har også åtte kamper i UEFA
  // Europa League-kvalifiseringen, og de ligger under `european`. Dette er
  // opp- og nedrykkskvalifiseringen i seriesystemet.
  playoff: "Opp- og nedrykkskvalifisering",
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
  playoff: "opp- og nedrykkskvalifisering",
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
