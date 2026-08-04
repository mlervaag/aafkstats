import type { Metadata } from "next";
import { CoverageNote, GapNote } from "@/components/CoverageNote";
import { SourceRights } from "@/components/SourceRights";

export const metadata: Metadata = { title: "Om arkivet", description: "Omfang, kilder og forbehold for AaFK-arkivet." };

export default function AboutPage() {
  return (
    <article>
      <header className="page-intro"><p className="eyebrow">Om prosjektet</p><h1>Et søkbart minne om AaFK-kampene</h1><p className="lede">AaFK-arkivet er et uoffisielt fritidsprosjekt. Målet er å samle kamphistorien i en åpen struktur som kan kontrolleres, rettes og bygges videre på.</p></header>
      <div className="article-grid">
        <div className="prose-stack">
          <section>
            <h2>Hva som finnes nå</h2>
            <p>
              Alle kamper i arkivet har dato, motstander, hjemme/borte, konkurranse og
              sluttresultat. Detaljgraden varierer: hendelser, lagoppstillinger, tilskuertall og
              statistikk finnes bare der kilden hadde dem.
            </p>
            <CoverageNote />
            <GapNote />
          </section>
          <section><h2>Hvordan søket virker</h2><p>Direktesøket finner år og motstandere uten AI. Når du skriver et spørsmål og sender det inn, lager en språkmodell en skrivebeskyttet SQL-spørring mot arkivet. Spørringen vises under svaret slik at resultatet kan etterprøves.</p></section>
          <section>
            <h2>Rettigheter per kilde</h2>
            <p>
              Arkivet fører selv oversikt over hva som er avklart og hva som ikke er det.
              Innhøstingen leser den samme statusen, og nekter å skrive fra en kilde der
              offentlig gjenbruk ikke er avklart — selv om uthentingen teknisk fungerer.
            </p>
            <SourceRights />
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
          <section><h2>Kilder og sikkerhet</h2><p>Hver kamp peker til kilden og hvilke felt kilden har levert. Dagens testdata kommer i hovedsak fra FotMob og er merket som foreløpige. FotMob er en udokumentert sekundærkilde med uavklarte vilkår for systematisk gjenbruk.</p><p>Arkivet skal etter hvert kryssjekkes mot fotball.no, NIFS, klubbkilder og samtidige kamprapporter. En opplysning blir ikke mer sann av å stå i en database.</p></section>
        </div>
        <aside className="facts-panel"><h2>Kort fortalt</h2><dl><dt>Status</dt><dd>MVP / testarkiv</dd><dt>Tilknytning</dt><dd>Ingen offisiell tilknytning til AaFK</dd><dt>Kode</dt><dd>MIT</dd><dt>Egne tekster</dt><dd>CC BY 4.0</dd><dt>Kildedata</dt><dd>Se kilde og vilkår per opplysning</dd></dl><a className="button-link" href="https://github.com/mlervaag/aafkstats">Se prosjektet på GitHub</a></aside>
      </div>
    </article>
  );
}
