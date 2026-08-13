"use client";

import { useEffect, useMemo, useState } from "react";
import type { VerificationCaseView } from "@/lib/verifications";
import styles from "./CaseDirectory.module.css";

const LABELS: Record<VerificationCaseView["category"], string> = {
  role: "Verv",
  identity: "Personer",
  match: "Kamper",
  source_reading: "Kildelesing",
  club: "Klubber",
};

export function CaseDirectory({ cases }: { cases: VerificationCaseView[] }) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [checkedOut, setCheckedOut] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        let owner = sessionStorage.getItem("aafk-verification-checkout-owner");
        if (!owner) {
          owner = crypto.randomUUID();
          sessionStorage.setItem("aafk-verification-checkout-owner", owner);
        }
        const response = await fetch(`/api/verifications/checkout?owner=${encodeURIComponent(owner)}`, { cache: "no-store" });
        const result = await response.json() as { checkedOut?: string[] };
        if (active && response.ok) setCheckedOut(result.checkedOut ?? []);
      } catch {
        // Listen virker fortsatt; reservasjoner er bare en kollisjonsbrems.
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("nb");
    return cases.filter((item) => !checkedOut.includes(item.id) &&
      (category === "all" || item.category === category) &&
      (!normalized || `${item.question} ${item.context}`.toLocaleLowerCase("nb").includes(normalized)),
    );
  }, [cases, category, checkedOut, query]);

  const categories = [...new Set(cases.map((item) => item.category))];
  return (
    <>
      <div className={styles.filters}>
        <label>Søk i sakene<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Navn, år eller motstander" /></label>
        <div className={styles.chips} aria-label="Filtrer etter type">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>Alle</button>
          {categories.map((value) => <button type="button" aria-pressed={category === value} onClick={() => setCategory(value)} key={value}>{LABELS[value]}</button>)}
        </div>
      </div>
      <p className={styles.count} aria-live="polite">{visible.length} {visible.length === 1 ? "sak" : "saker"}</p>
      <ol className={styles.list}>
        {visible.map((item) => (
          <li key={item.id}>
            <a href={`/mangler/${item.id}`}>
              <div className={styles.meta}><span>{LABELS[item.category]}</span><span>ca. {item.estimatedMinutes} min</span></div>
              <h2>{item.question}</h2>
              <p>{item.context}</p>
              <strong>Start kontrollen <span aria-hidden="true">→</span></strong>
            </a>
          </li>
        ))}
      </ol>
      {visible.length === 0 && <p className={styles.empty}>Ingen saker passer filteret. Prøv et annet ord eller vis alle kategorier.</p>}
    </>
  );
}
