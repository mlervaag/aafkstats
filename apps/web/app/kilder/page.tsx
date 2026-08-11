import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/components/JsonLd";
import { collectionJsonLd } from "@/lib/jsonld";
import { SourceListClient, type HistoricalSourceData } from "@/components/sources/SourceListClient";
import { ContributionCallToAction } from "@/components/ContributionCallToAction";
import { getSources } from "@/lib/sources";

export const metadata: Metadata = pageMetadata(
  "Historisk kildearkiv",
  "Bøker, medlemsblad, jubileumsskrift, årsmeldinger og andre kilder til AaFKs historie.",
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

  return (
    <>
      <JsonLd
        data={collectionJsonLd({
          name: "Historisk kildearkiv om Aalesunds Fotballklubb",
          description: "Bøker, medlemsblad, jubileumsskrift, årsmeldinger og andre kilder til AaFKs historie.",
          path: "/kilder",
          size: sources.length,
        })}
      />
      {/* Kildesidene kom til senere og hadde sine egne klassenavn for det samme.
          Nå er innledningen den samme som på sesonger, motstandere og datasettet. */}
      <header className="page-intro">
        <p className="eyebrow">{sources.length} registrerte kilder</p>
        <h1>Historisk kildearkiv</h1>
        <p className="lede">
          Bøker, medlemsblad, jubileumsskrift, årsmeldinger og andre kilder til AaFKs historie.
          Dette er dokumentene om klubben, ikke datakildene bak kamptallene — de står{" "}
          <a href="/om">på om-siden</a>.
        </p>
      </header>

      <SourceListClient sources={sources} />

      <ContributionCallToAction />
    </>
  );
}
