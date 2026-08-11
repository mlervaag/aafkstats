import type { Metadata } from "next";
import { contributionIssueUrl } from "@/lib/contribution-links";
import { pageMetadata } from "@/lib/metadata";
import { loadMissingOverview } from "@/lib/missing";
import styles from "./Missing.module.css";

export const metadata: Metadata = pageMetadata(
  "Hva mangler?",
  "En oppdatert arbeidskø over historiske resultater, kampdetaljer og kildekonflikter som AaFK-arkivet trenger hjelp med.",
  "/mangler",
  "website",
);

const FIELD_LABELS: Record<string, string> = {
  report: "Kampreferat",
  referee: "Dommer",
  attendance: "Tilskuertall",
  lineups: "Lagoppstilling",
  venue: "Bane",
  events: "Kamphendelser",
  score: "Resultat",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** «formann.1968» blir «formann, 1968». Feltet er vervet og året, med punktum imellom. */
function conflictLabel(field: string): string {
  const [role, year] = field.split(".");
  return year ? `${role}, ${year}` : field;
}

const COVERAGE_LABELS: Record<string, string> = {
  partial: "Runder mangler",
  unverified: "Omfanget er ukjent",
  isolated: "Kampene mangler rundenummer",
};

/**
 * Køen er tom, og det skal siden si.
 *
 * Uten dette rendret hver seksjon ubetinget. En tømt kø ble til «0 verv hos 0
 * personer har motstridende kildeopplysninger» over en tom liste, med en knapp
 * som ba om hjelp til ingenting. På en side som finnes for å vise hva som
 * gjenstår, leses det som en feil framfor som det det er: at jobben er gjort.
 *
 * Seksjonen blir stående med overskriften sin. Å la den forsvinne ville gjort
 * det umulig å se forskjell på «ingenting igjen her» og «denne køen finnes ikke».
 */
function Done({ children }: { children: React.ReactNode }) {
  return <p className="muted">{children}</p>;
}

function candidateContext(title: string, page: string, season: number | null): string {
  const year = season === null ? "ukjent år" : String(season);
  return `Lagoppstilling i ${title}, side ${page} (${year})`;
}

export default function MissingPage() {
  const missing = loadMissingOverview();

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Arkivets arbeidskø</p>
        <h1>Hva mangler i AaFK-arkivet?</h1>
        <p className="lede">
          Arkivet vet allerede hvor kunnskapen er tynn. Her samles de tydeligste
          hullene og uenighetene, slik at en kilde, et programblad eller et minne
          kan finne veien til riktig sted.
        </p>
      </header>

      <section className={styles.principle} aria-labelledby="mangler-betyr">
        <h2 id="mangler-betyr">«Mangler» betyr ikke «skjedde ikke»</h2>
        <p>
          Det betyr at arkivet ikke har nok dokumentasjon ennå. Maskinelle funn blir
          stående som kandidater, og kilder som er uenige får være uenige til et
          menneske kan kontrollere dem. Ingen oppgave her løses ved å gjette.
        </p>
      </section>

      <dl className={styles.summary} aria-label="Arbeidskø i tall">
        <div>
          <dt>Historiske resultater å identifisere</dt>
          <dd>{missing.historicalResults.total}</dd>
        </div>
        <div>
          <dt>Personer med uavklart kildekonflikt</dt>
          <dd>{missing.unresolvedPeople.people}</dd>
        </div>
        <div>
          <dt>Lagoppstillingskandidater å kontrollere</dt>
          <dd>{missing.lineupReview.candidates}</dd>
        </div>
      </dl>

      <section className={styles.section} id="historiske-resultater">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Eldre AaFK</p>
            <h2>Finn datoen bak et resultat</h2>
          </div>
          <p>
            Disse resultatene står i historiske kilder, men mangler sikker dato,
            hjemme–borte-status eller annen informasjon som trengs for å bli en
            kanonisk kamp. Sesongsiden viser hvert resultat og den konkrete kilden.
          </p>
        </div>
        {missing.historicalResults.total === 0 ? (
          <Done>
            Alle kildedokumenterte resultater er identifisert og knyttet til en kamp.
          </Done>
        ) : (
          <>
            <ul className={styles.yearList}>
              {missing.historicalResults.seasons.map((row) => (
                <li key={row.season}>
                  <a href={`/sesong/${row.season}`}>
                    <strong>{row.season}</strong>
                    <span>{row.results}</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <a className="button-link" href={contributionIssueUrl("manglende-kamp", "Historisk resultat")}>Hjelp med et resultat</a>
              <a className="button-link secondary" href="/sesonger">Se alle sesonger</a>
            </div>
          </>
        )}
      </section>

      {/* Dekningen har vært et merke på sesongsida, men aldri en oppgave noen
          kunne se samlet. En sesong uten rundenummer er like konkret et hull som
          et manglende tilskuertall, og den løses av den samme typen kilde. */}
      <section className={styles.section} id="sesongdekning">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Sesonger</p>
            <h2>Gjør en sesong hel</h2>
          </div>
          <p>
            En seriesesong regnes som komplett når rundene går fra første til siste uten
            hull, og kampantallet stemmer med et kjent omfang. Disse sesongene har kamper,
            men mangler noe av det som skal til for å si at de er hele.
          </p>
        </div>
        {missing.incompleteSeasons.length === 0 ? (
          <Done>Alle avsluttede seriesesonger arkivet dekker, er komplette.</Done>
        ) : (
          <>
            <ul className={styles.personList}>
              {missing.incompleteSeasons.map((row) => (
                <li key={`${row.season}-${row.competition}`}>
                  <a href={row.url}>
                    <strong>{row.season} {row.competition}</strong>
                  </a>
                  <span>
                    {COVERAGE_LABELS[row.coverage] ?? row.coverage}
                    {" · "}
                    {row.expected === null
                      ? `${row.played} kamper registrert`
                      : `${row.played} av ${row.expected} kamper`}
                  </span>
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <a className="button-link" href={contributionIssueUrl("ny-arkivkilde", "Sesongdekning")}>Tips om en kilde</a>
              <a className="button-link secondary" href="/sesonger">Se alle sesonger</a>
            </div>
          </>
        )}
      </section>

      <section className={styles.section} id="kampdetaljer">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Kampene vi har</p>
            <h2>Fyll inn det som mangler</h2>
          </div>
          <p>
            Dette er felter som mangler i de {missing.playedMatches} spilte kampene.
            Tallene overlapper: samme kamp kan mangle både lagoppstilling og dommer.
            På hver sesongside står den samme køen avgrenset til det året.
          </p>
        </div>
        {missing.matchFields.length === 0 ? (
          <Done>Hver spilte kamp har alt arkivet pleier å registrere.</Done>
        ) : (
          <>
            <dl className={styles.fieldGrid}>
              {missing.matchFields.map((gap) => (
                <div key={gap.field}>
                  <dt>{fieldLabel(gap.field)}</dt>
                  <dd>{gap.matches}</dd>
                </div>
              ))}
            </dl>
            <div className={styles.actions}>
              <a className="button-link" href={contributionIssueUrl("ny-kilde", "Manglende kampdetaljer")}>Legg til kampdetaljer</a>
              <a className="button-link secondary" href="/sesonger">Velg en sesong</a>
            </div>
          </>
        )}
      </section>

      <section className={styles.section} id="personkonflikter">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Kildene er uenige</p>
            <h2>Avklar historiske verv</h2>
          </div>
          <p>
            Der to kilder oppgir ulike navn for samme verv, står begge versjonene på
            personsida med hver sin kilde. Arkivet velger ingen av dem automatisk, og en
            uenighet blir stående til et menneske kan avgjøre den med belegg.
          </p>
        </div>
        {missing.unresolvedPeople.people === 0 ? (
          <Done>Ingen verv står med uavklart uenighet mellom kildene nå.</Done>
        ) : (
          <>
            <p className={styles.method}>
              {missing.unresolvedPeople.conflicts} verv hos {missing.unresolvedPeople.people}{" "}
              {missing.unresolvedPeople.people === 1 ? "person" : "personer"} venter på en avklaring.
            </p>
            <ul className={styles.personList}>
              {missing.unresolvedPeople.items.map((person) => (
                <li key={person.id}>
                  <a href={person.url}><strong>{person.name}</strong></a>
                  <span>{person.fields.map(conflictLabel).join(" · ")}</span>
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <a className="button-link" href={contributionIssueUrl("datafeil", "Uavklart personverv")}>Send en kilde</a>
              <a className="button-link secondary" href="/organisasjon">Se organisasjonshistorien</a>
            </div>
          </>
        )}
      </section>

      <section className={styles.section} id="kildekontroll">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Redaksjonell kontroll</p>
            <h2>Knytt lagoppstillinger til riktig kamp</h2>
          </div>
          <p>
            Mulige lagoppstillinger som er lest ut maskinelt fra historiske publikasjoner,
            men som ikke kan kobles sikkert til en kamp. De er kandidater, ikke publiserte
            lagoppstillinger. Åpne en publikasjon for å se side, mulig år og navnene som kan
            gjøre kampen gjenkjennelig.
          </p>
        </div>
        {missing.lineupReview.candidates === 0 ? (
          <Done>
            Ingen lagoppstillingskandidater venter på kontroll. Nye kommer inn når flere
            publikasjoner analyseres.
          </Done>
        ) : (
        <>
        <p className={styles.method}>
          {missing.lineupReview.candidates} kandidater fra {missing.lineupReview.sources}{" "}
          {missing.lineupReview.sources === 1 ? "publikasjon" : "publikasjoner"}.
        </p>
        <div className={styles.candidateSources}>
          {missing.lineupReview.items.map((source) => (
            <details className={styles.candidateSource} key={source.sourceId}>
              <summary>
                <strong>{source.title}</strong>
                <span>{source.candidates.length} kandidater</span>
              </summary>
              <div className={styles.sourceActions}>
                <a href={source.url}>Om publikasjonen</a>
                {source.sourceUrl && <a href={source.sourceUrl}>Åpne originalen</a>}
              </div>
              <ol className={styles.candidateList}>
                {source.candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <div className={styles.candidateMeta}>
                      <span>Side {candidate.page}</span>
                      <span>{candidate.season === null ? "År ukjent" : `Mulig år: ${candidate.season}`}</span>
                      <span>{candidate.personIds.length} av {candidate.names.length} navn koblet til personer</span>
                    </div>
                    <p>{candidate.names.join(" · ")}</p>
                    <a
                      className={styles.candidateAction}
                      href={contributionIssueUrl(
                        "manglende-kamp",
                        candidateContext(source.title, candidate.page, candidate.season),
                      )}
                    >
                      Jeg kjenner igjen kampen
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
        <p className={styles.method}>
          Årstallet er bare en pekepinn fra teksten rundt oppstillingen. Et bidrag bør
          derfor si hvilken kamp det gjelder og vise til en kilde som bekrefter koblingen.
        </p>
        <div className={styles.actions}>
          <a className="button-link" href={contributionIssueUrl("ny-arkivkilde", "Lagoppstilling")}>Tips om en kilde</a>
          <a className="button-link secondary" href="/kilder">Se kildearkivet</a>
        </div>
        </>
        )}
      </section>
    </>
  );
}
