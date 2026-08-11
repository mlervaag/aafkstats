import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { CoverageNote, GapNote, SeasonDepth } from "@/components/CoverageNote";
import { SourceRights } from "@/components/SourceRights";

export const metadata: Metadata = pageMetadata(
  "Om arkivet",
  "Omfang, kilder og forbehold for AaFK-arkivet: hva som er dekket, hvor opplysningene kommer fra, og hvilke lisenser som gjelder.",
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
            <h2>Hva som finnes nå</h2>
            <p>
              Arkivet inneholder to slags kamper. Spilte kamper har dato, motstander, hjemme
              eller borte, konkurranse og sluttresultat. Kamper som fortsatt står på
              terminlista, har dato og motstander, men ingen resultatfelt, og de er merket
              slik at de holdes utenfor statistikken.
            </p>
            <p>
              På kamp-, sesong- og personsidene finner du en knapp for å bidra, og de to
              typene bidrag går hver sin vei. Et minne eller en observasjon kan sendes inn
              uten konto. Det havner i en redaksjonell innboks, og blir vurdert og merket
              med hvor sikkert det er før det vises. En faktarettelse blir en sak på GitHub.
              Når den er godkjent, rettes kampen, personen, rollen eller kilden, og endringen
              får et synlig spor i historikken. Ingenting publiseres automatisk.{" "}
              <a href="/bidra">Slik bidrar du.</a>
            </p>
            <CoverageNote />
            <SeasonDepth />
            <GapNote />
            <p>
              Tallene over svarer på tre spørsmål som lett blandes sammen. Det første er hvor
              mange kamper arkivet har. Det andre er hvor mange av dem som også har hendelser,
              lagoppstilling og tilskuertall, og der følger dekningen kilden: kamper hentet
              fra FotMob har detaljer, mens de eldre som regel bare har resultatet. Det tredje
              er om en seriesesong er komplett, altså om rundenumrene går fra første til siste
              runde uten hull.
            </p>
          </section>
          <section>
            <h2>Hvordan søket virker</h2>
            <p>
              Søkefeltet gjør to ting. Mens du skriver, leter det direkte i arkivet etter
              personer, roller, år og motstandere, helt uten AI. Sender du inn et spørsmål
              formulert med egne ord, svarer en språkmodell ved å søke i arkivet med
              skrivebeskyttet tilgang. Spørringene den kjørte, står under svaret, slik at
              du kan etterprøve det. Modellen får også dekningstallene over, så den vet hva
              arkivet mangler.
            </p>
          </section>
          <section>
            <h2>Hva som måles</h2>
            <p>
              Nettstedet teller sidevisninger og måler hvor raskt sidene laster, uten
              informasjonskapsler og uten å lagre IP-adressen din. I tillegg telles det at et
              spørsmål ble stilt, om det fikk svar, og om noen åpnet en kamp fra direktesøket.
            </p>
            <p>
              Selve spørsmålet ditt lagres ikke i statistikken. Sier nettleseren din fra at
              den ikke vil spores, sendes ingenting i det hele tatt.
            </p>
          </section>
          <section>
            <h2>Kilder og kryssjekk</h2>
            <p>
              Hver kamp viser hvilken kilde den bygger på, og hvilke felt kilden har levert.
              Dataene kommer fra RSSSF (eldre sesonger), NFF Fotballdata og fotball.no
              (utvalgte sesonger og tabeller) og FotMob (nyere sesonger med hendelser og
              kampfakta, og tabellen for sesongen som pågår). FotMob er den eneste som gir
              hendelser og lagoppstillinger, men det er en udokumentert sekundærkilde, og
              vilkårene for systematisk gjenbruk er uavklarte. Spillere og trenere er hentet
              fra Wikipedia og Wikidata.
            </p>
            <p>
              Arkivet suppleres og kryssjekkes fortløpende mot NIFS, klubbkilder,
              Nasjonalbiblioteket og samtidige kamprapporter. Er to kilder uenige, står
              begge verdiene på kampsiden i stedet for at den ene stille får vinne. En
              opplysning blir ikke mer sann av å stå i en database.
            </p>
          </section>
        </div>
        <aside className="facts-panel"><h2>Kort fortalt</h2><dl><dt>Status</dt><dd>Offentlig beta, under oppbygging</dd><dt>Tilknytning</dt><dd>Ingen offisiell tilknytning til AaFK</dd><dt>Kode</dt><dd>MIT</dd><dt>Egne tekster</dt><dd>CC BY 4.0</dd><dt>Kildedata</dt><dd>Se kilde og vilkår per opplysning</dd></dl><a className="button-link" href="https://github.com/mlervaag/aafkstats">Se prosjektet på GitHub</a></aside>
      </div>

      {/* Femkolonnerstabellen sto i tekstspalten og måtte rulles sidelengs for å
          vise de to kolonnene som er hele poenget. Her har den hele bredden,
          og faktaruta ved siden av teksten står fortsatt der den skal. */}
      <section className="content-section rights-section">
        <h2>Rettigheter per kilde</h2>
        <div className="prose-stack">
          <p>
            Arkivet fører selv oversikt over hva som er avklart og hva som ikke er det.
            Innhøstingen leser den samme statusen, og stopper der en kilde er blokkert
            eller har sagt nei.
          </p>
          <p>
            Der vilkårene er uavklarte, skjer ingenting automatisk. Da må noen ta et valg,
            og valget føres som «høstet på akseptert risiko»: prosjekteieren har lest
            vilkårene, ser at bruken ikke er uttrykkelig tillatt, og går videre likevel.
            Beslutningen krever navn, dato og en begrunnelse, ellers avviser skjemaet den.
            Beslutningen er vår egen og ikke motpartens, og den står derfor i en egen
            kolonne, atskilt fra det motparten faktisk har svart.
          </p>
        </div>
        <SourceRights />
      </section>
    </article>
  );
}
