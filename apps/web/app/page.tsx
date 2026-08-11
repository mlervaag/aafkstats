import { AskBox } from "@/components/AskBox";
import { CoverageNote } from "@/components/CoverageNote";
import { MatchList } from "@/components/MatchList";
import { NextMatch } from "@/components/NextMatch";
import { loadNextMatch, loadOverview } from "@/lib/archive";

/**
 * Bygges på nytt hver time i stedet for ved hver forespørsel.
 *
 * Arkivet endrer seg bare ved utrulling, så alt på siden kunne vært statisk med
 * ett unntak: «neste kamp» avhenger av dagens dato, og en side bygget i mars
 * ville lovet en kamp som var spilt for lengst. En time er kort nok til at
 * kampen forsvinner fra forsiden samme dag den spilles, og lenge nok til at
 * siden serveres fra kanten nesten alltid.
 */
export const revalidate = 3600;

export default function Home() {
  const { recent, totals } = loadOverview();
  const next = loadNextMatch();
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Uoffisielt historisk arkiv</p>
          <h1>{totals.matches} AaFK-kamper.<br />Ett sted å lete.</h1>
          <p className="lede">
            Søk opp kamper direkte, eller still spørsmål i fritekst.
            Arkivet dekker foreløpig serie og cup fra {totals.first?.slice(0, 4) ?? "-"} til{" "}
            {totals.last?.slice(0, 4) ?? "-"}.
          </p>
        </div>
        {/* Tallene har vært fire stykker der det fjerde bare gjentok årstallet fra
            avsnittet over. Neste kamp står der i stedet: det er den ene
            opplysningen som endrer seg mellom besøkene. */}
        <div className="hero-side">
          <dl className="hero-stats">
            <div><dt>Kamper</dt><dd>{totals.matches}</dd></div>
            {/* «Sesonger» leses som hele sesonger, og tallet er noe annet: år
                med minst én registrert kamp. Ordet er byttet, ikke tallet. */}
            <div><dt>År</dt><dd>{totals.seasons}</dd></div>
            <div><dt>Motstandere</dt><dd>{totals.opponents}</dd></div>
          </dl>
          <NextMatch match={next} />
        </div>
      </section>

      <AskBox />

      <section className="home-grid content-section">
        <div>
          <div className="section-heading">
            {/* Lista sorterer på kampdato, ikke på når raden kom inn i arkivet.
                «Sist registrert» lovet det motsatte. */}
            <div><p className="eyebrow">Siste resultater</p><h2>Siste kamper</h2></div>
            <a href="/sesonger">Alle sesonger →</a>
          </div>
          <MatchList matches={recent} />
        </div>
        <aside className="explore-panel">
          <p className="eyebrow">Utforsk</p>
          <h2>Gå rett i arkivet</h2>
          <a href="/sesonger"><strong>Sesonger</strong><span>Resultater og alle kamper, år for år</span></a>
          <a href="/motstandere"><strong>Motstandere</strong><span>Innbyrdes statistikk gjennom historien</span></a>
          <a href="/personer"><strong>Personer</strong><span>Spillere, trenere, ledere og æresmedlemmer</span></a>
          <a href="/organisasjon"><strong>Organisasjon</strong><span>Styrer og verv, kildeført over tid</span></a>
          <a href="/data"><strong>Datasettet</strong><span>Se datamodellen og koden som driver arkivet</span></a>
          <a href="/bidra"><strong>Bidra</strong><span>Del minner og faktasjekk hendelser</span></a>
        </aside>
      </section>

      {/* To spalter, ikke tre: overskriften til venstre og innholdet til høyre.
          Tidligere sto overskriften alene i en spalte som ellers var tom, og
          notisen lå som en boks inni en tekst som allerede sa det samme. */}
      <section className="scope-note">
        <div>
          <p className="eyebrow">Offentlig beta</p>
          <h2>God bredde, ulik detaljgrad</h2>
        </div>
        <div className="prose">
          <p>
            Dato, motstander og sluttresultat finnes for hver spilte kamp. Kampene på
            terminlista inngår i arkivtotalen, men holdes utenfor resultatstatistikken
            til de er spilt. Detaljgraden varierer, og kildene er dokumentert.
            Datasettet er ikke en offisiell AaFK-publikasjon.{" "}
            <a href="/om">Les om omfang og forbehold.</a>
          </p>
          <CoverageNote heading={false} />
        </div>
      </section>
    </>
  );
}
