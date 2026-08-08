"use client";

import { useState, useMemo } from "react";
import { SourceCard } from "./SourceCard";
import { SourceSeriesCard } from "./SourceSeriesCard";

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

  const filteredSources = useMemo(() => {
    return sources.filter((s) => {
      if (filterType !== "all" && s.source_type !== filterType && s.source_type !== "series") {
        return false;
      }
      if (search.trim() !== "") {
        const q = search.toLowerCase();
        if (!s.title.toLowerCase().includes(q) && !(s.publisher || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [sources, search, filterType]);

  const series = new Map<string, HistoricalSourceData[]>();
  const singles: HistoricalSourceData[] = [];

  for (const source of filteredSources) {
    if (source.parent_source_id) {
      const group = series.get(source.parent_source_id) || [];
      group.push(source);
      series.set(source.parent_source_id, group);
    } else if (source.source_type !== "series") {
      singles.push(source);
    }
  }

  // Filter out series that became empty due to child filtering
  // Except if the series itself matched the search query and filterType is all.
  const seriesEntries = Array.from(series.entries()).filter(([parentId, items]) => {
    if (items.length > 0) return true;
    return false; // Actually, if children were filtered out, don't show the series
  });

  const getSeriesTitle = (parentId: string) => {
    const parent = sources.find(s => s.id === parentId);
    return parent ? parent.title : parentId;
  };

  const types = Array.from(new Set(sources.map(s => s.source_type))).filter(t => t !== "series").sort();
  
  const typeLabels: Record<string, string> = {
    book: "Bøker",
    anniversary_book: "Jubileumsbøker",
    member_magazine: "Medlemsblad",
    match_program: "Kampprogram",
    supporter_magazine: "Supporterblad",
    document: "Dokumenter",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <input
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
        <select
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
            <option key={t} value={t}>{typeLabels[t] || t}</option>
          ))}
        </select>
      </div>

      {seriesEntries.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Serier og faste utgivelser</h2>
          {seriesEntries.map(([parentId, items]) => (
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

      {singles.length > 0 && (
        <>
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
