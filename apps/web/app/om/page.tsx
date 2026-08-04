import type { Metadata } from "next";
import { CoverageNote, GapNote, SeasonDepth } from "@/components/CoverageNote";
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
              Arkivet inneholder to slags kamper. De som er spilt har dato, motstander,
              hjemme eller borte, konkurranse og sluttresultat. De som står på terminlista
              har dato og motstander, men ingen resultatfelt, og er merket slik at de ikke
              telles med i statistikken.
            </p>
            <CoverageNote />
            <SeasonDepth />
            <GapNote />
            <p>
              Tre forskjellige spørsmål om dekning blandes lett. Hvor mange kamper arkivet
              har er ett. Hvor mange av dem som har hendelser, lagoppstilling og
              tilskuertall er et annet, og der følger dekningen kilden: kampene hentet fra
              FotMob har detaljer, de eldre har som regel bare resultatet. Om en sesong er
              hel er et tredje, og det svares på med rundenumrene. Tallene over holder de
              tre fra hverandre.
            </p>
          </section>
          <section><h2>Hvordan søket virker</h2><p>Direktesøket finner år og motstandere uten AI. Når du skriver et spørsmål og sender det inn, lager en språkmodell en skrivebeskyttet SQL-spørring mot arkivet. Spørringen vises under svaret slik at resultatet kan etterprøves. Dekningstallene over ligger også i systemprompten, så modellen vet hva arkivet mangler.</p></section>
          <section>
            <h2>Rettigheter per kilde</h2>
            <p>
              Arkivet fører selv oversikt over hva som er avklart og hva som ikke er det.
              Innhøstingen leser den samme statusen og stopper der en kilde er blokkert
              eller har sagt nei.
            </p>
            <p>
              Der vilkårene er uavklarte er det derimot ikke automatikk. Da må noen ta et
              valg, og valget føres som «høstet på akseptert risiko»: prosjekteieren har
              lest vilkårene, ser at bruken ikke er uttrykkelig tillatt, og går videre
              likevel. Beslutningen krever navn, dato og en begrunnelse, ellers avviser
              skjemaet den. Den er vår, ikke motpartens, og står derfor i en egen kolonne
              enn det motparten faktisk har svart.
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
          <section>
            <h2>Kilder og sikkerhet</h2>
            <p>
              Hver kamp peker til kilden og hvilke felt kilden har levert. To kilder bærer
              arkivet i dag. FotMob dekker kampene fra rundt 2010 og er den eneste som gir
              hendelser og lagoppstillinger; den er en udokumentert sekundærkilde med
              uavklarte vilkår for systematisk gjenbruk. RSSSF dekker sesongene bakover og
              gir resultater og sluttabeller, men ikke detaljer fra kampene. Spillere og
              trenere er hentet fra Wikipedia og Wikidata.
            </p>
            <p>
              Ingen av kampene er kryssjekket mot en uavhengig kilde ennå. Planen er
              fotball.no, NIFS, klubbkilder og samtidige kamprapporter fra
              Nasjonalbiblioteket. En opplysning blir ikke mer sann av å stå i en database.
            </p>
          </section>
        </div>
        <aside className="facts-panel"><h2>Kort fortalt</h2><dl><dt>Status</dt><dd>Offentlig beta, under oppbygging</dd><dt>Tilknytning</dt><dd>Ingen offisiell tilknytning til AaFK</dd><dt>Kode</dt><dd>MIT</dd><dt>Egne tekster</dt><dd>CC BY 4.0</dd><dt>Kildedata</dt><dd>Se kilde og vilkår per opplysning</dd></dl><a className="button-link" href="https://github.com/mlervaag/aafkstats">Se prosjektet på GitHub</a></aside>
      </div>
    </article>
  );
}
