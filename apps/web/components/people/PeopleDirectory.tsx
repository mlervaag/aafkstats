"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import type { PersonSummary } from "@/lib/people";
import styles from "./PeopleDirectory.module.css";

const FILTERS = [
  { id: "all", label: "Alle" },
  { id: "player", label: "Spillere" },
  { id: "coach", label: "Trenere" },
  { id: "organization", label: "Organisasjon" },
  { id: "honorary", label: "Heder" },
] as const;

type FilterId = typeof FILTERS[number]["id"];

const ROLE_LABELS: Record<string, string> = {
  coach: "Trener",
  sporting_staff: "Sportslig apparat",
  board: "Styre",
  administration: "Administrasjon",
  honorary: "Heder",
};

const POSITION_LABELS: Record<string, string> = {
  keeper: "Keeper",
  forsvar: "Forsvar",
  midtbane: "Midtbane",
  angrep: "Angrep",
};

function searchable(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("nb");
}

function belongsTo(person: PersonSummary, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "player") return person.appearances > 0 || person.position !== null || person.role_categories.includes("player");
  if (filter === "coach") return person.role_categories.includes("coach");
  if (filter === "honorary") return person.role_categories.includes("honorary");
  return person.role_categories.some((role) => ["board", "administration", "sporting_staff"].includes(role));
}

function period(person: PersonSummary): string | null {
  const from = person.first_season ?? (person.first_role_year ? Number(person.first_role_year) : null);
  const to = person.last_season ?? (person.last_role_year ? Number(person.last_role_year) : null);
  if (from === null) return null;
  return to !== null && to !== from ? `${from}–${to}` : String(from);
}

export function PeopleDirectory({ people }: { people: PersonSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const deferredQuery = useDeferredValue(query);

  const counts = useMemo(() => new Map(
    FILTERS.map((entry) => [entry.id, people.filter((person) => belongsTo(person, entry.id)).length]),
  ), [people]);

  const visible = useMemo(() => {
    const needle = searchable(deferredQuery.trim());
    return people.filter((person) => {
      if (!belongsTo(person, filter)) return false;
      if (!needle) return true;
      const labels = person.role_categories.map((role) => ROLE_LABELS[role] ?? role);
      return searchable([person.name, person.nationality, person.position, ...labels].filter(Boolean).join(" ")).includes(needle);
    });
  }, [deferredQuery, filter, people]);

  return (
    <div className={styles.directory}>
      <div className={styles.controls}>
        <label className={styles.search}>
          <span>Søk etter navn, rolle eller nasjonalitet</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="For eksempel Haller, trener eller Danmark"
          />
        </label>
        <div className={styles.filters} aria-label="Filtrer personer">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}<span>{counts.get(entry.id) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <p className={styles.resultCount} aria-live="polite">
        {visible.length} {visible.length === 1 ? "person" : "personer"}
      </p>

      {visible.length > 0 ? (
        <ol className={styles.grid}>
          {visible.map((person) => {
            const labels = new Set(person.role_categories.map((role) => ROLE_LABELS[role] ?? role));
            if (person.appearances > 0 || person.position) labels.add(POSITION_LABELS[person.position ?? ""] ?? "Spiller");
            return (
              <li key={person.id}>
                <Link href={`/personer/${person.id}`}>
                  <div className={styles.monogram} aria-hidden="true">
                    {person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardHeading}>
                      <h2>{person.name}</h2>
                      {period(person) ? <span className="num">{period(person)}</span> : null}
                    </div>
                    <div className={styles.tags}>
                      {[...labels].slice(0, 3).map((label) => <span key={label}>{label}</span>)}
                    </div>
                    {person.appearances > 0 ? (
                      <p>{person.appearances} registrerte kamptropper · {person.starts} starter</p>
                    ) : (
                      <p>{person.role_count} {person.role_count === 1 ? "kildeført rolle" : "kildeførte roller"}</p>
                    )}
                  </div>
                  <span className={styles.arrow} aria-hidden="true">→</span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={styles.empty}>
          <h2>Ingen treff</h2>
          <p>Prøv et annet navn eller fjern et filter.</p>
        </div>
      )}
    </div>
  );
}
