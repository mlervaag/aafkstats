"use client";

import React, { useEffect, useState } from "react";
import styles from "./ContributeVerificationCard.module.css";

interface ContributeVerificationCardProps {
  openCaseIds: string[];
  researchCaseCount: number;
  newspaperCaseCount: number;
  directCaseCount: number;
  minimumMinutes: number;
  maximumMinutes: number;
}

function caseCount(count: number): string {
  return `${count} ${count === 1 ? "sak" : "saker"}`;
}

export function ContributeVerificationCard({
  openCaseIds,
  researchCaseCount,
  newspaperCaseCount,
  directCaseCount,
  minimumMinutes,
  maximumMinutes,
}: ContributeVerificationCardProps) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch("/api/verifications/checkout", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { submitted?: string[] };
        const openCases = new Set(openCaseIds);
        if (active) {
          setPendingCount((result.submitted ?? []).filter((id) => openCases.has(id)).length);
        }
      } catch {
        // Antallet åpne saker er fortsatt nyttig om innboksen ikke kan leses.
      }
    }

    void loadStatus();
    return () => { active = false; };
  }, [openCaseIds]);

  const availableCount = Math.max(openCaseIds.length - (pendingCount ?? 0), 0);
  const timeEstimate = minimumMinutes === maximumMinutes
    ? `${minimumMinutes} minutter`
    : `${minimumMinutes}–${maximumMinutes} minutter`;

  return (
    <section className={styles.card} aria-labelledby="verification-contribution-title">
      <div className={styles.copy}>
        <span className="card-kicker">Enkleste måten å bidra</span>
        <h2 id="verification-contribution-title">Kontroller én konkret sak</h2>
        <p>
          Du får ett konkret spørsmål og leter etter svaret i en avis eller en annen
          historisk kilde. Ingen forkunnskaper eller konto kreves.
        </p>
        <p className={styles.safety}>
          Du beskriver funnet og hvor du fant det. En redaktør vurderer dokumentasjonen
          før arkivet endres.
        </p>
        <div className={styles.caseTypes} aria-label="Typer saker du kan kontrollere">
          <div>
            <strong>Avisresearch</strong>
            <span>{caseCount(researchCaseCount)}</span>
            <p>Finn riktig kamp, dato eller kildepåstand på en kontrollert avisside.</p>
            <a href="/mangler/saker?type=avisresearch">Se research-sakene</a>
          </div>
          <div>
            <strong>Kamp fra avis</strong>
            <span>{caseCount(newspaperCaseCount)}</span>
            <p>Åpne en bestemt Sunnmørsposten-side og kontroller lagpar og resultat.</p>
          </div>
          <div>
            <strong>Direkte kildekontroll</strong>
            <span>{caseCount(directCaseCount)}</span>
            <p>Avklar en konkret kildekonflikt om kamp, person, verv eller klubb.</p>
          </div>
        </div>
      </div>

      <div className={styles.action}>
        <p className={styles.status} aria-live="polite">
          <strong>
            {availableCount > 0 ? `${caseCount(availableCount)} trenger hjelp` : "Alle sakene er tatt akkurat nå"}
          </strong>
          {pendingCount !== null && pendingCount > 0 ? (
            <span>{caseCount(pendingCount)} venter på vurdering</span>
          ) : availableCount === 0 ? (
            <span>Se historikken, eller kom tilbake senere.</span>
          ) : null}
          {availableCount > 0 ? <span>Vanligvis {timeEstimate} per sak</span> : null}
        </p>
        <a className="button-link" href="/mangler">
          {availableCount > 0 ? "Finn en sak å kontrollere" : "Se bidrag og historikk"}
        </a>
        <a className={styles.directoryLink} href="/mangler/saker">Se alle åpne saker</a>
        <a className={styles.directoryLink} href="/mangler/oversikt">Se absolutt alle mangler og lister</a>
      </div>
    </section>
  );
}
