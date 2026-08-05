import { AskBox } from "@/components/AskBox";
import { CoverageNote } from "@/components/CoverageNote";
import { MatchList } from "@/components/MatchList";
import { NextMatch } from "@/components/NextMatch";
import { loadNextMatch, loadOverview } from "@/lib/archive";

export const dynamic = "force-dynamic";

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
            {totals.last?.slice(0, 4) ?? "-"}
            {totals.upcoming > 0
              ? `, og ${totals.upcoming} kamper til står på terminlista.`
              : "."}
          </p>
        </div>
        {/* Tallene har vært fire stykker der det fjerde bare gjentok årstallet fra
            avsnittet over. Neste kamp står der i stedet: det er den ene
            opplysningen som endrer seg mellom besøkene. */}
        <div className="hero-side">
          <dl className="hero-stats">
            <div><dt>Kamper</dt><dd>{totals.matches}</dd></div>
            <div><dt>Sesonger</dt><dd>{totals.seasons}</dd></div>
            <div><dt>Motstandere</dt><dd>{totals.opponents}</dd></div>
          </dl>
          <NextMatch match={next} />
        </div>
      </section>

      <AskBox />

      <section className="home-grid content-section">
        <div>
          <div className="section-heading">
            <div><p className="eyebrow">Sist registrert</p><h2>Siste kamper</h2></div>
            <a href="/sesonger">Alle sesonger →</a>
          </div>
          <MatchList matches={recent} />
        </div>
        <aside className="explore-panel">
          <p className="eyebrow">Utforsk</p>
          <h2>Gå rett i arkivet</h2>
          <a href="/sesonger"><strong>Sesonger</strong><span>Resultater og alle kamper, år for år</span></a>
          <a href="/motstandere"><strong>Motstandere</strong><span>Innbyrdes statistikk gjennom historien</span></a>
          <a href="/data"><strong>Datasettet</strong><span>Se datamodellen og koden som driver arkivet</span></a>
          <a href="/bidra"><strong>Bidra</strong><span>Del minner og faktasjekk hendelser</span></a>
        </aside>
      </section>

      {/* To spalter, ikke tre: overskriften til venstre og innholdet til høyre.
          Tidligere sto overskriften alene i en spalte som ellers var tom, og
          notisen lå som en boks inni en tekst som allerede sa det samme. */}
      <section className="scope-note">
        <div>
          <p className="eyebrow">Dette er en MVP</p>
          <h2>God bredde, ulik detaljgrad</h2>
        </div>
        <div className="prose">
          <p>
            Dato, motstander og sluttresultat finnes for hver kamp i arkivet;
            detaljgraden varierer. Kildene er dokumentert, men datasettet er ikke en
            offisiell AaFK-publikasjon. <a href="/om">Les om omfang og forbehold.</a>
          </p>
          <CoverageNote heading={false} />
        </div>
      </section>
    </>
  );
}
