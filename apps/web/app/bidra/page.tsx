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
          Velg det som passer. Minner og observasjoner kan sendes uten konto. Rettelser og nye data bruker
          korte GitHub-skjema, slik at vi får opplysningene som trengs første gang.
        </p>
      </header>

      <div className="contribute-grid">
        <section className="archive-card">
          <span className="card-kicker">Raskest</span>
          <h2>Del et minne</h2>
          <p>
            Finn kampen, sesongen eller personen og trykk «Bidra». Skjemaet kjenner allerede stedet
            og kan sendes uten innlogging.
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
            Velg et ferdig skjema. GitHub-konto kreves, men du slipper å kjenne arkivets
            filformat eller vite hvor rettelsen hører hjemme.
          </p>
          <nav className="contribution-template-links" aria-label="GitHub-skjema for bidrag">
            <a href={contributionIssueUrl("datafeil")}>Meld en feil</a>
            <a href={contributionIssueUrl("manglende-kamp")}>Meld en kamp som mangler</a>
            <a href={contributionIssueUrl("manglende-person")}>Meld en person som mangler</a>
            <a href={contributionIssueUrl("ny-kilde")}>Legg til kampdetaljer</a>
            <a href={contributionIssueUrl("klubbidentitet")}>Meld feil klubb eller navn</a>
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
          det er. En datarettelse endrer i stedet den aktuelle kampen, personen, rollen eller kilden, med et
          synlig spor i git.
        </p>
      </section>

      {/* Personregisteret hadde ingen vei inn for en person som manglet helt. «Meld
          en feil» retter en som allerede står der, og minneskjemaet krever en
          personside å stå på. Den som satt med et navn fra en årsmelding, fant
          ingen knapp som passet. */}
      <section className="content-section prose-stack">
        <h2>Personer i arkivet</h2>
        <p>
          Personregisteret er ikke en liste over alle som har spilt for klubben. En person får
          en egen oppføring når det er noe å si om henne eller ham: et verv, en trenerperiode,
          en skrivemåte av navnet som må knyttes til riktig person, eller et draktnummer. En
          spiller som bare står som et navn i en lagoppstilling, er allerede med i statistikken
          uten å ha en oppføring.
        </p>
        <p>
          Mangler noen helt, bruk{" "}
          <a href={contributionIssueUrl("manglende-person")}>Person som mangler</a>. Står
          personen der med feil årstall eller feil verv, bruk{" "}
          <a href={contributionIssueUrl("datafeil")}>Meld en feil</a>. Har du et minne om en
          person som allerede har en side, finner du «Bidra»-knappen på siden hennes eller hans.
        </p>
        <p>
          Vi fører bare det som knytter personen til AaFK. Fødselsdato, karriere og
          klubbhistorikk hører hjemme på Wikipedia og Wikidata, og arkivet lenker dit framfor
          å kopiere det hit. Historiske titler beholdes slik kilden skriver dem: sto det
          «Formann», står det «Formann».
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
          <strong>Hent fakta, ikke brødtekst.</strong> Ikke kopier artikler, boktekst eller
          kampreferat. Send lenken eller den bibliografiske referansen til originalen.
        </div>
      </section>

      <details className="content-section advanced-contribution">
        <summary>Vil du gjøre en større datajobb med AI?</summary>
        <div className="advanced-contribution-content">
          <h2 className="sr-only">Bruk AI-en du allerede har</h2>
          <div className="prose-stack">
            <p>
              Du trenger ikke kunne YAML for å bidra. Kopier en av promptene under inn i
              modellen du bruker til vanlig, fyll inn det du vet om kampen eller personen, og la den skrive
              filen. Da holder det at <em>du</em> har kildene og kontrollerer resultatet.
            </p>
            <p>
              Promptene forteller modellen hvordan arkivet er bygget opp, og — viktigere — hva
              den <strong>ikke</strong> skal gjøre: gjette på fakta den ikke finner, og kopiere
              eller omskrive tekst fra en bok eller avis. Begge deler skjer lett om man ikke ber
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

      {/* Nettstedet hadde ingen vei til «feil-i-koden» eller «forslag». De to
          malene fantes bare for den som allerede sto i GitHubs malvelger, og en
          leser som fant en ødelagt side hadde ingen annen knapp enn «Meld en
          feil», som handler om arkivet og ikke om koden. */}
      <section className="content-section prose-stack">
        <h2>Noe annet enn data</h2>
        <p>
          Er en side ødelagt, gir søket feil treff eller svarer spørrefunksjonen noe rart,
          er det ikke en feil i arkivet, men i koden. Har du en idé, eller lurer du bare på
          hvordan noe henger sammen, er det også plass til det.
        </p>
        <nav className="contribution-template-links" aria-label="GitHub-skjema for kode og forslag">
          <a href={contributionIssueUrl("feil-i-koden")}>Meld en feil på nettstedet</a>
          <a href={contributionIssueUrl("forslag")}>Foreslå noe, eller spør</a>
        </nav>
      </section>

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
