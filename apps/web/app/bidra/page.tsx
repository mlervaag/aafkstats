import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bidra", description: "Meld inn feil, kilder og manglende AaFK-kamper." };

export default function ContributePage() {
  return (
    <>
      <header className="page-intro"><p className="eyebrow">Åpent arkiv</p><h1>Har du en rettelse eller kilde?</h1><p className="lede">Bidragsskjemaet er ikke bygget ennå. I MVP-en bruker vi GitHub, slik at alle endringer kan kontrolleres før de blir del av arkivet.</p></header>
      <div className="contribute-grid">
        <section className="archive-card"><span className="card-kicker">Raskest</span><h2>Meld inn en feil</h2><p>Oppgi kampdato, hva som er feil, riktig verdi og hvor opplysningen kan kontrolleres.</p><a className="button-link" href="https://github.com/mlervaag/aafkstats/issues/new?title=Rettelse%3A%20">Opprett GitHub-sak</a></section>
        <section className="archive-card"><span className="card-kicker">For utviklere</span><h2>Send en pull request</h2><p>Dataene ligger som lesbare YAML-filer. Validering og tester kjører automatisk på alle forslag.</p><a className="button-link secondary" href="https://github.com/mlervaag/aafkstats">Åpne repoet</a></section>
      </div>
      <section className="content-section prose-stack"><h2>Et godt bidrag inneholder</h2><ul><li>kampdato og motstander</li><li>feltet som skal legges til eller rettes</li><li>lenke til en etterprøvbar kilde</li><li>en kort forklaring hvis kildene er uenige</li></ul><div className="notice"><strong>Ikke kopier kampreferat.</strong> Send lenken til originalen. Opphavsrettsbeskyttet tekst skal ikke inn i arkivet.</div></section>
    </>
  );
}
