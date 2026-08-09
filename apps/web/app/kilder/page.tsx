import type { Metadata } from "next";
import { SourceListClient, type HistoricalSourceData } from "@/components/sources/SourceListClient";
import { ContributionCallToAction } from "@/components/ContributionCallToAction";
import { getSources } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Historisk kildearkiv",
  description: "Bøker, medlemsblad, jubileumsskrift, årsmeldinger og andre kilder til AaFKs historie.",
};

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
      <header className="page-header">
        <h1>Historisk kildearkiv</h1>
        <p className="lead">
          Bøker, medlemsblad, jubileumsskrift, årsmeldinger og andre kilder til AaFKs historie.
        </p>
      </header>

      <SourceListClient sources={sources} />

      <ContributionCallToAction />
    </>
  );
}
