"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SourceCard } from "./SourceCard";
import { SourceSeriesCard } from "./SourceSeriesCard";
import { SOURCE_TYPES } from "./SourceTypeBadge";
import styles from "./SourceListClient.module.css";

export interface HistoricalSourceData {
  id: string;
  parent_source_id: string | null;
  title: string;
  source_type: string;
  publisher: string | null;
  year: number | null;
  issue: string | null;
  volume: string | null;
  cover_url: string | null;
  access_url: string | null;
}

interface SourceListClientProps {
  sources: HistoricalSourceData[];
}

const SOURCE_GROUP_ORDER = [
  "book",
  "anniversary_book",
  "local_history_book",
  "annual_report",
  "member_magazine",
  "match_program",
  "supporter_publication",
  "newspaper_supplement",
  "other",
];

/**
 * Alt en søkestreng skal kunne treffe på i én kilde.
 *
 * Søket matchet tittel og utgiver. I et arkiv der 87 av 99 kilder heter nesten det
 * samme, er årstallet og utgavenummeret det leseren faktisk leter etter — «1972»
 * ga ingen treff selv om arkivet har fire utgaver fra 1972.
 */
function haystack(source: HistoricalSourceData): string {
  return [
    source.title,
    source.publisher ?? "",
    source.year === null ? "" : String(source.year),
    source.issue ?? "",
    source.volume ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("nb-NO");
}

export function SourceListClient({ sources }: SourceListClientProps) {
  // `useSearchParams` krever en Suspense-grense for at siden skal kunne
  // forhåndsgenereres. Grensen står her framfor på sida, slik at reserveinnholdet
  // er den samme lista uten søkefelt — ikke en tom side.
  return (
    <Suspense fallback={<SourceList sources={sources} search="" filterType="all" />}>
      <SearchableSourceList sources={sources} />
    </Suspense>
  );
}

function SearchableSourceList({ sources }: SourceListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlType = searchParams.get("type") ?? "all";

  const [search, setSearch] = useState(urlQuery);
  const [filterType, setFilterType] = useState(urlType);

  // URL-en er fasit når den endrer seg utenfra. Det er dette som gjør at leseren
  // kan åpne en kilde, trykke tilbake, og finne igjen søket sitt.
  useEffect(() => setSearch(urlQuery), [urlQuery]);
  useEffect(() => setFilterType(urlType), [urlType]);

  // …og dette som legger søket i URL-en i utgangspunktet, slik at /kilder?q=1972
  // både kan deles og bokmerkes. `replace` framfor `push`: hvert tastetrykk skal
  // ikke bli en egen post i historikken.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === urlQuery && filterType === urlType) return;
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    if (filterType !== "all") params.set("type", filterType);
    const query = params.toString();
    router.replace(query ? `/kilder?${query}` : "/kilder", { scroll: false });
  }, [search, filterType, urlQuery, urlType, router]);

  const types = useMemo(
    () => Array.from(new Set(sources.map((s) => s.source_type))).filter((t) => t !== "series").sort(),
    [sources],
  );

  return (
    <div>
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label htmlFor="source-search">Søk i arkivet</label>
          <input
            id="source-search"
            type="search"
            placeholder="Tittel, år, utgave eller utgiver"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.search}
          />
        </div>
        <div className={styles.controlGroup}>
          <label htmlFor="source-type">Kildetype</label>
          <select
            id="source-type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={styles.filter}
          >
            <option value="all">Alle kildetyper</option>
            {types.map(t => (
              <option key={t} value={t}>{SOURCE_TYPES[t]?.plural || t}</option>
            ))}
          </select>
        </div>
      </div>

      <SourceList sources={sources} search={search} filterType={filterType} />
    </div>
  );
}

function SourceList({
  sources,
  search,
  filterType,
}: SourceListClientProps & { search: string; filterType: string }) {
  const { seriesEntries, singles } = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("nb-NO");
    const matchesQuery = (source: HistoricalSourceData) =>
      query === "" || haystack(source).includes(query);
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

  const singleGroups = useMemo(() => {
    const groups = new Map<string, HistoricalSourceData[]>();
    for (const source of singles) {
      groups.set(source.source_type, [...(groups.get(source.source_type) ?? []), source]);
    }
    return [...groups.entries()].sort(([typeA], [typeB]) => {
      const rankA = SOURCE_GROUP_ORDER.indexOf(typeA);
      const rankB = SOURCE_GROUP_ORDER.indexOf(typeB);
      return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
    });
  }, [singles]);

  const resultCount = seriesEntries.length + singles.length;

  return (
    <>
      <div className={styles.resultSummary} aria-live="polite">
        <strong>{resultCount}</strong> treff
        {(search.trim() || filterType !== "all") && <span> med valgte filtre</span>}
      </div>

      {seriesEntries.length > 0 && (
        <section className={styles.section} aria-labelledby="source-series-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>Samlinger</p>
              <h2 id="source-series-heading">Serier og faste utgivelser</h2>
            </div>
            <span>{seriesEntries.length}</span>
          </div>
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
        </section>
      )}

      {singles.length > 0 && (
        <section className={styles.section} aria-labelledby="single-sources-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>Enkeltkilder</p>
              <h2 id="single-sources-heading">Bøker, dokumenter og artikler</h2>
            </div>
            <span>{singles.length}</span>
          </div>

          <div className={styles.sourceGroups}>
            {singleGroups.map(([type, items]) => (
              <section className={styles.sourceGroup} key={type}>
                <div className={styles.groupHeading}>
                  <h3>{SOURCE_TYPES[type]?.plural || type}</h3>
                  <span>{items.length}</span>
                </div>
                <div className={styles.sourceGrid}>
                  {items.map((pub) => (
                    <SourceCard
                      key={pub.id}
                      id={pub.id}
                      title={pub.title}
                      sourceType={pub.source_type}
                      year={pub.year}
                      publisher={pub.publisher}
                      coverUrl={pub.cover_url}
                      titleAs="h4"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}

      {seriesEntries.length === 0 && singles.length === 0 && (
        <p className={styles.empty}>
          Fant ingen kilder som samsvarer med søket ditt.
        </p>
      )}
    </>
  );
}
