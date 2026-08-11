import type { Metadata } from "next";
import { PromptCard } from "@/components/PromptCard";
import { GapNote } from "@/components/CoverageNote";
import { contributionIssueUrl } from "@/lib/contribution-links";
import { contributionPrompts } from "@/lib/prompts";

export const metadata: Metadata = {
  title: "Bidra",
  description: "Meld inn minner, feil og kilder om AaFKs kamper, personer, roller og historie.",
};

export default function ContributePage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Åpent arkiv</p>
        <h1>Hva vil du bidra med?</h1>
        <p className="lede">
          Velg det som passer. Minner og observasjoner kan du sende inn uten konto. Rettelser
          og nye data går gjennom korte skjema på GitHub, slik at vi får med alt vi trenger
          med én gang.
        </p>
      </header>

      <div className="contribute-grid">
        <section className="archive-card">
          <span className="card-kicker">Raskest</span>
          <h2>Del et minne</h2>
          <p>
            Finn kampen, sesongen eller personen det gjelder, og trykk «Bidra». Skjemaet vet
            allerede hvor du er, og du trenger ikke logge inn.
          </p>
          <nav className="contribution-template-links" aria-label="Finn siden du vil bidra på">
            <a href="/sesonger">Finn kamp eller sesong</a>
            <a href="/personer">Finn person</a>
          </nav>
        </section>
        <section className="archive-card">
          <span className="card-kicker">Rett sted med én gang</span>
          <h2>Rett eller legg til data</h2>
          <p>
            Velg et ferdig skjema. Du trenger en GitHub-konto, men du slipper å kunne
            arkivets filformat eller vite hvor rettelsen hører hjemme.
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
          Ingenting går rett inn i arkivet. Minner havner i en egen innboks, mens feil og
          nye data blir saker på GitHub. Begge deler blir kontrollert før noe publiseres.
        </p>
        <p>
          Et godkjent minne vises under «Observasjoner og minner», merket med hvor sikkert
          det er. En datarettelse endrer i stedet selve kampen, personen, rollen eller
          kilden, og endringen får et synlig spor i historikken.
        </p>
      </section>

      <section className="content-section prose-stack">
        <h2>Et godt bidrag inneholder</h2>
        <ul>
          <li>hvilken kamp, person, rolle eller annen del av arkivet det gjelder</li>
          <li>opplysningen som skal legges til eller rettes</li>
          <li>lenke til en etterprøvbar kilde</li>
          <li>en kort forklaring hvis kildene er uenige</li>
        </ul>
        <div className="notice">
          <strong>Send fakta, ikke brødtekst.</strong> Ikke kopier artikler, boktekst eller
          kampreferat inn i bidraget. Send heller lenken eller kildehenvisningen til
          originalen.
        </div>
      </section>

      <details className="content-section advanced-contribution">
        <summary>Vil du gjøre en større datajobb med AI?</summary>
        <div className="advanced-contribution-content">
          <h2 className="sr-only">Bruk AI-en du allerede har</h2>
          <div className="prose-stack">
            <p>
              Du trenger ikke kunne YAML for å bidra. Kopier en av promptene under inn i den
              modellen du bruker til vanlig, fyll inn det du vet om kampen eller personen, og
              la modellen skrive filen. Da holder det at <em>du</em> har kildene og
              kontrollerer resultatet.
            </p>
            <p>
              Promptene forteller modellen hvordan arkivet er bygget opp, og, enda viktigere,
              hva den <strong>ikke</strong> skal gjøre: gjette på fakta den ikke finner, eller
              kopiere og omskrive tekst fra en bok eller en avis. Begge deler skjer lett om
              man ikke ber om noe annet.
            </p>
            <div className="notice">
              <strong>Les alltid gjennom før du sender.</strong> En språkmodell kan finne på
              et tilskuertall eller en målscorer som ser helt rimelig ut. Vi kontrollerer alle
              bidrag, men jobben blir langt enklere om du har sjekket opplysningene mot kilden
              din først.
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
          Se <a href="/sesonger">sesongoversikten</a> og <a href="/personer">personregisteret</a> for hva som allerede ligger inne.
        </p>
      </section>
    </>
  );
}
