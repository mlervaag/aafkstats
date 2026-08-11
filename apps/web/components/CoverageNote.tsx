import { open } from "@aafkstats/db";
import { coverageFacts, readCoverage } from "@aafkstats/query/coverage";
import type { DatasetCoverage } from "@aafkstats/query/coverage";
import { TYPE_WORDS } from "@/components/Coverage";
import { loadCoverage } from "@/lib/archive";
import type { ArchiveCoverage } from "@/lib/archive";

/**
 * Setningen som beskriver hva arkivet inneholder, regnet ut fra arkivet selv.
 *
 * Tallene sto tidligere som tekst i seks sider og var gale dagen etter hver
 * innhøsting. Her finnes de ett sted, og de kan ikke bli utdaterte uten at
 * dataene faktisk endrer seg.
 */
export function coverageSentence(c: ArchiveCoverage): string {
  const span =
    c.firstSeason && c.lastSeason
      ? c.firstSeason === c.lastSeason
        ? ` fra ${c.firstSeason}`
        : ` fra ${c.firstSeason} til ${c.lastSeason}`
      : "";
  return `${c.matches} kamper${span}`;
}

/**
 * Kamper per konkurranse, som en liste.
 *
 * Sto som en setning med sju ledd i, og da leses den ikke — den hoppes over.
 * Rader kan skummes, og de kan sammenlignes med øyet.
 */
export function CompetitionTable() {
  const c = loadCoverage();
  if (c.byCompetition.length === 0) return null;
  const total = c.byCompetition.reduce((sum, row) => sum + row.matches, 0);

  return (
    <ul className="breakdown">
      {c.byCompetition.map((row) => (
        <li key={row.competition}>
          <span>{row.competition}</span>
          {/* Andelen tegnes, ikke skrives. Med sju rader er forholdet mellom dem
              poenget, og et prosenttall per rad ville vært sju tall å veie mot
              hverandre i hodet. */}
          <span className="breakdown-bar" aria-hidden="true">
            <span style={{ width: `${Math.round((row.matches / total) * 100)}%` }} />
          </span>
          <strong className="num">{row.matches}</strong>
        </li>
      ))}
    </ul>
  );
}

/**
 * Hva som mangler, regnet ut fra hva som finnes.
 *
 * AaFK ble stiftet i 1914, så alt mellom stiftelsen og arkivets første sesong er
 * et hull. Setningen sto tidligere som «før 2011» i to sider og ble gal i samme
 * øyeblikk som den første eldre sesongen ble hentet.
 */
const FOUNDED = 1914;

