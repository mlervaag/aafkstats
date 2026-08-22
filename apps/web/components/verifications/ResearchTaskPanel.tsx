import React from "react";
import type { NbCommunityResearchTask, NbResearchSourceResult } from "@aafkstats/schema";
import styles from "./ResearchTaskPanel.module.css";

function score(value: { aafk: number; opponent: number }): string {
  return `${value.aafk}–${value.opponent}`;
}

function homeAway(value?: "home" | "away" | "neutral" | "unknown"): string {
  if (value === "home") return "AaFK hjemme";
  if (value === "away") return "AaFK borte";
  if (value === "neutral") return "Nøytral bane";
  return "Ikke avklart";
}

function optionKey(option: NbResearchSourceResult): string {
  return `${option.sourceId}:${option.no}`;
}

interface ResearchTaskPanelProps {
  task: NbCommunityResearchTask;
  answer: string;
  selectedSourceResultKey: string;
  disabled: boolean;
  onChoose: (answer: string, selectedSourceResultKey?: string) => void;
}

export function ResearchTaskPanel({ task, answer, selectedSourceResultKey, disabled, onChoose }: ResearchTaskPanelProps) {
  const lead = task.sourceResults[0]!;
  const observed = task.observedEvent;
  const choice = (value: string, title: string, description: string) => (
    <button
      type="button"
      className={answer === value ? styles.selected : undefined}
      aria-pressed={answer === value}
      disabled={disabled}
      onClick={() => onChoose(value)}
    >
      <strong>{title}</strong><span>{description}</span>
    </button>
  );

  return (
    <>
      <section className={styles.source} aria-labelledby="research-source-title">
        <div>
          <p>Kilden</p>
          <h3 id="research-source-title">{task.actualVisualSource.title}</h3>
          <span>{task.actualVisualSource.issueDate} · trykt side {task.actualVisualSource.printedPage}</span>
        </div>
        <a href={task.actualVisualSource.pageUrl} target="_blank" rel="noreferrer">
          Åpne avissiden <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className={styles.known} aria-labelledby="research-known-title">
        <div>
          <p>Dette vet vi allerede</p>
          <h3 id="research-known-title">Det kildekontrollen fant på siden</h3>
          <span>{observed.description}</span>
        </div>
        <dl>
          <div><dt>Sesong</dt><dd>{task.season}</dd></div>
          <div><dt>Motstander</dt><dd>{observed.opponent ?? "Ikke sikkert"}</dd></div>
          <div><dt>Resultat</dt><dd>{observed.score ? score(observed.score) : "Ikke sikkert"}</dd></div>
          <div><dt>Dato</dt><dd>{observed.matchDate ?? "Ikke sikkert"}</dd></div>
          <div><dt>Hjemme/borte</dt><dd>{homeAway(observed.homeAway)}</dd></div>
          <div><dt>Konkurranse</dt><dd>{observed.competition ?? "Ikke sikkert"}</dd></div>
        </dl>
      </section>

      <section className={styles.claims} aria-labelledby="research-claims-title">
        <p>Arkivets kildedokumenterte {task.sourceResults.length === 1 ? "oppføring sier" : "oppføringer sier"}</p>
        <h3 id="research-claims-title">Kildepåstander – ikke ferdig etablert kamphistorikk</h3>
        <ul>{task.sourceResults.map((item) => <li key={optionKey(item)}>{item.label}</li>)}</ul>
      </section>

      <section className={styles.answers} aria-labelledby="research-answer-title">
        <div>
          <span>1</span>
          <div><p>Dette trenger vi hjelp til</p><h3 id="research-answer-title">Velg det kildene faktisk støtter</h3></div>
        </div>

        {task.category === "sibling_resolution" ? (
          <div className={styles.optionGrid}>
            {task.candidateOptions.map((option) => {
              const key = optionKey(option);
              const selected = answer === "matched_source_result" && selectedSourceResultKey === key;
              return (
                <button key={key} type="button" className={selected ? styles.selected : undefined} aria-pressed={selected} disabled={disabled} onClick={() => onChoose("matched_source_result", key)}>
                  <strong>#{option.no} · {option.label}</strong>
                  <span>Velg bare når dato, konkurranse eller annen kontekst skiller møtet.</span>
                </button>
              );
            })}
            {choice("none_of_these", "Ingen av disse", "Avisen gjelder en annen kamp enn alternativene over.")}
            {choice("inconclusive", "Kan ikke bestemmes", "Du har undersøkt siden, men den skiller ikke møtene sikkert.")}
          </div>
        ) : task.category === "date_research" ? (
          <div className={styles.optionGrid}>
            {choice("exact_date", "Eksakt dato", "Kilden dokumenterer en bestemt kampdato.")}
            {choice("period_only", "Bare måned eller periode", "Kilden avgrenser tidspunktet, men ikke til én dag.")}
            {choice("inconclusive", "Kan ikke bestemmes", "Kilden er undersøkt, men gir ikke en forsvarlig dato.")}
          </div>
        ) : task.category === "score_conflict" ? (
          <div className={styles.optionGrid}>
            {choice("newspaper_score", `Avisens resultat ${observed.score ? score(observed.score) : ""}`, "Aviskilden støtter dette resultatet for den konkrete kampen.")}
            {choice("source_result_score", `Kildeoppføringens resultat ${score(lead.expectedScore)}`, "Den retrospective kildeoppføringen støttes best.")}
            {choice("different_events", "Forskjellige kamper", "Resultatene beskriver to ulike møter.")}
            {choice("inconclusive", "Kan ikke bestemmes", "Kildene avgjør ikke konflikten.")}
          </div>
        ) : task.category === "competition_conflict" ? (
          <div className={styles.optionGrid}>
            {choice("league", "Seriekamp", "Denne konkrete kampen hører til serien.")}
            {choice("nm", "NM-kamp", "Denne konkrete kampen hører til Norgesmesterskapet.")}
            {choice("friendly", "Privat- eller treningskamp", "Kampen var ikke tellende serie eller NM.")}
            {choice("other", "Annen konkurranse", "Kilden oppgir en annen turneringstype.")}
            {choice("different_events", "Forskjellige kamper", "Kildene beskriver ikke samme møte.")}
            {choice("inconclusive", "Kan ikke bestemmes", "Kildene avgjør ikke konkurransetypen.")}
          </div>
        ) : (
          <div className={styles.optionGrid}>
            {task.candidateOptions.map((option) => {
              const key = optionKey(option);
              const selected = answer === "matched_other_source_result" && selectedSourceResultKey === key;
              return <button key={key} type="button" className={selected ? styles.selected : undefined} aria-pressed={selected} disabled={disabled} onClick={() => onChoose("matched_other_source_result", key)}><strong>En annen oppføring: #{option.no}</strong><span>{option.label}</span></button>;
            })}
            {choice("missing_source_result", "Kampen mangler i oppføringene", "Avisen dokumenterer en selvstendig AaFK-kamp som ikke står der.")}
            {choice("irrelevant", "Ikke relevant for AaFK-oppføringene", "Avisartikkelen skal ikke kobles til disse kildedokumenterte resultatene.")}
            {choice("inconclusive", "Kan ikke bestemmes", "Kildene er undersøkt, men koblingen er fortsatt uklar.")}
          </div>
        )}
      </section>
    </>
  );
}
