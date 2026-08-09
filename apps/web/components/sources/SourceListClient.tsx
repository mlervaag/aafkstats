"use client";

import { useState, useMemo } from "react";
import { SourceCard } from "./SourceCard";
import { SourceSeriesCard } from "./SourceSeriesCard";
import { SOURCE_TYPES } from "./SourceTypeBadge";

export interface HistoricalSourceData {
  id: string;
  parent_source_id: string | null;
  title: string;
  source_type: string;
  publisher: string | null;
  year: number | null;
  cover_url: string | null;
  access_url: string | null;
}

interface SourceListClientProps {
  sources: HistoricalSourceData[];
}

export function SourceListClient({ sources }: SourceListClientProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const { seriesEntries, singles } = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("nb-NO");
    const matchesQuery = (source: HistoricalSourceData) => query === "" ||
      source.title.toLocaleLowerCase("nb-NO").includes(query) ||
      (source.publisher ?? "").toLocaleLowerCase("nb-NO").includes(query);
    const matchesType = (source: HistoricalSourceData) =>
      filterType === "all" || source.source_type === filterType;

    const parents = new Map(
      sources
        .filter((source) => source.source_type === "series" && !source.parent_source_id)
        .map((source) => [source.id, source]),
    );
    const grouped = new Map<string, HistoricalSourceData[]>();
    const ungrouped: HistoricalSourceData[] = [];

    for (const source of sources) {
      if (source.source_type === "series") continue;
      if (source.parent_source_id) {
        const parent = parents.get(source.parent_source_id);
        const parentMatches = parent ? matchesQuery(parent) : false;
        if (matchesType(source) && (parentMatches || matchesQuery(source))) {
          grouped.set(source.parent_source_id, [
            ...(grouped.get(source.parent_source_id) ?? []),
            source,
          ]);
        }
      } else if (matchesType(source) && matchesQuery(source)) {
        ungrouped.push(source);
      }
    }

    return {
      seriesEntries: [...grouped.entries()].map(([id, items]) => ({
        id,
        title: parents.get(id)?.title ?? id,
        items,
      })),
      singles: ungrouped,
    };
  }, [sources, search, filterType]);

  const types = Array.from(new Set(sources.map(s => s.source_type))).filter(t => t !== "series").sort();

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <label className="sr-only" htmlFor="source-search">Søk i kilder</label>
        <input
          id="source-search"
          type="text"
          placeholder="Søk i kilder..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            flexGrow: 1,
            maxWidth: "400px"
          }}
        />
        <label className="sr-only" htmlFor="source-type">Filtrer på kildetype</label>
        <select
          id="source-type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        >
          <option value="all">Alle kildetyper</option>
          {types.map(t => (
            <option key={t} value={t}>{SOURCE_TYPES[t]?.plural || t}</option>
          ))}
        </select>
      </div>

      {seriesEntries.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Serier og faste utgivelser</h2>
          {seriesEntries.map(({ id, title, items }) => (
            <SourceSeriesCard
              key={id}
              id={id}
              title={title}
              sourceType="series"
              minYear={Math.min(...items.map((item) => item.year ?? 9999))}
              maxYear={Math.max(...items.map((item) => item.year ?? 0))}
              count={items.length}
            />
          ))}
        </div>
      )}

      {singles.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.5rem", marginTop: "3rem", marginBottom: "1rem" }}>Bøker og enkeltutgivelser</h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "1.5rem",
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
        </>
      )}
      
      {seriesEntries.length === 0 && singles.length === 0 && (
        <p style={{ marginTop: "2rem", fontStyle: "italic", color: "#666" }}>
          Fant ingen kilder som samsvarer med søket ditt.
        </p>
      )}
    </div>
  );
}
