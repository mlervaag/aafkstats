"use client";

import { useDeferredValue, useEffect, useState } from "react";
import type { SearchMatch, SearchPerson, SearchSource } from "@/lib/search";
import { trackEvent } from "@/lib/analytics";
import { formatDateShort } from "@/lib/date";
import { readableScore } from "@/lib/score";

export interface DirectSearchData {
  matches: SearchMatch[];
  people: SearchPerson[];
  sources: SearchSource[];
}

const EMPTY_RESULTS: DirectSearchData = { matches: [], people: [], sources: [] };

export function useDirectSearch(query: string, disabled = false) {
  const deferredQuery = useDeferredValue(query);
  const [data, setData] = useState<DirectSearchData>(EMPTY_RESULTS);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    const value = deferredQuery.trim();
    if (disabled || value.length < 2) {
      setData(EMPTY_RESULTS);
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
        });
        setState("done");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setData(EMPTY_RESULTS);
        setState("done");
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [deferredQuery, disabled]);

  return { data, state, show: !disabled && deferredQuery.trim().length >= 2 };
}

export interface DirectResultTarget {
  kind: "person" | "source" | "match";
  url: string;
  position: number;
}

export function firstDirectResult(data: DirectSearchData): DirectResultTarget | null {
  if (data.people[0]) return { kind: "person", url: data.people[0].url, position: 1 };
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
  else trackEvent("match-opened", { position: target.position });
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
  state: "idle" | "loading" | "done";
  emptyText: string;
  maxMatches?: number;
}) {
  const total = data.people.length + data.sources.length + data.matches.length;
  const shownTotal = data.people.length + data.sources.length + Math.min(data.matches.length, maxMatches);
  const resultCount = shownTotal < total ? `${total} treff · viser ${shownTotal}` : `${total} treff`;
  return (
    <div id={id} className="live-results" aria-live="polite">
      <div className="live-results-heading">
        <strong>Direkte treff</strong>
        <span className="small muted">
          {state === "loading" ? "Søker …" : resultCount}
        </span>
      </div>
      {state === "done" && total === 0 ? (
        <p className="small muted live-empty">{emptyText}</p>
      ) : (
        <ul className="match-results">
          {data.people.map((person, index) => (
            <PersonResult key={person.personId} person={person} position={index + 1} />
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