export function GapNote() {
  const c = loadCoverage();
  if (!c.firstSeason) return null;
  const gap = c.firstSeason - FOUNDED;

  // Sto som «Europacupkampene mangler helt» mens arkivet hadde fjorten av dem.
  // En håndskrevet påstand om hva som mangler blir gal i samme øyeblikk som
  // noen fyller hullet, og da er det siden som lyver, ikke dataene.
  const present = new Set(c.byCompetition.map((row) => row.type));
  const missing = Object.keys(TYPE_WORDS).filter((type) => !present.has(type));

  return (
    <p className="prose">
      {gap > 0 ? (
        <>
          Arkivet mangler fortsatt de {gap} årene fra {FOUNDED} til {c.firstSeason - 1}, fordi
          protokollene som skal til for å hente dem ut enten mangler eller ikke er tilgjengelige.{" "}
        </>
      ) : null}
      {missing.length > 0 && (
        <>
          {capitalize(missing.map((type) => TYPE_WORDS[type]).join(" og "))} mangler helt
          {c.withReport === 0 ? ", og ingen kamper har kampreferat ennå" : ""}.{" "}
        </>
      )}
      {missing.length === 0 && c.withReport === 0 && (
        <>Ingen kamper har kampreferat ennå.{" "}</>
      )}
      <a href="/bidra">Bidrag</a> monner mest der.
    </p>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Hva arkivet har, og hvor dypt.
 *
 * Var én lang setning med sju konkurranser, to andeler og et forbehold i seg.
 * Den sa alt og ble lest av ingen. Nå er det tre tall og én setning om hullet;
 * fordelingen per konkurranse hører hjemme på `/data`, der den kan ta plassen
 * den trenger.
 */
export function CoverageNote({ heading = true }: { heading?: boolean }) {
  const c = loadCoverage();
  const detailShare = c.matches === 0 ? 0 : Math.round((c.withEvents / c.matches) * 100);

  return (
    <div className="notice prose">
      {heading && <strong>Slik ser arkivet ut nå: </strong>}
      {coverageSentence(c)}.{" "}
      {c.withEvents > 0
        ? `${c.withEvents} av dem (${detailShare} %) har hendelser som mål og kort, og ${c.withAttendance} har tilskuertall.`
        : "Ingen av dem har hendelsesdata ennå."}{" "}
      {c.withReport === 0 ? (
        <>
          Kampreferat mangler helt, og det er nettopp der{" "}
          <a href="/bidra">minner og observasjoner fra leserne</a> gjør størst nytte.
        </>
      ) : (
        <>{c.withReport} har kampreferat.</>
      )}
    </div>
  );
}

/**
 * Dekningspåstandene modellen får, vist for mennesker.
 *
 * Nøyaktig de samme setningene, fra nøyaktig den samme funksjonen. Det er hele
 * poenget: den som lurer på hva spørrefunksjonen tror om arkivet, kan lese det
 * her og se at det stemmer med tallene lenger oppe på siden.
 */
export function PromptCoverage() {
  const db = open();
  let facts: string[];
  try {
    facts = coverageFacts(readCoverage(db));
  } finally {
    db.close();
  }

  return (
    <ul className="prose" style={{ paddingLeft: "1.1rem" }}>
      {facts.map((fact) => (
        <li key={fact}>{fact}</li>
      ))}
    </ul>
  );
}

/**
 * De viktigste dekningsmålene for en leser som vil forstå datasettet.
 *
 * Systemprompten trenger alle de tekniske dekningsfaktaene. På datasiden er
 * det mer nyttig å vise omfang, dybde og hvor mye som er kontrollert, uten å
 * blande inn resolverstatus og interne tabellnavn.
 */
export function DatasetHighlights() {
  const db = open();
  let c: DatasetCoverage;
  try {
    c = readCoverage(db);
  } finally {
    db.close();
  }

  const span =
    c.firstSeason && c.lastSeason
      ? c.firstSeason === c.lastSeason
        ? `i ${c.firstSeason}`
        : `fra ${c.firstSeason} til ${c.lastSeason}`
      : "i arkivet";

  return (
    <>
      <ul className="prose" style={{ paddingLeft: "1.1rem" }}>
        <li>
          <strong>{c.played} spilte kamper</strong> {span}, fordelt på {c.years} år.
        </li>
        <li>
          <strong>
            {c.completeLeagueSeasons} av {c.finishedLeagueSeasons} avsluttede seriesesonger
          </strong>{" "}
          har komplett dekning fra første til siste runde.
        </li>
        <li>
          Kampene har ulik detaljgrad: {c.withEvents} har hendelser som mål og kort, {c.withLineups}{" "}
          har lagoppstilling og {c.withAttendance} har tilskuertall.
        </li>
        <li>
          <strong>{c.people} personer</strong> er registrert med {c.personRoles} kontrollerte
          roller eller verv.
        </li>
      </ul>
      <p className="prose small muted">
        Dekningen følger kildene. At en detalj mangler, betyr derfor ikke nødvendigvis at
        den ikke fantes eller skjedde.
      </p>
    </>
  );
}

/**
 * Forskjellen på et representert år og en komplett sesong.
 *
 * «87 sesonger» betyr her 87 år med minst én registrert kamp, og en
 * leser som ser tallet på forsiden har ingen grunn til å lese det slik. Setningen
 * her sier begge tallene ved siden av hverandre, regnet ut av arkivet selv.
 */
export function SeasonDepth() {
  const db = open();
  let c: DatasetCoverage;
  try {
    c = readCoverage(db);
  } finally {
    db.close();
  }

  return (
    <p className="prose">
      {c.years} år har minst én registrert kamp. Det betyr ikke at alle disse sesongene er
      komplette. Av de {c.finishedLeagueSeasons} avsluttede serieårene arkivet har, er{" "}
      {c.completeLeagueSeasons} merket som komplette, altså med alle runder fra den første
      til den siste uten hull. Resten har kamper, men ikke hele rekka. En sesong som fortsatt
      pågår, holdes utenfor, siden den ikke kan være komplett ennå. Cupen kan ikke måles på
      samme måte, for der slutter sesongen når laget ryker ut.
    </p>
  );
}
