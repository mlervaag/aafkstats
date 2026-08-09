import type { Metadata } from "next";
import { PromptCard } from "@/components/PromptCard";
import { GapNote } from "@/components/CoverageNote";
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
        <h1>Har du en rettelse eller kilde?</h1>
        <p className="lede">
          Bidrag legges inn der de hører hjemme: på kampen eller sesongen de gjelder. Hver
          kampside har en knapp som åpner skjemaet med kampen allerede valgt, så du slipper
          å forklare hvilken kamp du mener.
        </p>
      </header>

      <div className="contribute-grid">
        <section className="archive-card">
          <span className="card-kicker">Raskest</span>
          <h2>Bidra fra kampsiden</h2>
          <p>
            Finn kampen eller sesongen, og bruk «Bidra om kampen». Du kan dele et minne,
            melde en feil i kampfakta eller legge til en kilde — uten konto, uten innlogging.
          </p>
          <a className="button-link" href="/sesonger">
            Finn kampen
          </a>
        </section>
        <section className="archive-card">
          <span className="card-kicker">For utviklere</span>
          <h2>GitHub-sak eller pull request</h2>
          <p>
            Gjelder det noe større — en kamp som mangler helt, en ny datakilde eller koden —
            er malene på GitHub bedre egnet. Dataene ligger som lesbare YAML-filer.
          </p>
          <a
            className="button-link secondary"
            href="https://github.com/mlervaag/aafkstats/issues/new/choose"
          >
            Opprett GitHub-sak
          </a>
        </section>
      </div>

      <section className="content-section prose-stack">
        <h2>Hva som skjer etterpå</h2>
        <p>
          Et bidrag går ikke rett i arkivet. Det havner i en innboks og blir liggende til
          noen har vurdert det — og den vurderingen er den samme uansett om den gjøres for
          hånd eller av en agent: finnes kampen, motsier innspillet noe som allerede er
          registrert med kilde, holder en oppgitt lenke, og var spilleren du nevner faktisk i
          klubben det året.
        </p>
        <p>
          Holder det, blir bidraget en fil i arkivet og dukker opp på kampsiden under
          «Observasjoner og minner», merket med hvor sikkert det er. Uten kilde står det som
          <em> ubekreftet</em> — det er ingen dom over minnet ditt, bare en opplysning til
          neste leser. Et bidrag endrer aldri selve kampfakta; mener du at et resultat er
          feil, blir det en egen sak.
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

      <section className="content-section">
        <h2>Bruk AI-en du allerede har</h2>
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
      </section>

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
