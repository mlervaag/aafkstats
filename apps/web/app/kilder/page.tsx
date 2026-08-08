import type { Metadata } from "next";
import { all, open } from "@aafkstats/db";
import { SourceListClient } from "@/components/sources/SourceListClient";
import { ContributionCallToAction } from "@/components/ContributionCallToAction";

export const metadata: Metadata = {
  title: "Historisk kildearkiv",
  description: "Bøker, medlemsblad, jubileumsskrift, årsmeldinger og andre kilder til AaFKs historie.",
};

export const dynamic = "force-dynamic";

interface HistoricalSource {
  id: string;
  parent_source_id: string | null;
  title: string;
  source_type: string;
  publisher: string | null;
  year: number | null;
  cover_url: string | null;
  access_url: string | null;
}

export default function ArkivetPage() {
  const db = open();
  const sources = all<HistoricalSource>(
    db,
    "SELECT * FROM core_sources ORDER BY coalesce(year, 0) DESC, title ASC"
  );

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
