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

const RESEARCH_LABELS = {
  sibling_resolution: "Avis – finn riktig kamp",
  date_research: "Avis – finn dato",
  score_conflict: "Avis – resultatkonflikt",
  competition_conflict: "Avis – konkurransekonflikt",
  source_reconciliation: "Avis – finn riktig kildeoppføring",
} as const;

function caseType(item: VerificationCaseView): string {
  if (item.researchTask) return `research:${item.researchTask.category}`;
  if (item.newspaper) return "newspaper_match";
  return "direct";
}

function caseTypeLabel(item: VerificationCaseView): string {
  return item.researchTask ? RESEARCH_LABELS[item.researchTask.category] : item.newspaper ? "Kamp fra avis" : LABELS[item.category];
}

export function CaseDirectory({ cases, initialCategory = "all" }: { cases: VerificationCaseView[]; initialCategory?: string }) {
  const [category, setCategory] = useState<string>(initialCategory);
  const [newspaper, setNewspaper] = useState("all");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        setCompleted(JSON.parse(localStorage.getItem("aafk-verifications-completed") ?? "[]") as string[]);
      } catch {
        setCompleted([]);
      }

      let owner = crypto.randomUUID();
      try {
        const savedOwner = sessionStorage.getItem("aafk-verification-checkout-owner");
        if (savedOwner) {
          owner = savedOwner;
        } else {
          sessionStorage.setItem("aafk-verification-checkout-owner", owner);
        }
      } catch {
        // En flyktig eier-ID er nok til å lese køen når nettleserlagring er blokkert.
      }

      try {
        const response = await fetch(`/api/verifications/checkout?owner=${encodeURIComponent(owner)}`, { cache: "no-store" });
        const result = await response.json() as { checkedOut?: string[]; submitted?: string[]; unavailable?: string[] };
        if (active && response.ok) {
          setUnavailable(result.unavailable ?? [...(result.checkedOut ?? []), ...(result.submitted ?? [])]);
        }
      } catch {
        // Listen virker fortsatt; reservasjoner og innbokssjekk er sikkerhetsnett.
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("nb");
    return cases.filter((item) => !unavailable.includes(item.id) && !completed.includes(item.id) &&
      (category === "all" || category === caseType(item) || (category === "research" && Boolean(item.researchTask))) &&
      (newspaper === "all" || item.newspaper?.newspaper.title === newspaper || item.researchTask?.actualVisualSource.title === newspaper) &&
      (period === "all" || Math.floor((item.newspaper?.sourceResult.year ?? item.researchTask?.season ?? 0) / 10) * 10 === Number(period)) &&
      (!normalized || `${item.question} ${item.context} ${item.newspaper?.sourceResult.opponent ?? ""} ${item.researchTask?.sourceResults[0]?.opponent ?? ""} ${item.newspaper?.sourceResult.year ?? item.researchTask?.season ?? ""}`.toLocaleLowerCase("nb").includes(normalized)),
    );
  }, [cases, category, completed, newspaper, period, query, unavailable]);

  const categories = [...new Set(cases.map(caseType))];
  const newspapers = [...new Set(cases.flatMap((item) => item.newspaper ? [item.newspaper.newspaper.title] : item.researchTask ? [item.researchTask.actualVisualSource.title] : []))];
  const periods = [...new Set(cases.flatMap((item) => item.newspaper ? [Math.floor(item.newspaper.sourceResult.year / 10) * 10] : item.researchTask ? [Math.floor(item.researchTask.season / 10) * 10] : []))].sort((a, b) => a - b);
  const researchCount = cases.filter((item) => item.researchTask).length;
  const newspaperCount = cases.filter((item) => item.newspaper).length;
  const directCount = cases.length - newspaperCount - researchCount;
  return (
    <>
      <div className={styles.caseGuide}>
        <div>
          <span>{researchCount} saker</span>
          <strong>Avisresearch</strong>
          <p>Skill mellom historiske møter, finn datoer og løs kildekonflikter på en konkret avisside.</p>
          <button type="button" onClick={() => setCategory("research")}>Vis research-sakene</button>
        </div>
        <div>
          <span>{newspaperCount} saker</span>
          <strong>Kamp fra avis</strong>
          <p>Du får én bestemt avisside og kontrollerer om lagpar og resultat stemmer.</p>
          <button type="button" onClick={() => setCategory("newspaper_match")}>Vis avissakene</button>
        </div>
        <div>
          <span>{directCount} saker</span>
          <strong>Direkte JA/NEI-kontroll</strong>
          <p>Du sammenligner en konkret påstand med en oppgitt kilde, ofte der kilder er uenige.</p>
          <button type="button" onClick={() => setCategory("direct")}>Vis de direkte sakene</button>
        </div>
      </div>
      <div className={styles.filters}>
        <label>Søk i sakene<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Navn, år eller motstander" /></label>
        <div className={styles.chips} aria-label="Filtrer etter type">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>Alle</button>
          {categories.map((value) => <button type="button" aria-pressed={category === value} onClick={() => setCategory(value)} key={value}>{value.startsWith("research:") ? RESEARCH_LABELS[value.slice(9) as keyof typeof RESEARCH_LABELS] : value === "newspaper_match" ? "Kamp fra avis" : "Direkte kildekontroll"}</button>)}
        </div>
        {newspapers.length > 0 && <label>Avis<select value={newspaper} onChange={(event) => setNewspaper(event.target.value)}><option value="all">Alle aviser</option>{newspapers.map((value) => <option key={value}>{value}</option>)}</select></label>}
        {periods.length > 0 && <label>Periode<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">Alle år</option>{periods.map((value) => <option value={value} key={value}>{value}–{value + 9}</option>)}</select></label>}
      </div>
      <p className={styles.count} aria-live="polite">{visible.length} {visible.length === 1 ? "sak" : "saker"}</p>
      <ol className={styles.list}>
        {visible.map((item) => (
          <li key={item.id}>
            <a href={`/mangler/${item.id}`}>
              <div className={styles.meta}><span>{caseTypeLabel(item)}</span><span>ca. {item.estimatedMinutes} min</span></div>
              <h2>{item.question}</h2>
              <p>{item.context}</p>
              <strong>Start kontrollen <span aria-hidden="true">→</span></strong>
            </a>
          </li>
        ))}
      </ol>
      {visible.length === 0 && <p className={styles.empty}>Ingen saker passer filteret. Prøv et annet ord eller vis alle kategorier.</p>}
      <aside className={styles.allMissing}>
        <div>
          <strong>Leter du etter hele arbeidslista?</strong>
          <p>Den komplette oversikten viser også historiske resultater, manglende kampfelt, sesongdekning, personkonflikter og lagoppstillingskandidater.</p>
        </div>
        <a href="/mangler/oversikt">Se absolutt alle mangler og lister <span aria-hidden="true">→</span></a>
      </aside>
    </>
  );
}
