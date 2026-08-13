"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { VerificationCaseView } from "@/lib/verifications";
import styles from "./VerificationHistory.module.css";

const STATUS_LABELS: Partial<Record<VerificationCaseView["status"], string>> = {
  resolved: "Avgjort",
  rejected: "Avsluttet uten endring",
  superseded: "Erstattet",
};

export function VerificationHistory({ cases }: { cases: VerificationCaseView[] }) {
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      let owner = crypto.randomUUID();
      try {
        owner = sessionStorage.getItem("aafk-verification-checkout-owner") ?? owner;
      } catch {
        // Owner brukes bare for at egen checkout ikke skal regnes som opptatt.
      }
      try {
        const response = await fetch(`/api/verifications/checkout?owner=${encodeURIComponent(owner)}`, { cache: "no-store" });
        const result = await response.json() as { submitted?: string[] };
        if (active && response.ok) setSubmittedIds(result.submitted ?? []);
      } catch {
        // Ferdig historikk vises fortsatt om innboksen er midlertidig utilgjengelig.
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const pending = useMemo(() => {
    const submitted = new Set(submittedIds);
    return cases.filter((item) => item.status === "open" && submitted.has(item.id));
  }, [cases, submittedIds]);
  const decided = cases.filter((item) => item.status === "resolved" || item.status === "rejected" || item.status === "superseded");

  return (
    <section className={styles.history} aria-labelledby="verification-history-title">
      <header className={styles.heading}>
        <div>
          <p className="eyebrow">Fra funn til arkiv</p>
          <h2 id="verification-history-title">Se hva andre har kontrollert</h2>
        </div>
        <p>
          Et bidrag blir først vurdert av arkivredaksjonen. Deretter får saken en varig
          konklusjon med begrunnelse og lenke til eventuell dataendring.
        </p>
      </header>

      <ol className={styles.guide} aria-label="Slik behandles et bidrag">
        <li><span>1</span><strong>Kontroller</strong><small>Finn den konkrete siden eller kilden.</small></li>
        <li><span>2</span><strong>Dokumenter</strong><small>Svar JA eller NEI og beskriv funnet.</small></li>
        <li><span>3</span><strong>Avgjør</strong><small>En redaktør vurderer belegget og oppdaterer arkivet.</small></li>
      </ol>

      <div className={styles.columns}>
        <section aria-labelledby="pending-title">
          <div className={styles.columnHeading}>
            <h3 id="pending-title">Venter på vurdering</h3>
            <span>{pending.length}</span>
          </div>
          {pending.length ? (
            <ul className={styles.items}>
              {pending.map((item) => (
                <li key={item.id}>
                  <span className={styles.pending}>Innsendt</span>
                  <strong>{item.question}</strong>
                  <p>Dokumentasjon er levert. Saken er skjult fra arbeidskøen mens den vurderes.</p>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}>Ingen saker venter på vurdering akkurat nå.</p>}
        </section>

        <section aria-labelledby="decided-title">
          <div className={styles.columnHeading}>
            <h3 id="decided-title">Ferdig avgjort</h3>
            <span>{decided.length}</span>
          </div>
          {decided.length ? (
            <ul className={styles.items}>
              {decided.map((item) => (
                <li key={item.id}>
                  <span>{STATUS_LABELS[item.status]}</span>
                  <strong>{item.question}</strong>
                  {item.resolution && <p><b>{item.resolution.answer === "yes" ? "JA" : item.resolution.answer === "no" ? "NEI" : "Ikke avgjørbart"}:</b> {item.resolution.reason}</p>}
                  <a href={item.href}>Se konklusjon og kilder <span aria-hidden="true">→</span></a>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}>De første konklusjonene vises her når redaksjonen har behandlet dem.</p>}
        </section>
      </div>
    </section>
  );
}
