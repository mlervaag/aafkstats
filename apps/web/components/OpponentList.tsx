"use client";

import { useMemo, useState } from "react";
import type { OpponentSummary } from "@/lib/archive";

type SortKey = "name" | "played" | "wins" | "losses";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Alfabetisk" },
  { key: "played", label: "Flest kamper" },
  { key: "wins", label: "Flest seire" },
  { key: "losses", label: "Flest tap" },
];

/**
 * Lista over alle motstanderne arkivet har møtt.
 *
 * Sto som 165 rader i alfabetisk rekkefølge uten annen vei inn enn å rulle. Det
 * er en oppslagsbok, ikke en side: «hvem har vi møtt flest ganger» og «hvor står
 * vi mot Brann» er de to spørsmålene lista faktisk får, og ingen av dem lot seg
 * besvare uten å lese alt. Filteret svarer på det andre, sorteringen på det første.
 *
 * Målene lå allerede i `opponents`-viewet og ble ikke vist noe sted. En
 * innbyrdes statistikk uten målforskjell er halve tabellen.
 */
export function OpponentList({ opponents }: { opponents: OpponentSummary[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle === ""
      ? opponents
      : opponents.filter((o) =>
          o.opponent.toLowerCase().includes(needle) || (o.city ?? "").toLowerCase().includes(needle),
        );
    const sorted = [...filtered];
    // Alfabetisk er allerede rekkefølgen fra basen. De tre andre sorterer
    // synkende, med navnet som stille andrenøkkel så like tall ikke bytter plass
    // mellom to tegninger.
    if (sort !== "name") {
      sorted.sort((a, b) => b[sort] - a[sort] || a.opponent.localeCompare(b.opponent, "nb"));
    }
    return sorted;
  }, [opponents, query, sort]);

  return (
    <>
      <div className="opponent-controls">
        <label className="sr-only" htmlFor="motstander-sok">Søk etter motstander</label>
        <input
          id="motstander-sok"
          type="search"
          className="opponent-search"
          placeholder="Søk etter lag eller by …"
          value={query}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="opponent-sorts" role="group" aria-label="Sorter lista">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={option.key === sort ? "is-active" : undefined}
              aria-pressed={option.key === sort}
              onClick={() => setSort(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bare når det faktisk er filtrert. «Viser 165 av 165» er støy, men en
          skjermleser skal likevel få vite at treffmengden endret seg. */}
      <p className={query.trim() === "" ? "sr-only" : "small muted opponent-count"} aria-live="polite">
        Viser {visible.length} av {opponents.length} lag.
      </p>

      {visible.length === 0 ? (
        <p className="prose">Ingen lag matcher søket.</p>
      ) : (
        <div className="opponent-list">
          {visible.map((opponent) => (
            <a href={opponent.url} key={opponent.id}>
              <span>
                <strong>{opponent.opponent}</strong>
                {opponent.city && <small>{opponent.city}</small>}
              </span>
              <span className="record-line num">
                {opponent.wins} S · {opponent.draws} U · {opponent.losses} T
              </span>
              <span className="num muted opponent-goals">
                {opponent.goalsFor}–{opponent.goalsAgainst}
              </span>
              <span className="num muted">
                {opponent.played} {opponent.played === 1 ? "kamp" : "kamper"}
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
