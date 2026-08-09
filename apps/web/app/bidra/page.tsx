import type { Metadata } from "next";
import { PromptCard } from "@/components/PromptCard";
import { GapNote } from "@/components/CoverageNote";
import { contributionIssueUrl } from "@/lib/contribution-links";
import { contributionPrompts } from "@/lib/prompts";

export const metadata: Metadata = {
  title: "Bidra",
  description: "Meld inn feil, kilder og manglende AaFK-kamper — for hånd eller med AI-hjelp.",
};

export default function ContributePage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Åpent arkiv</p>
        <h1>Hva vil du bidra med?</h1>
        <p className="lede">
          Velg det som passer. Minner kan sendes uten konto. Rettelser og nye data bruker
          korte GitHub-skjema, slik at vi får opplysningene som trengs første gang.
        </p>
      </header>

      <div className="contribute-grid">
        <section className="archive-card">
          <span className="card-kicker">Raskest</span>
          <h2>Del et minne</h2>
          <p>
            Finn kampen eller sesongen og trykk «Bidra». Skjemaet kjenner allerede stedet
            og kan sendes uten innlogging.
          </p>
          <a className="button-link" href="/sesonger">
            Finn kampen
          </a>
        </section>
        <section className="archive-card">
          <span className="card-kicker">Rett sted med én gang</span>
          <h2>Rett eller legg til data</h2>
          <p>
            Velg et ferdig skjema. GitHub-konto kreves, men du slipper å kjenne arkivets
            filformat eller vite hvor rettelsen hører hjemme.
          </p>
          <nav className="contribution-template-links" aria-label="GitHub-skjema for bidrag">
            <a href={contributionIssueUrl("datafeil")}>Meld en feil</a>
            <a href={contributionIssueUrl("manglende-kamp")}>Meld en kamp som mangler</a>
            <a href={contributionIssueUrl("ny-kilde")}>Legg til kampdetaljer</a>
            <a href={contributionIssueUrl("ny-arkivkilde")}>Tips om en kilde</a>
          </nav>
        </section>
      </div>

      <section className="content-section prose-stack">
        <h2>Hva som skjer etterpå</h2>
        <p>
          Ingenting går rett i arkivet. Minner havner i en egen innboks. Feil og nye data
          blir GitHub-saker med riktig mal. Begge deler blir kontrollert før noe publiseres.
        </p>
        <p>
          Et godkjent minne vises under «Observasjoner og minner», merket med hvor sikkert
          det er. En datarettelse endrer i stedet den aktuelle kampen eller kilden, med et
          synlig spor i git.
        </p>
      </section>

      <section className="content-section prose-stack">
        <h2>Et godt bidrag inneholder</h2>
        <ul>
          <li>kampdato og motstander</li>
          <li>feltet som skal legges til eller rettes</li>
          <li>lenke til en etterprøvbar kilde</li>
          <li>en kort forklaring hvis kildene er uenige</li>
        </ul>
        <div className="notice">
          <strong>Ikke kopier kampreferat.</strong> Send lenken til originalen.
          Opphavsrettsbeskyttet tekst skal ikke inn i arkivet.
        </div>
      </section>

      <details className="content-section advanced-contribution">
        <summary>Vil du gjøre en større datajobb med AI?</summary>
        <div className="advanced-contribution-content">
          <h2 className="sr-only">Bruk AI-en du allerede har</h2>
          <div className="prose-stack">
            <p>
              Du trenger ikke kunne YAML for å bidra. Kopier en av promptene under inn i
              modellen du bruker til vanlig, fyll inn det du vet om kampen, og la den skrive
              filen. Da holder det at <em>du</em> har kildene og kontrollerer resultatet.
            </p>
            <p>
              Promptene forteller modellen hvordan arkivet er bygget opp, og — viktigere — hva
              den <strong>ikke</strong> skal gjøre: gjette på fakta den ikke finner, og kopiere
              eller omskrive referattekst fra en avis. Begge deler skjer lett om man ikke ber
              om noe annet.
            </p>
            <div className="notice">
              <strong>Les alltid gjennom før du sender.</strong> En språkmodell kan finne på
              et tilskuertall eller en målscorer som ser helt rimelig ut. Vi kontrollerer alle
              bidrag, men det er langt lettere for oss om du har sjekket fakta mot kilden din
              først.
            </div>
          </div>

          <div className="prompt-list">
            {contributionPrompts().map((p) => (
              <div key={p.id}>
                <p className="prose prompt-intro">{p.description}</p>
                <PromptCard title={p.title} purpose={p.purpose} prompt={p.prompt} />
              </div>
            ))}
          </div>
        </div>
      </details>

      <section className="content-section prose-stack">
        <h2>Hva som mangler mest</h2>
        <GapNote />
        <p>
          Se <a href="/sesonger">sesongoversikten</a> for hva som allerede ligger inne.
        </p>
      </section>
    </>
  );
}
