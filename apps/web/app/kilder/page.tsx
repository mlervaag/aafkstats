import type { Metadata } from "next";
import { all, open } from "@aafkstats/db";
import { SourceCard } from "@/components/sources/SourceCard";
import { SourceSeriesCard } from "@/components/sources/SourceSeriesCard";
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

  const series = new Map<string, HistoricalSource[]>();
  const singles: HistoricalSource[] = [];

  for (const source of sources) {
    if (source.parent_source_id) {
      const group = series.get(source.parent_source_id) || [];
      group.push(source);
      series.set(source.parent_source_id, group);
    } else if (source.source_type !== 'series') {
      singles.push(source);
    }
  }

  // Find series title from the actual sources
  const getSeriesTitle = (parentId: string) => {
    const parent = sources.find(s => s.id === parentId);
    return parent ? parent.title : parentId;
  };

  return (
    <>
      <header className="page-header">
        <h1>Historisk kildearkiv</h1>
        <p className="lead">
          Bøker, medlemsblad, jubileumsskrift, årsmeldinger og andre kilder til AaFKs historie.
        </p>
      </header>

      {series.size > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Serier og faste utgivelser</h2>
          {Array.from(series.entries()).map(([parentId, items]) => (
            <SourceSeriesCard 
              key={parentId}
              id={parentId}
              title={getSeriesTitle(parentId)}
              sourceType={items[0].source_type}
              minYear={Math.min(...items.map(i => i.year || 9999))}
              maxYear={Math.max(...items.map(i => i.year || 0))}
              count={items.length}
            />
          ))}
        </div>
      )}

      <h2 style={{ fontSize: "1.5rem", marginTop: "3rem", marginBottom: "1rem" }}>Bøker og enkeltutgivelser</h2>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "2rem",
        marginTop: "2rem"
      }}>
        {singles.map((pub) => (
          <SourceCard
            key={pub.id}
            id={pub.id}
            title={pub.title}
            sourceType={pub.source_type}
            year={pub.year}
            publisher={pub.publisher}
            coverUrl={pub.cover_url}
          />
        ))}
      </div>
      
      <ContributionCallToAction />
    </>
  );
}
