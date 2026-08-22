import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { PromptCard } from "@/components/PromptCard";
import { GapNote } from "@/components/CoverageNote";
import { contributionIssueUrl } from "@/lib/contribution-links";
import { contributionPrompts } from "@/lib/prompts";
import { CONTACT_EMAIL } from "@/lib/site";
import { loadVerificationCases } from "@/lib/verifications";
import { ContributeVerificationCard } from "@/components/verifications/ContributeVerificationCard";

export const metadata: Metadata = pageMetadata(
  "Bidra",
  "Meld inn minner, feil og kilder om AaFKs kamper, personer, roller og historie.",
  "/bidra",
  "website",
);

export default function ContributePage() {
  const verificationCases = loadVerificationCases("open");
  const estimatedMinutes = verificationCases.map((item) => item.estimatedMinutes);
  const researchCaseCount = verificationCases.filter((item) => item.researchTask).length;
  const newspaperCaseCount = verificationCases.filter((item) => item.newspaper && !item.researchTask).length;
  const directCaseCount = verificationCases.filter((item) => !item.newspaper && !item.researchTask).length;

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Åpent arkiv</p>
        <h1>Hva vil du bidra med?</h1>
        <p className="lede">
          Velg det som passer. Du kan kontrollere en konkret sak eller dele et minne uten
          konto. Rettelser og nye data går gjennom korte skjema på GitHub, slik at vi får
          med alt vi trenger med én gang.
        </p>
      </header>

      <ContributeVerificationCard
        openCaseIds={verificationCases.map((item) => item.id)}
        researchCaseCount={researchCaseCount}
        newspaperCaseCount={newspaperCaseCount}
        directCaseCount={directCaseCount}
        minimumMinutes={estimatedMinutes.length ? Math.min(...estimatedMinutes) : 0}
        maximumMinutes={estimatedMinutes.length ? Math.max(...estimatedMinutes) : 0}
      />

      <div className="contribute-grid">
        <section className="archive-card">
          <span className="card-kicker">Har du noe å fortelle?</span>
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
            <a href={contributionIssueUrl("manglende-person")}>Meld en person som mangler</a>
            <a href={contributionIssueUrl("ny-kilde")}>Legg til kampdetaljer</a>
            <a href={contributionIssueUrl("klubbidentitet")}>Meld feil klubb eller navn</a>
            <a href={contributionIssueUrl("ny-arkivkilde")}>Tips om en kilde</a>
          </nav>
        </section>
      </div>

      <section className="content-section prose-stack">
        <h2>Hva skjer med bidraget mitt?</h2>
        <p>
          Ingenting publiseres automatisk. Bidrag blir kontrollert før de blir en del av
          arkivet. Minner vises som observasjoner, mens faktarettelser oppdaterer selve
          arkivdataene og beholder kildesporet.
        </p>
      </section>

      <details className="content-section advanced-contribution other-contributions">
        <summary>Andre måter å bidra på</summary>
        <div className="advanced-contribution-content">
      <section className="prose-stack">
        <h2>Send e-post</h2>
        <p>
          Har du bilder, dokumenter, et tips som ikke passer i skjemaene, eller vil du
          kontakte oss direkte? Skriv til <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      {/* Personregisteret hadde ingen vei inn for en person som manglet helt. «Meld
          en feil» retter en som allerede står der, og minneskjemaet krever en
          personside å stå på. Den som satt med et navn fra en årsmelding, fant
          ingen knapp som passet. */}
      <section className="content-section prose-stack">
        <h2>Mangler en person?</h2>
        <p>
          Bruk skjemaet <a href={contributionIssueUrl("manglende-person")}>Person som mangler</a>,
          eller gå til <a href="/personer">personregisteret</a> hvis du vil rette en som
          allerede finnes.
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
          <strong>Send opplysninger, ikke hele tekster.</strong> Ikke kopier artikler, boktekst
          eller kampreferat inn i bidraget. Send heller lenken eller kildehenvisningen til
          originalen.
        </div>
      </section>

      <section className="content-section">
          <h2>Bidra direkte med større datamengder</h2>
          <div className="prose-stack">
            <p>
              Skal du registrere mye på én gang, kan du arbeide direkte med datafilene. Du kan
              bruke AI som hjelp hvis du ønsker det; promptene under forklarer formatet og
              grensene modellen må følge.
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
      </section>

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
          Den komplette <a href="/mangler/oversikt">mangellista</a> viser historiske resultater
          som trenger identifisering, kampdetaljer som mangler og kildekonflikter
          som må avklares. For korte, konkrete oppgaver kan du bruke{" "}
          <a href="/mangler">kontrollkøen</a>, eller gå rett til{" "}
          <a href="/mangler/saker?type=avisresearch">avisresearch</a>.
        </p>
      </section>
        </div>
      </details>
    </>
  );
}
