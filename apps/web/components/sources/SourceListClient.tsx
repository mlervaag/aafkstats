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
 * Når en typegruppe er så stor at den må deles på utgiver, og hvor mange kort en
 * gruppe viser før «vis alle».
 *
 * 274 av 455 kilder har typen «Annet»: 208 avissider fra Sunnmørsposten, 48
 * nettsaker fra klubben, resten enkeltsaker fra andre aviser. De sto under én
 * overskrift som ikke sa noe om noen av dem, i en side på over 30 000 piksler.
 * Utgiveren står allerede i dataene, og er det som faktisk skiller dem.
 */
const GROUP_SPLIT = 40;
const GROUP_PREVIEW = 24;

const UNKNOWN_PUBLISHER = "Uten oppgitt utgiver";
const UNDATED = "udatert";

interface SourceGroup {
  key: string;
  label: string;
  items: HistoricalSourceData[];
  /** Sant når overskriften allerede er utgiveren, slik at kortene slipper å gjenta den. */
  byPublisher?: boolean;
}

/** Tiåret kilden hører til, eller `UNDATED` for de elleve uten årstall. */
function decadeOf(source: HistoricalSourceData): string {
  return source.year === null ? UNDATED : `${Math.floor(source.year / 10) * 10}`;
}

function decadeLabel(decade: string): string {
  return decade === UNDATED ? "Uten årstall" : `${decade}-tallet`;
}

/** Årsspennet i en gruppe, til å skrive ut ved siden av antallet. */
function yearSpan(items: HistoricalSourceData[]): string | null {
  const years = items.map((item) => item.year).filter((year): year is number => year !== null);
  if (years.length === 0) return null;
  const from = Math.min(...years);
  const to = Math.max(...years);
  return from === to ? String(from) : `${from}–${to}`;
}

/**
 * Grupperer enkeltkildene, og deler de største gruppene videre på utgiver.
 *
 * Delingen slår bare inn der den trengs: en gruppe på under førti kilder er
 * lesbar som den er, og en gruppe der alt kommer fra samme utgiver blir ikke
 * tydeligere av å få utgiverens navn som overskrift.
 */
function buildGroups(singles: HistoricalSourceData[]): SourceGroup[] {
  const byType = new Map<string, HistoricalSourceData[]>();
  for (const source of singles) {
    byType.set(source.source_type, [...(byType.get(source.source_type) ?? []), source]);
  }

  return [...byType.entries()]
    .sort(([typeA], [typeB]) => {
      const rankA = SOURCE_GROUP_ORDER.indexOf(typeA);
      const rankB = SOURCE_GROUP_ORDER.indexOf(typeB);
      return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
    })
    .flatMap(([type, items]) => {
      const whole: SourceGroup = {
        key: type,
        label: SOURCE_TYPES[type]?.plural || type,
        items,
      };
      if (items.length < GROUP_SPLIT) return [whole];

      const byPublisher = new Map<string, HistoricalSourceData[]>();
      for (const source of items) {
        const publisher = source.publisher ?? UNKNOWN_PUBLISHER;
        byPublisher.set(publisher, [...(byPublisher.get(publisher) ?? []), source]);
      }
      if (byPublisher.size < 2) return [whole];

      return [...byPublisher.entries()]
        .sort(([, a], [, b]) => b.length - a.length)
        .map(([publisher, publisherItems]) => ({
          key: `${type}:${publisher}`,
          label: publisher,
          items: publisherItems,
          byPublisher: true,
        }));
    });
}

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
    <Suspense fallback={<SourceList sources={sources} search="" filterType="all" filterDecade="all" />}>
      <SearchableSourceList sources={sources} />
    </Suspense>
  );
}

