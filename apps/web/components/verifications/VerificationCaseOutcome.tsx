import React from "react";
import type { VerificationCaseView } from "@/lib/verifications";
import styles from "./VerificationCaseOutcome.module.css";

const STATUS_COPY = {
  resolved: {
    eyebrow: "Kontrollen er avsluttet",
    title: "Saken er løst",
    description: "Dokumentasjonen er vurdert, og konklusjonen er ført i arkivsporet.",
  },
  rejected: {
    eyebrow: "Kontrollen er avsluttet",
    title: "Saken ble avvist",
    description: "Saken ga ikke grunnlag for en arkivendring, men historikken står igjen.",
  },
  paused: {
    eyebrow: "Ikke åpen for svar nå",
    title: "Saken er satt på pause",
    description: "Arkivredaksjonen må avklare noe før community kan arbeide videre med saken.",
  },
  superseded: {
    eyebrow: "Erstattet av en nyere sak",
    title: "Denne formuleringen er ikke lenger aktiv",
    description: "Lenken består for sporbarhet, men det skal ikke sendes nye svar på den gamle påstanden.",
  },
} as const;

function answerLabel(answer: NonNullable<VerificationCaseView["resolution"]>["answer"]): string {
  if (answer === "yes") return "JA";
  if (answer === "no") return "NEI";
  return "IKKE AVGJØRBART";
}

export function VerificationCaseOutcome({ item }: { item: VerificationCaseView }) {
  if (item.status === "open" || item.status === "draft") return null;
  const copy = STATUS_COPY[item.status];

  return (
    <article className={styles.outcome}>
      <header className={styles.header}>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>

      <section className={styles.claim} aria-labelledby="historical-question">
        <p>Den opprinnelige påstanden</p>
        <h2 id="historical-question">{item.question}</h2>
        <p>{item.context}</p>
      </section>

      {item.resolution && (
        <section className={styles.resolution} aria-labelledby="resolution-title">
          <div className={styles.answer} aria-label={`Konklusjon: ${answerLabel(item.resolution.answer)}`}>
            {answerLabel(item.resolution.answer)}
          </div>
          <div>
            <h2 id="resolution-title">Konklusjon</h2>
            <p>{item.resolution.reason}</p>
            <p className={styles.date}>Avgjort {item.resolution.resolvedAt}</p>
            <div className={styles.links}>
              {item.resolution.issueUrl && <a href={item.resolution.issueUrl}>Se vurderingen på GitHub</a>}
              {item.resolution.pullRequestUrl && <a href={item.resolution.pullRequestUrl}>Se dataendringen</a>}
            </div>
          </div>
        </section>
      )}

      <section className={styles.sources} aria-labelledby="historical-sources">
        <h2 id="historical-sources">Kildene som hørte til saken</h2>
        <ul>
          {item.sources.map((source) => (
            <li key={source.key}>
              <div><strong>{source.title}</strong>{source.page && <span>Side {source.page}</span>}</div>
              {source.note && <p>{source.note}</p>}
              {source.href && <a href={source.href}>Åpne kilde</a>}
            </li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>
        <a href="/mangler">Ta en åpen sak</a>
        <a href="/mangler/saker">Se alle åpne saker</a>
        <a href="/mangler/oversikt">Se hele arbeidskøen</a>
      </footer>
    </article>
  );
}
