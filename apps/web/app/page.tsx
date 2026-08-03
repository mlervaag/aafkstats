import { AskBox } from "@/components/AskBox";
import { CoverageNote } from "@/components/CoverageNote";
import { MatchList } from "@/components/MatchList";
import { loadOverview, loadTrivia } from "@/lib/archive";

export const dynamic = "force-dynamic";

export default function Home() {
  const { recent, totals } = loadOverview();
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Uoffisielt historisk arkiv</p>
          <h1>{totals.matches} AaFK-kamper.<br />Ett sted å lete.</h1>
          <p className="lede">
            Finn en kamp mens du skriver, eller still et spørsmål med vanlige ord.
            Arkivet dekker foreløpig serie og cup fra {totals.first?.slice(0, 4) ?? "–"} til{" "}
            {totals.last?.slice(0, 4) ?? "–"}.
          </p>
        </div>
        <dl className="hero-stats">
          <div><dt>Kamper</dt><dd>{totals.matches}</dd></div>
          <div><dt>Sesonger</dt><dd>{totals.seasons}</dd></div>
          <div><dt>Motstandere</dt><dd>{totals.opponents}</dd></div>
          <div><dt>Fra</dt><dd>{totals.first?.slice(0, 4) ?? "–"}</dd></div>
        </dl>
      </section>

      <AskBox trivia={loadTrivia()} />

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
          <a href="/data"><strong>Datasettet</strong><span>Se feltene og SQL-en bak AI-svarene</span></a>
        </aside>
      </section>

      <section className="scope-note">
        <div><p className="eyebrow">Dette er en MVP</p><h2>God bredde, ulik detaljgrad</h2></div>
        <p>
          Dato, motstander og sluttresultat finnes for hver kamp i arkivet; detaljgraden
          varierer. Kildene er dokumentert, men datasettet er ikke en offisiell
          AaFK-publikasjon. <a href="/om">Les om omfang og forbehold.</a>
        </p>
        <CoverageNote heading={false} />
      </section>
    </>
  );
}
