import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/components/JsonLd";
import { collectionJsonLd } from "@/lib/jsonld";
import { SourceListClient, type HistoricalSourceData } from "@/components/sources/SourceListClient";
import { ContributionCallToAction } from "@/components/ContributionCallToAction";
import { NewspaperArticleArchive } from "@/components/sources/NewspaperArticleArchive";
import { getNewspaperArticles } from "@/lib/newspaper-articles";
import { getSources } from "@/lib/sources";
import { SourceRights } from "@/components/SourceRights";

export const metadata: Metadata = pageMetadata(
  "Kilder",
  "Historiske publikasjoner, avisartikler og datakildene bak AaFK-arkivet.",
  "/kilder",
  "website",
);

export default function ArkivetPage() {
  // Klientkomponenten trenger bare feltene den filtrerer og viser. Providerlisten
  // og utgavedetaljene blir igjen på serveren og sendes først på detaljsiden.
  //
  // År, utgave og årgang er med fordi søket er arkivorientert: «1972» skal finne
  // utgavene fra 1972, ikke bare de kildene som har årstallet i tittelen.
  const sources: HistoricalSourceData[] = getSources().map((source) => ({
    id: source.id,
    parent_source_id: source.parent_source_id,
    title: source.title,
    source_type: source.source_type,
    publisher: source.publisher,
    year: source.year,
    issue: source.issue,
    volume: source.volume,
    cover_url: source.cover_url,
    access_url: source.access_url,
  }));
  const newspaperArticles = getNewspaperArticles();
  const matchesWithArticles = new Set(newspaperArticles.map((article) => article.matchId)).size;

  return (
    <>
      <JsonLd
        data={collectionJsonLd({
          name: "Kilder til AaFK-arkivet",
          description: "Historiske publikasjoner, avisartikler og datakildene bak AaFK-arkivet.",
          path: "/kilder",
          size: sources.length,
        })}
      />
      {/* Kildesidene kom til senere og hadde sine egne klassenavn for det samme.
          Nå er innledningen den samme som på sesonger, motstandere og datasettet. */}
      <header className="page-intro">
        <p className="eyebrow">
          {sources.length} registrerte kilder · {newspaperArticles.length} avisartikler
        </p>
        <h1>Kilder</h1>
        <p className="lede">
          AaFK-arkivet bygger på historiske publikasjoner, fotballdatabaser og samtidige
          kilder. Her kan du både utforske originalmaterialet og se hvor kampopplysningene
          kommer fra.
        </p>
      </header>

      {/* Veivalgene fra PR 210 sa hva som lå bak hver inngang, men ikke hvor mye.
          Nå som begge arkivene er store nok til å måtte filtreres, er antallet
          det som skiller et oppslagsverk fra en håndfull dokumenter. */}
      <nav className="source-paths" aria-label="Velg type kilde">
        <a className="archive-card" href="#historiske-kilder"><span className="card-kicker">01</span><strong className="card-title">Historiske kilder</strong><span className="card-meta">{sources.length} bøker, medlemsblad, årsmeldinger, avissider og nettsaker</span></a>
        <a className="archive-card" href="#avisarkivet"><span className="card-kicker">02</span><strong className="card-title">Avisarkivet</strong><span className="card-meta">{newspaperArticles.length} avissider koblet til {matchesWithArticles} konkrete kamper</span></a>
        <a className="archive-card" href="#datakilder"><span className="card-kicker">03</span><strong className="card-title">Datakilder og kildebruk</strong><span className="card-meta">Kryssjekk, forbehold, rettigheter og vilkår</span></a>
      </nav>

      <section id="historiske-kilder" className="source-section">
        <SourceListClient sources={sources} />
      </section>

      <section id="avisarkivet" className="source-section">
        <NewspaperArticleArchive articles={newspaperArticles} />
      </section>

      <section id="datakilder" className="content-section source-section rights-section">
        <p className="eyebrow">Etterprøvbarhet</p>
        <h2>Datakilder, metode og rettigheter</h2>
        <div className="prose-stack">
          <p>
            Kampdata kommer blant annet fra RSSSF, NFF Fotballdata og fotball.no,
            Sunnmøre Fotballkrets, NFF-årbøker i Nasjonalbiblioteket og FotMob. Person- og
            treneropplysninger suppleres fra Wikipedia og Wikidata. Hver kamp viser hvilke
            kilder og leverandører som har levert opplysningene.
          </p>
          <p>
            Arkivet kryssjekker mot NIFS, klubbkilder, Nasjonalbiblioteket og samtidige
            kamprapporter. Når kilder er uenige, vises begge verdiene til konflikten kan
            avgjøres med belegg. FotMob gir mye av detaljdybden i nyere kamper, men er en
            sekundærkilde med uavklarte vilkår for systematisk gjenbruk.
          </p>
          <p>
            Tabellen skiller mellom hva en kilde tillater, hva motparten har svart, og hva
            prosjektet selv har besluttet. Innhøstingen stopper når en kilde er blokkert
            eller har sagt nei; risikobeslutninger krever navn, dato og begrunnelse.
          </p>
        </div>
        <SourceRights />
      </section>

      <ContributionCallToAction />
    </>
  );
}
