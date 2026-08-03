import type { Metadata } from "next";
import { PromptCard } from "@/components/PromptCard";
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
          Bidragsskjemaet er ikke bygget ennå. I MVP-en bruker vi GitHub, slik at alle
          endringer kan kontrolleres før de blir del av arkivet.
        </p>
      </header>

      <div className="contribute-grid">
        <section className="archive-card">
          <span className="card-kicker">Raskest</span>
          <h2>Meld inn en feil</h2>
          <p>
            Oppgi kampdato, hva som er feil, riktig verdi og hvor opplysningen kan
            kontrolleres.
          </p>
          <a
            className="button-link"
            href="https://github.com/mlervaag/aafkstats/issues/new?title=Rettelse%3A%20"
          >
            Opprett GitHub-sak
          </a>
        </section>
        <section className="archive-card">
          <span className="card-kicker">For utviklere</span>
          <h2>Send en pull request</h2>
          <p>
            Dataene ligger som lesbare YAML-filer. Validering og tester kjører automatisk
            på alle forslag.
          </p>
          <a className="button-link secondary" href="https://github.com/mlervaag/aafkstats">
            Åpne repoet
          </a>
        </section>
      </div>

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
          {contributionPrompts.map((p) => (
            <div key={p.id}>
              <p className="prose prompt-intro">{p.description}</p>
              <PromptCard title={p.title} purpose={p.purpose} prompt={p.prompt} />
            </div>
          ))}
        </div>
      </section>

      <section className="content-section prose-stack">
        <h2>Hva som mangler mest</h2>
        <p>
          Arkivet er tynt før 2011 og har foreløpig ingen kampreferat. Kamper fra
          1914–2010, cupkamper og europakamper er der et bidrag monner mest. Se{" "}
          <a href="/sesonger">sesongoversikten</a> for hva som allerede ligger inne.
        </p>
      </section>
    </>
  );
}
