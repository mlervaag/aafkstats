import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/components/JsonLd";
import { collectionJsonLd } from "@/lib/jsonld";
import { SourceListClient, type HistoricalSourceData } from "@/components/sources/SourceListClient";
import { ContributionCallToAction } from "@/components/ContributionCallToAction";
import { NewspaperArticleArchive } from "@/components/sources/NewspaperArticleArchive";
import { getSunnmorspostenArticles } from "@/lib/newspaper-articles";
import { getSources } from "@/lib/sources";

export const metadata: Metadata = pageMetadata(
  "Historisk kildearkiv",
  "Bøker, medlemsblad, årsmeldinger og Sunnmørsposten-artikler knyttet til AaFK-kamper.",
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
  const newspaperArticles = getSunnmorspostenArticles();

  return (
    <>
      <JsonLd
        data={collectionJsonLd({
          name: "Historisk kildearkiv om Aalesunds Fotballklubb",
          description: "Bøker, medlemsblad, årsmeldinger og Sunnmørsposten-artikler knyttet til AaFK-kamper.",
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
        <h1>Historisk kildearkiv</h1>
        <p className="lede">
          Bøker, medlemsblad, jubileumsskrift og årsmeldinger om AaFKs historie –
          sammen med avissider som er koblet direkte til konkrete kamper. Datakildene
          bak kamptallene står <a href="/om">på om-siden</a>.
        </p>
      </header>

      <NewspaperArticleArchive articles={newspaperArticles} />

      <SourceListClient sources={sources} />

      <ContributionCallToAction />
    </>
  );
}
