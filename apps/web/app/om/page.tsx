import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(
  "Om arkivet",
  "Hva AaFK-arkivet er, hva du finner her, og hvordan det åpne supporterprosjektet drives.",
  "/om",
  "website",
);

export default function AboutPage() {
  return (
    <article>
      <header className="page-intro"><p className="eyebrow">Om prosjektet</p><h1>Et søkbart minne om AaFK-kampene</h1><p className="lede">AaFK-arkivet er et uoffisielt fritidsprosjekt. Målet er å samle kamphistorien i en åpen struktur som kan kontrolleres, rettes og bygges videre på.</p></header>
      <div className="article-grid">
        <div className="prose-stack">
          <section>
            <h2>Hva er dette?</h2>
            <p>
              Et uoffisielt, åpent historisk arkiv for alle som vil finne igjen og undersøke
              AaFKs historie. Det er laget som et fritidsprosjekt, uten offisiell tilknytning
              til klubben.
            </p>
          </section>
          <section>
            <h2>Hva finner jeg her?</h2>
            <p>
              Kamper og sesonger, motstandere, personer, organisasjon, hjemmebaner og
              historiske kilder. Dekningen varierer: noen år har komplette seriesesonger,
              andre bare enkeltkamper eller kildedokumenterte resultater.
            </p>
          </section>
          <section>
            <h2>Hvor sikkert er innholdet?</h2>
            <p>
              Opplysninger skal kunne spores til en navngitt kilde. Uenigheter mellom kilder
              skjules ikke, og tomme perioder betyr at dokumentasjon mangler – ikke at noe
              sikkert ikke skjedde. <a href="/kilder#datakilder">Les om kilder, metode og rettigheter.</a>
            </p>
          </section>
          <section>
            <h2>Kan jeg bidra?</h2>
            <p>
              Ja. Du kan kontrollere en konkret kildeoppgave, dele et minne eller rette og
              legge til fakta. Ingenting publiseres automatisk; alle bidrag vurderes først.{" "}
              <a href="/bidra">Velg hvordan du vil bidra.</a>
            </p>
          </section>
          <section id="personvern">
            <h2>Hvem står bak, og hvordan drives det?</h2>
            <p>
              Koden er åpen, og arkivarbeidet drives på fritiden. Nettstedet teller
              sidevisninger og ytelse uten informasjonskapsler eller lagring av IP-adressen.
              Spørsmål du stiller til søket, lagres ikke i statistikken. Respekterer nettleseren
              din «ikke spor», sendes ingen målinger.
            </p>
          </section>
        </div>
        <aside className="facts-panel"><h2>Videre</h2><nav className="project-links" aria-label="Les mer om prosjektet"><a href="/kilder">Se kildene</a><a href="/data">Se datasettet</a><a href="#personvern">Les om personvern og måling</a><a href="https://github.com/mlervaag/aafkstats">Se prosjektet på GitHub</a></nav><dl><dt>Status</dt><dd>Aktivt, åpent supporterarkiv</dd><dt>Tilknytning</dt><dd>Ingen offisiell tilknytning til AaFK</dd><dt>Kode</dt><dd>MIT</dd><dt>Egne tekster</dt><dd>CC BY 4.0</dd></dl></aside>
      </div>
    </article>
  );
}