function SearchableSourceList({ sources }: SourceListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlType = searchParams.get("type") ?? "all";
  const urlDecade = searchParams.get("tiar") ?? "all";

  const [search, setSearch] = useState(urlQuery);
  const [filterType, setFilterType] = useState(urlType);
  const [filterDecade, setFilterDecade] = useState(urlDecade);

  // URL-en er fasit når den endrer seg utenfra. Det er dette som gjør at leseren
  // kan åpne en kilde, trykke tilbake, og finne igjen søket sitt.
  useEffect(() => setSearch(urlQuery), [urlQuery]);
  useEffect(() => setFilterType(urlType), [urlType]);
  useEffect(() => setFilterDecade(urlDecade), [urlDecade]);

  // …og dette som legger søket i URL-en i utgangspunktet, slik at /kilder?q=1972
  // både kan deles og bokmerkes. `replace` framfor `push`: hvert tastetrykk skal
  // ikke bli en egen post i historikken.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === urlQuery && filterType === urlType && filterDecade === urlDecade) return;
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    if (filterType !== "all") params.set("type", filterType);
    if (filterDecade !== "all") params.set("tiar", filterDecade);
    const query = params.toString();
    router.replace(query ? `/kilder?${query}` : "/kilder", { scroll: false });
  }, [search, filterType, filterDecade, urlQuery, urlType, urlDecade, router]);

  const types = useMemo(
    () => Array.from(new Set(sources.map((s) => s.source_type))).filter((t) => t !== "series").sort(),
    [sources],
  );

  // Tiårene arkivet har, med antall. Kildene spenner fra 1915 til 2026, og uten
  // et tidsfilter er den eneste veien til 1940-tallet å skrolle forbi alt nyere.
  const decades = useMemo(() => {
    const counts = new Map<string, number>();
    for (const source of sources) {
      if (source.source_type === "series") continue;
      const decade = decadeOf(source);
      counts.set(decade, (counts.get(decade) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => {
      if (a === UNDATED) return 1;
      if (b === UNDATED) return -1;
      return Number(b) - Number(a);
    });
  }, [sources]);

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
        <div className={styles.controlGroup}>
          <label htmlFor="source-decade">Tidsrom</label>
          <select
            id="source-decade"
            value={filterDecade}
            onChange={(e) => setFilterDecade(e.target.value)}
            className={styles.filter}
          >
            <option value="all">Alle tiår</option>
            {decades.map(([decade, count]) => (
              <option key={decade} value={decade}>{decadeLabel(decade)} ({count})</option>
            ))}
          </select>
        </div>
      </div>

      <SourceList
        sources={sources}
        search={search}
        filterType={filterType}
        filterDecade={filterDecade}
      />
    </div>
  );
}

function SourceList({
  sources,
  search,
  filterType,
  filterDecade,
}: SourceListClientProps & { search: string; filterType: string; filterDecade: string }) {
  // Hvilke grupper leseren har bedt om å se hele. Nøkkelen er gruppas, ikke
  // posisjonen, så et nytt søk ikke folder ut en helt annen gruppe.
  const [expanded, setExpanded] = useState<string[]>([]);

  const { seriesEntries, singles } = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("nb-NO");
    const matchesQuery = (source: HistoricalSourceData) =>
      query === "" || haystack(source).includes(query);
    const matchesType = (source: HistoricalSourceData) =>
      filterType === "all" || source.source_type === filterType;
    // Tidsfilteret treffer utgavene, ikke serien: en serie hører til der
    // årgangene ligger, og skal vises så lenge den har en utgave i tiåret.
    const matchesDecade = (source: HistoricalSourceData) =>
      filterDecade === "all" || decadeOf(source) === filterDecade;

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
        if (matchesType(source) && matchesDecade(source) && (parentMatches || matchesQuery(source))) {
          grouped.set(source.parent_source_id, [
            ...(grouped.get(source.parent_source_id) ?? []),
            source,
          ]);
        }
      } else if (matchesType(source) && matchesDecade(source) && matchesQuery(source)) {
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
  }, [sources, search, filterType, filterDecade]);

  const singleGroups = useMemo(() => buildGroups(singles), [singles]);

  const resultCount = seriesEntries.length + singles.length;

  return (
    <>
      <div className={styles.resultSummary} aria-live="polite">
        <strong>{resultCount}</strong> treff
        {(search.trim() || filterType !== "all" || filterDecade !== "all") && (
          <span> med valgte filtre</span>
        )}
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
            {singleGroups.map(({ key, label, items, byPublisher }) => {
              // Gruppene er svært ulike: elleve bøker mot 208 avissider. Alle kortene
              // fra den største gjorde sida over 30 000 piksler høy, så en gruppe
              // viser et utsnitt til leseren ber om resten.
              const open = expanded.includes(key);
              const shown = open ? items : items.slice(0, GROUP_PREVIEW);
              const span = yearSpan(items);
              return (
                <section className={styles.sourceGroup} key={key}>
                  <div className={styles.groupHeading}>
                    <h3>{label}</h3>
                    <span>{items.length}{span ? ` · ${span}` : ""}</span>
                  </div>
                  <div className={styles.sourceGrid}>
                    {shown.map((pub) => (
                      <SourceCard
                        key={pub.id}
                        id={pub.id}
                        title={pub.title}
                        sourceType={pub.source_type}
                        year={pub.year}
                        publisher={byPublisher ? null : pub.publisher}
                        coverUrl={pub.cover_url}
                        titleAs="h4"
                      />
                    ))}
                  </div>
                  {items.length > GROUP_PREVIEW ? (
                    <button
                      type="button"
                      className={styles.groupMore}
                      aria-expanded={open}
                      onClick={() => setExpanded((current) => (
                        open ? current.filter((entry) => entry !== key) : [...current, key]
                      ))}
                    >
                      {open
                        ? `Vis færre fra ${label}`
                        : `Vis alle ${items.length} fra ${label}`}
                    </button>
                  ) : null}
                </section>
              );
            })}
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
