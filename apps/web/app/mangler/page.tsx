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

function conflictLabel(field: string): string {
  const [role, year] = field.split(".");
  const title = role === "formann" ? "formann" : role === "oppmann" ? "oppmann" : role;
  return year ? `${title}, ${year}` : title;
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
      </section>

      <section className={styles.section} id="personkonflikter">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Kildene er uenige</p>
            <h2>Avklar historiske verv</h2>
          </div>
          <p>
            {missing.unresolvedPeople.conflicts} verv hos {missing.unresolvedPeople.people} personer
            har motstridende kildeopplysninger. Personsidene viser begge versjonene og
            hvor de kommer fra; arkivet velger ingen av dem automatisk.
          </p>
        </div>
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
      </section>

      <section className={styles.section} id="kildekontroll">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Redaksjonell kontroll</p>
            <h2>Knytt lagoppstillinger til riktig kamp</h2>
          </div>
          <p>
            {missing.lineupReview.candidates} mulige lagoppstillinger fra {missing.lineupReview.sources} historiske
            publikasjoner er lest ut maskinelt, men kan ikke kobles sikkert til en kamp.
            De er kandidater, ikke publiserte lagoppstillinger. Kildesiden er startpunktet
            for kontroll mot originalen.
          </p>
        </div>
        <ul className={styles.sourceList}>
          {missing.lineupReview.items.map((source) => (
            <li key={source.sourceId}>
              <a href={source.url}><strong>{source.title}</strong></a>
              <span>{source.candidates} kandidater</span>
            </li>
          ))}
        </ul>
        <p className={styles.method}>
          Denne delen er først og fremst for redaksjonell gjennomgang. Har du tilgang til
          en bedre eller mer presis kilde, kan du i stedet tipse arkivet direkte.
        </p>
        <div className={styles.actions}>
          <a className="button-link" href={contributionIssueUrl("ny-arkivkilde", "Lagoppstilling")}>Tips om en kilde</a>
          <a className="button-link secondary" href="/kilder">Se kildearkivet</a>
        </div>
      </section>
    </>
  );
}
