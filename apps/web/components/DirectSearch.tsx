"use client";

import { useDeferredValue, useEffect, useState } from "react";
import type { SearchMatch, SearchObservation, SearchPerson, SearchSource } from "@/lib/search";
import { trackEvent } from "@/lib/analytics";
import { formatDateShort, formatObservationDate } from "@/lib/date";
import { readableScore } from "@/lib/score";

export interface DirectSearchData {
  matches: SearchMatch[];
  people: SearchPerson[];
  sources: SearchSource[];
  observations: SearchObservation[];
}

const EMPTY_RESULTS: DirectSearchData = { matches: [], people: [], sources: [], observations: [] };

export type DirectSearchState = "idle" | "loading" | "done" | "error";

export function useDirectSearch(query: string, disabled = false) {
  const deferredQuery = useDeferredValue(query);
  const [data, setData] = useState<DirectSearchData>(EMPTY_RESULTS);
  // Hvilket søk `data` er svaret på. Forrige treffliste blir stående mens neste
  // søk går, så lista ikke blinker — men da må Enter vite at den er utdatert.
  const [resultQuery, setResultQuery] = useState("");
  const [state, setState] = useState<DirectSearchState>("idle");

  useEffect(() => {
    const value = deferredQuery.trim();
    if (disabled || value.length < 2) {
      setData(EMPTY_RESULTS);
      setResultQuery("");
      setState("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Søket feilet");
        const result = (await response.json()) as Partial<DirectSearchData>;
        setData({
          matches: result.matches ?? [],
          people: result.people ?? [],
          sources: result.sources ?? [],
          observations: result.observations ?? [],
        });
        setResultQuery(value);
        setState("done");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        // En feil er ikke det samme som null treff. Før sto det «Ingen direkte
        // treff», og leseren trodde arkivet manglet det hen lette etter.
        setData(EMPTY_RESULTS);
        setResultQuery(value);
        setState("error");
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [deferredQuery, disabled]);

  const current = query.trim();
  return {
    data,
    state,
    show: !disabled && deferredQuery.trim().length >= 2,
    /**
     * Sant når trefflista er svaret på det som står i feltet nå. Uten denne
     * åpnet Enter første treff fra forrige søk hvis man skrev fort og trykket
     * før det nye svaret var kommet.
     */
    fresh: state !== "loading" && current.length >= 2 && resultQuery === current,
  };
}

export function directResultCount(data: DirectSearchData): number {
  return data.people.length + data.observations.length + data.sources.length + data.matches.length;
}

export interface DirectResultTarget {
  kind: "person" | "source" | "match" | "observation";
  url: string;
  position: number;
}

export function firstDirectResult(data: DirectSearchData): DirectResultTarget | null {
  if (data.people[0]) return { kind: "person", url: data.people[0].url, position: 1 };
  if (data.observations[0]) return { kind: "observation", url: data.observations[0].url, position: 1 };
  if (data.sources[0]) return { kind: "source", url: data.sources[0].url, position: 1 };
  if (data.matches[0]) return { kind: "match", url: data.matches[0].url, position: 1 };
  return null;
}

/**
 * Åpner første direktetreff med den samme målingen som et museklikk.
 *
 * Enter-stien gikk tidligere rett til URL-en og hoppet dermed over Analytics.
 * Trefftypen og plasseringen er nok til å måle om søket virker; teksten og
 * identiteten til treffet skal aldri følge med.
 */
export function openFirstDirectResult(data: DirectSearchData): void {
  const target = firstDirectResult(data);
  if (!target) return;
  if (target.kind === "person") trackEvent("person-opened", { position: target.position });
  else if (target.kind === "source") trackEvent("source-opened", { position: target.position });
  else if (target.kind === "match") trackEvent("match-opened", { position: target.position });
  else if (target.kind === "observation") trackEvent("observation-opened", { position: target.position });
  window.location.assign(target.url);
}

export function DirectResults({
  id,
  data,
  state,
  emptyText,
  maxMatches = 40,
}: {
  id: string;
  data: DirectSearchData;
  state: DirectSearchState;
  emptyText: string;
  maxMatches?: number;
}) {
  const total = directResultCount(data);
  const shownTotal = data.people.length + data.observations.length + data.sources.length + Math.min(data.matches.length, maxMatches);
  const resultCount = shownTotal < total ? `${total} treff · viser ${shownTotal}` : `${total} treff`;
  return (
    <div id={id} className="live-results" aria-live="polite">
      <div className="live-results-heading">
        <strong>Direkte treff</strong>
        <span className="small muted">
          {state === "loading" ? "Søker …" : state === "error" ? "Feil" : resultCount}
        </span>
      </div>
      {state === "error" ? (
        <p className="small muted live-empty" role="alert">
          Søket feilet. Sjekk nettforbindelsen og prøv igjen.
        </p>
      ) : state === "done" && total === 0 ? (
        <p className="small muted live-empty">{emptyText}</p>
      ) : (
        <ul className="match-results">
          {data.people.map((person, index) => (
            <PersonResult key={person.personId} person={person} position={index + 1} />
          ))}
          {data.observations.map((observation, index) => (
            <ObservationResult key={observation.observationId} observation={observation} position={index + 1} />
          ))}
          {data.sources.map((source, index) => (
            <SourceResult key={source.sourceId} source={source} position={index + 1} />
          ))}
          {data.matches.slice(0, maxMatches).map((match, index) => (
            <MatchResult key={match.matchId} match={match} position={index + 1} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Beskrivelsen er hele observasjonsteksten, ofte flere setninger. Den kuttes
 * visuelt etter tre linjer: treffet skal kjennes igjen, ikke leses i søket.
 * Datoen vises som ellers i arkivet og ikke som rå ISO-dato.
 */
function ObservationResult({ observation, position }: { observation: SearchObservation; position: number }) {
  return <li><a
    className="person-result-link"
    href={observation.url}
    onClick={() => trackEvent("observation-opened", { position })}
  >
    <span className="result-kind">Observasjon</span>
    <strong>{observation.title}</strong>
    <span className="small muted result-excerpt">{observation.description}</span>
    {observation.date ? <span className="num muted">{formatObservationDate(observation.date)}</span> : null}
  </a></li>;
}

function PersonResult({ person, position }: { person: SearchPerson; position: number }) {
  return (
    <li>
      <a
        className="person-result-link"
        href={person.url}
        onClick={() => trackEvent("person-opened", { position })}
      >
        <span className="result-kind">Person</span>
        <strong>{person.name}</strong>
        <span className="small muted">{person.description}</span>
        {person.period ? <span className="num muted">{person.period}</span> : null}
      </a>
    </li>
  );
}

function SourceResult({ source, position }: { source: SearchSource; position: number }) {
  return (
    <li>
      <a
        className="person-result-link"
        href={source.url}
        onClick={() => trackEvent("source-opened", { position })}
      >
        <span className="result-kind">Kilde</span>
        <strong>{source.title}</strong>
        <span className="small muted">{source.description}</span>
      </a>
    </li>
  );
}

function MatchResult({ match, position }: { match: SearchMatch; position: number }) {
  const { score, qualifier, label } = readableScore(match);
  const upcoming = match.status === "scheduled";
  return (
    <li>
      <a
        className="match-result-link"
        href={match.url}
        onClick={() => trackEvent("match-opened", { position })}
      >
        <span className="num muted">{formatDateShort(match.date)}</span>
        <span className="result-opponent">
          {match.result
            ? <span className={`result-badge result-${match.result}`}>{match.result}</span>
            : upcoming
              ? <span className="result-badge result-upcoming" aria-hidden="true">·</span>
              : null}
          {match.isHome ? "AaFK – " : ""}{match.opponent}{match.isHome ? "" : " – AaFK"}
        </span>
        <strong className="score" title={label}>
          {score}
          {qualifier ? <span className="score-qualifier"> {qualifier}</span> : null}
        </strong>
        <span className="small muted">
          {upcoming ? "Ikke spilt · " : ""}{match.competition}
        </span>
      </a>
    </li>
  );
}
