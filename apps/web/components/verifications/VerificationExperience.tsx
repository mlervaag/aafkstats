"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { contributionIssueUrl } from "@/lib/contribution-links";
import { trackEvent } from "@/lib/analytics";
import {
  EMPTY_VERIFICATION_DRAFT,
  restoreVerificationDraft,
  type VerificationAnswer,
  type VerificationDraft,
} from "@/lib/verification-draft";
import type { VerificationCaseView } from "@/lib/verifications";
import styles from "./VerificationExperience.module.css";

const CATEGORY_LABELS: Record<VerificationCaseView["category"], string> = {
  role: "Verv og klubbhistorie",
  identity: "Personidentitet",
  match: "Kampresultat",
  source_reading: "Kildelesing",
  club: "Klubbidentitet",
};

const NO_REASONS = ["Annet lagpar", "Annet sluttresultat", "Reserve- eller aldersbestemt lag", "Annen kamp på samme side"];
const INCONCLUSIVE_REASONS = ["Utydelig faksimile", "Siden mangler", "Lag eller resultat kan ikke leses", "Flere mulige kamper"];

function progressKey(id: string, revision: string): string {
  return `aafk-verification-draft:${id}:${revision}`;
}

function githubFallback(current: VerificationCaseView, draft: VerificationDraft): string {
  const documentation = draft.evidenceKind === "new_url"
    ? [draft.url, draft.reference].filter(Boolean).join(" — ")
    : draft.evidenceKind === "listed_source"
      ? [draft.sourceKey, draft.reference].filter(Boolean).join(" — ")
      : draft.reference;
  return contributionIssueUrl("verifisering", current.question, {
    sak: `${current.id} — /mangler/${current.id}`,
    revisjon: current.revision,
    svar: draft.answer === "yes" ? "JA" : draft.answer === "no" ? "NEI" : draft.answer === "inconclusive" ? "KAN IKKE BESTEMMES" : "",
    dokumentasjon: documentation,
    funn: draft.finding,
    kommentar: draft.comment,
    navn: draft.contributor,
  });
}

export function availableVerificationCases(
  cases: VerificationCaseView[],
  unavailableCaseIds: string[],
): VerificationCaseView[] {
  const unavailable = new Set(unavailableCaseIds);
  return cases.filter((item) => !unavailable.has(item.id));
}

export function VerificationExperience({ cases, startCaseId }: { cases: VerificationCaseView[]; startCaseId?: string }) {
  const orderedCases = useMemo(() => {
    if (!startCaseId) return cases;
    const chosen = cases.find((item) => item.id === startCaseId);
    return chosen ? [chosen, ...cases.filter((item) => item.id !== startCaseId)] : cases;
  }, [cases, startCaseId]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<VerificationDraft>(EMPTY_VERIFICATION_DRAFT);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [unavailableCaseIds, setUnavailableCaseIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [checkoutOwner, setCheckoutOwner] = useState<string | null>(null);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [reservation, setReservation] = useState<"idle" | "checking" | "acquired" | "unavailable">("idle");
  const [reservationNotice, setReservationNotice] = useState<string | null>(null);
  const verificationStartedAt = useRef<number | null>(null);

  const current = orderedCases[index];
  const availableCases = useMemo(
    () => availableVerificationCases(orderedCases, unavailableCaseIds),
    [orderedCases, unavailableCaseIds],
  );
  const currentPosition = availableCases.findIndex((item) => item.id === current?.id) + 1;

  useEffect(() => {
    let owner = crypto.randomUUID();
    try {
      const savedOwner = sessionStorage.getItem("aafk-verification-checkout-owner");
      if (savedOwner) {
        owner = savedOwner;
      } else {
        sessionStorage.setItem("aafk-verification-checkout-owner", owner);
      }
    } catch {
      // En flyktig ID er nok når nettleserlagring er blokkert.
    }
    setCheckoutOwner(owner);
    try {
      setCompleted(JSON.parse(localStorage.getItem("aafk-verifications-completed") ?? "[]") as string[]);
      setSkipped(JSON.parse(sessionStorage.getItem("aafk-verifications-skipped") ?? "[]") as string[]);
    } catch {
      // Lagring er bare en bekvemmelighet. Privat modus skal ikke blokkere arbeidet.
    }
  }, []);

  useEffect(() => {
    if (!checkoutOwner) return;
    const owner = checkoutOwner;
    let active = true;

    async function loadSubmittedCases() {
      try {
        const response = await fetch(
          `/api/verifications/checkout?owner=${encodeURIComponent(owner)}`,
          { cache: "no-store" },
        );
        const result = await response.json() as { submitted?: string[] };
        if (!active || !response.ok) return;

        const submitted = result.submitted ?? [];
        const blocked = new Set(submitted);
        setUnavailableCaseIds((ids) => [...new Set([...ids, ...submitted])]);
        setIndex((currentIndex) => {
          const selected = orderedCases[currentIndex];
          if (!selected || !blocked.has(selected.id)) return currentIndex;
          return orderedCases.findIndex((item) => !blocked.has(item.id));
        });
        setAvailabilityChecked(true);
      } catch {
        // Køen virker fortsatt. Uten innbokssjekken viser vi ikke et usikkert totaltall.
      }
    }

    void loadSubmittedCases();
    return () => { active = false; };
  }, [checkoutOwner, orderedCases]);

  useEffect(() => {
    if (!current || !checkoutOwner || reservation !== "acquired") return;
    const caseId = current.id;
    const renew = window.setInterval(() => {
      void fetch("/api/verifications/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, owner: checkoutOwner }),
      });
    }, 4 * 60 * 1000);
    return () => {
      window.clearInterval(renew);
    };
  }, [checkoutOwner, current, reservation]);

  useEffect(() => {
    if (!current) return;
    const key = progressKey(current.id, current.revision);
    verificationStartedAt.current = null;
    setError(null);
    setSuccessUrl(null);
    setShowEvidence(false);
    setReservation("idle");
    try {
      const saved = sessionStorage.getItem(key);
      const nextDraft = restoreVerificationDraft(saved, current.sources[0]?.key ?? "", current.sources.length > 0);
      verificationStartedAt.current = nextDraft.answer ? Date.now() : null;
      setDraft(nextDraft);
      setDraftFor(key);
      setShowEvidence(Boolean(nextDraft.answer));
    } catch {
      const nextDraft = restoreVerificationDraft(null, current.sources[0]?.key ?? "", current.sources.length > 0);
      setDraft(nextDraft);
      setDraftFor(key);
    }
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const key = progressKey(current.id, current.revision);
    if (draftFor !== key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // Se kommentaren over: selve innsendingen er ikke avhengig av nettleserlagring.
    }
  }, [current, draft, draftFor]);

  if (!current) {
    return (
      <section className={styles.empty}>
        <p className="eyebrow">Arbeidskøen er tom</p>
        <h1>Alt er kontrollert akkurat nå</h1>
        <p>Nye konkrete spørsmål blir lagt ut etter hvert som arkivet finner usikkerhet.</p>
        <a className={styles.secondaryButton} href="/mangler/oversikt">Se hele mangellista</a>
      </section>
    );
  }

  function applyAnswer(answer: VerificationAnswer) {
    if (verificationStartedAt.current === null) {
      verificationStartedAt.current = Date.now();
      trackEvent("verification-started", { category: current.category });
    }
    setDraft((value) => ({ ...value, answer }));
    if (current.newspaper) {
      trackEvent("newspaper-verification-answer", {
        category: "match",
        answer,
        year: current.newspaper.sourceResult.year,
        discovery_status: current.newspaper.hypothesis.discoveryStatus,
        seconds: Math.max(0, Math.round((Date.now() - (verificationStartedAt.current ?? Date.now())) / 1000)),
      });
    }
    setShowEvidence(true);
    setError(null);
    window.setTimeout(() => document.getElementById("dokumentasjon")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  async function chooseAnswer(answer: VerificationAnswer) {
    if (!checkoutOwner || reservation === "acquired") return applyAnswer(answer);
    setReservation("checking");
    setReservationNotice(null);
    try {
      const response = await fetch("/api/verifications/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: current.id, owner: checkoutOwner }),
      });
      const result = await response.json() as { submitted?: boolean };
      if (response.ok) {
        setReservation("acquired");
        return applyAnswer(answer);
      }
      if (response.status === 409) {
        const blocked = [...new Set([...unavailableCaseIds, current.id])];
        setUnavailableCaseIds(blocked);
        setReservation("unavailable");
        setReservationNotice(result.submitted
          ? "Denne saken er allerede sendt inn til vurdering. Vi fant en ny til deg."
          : "Den saken arbeides det allerede med. Vi fant en ny til deg.");
        const unavailable = new Set([...blocked, ...completed, ...skipped]);
        const nextIndex = orderedCases.findIndex((item) => !unavailable.has(item.id));
        window.setTimeout(() => setIndex(nextIndex), 500);
        return;
      }
      setReservation("idle");
      applyAnswer(answer);
    } catch {
      // Checkout er bare en kollisjonsbrems. Nettverksfeil skal ikke stoppe bidrag.
      setReservation("idle");
      applyAnswer(answer);
    }
  }

  function moveNext(kind: "completed" | "skipped") {
    const id = current.id;
    if (kind === "skipped" && !successUrl) {
      trackEvent("verification-skipped", { category: current.category });
    }
    const nextCompleted = kind === "completed" ? [...new Set([...completed, id])] : completed;
    const nextSkipped = kind === "skipped" ? [...new Set([...skipped, id])] : skipped;
    setCompleted(nextCompleted);
    setSkipped(nextSkipped);
    try {
      localStorage.setItem("aafk-verifications-completed", JSON.stringify(nextCompleted));
      sessionStorage.setItem("aafk-verifications-skipped", JSON.stringify(nextSkipped));
      sessionStorage.removeItem(progressKey(current.id, current.revision));
    } catch {
      // Fremdriftslagring er valgfri og kan være blokkert i privat modus.
    }

    if (checkoutOwner) {
      void fetch("/api/verifications/checkout", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: current.id, owner: checkoutOwner }),
        keepalive: true,
      });
    }

    const unavailable = new Set([...nextCompleted, ...nextSkipped, ...unavailableCaseIds]);
    const nextIndex = orderedCases.findIndex((item, candidateIndex) => candidateIndex !== index && !unavailable.has(item.id));
    setIndex(nextIndex);
  }

  async function shareCase() {
    const url = `${window.location.origin}/mangler/${current.id}`;
    try {
      if (navigator.share) await navigator.share({ title: current.question, text: "Kan du hjelpe AaFK-arkivet med å kontrollere denne?", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // Avbrutt deling er ikke en feil brukeren trenger å rydde opp i.
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.answer) return setError("Velg JA, NEI eller KAN IKKE BESTEMMES først.");
    if (!current.newspaper && draft.finding.trim().length < 3) return setError("Beskriv kort hva du fant i kilden.");
    if (draft.evidenceKind === "listed_source" && !draft.sourceKey) return setError("Velg kilden du kontrollerte.");
    if (draft.evidenceKind === "new_url" && !/^https?:\/\/\S+$/i.test(draft.url.trim())) return setError("Skriv inn en gyldig nettlenke.");
    if (draft.evidenceKind === "bibliographic" && draft.reference.trim().length < 3) return setError("Oppgi publikasjon, dato og side.");

    setSubmitting(true);
    setError(null);
    const evidence = draft.evidenceKind === "listed_source"
      ? { kind: "listed_source", sourceKey: draft.sourceKey, reference: draft.reference || undefined }
      : draft.evidenceKind === "new_url"
        ? { kind: "new_url", url: draft.url, reference: draft.reference || undefined }
        : { kind: "bibliographic", reference: draft.reference };
    try {
      const response = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: current.id,
          revision: current.revision,
          answer: draft.answer,
          evidence,
          finding: draft.finding,
          communityFinding: current.newspaper ? {
            scoreAgreement: draft.scoreAgreement || undefined,
            matchDate: draft.matchDate || undefined,
            dateReadable: draft.dateReadable || undefined,
            homeAway: draft.homeAway || undefined,
            competition: draft.competition || undefined,
            reasons: draft.reasons.length ? draft.reasons : undefined,
          } : undefined,
          comment: draft.comment || undefined,
          contributor: draft.contributor || undefined,
          clientSubmissionId: draft.clientSubmissionId,
          company: "",
        }),
      });
      const result = await response.json() as { error?: string; issueUrl?: string };
      if (!response.ok) throw new Error(result.error ?? "Klarte ikke å sende inn svaret.");
      setSuccessUrl(result.issueUrl ?? "sendt");
      trackEvent("verification-submitted", {
        category: current.category,
        evidence: draft.evidenceKind,
        status: "ok",
        seconds: Math.max(0, Math.round((Date.now() - (verificationStartedAt.current ?? Date.now())) / 1000)),
      });
      if (current.newspaper) trackEvent("newspaper-verification-submitted", {
        category: "match",
        answer: draft.answer,
        year: current.newspaper.sourceResult.year,
        discovery_status: current.newspaper.hypothesis.discoveryStatus,
        seconds: Math.max(0, Math.round((Date.now() - (verificationStartedAt.current ?? Date.now())) / 1000)),
        submission_status: "ok",
      });
      if (checkoutOwner) {
        void fetch("/api/verifications/checkout", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId: current.id, owner: checkoutOwner }),
          keepalive: true,
        });
      }
      try {
        sessionStorage.removeItem(progressKey(current.id, current.revision));
      } catch {
        // Innsendingen er allerede fullført; opprydding av utkast er valgfri.
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Klarte ikke å sende inn svaret.");
      trackEvent("verification-submitted", {
        category: current.category,
        evidence: draft.evidenceKind,
        status: "error",
        seconds: Math.max(0, Math.round((Date.now() - (verificationStartedAt.current ?? Date.now())) / 1000)),
      });
      if (current.newspaper) trackEvent("newspaper-verification-submitted", {
        category: "match",
        answer: draft.answer,
        year: current.newspaper.sourceResult.year,
        discovery_status: current.newspaper.hypothesis.discoveryStatus,
        seconds: Math.max(0, Math.round((Date.now() - (verificationStartedAt.current ?? Date.now())) / 1000)),
        submission_status: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function toggleReason(reason: string) {
    setDraft((value) => ({
      ...value,
      reasons: value.reasons.includes(reason) ? value.reasons.filter((entry) => entry !== reason) : [...value.reasons, reason],
    }));
  }

  const doneCount = completed.filter((id) => orderedCases.some((item) => item.id === id)).length;

  return (
    <div className={styles.experience}>
      <header className={styles.hero}>
        <div>
          <p className="eyebrow">Hjelp arkivet — ett svar om gangen</p>
          <h1>Kan du kontrollere dette?</h1>
          <p>Finn dokumentasjonen. Svar JA, NEI eller KAN IKKE BESTEMMES. Arkivredaksjonen vurderer funnet før data endres.</p>
        </div>
        <div className={styles.progress} aria-label={`${doneCount} saker fullført i denne nettleseren`}>
          <span>{doneCount}</span>
          <small>kontrollert av deg</small>
        </div>
      </header>

      <nav className={styles.utilityNav} aria-label="Arbeidskø">
        <a href="/mangler/saker">
          {availabilityChecked ? `Se alle ${availableCases.length} saker` : "Se alle saker"}
        </a>
        <a href="/mangler/oversikt">Hele mangellista</a>
      </nav>

      {reservationNotice && <p className={styles.reservationNotice} role="status">{reservationNotice}</p>}

      <article className={styles.caseCard} aria-labelledby="case-question" aria-busy={reservation === "checking"}>
        <div className={styles.caseMeta}>
          <span>{CATEGORY_LABELS[current.category]}</span>
          <span>ca. {current.estimatedMinutes} min</span>
          <span>
            {availabilityChecked && currentPosition > 0
              ? `Sak ${currentPosition} av ${availableCases.length}`
              : "Sak i arbeidskøen"}
          </span>
        </div>

        <div className={styles.questionBlock}>
          <p className={styles.claimLabel}>Påstanden er</p>
          <h2 id="case-question">{current.question}</h2>
          <p>{current.context}</p>
          {current.newspaper ? (
            <dl className={styles.newspaperFacts}>
              <div><dt>Sesong</dt><dd>{current.newspaper.sourceResult.year}</dd></div>
              <div><dt>Motstander</dt><dd>{current.newspaper.sourceResult.opponent}</dd></div>
              <div><dt>Forventet resultat</dt><dd>{current.newspaper.sourceResult.expectedScore.aafk}–{current.newspaper.sourceResult.expectedScore.opponent}</dd></div>
              <div><dt>Konkurranse</dt><dd>{current.newspaper.sourceResult.competition ?? "Ikke oppgitt"}</dd></div>
            </dl>
          ) : <a href={current.target.href}>Se oppføringen i arkivet <span aria-hidden="true">→</span></a>}
        </div>

        <details className={styles.helpBox}>
          <summary>Slik finner du svaret</summary>
          <ol>{current.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
          {current.searchHint && <p><strong>Tips:</strong> {current.searchHint}</p>}
        </details>

        {current.newspaper ? (
          <section className={styles.newspaperSource} aria-labelledby="newspaper-source-title">
            <div>
              <p className="eyebrow">Aviskilde</p>
              <h3 id="newspaper-source-title">{current.newspaper.newspaper.title}</h3>
              <p>Utgave {current.newspaper.newspaper.issueDate} · side {current.newspaper.newspaper.page}</p>
            </div>
            <a href={current.newspaper.newspaper.pageUrl} target="_blank" rel="noreferrer" onClick={() => trackEvent("newspaper-verification-open-source", {
              category: "match",
              year: current.newspaper!.sourceResult.year,
              discovery_status: current.newspaper!.hypothesis.discoveryStatus,
            })}>Åpne avissiden hos NB <span aria-hidden="true">↗</span></a>
          </section>
        ) : current.sources.length > 0 && (
          <section className={styles.sources} aria-labelledby="sources-title">
            <h3 id="sources-title">Kilder å kontrollere</h3>
            <div className={styles.sourceList}>
              {current.sources.map((source) => (
                <div className={styles.source} key={source.key}>
                  <div>
                    <strong>{source.title}</strong>
                    <span>{source.page ? `Side ${source.page}` : "Nettkilde"}</span>
                  </div>
                  {source.note && <p>{source.note}</p>}
                  {source.href && (
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackEvent("verification-source-opened", { category: current.category })}
                    >
                      Åpne kilde <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={styles.answerSection} aria-labelledby="answer-title">
          <div className={styles.sectionHeading}>
            <div><span>1</span><h3 id="answer-title">Hva viser dokumentasjonen?</h3></div>
            <p>Ikke svar ut fra hva som virker sannsynlig.</p>
          </div>
          <div className={styles.answerGrid}>
            <button className={`${styles.answerButton} ${draft.answer === "yes" ? styles.selectedYes : ""}`} type="button" onClick={() => void chooseAnswer("yes")} aria-pressed={draft.answer === "yes"} disabled={reservation === "checking"}>
              <span className={styles.answerWord}>JA</span><span>{current.yesMeaning}</span>
            </button>
            <button className={`${styles.answerButton} ${draft.answer === "no" ? styles.selectedNo : ""}`} type="button" onClick={() => void chooseAnswer("no")} aria-pressed={draft.answer === "no"} disabled={reservation === "checking"}>
              <span className={styles.answerWord}>NEI</span><span>{current.noMeaning}</span>
            </button>
            <button className={`${styles.answerButton} ${draft.answer === "inconclusive" ? styles.selectedInconclusive : ""}`} type="button" onClick={() => void chooseAnswer("inconclusive")} aria-pressed={draft.answer === "inconclusive"} disabled={reservation === "checking"}>
              <span className={styles.answerWord}>KAN IKKE BESTEMMES</span><span>{current.inconclusiveMeaning}</span>
            </button>
          </div>
        </section>

        {showEvidence && (
          <form id="dokumentasjon" className={styles.evidenceForm} onSubmit={submit}>
            <div className={styles.sectionHeading}>
              <div><span>2</span><h3>Vis hvor du fant svaret</h3></div>
              <p>Et svar endrer aldri arkivet automatisk.</p>
            </div>

            {!current.newspaper && <fieldset className={styles.evidenceChoices}>
              <legend>Type dokumentasjon</legend>
              {current.sources.length > 0 && <label><input type="radio" name="evidence" checked={draft.evidenceKind === "listed_source"} onChange={() => setDraft((value) => ({ ...value, evidenceKind: "listed_source" }))} /> En kilde som er oppgitt over</label>}
              <label><input type="radio" name="evidence" checked={draft.evidenceKind === "new_url"} onChange={() => setDraft((value) => ({ ...value, evidenceKind: "new_url" }))} /> En annen nettlenke</label>
              <label><input type="radio" name="evidence" checked={draft.evidenceKind === "bibliographic"} onChange={() => setDraft((value) => ({ ...value, evidenceKind: "bibliographic" }))} /> Avis, bok eller blad uten nettlenke</label>
            </fieldset>}

            {!current.newspaper && draft.evidenceKind === "listed_source" && (
              <label className={styles.field}>Hvilken kilde?
                <select value={draft.sourceKey} onChange={(event) => setDraft((value) => ({ ...value, sourceKey: event.target.value }))}>
                  {current.sources.map((source) => <option value={source.key} key={source.key}>{source.title}{source.page ? `, side ${source.page}` : ""}</option>)}
                </select>
              </label>
            )}
            {!current.newspaper && draft.evidenceKind === "new_url" && <label className={styles.field}>Lenke <input type="url" inputMode="url" placeholder="https://…" value={draft.url} onChange={(event) => setDraft((value) => ({ ...value, url: event.target.value }))} required /></label>}
            {!current.newspaper && <label className={styles.field}>{draft.evidenceKind === "bibliographic" ? "Publikasjon, dato og side" : "Side, dato eller annen presisering (valgfritt)"}
              <input value={draft.reference} onChange={(event) => setDraft((value) => ({ ...value, reference: event.target.value }))} placeholder={draft.evidenceKind === "bibliographic" ? "Sunnmørsposten 12.03.1968, side 7" : "Side 18, venstre spalte"} required={draft.evidenceKind === "bibliographic"} />
            </label>}
            {current.newspaper && draft.answer === "yes" && <div className={styles.structuredFinding}>
              <label className={styles.field}>Stemmer sluttresultatet?<select value={draft.scoreAgreement} onChange={(event) => setDraft((value) => ({ ...value, scoreAgreement: event.target.value as VerificationDraft["scoreAgreement"] }))}><option value="">Ikke oppgitt</option><option value="yes">Ja</option><option value="no">Nei</option><option value="uncertain">Usikkert</option></select></label>
              <label className={styles.field}>Kampdato, hvis lesbar<input type="date" value={draft.matchDate} onChange={(event) => setDraft((value) => ({ ...value, matchDate: event.target.value }))} /></label>
              <label className={styles.field}>Er datoen lesbar?<select value={draft.dateReadable} onChange={(event) => setDraft((value) => ({ ...value, dateReadable: event.target.value as VerificationDraft["dateReadable"] }))}><option value="">Ikke oppgitt</option><option value="yes">Ja</option><option value="no">Nei</option><option value="uncertain">Usikkert</option></select></label>
              <label className={styles.field}>Hjemme/borte<select value={draft.homeAway} onChange={(event) => setDraft((value) => ({ ...value, homeAway: event.target.value as VerificationDraft["homeAway"] }))}><option value="">Ikke oppgitt</option><option value="home">Hjemme</option><option value="away">Borte</option><option value="neutral">Nøytral bane</option><option value="uncertain">Usikkert</option></select></label>
              <label className={styles.field}>Konkurranse<input maxLength={120} value={draft.competition} onChange={(event) => setDraft((value) => ({ ...value, competition: event.target.value }))} /></label>
            </div>}
            {current.newspaper && draft.answer !== "yes" && <fieldset className={styles.reasonChoices}><legend>Hva gjorde at du valgte dette? (valgfritt)</legend>{(draft.answer === "no" ? NO_REASONS : INCONCLUSIVE_REASONS).map((reason) => <label key={reason}><input type="checkbox" checked={draft.reasons.includes(reason)} onChange={() => toggleReason(reason)} /> {reason}</label>)}</fieldset>}
            <label className={styles.field}>{current.newspaper ? "Kort kommentar (valgfritt)" : "Hva fant du?"} {!current.newspaper && <span>Beskriv bare det som avgjør svaret.</span>}
              <textarea rows={current.newspaper ? 3 : 4} maxLength={1500} value={draft.finding} onChange={(event) => setDraft((value) => ({ ...value, finding: event.target.value }))} placeholder={current.newspaper ? "Bare hvis noe trenger en forklaring …" : "Årsoversikten oppgir …"} required={!current.newspaper} />
            </label>

            <details className={styles.optionalFields}>
              <summary>Kommentar eller navn (valgfritt)</summary>
              <label className={styles.field}>Kommentar<textarea rows={3} maxLength={1000} value={draft.comment} onChange={(event) => setDraft((value) => ({ ...value, comment: event.target.value }))} /></label>
              <label className={styles.field}>Navn eller kallenavn<input maxLength={100} autoComplete="name" value={draft.contributor} onChange={(event) => setDraft((value) => ({ ...value, contributor: event.target.value }))} /></label>
            </details>

            {error && <div className={styles.error} role="alert">{error} <a href={githubFallback(current, draft)} target="_blank" rel="noreferrer">Send via GitHub</a></div>}
            {successUrl ? (
              <div className={styles.success} role="status">
                <div><strong>Takk — funnet er sendt til vurdering.</strong><span>Arkivet endres først når dokumentasjonen er kontrollert.</span></div>
                {successUrl !== "sendt" && <a href={successUrl} target="_blank" rel="noreferrer">Se saken på GitHub</a>}
                <button type="button" onClick={() => moveNext("completed")}>Ta neste sak <span aria-hidden="true">→</span></button>
              </div>
            ) : (
              <div className={styles.submitRow}>
                <button className={styles.primaryButton} type="submit" disabled={submitting}>{submitting ? "Sender …" : "Send til vurdering"}</button>
                <a href={githubFallback(current, draft)} target="_blank" rel="noreferrer">Har du GitHub? Bruk skjemaet der</a>
              </div>
            )}
          </form>
        )}

        <footer className={styles.caseFooter}>
          <button type="button" onClick={() => moveNext("skipped")}>Hopp over denne</button>
          <button type="button" onClick={shareCase}>{copied ? "Lenken er kopiert" : "Del denne saken"}</button>
        </footer>
      </article>

      <aside className={styles.trust}>
        <strong>Trygt å bidra anonymt</strong>
        <p>Ingen konto kreves. Svaret blir en åpen sak på GitHub, gjennomgås av et menneske og kan spores tilbake til dokumentasjonen.</p>
      </aside>

      <section className={styles.completeOverview} aria-labelledby="complete-overview-title">
        <div>
          <p className="eyebrow">Arkivets komplette arbeidskø</p>
          <h2 id="complete-overview-title">Dette er den enkle inngangen. Resten er fortsatt her.</h2>
        </div>
        <div>
          <p>
            Kontrollkøen viser bare saker som kan avgjøres med manuell kontroll. Den fullstendige
            mangellista dekker også historiske resultater, sesongdekning, kampdetaljer,
            personkonflikter, identitet og maskinelt foreslåtte kildefunn.
          </p>
          <a className={styles.secondaryButton} href="/mangler/oversikt">
            Åpne hele mangellista <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>
    </div>
  );
}
