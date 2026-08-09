"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { stripProseDashes } from "@aafkstats/query/style";
import { ThinkingLine } from "@/components/ThinkingLine";
import {
  historyFromTurns,
  parseFollowUp,
  type ConversationTurn,
  type FollowUp,
} from "@/lib/chat-followup";
import { trackEvent } from "@/lib/analytics";
import { absolutizeAnswerLinks, shareableAnswerText } from "@/lib/chat-answer";
import { formatDateShort } from "@/lib/date";
import { readableScore } from "@/lib/score";

interface ExecutedQuery {
  sql: string;
  durationMs: number;
  rowCount: number;
  error?: string;
}

interface SearchMatch {
  matchId: string;
  date: string;
  kickoff: string | null;
  competition: string;
  status: string;
  isHome: boolean;
  opponent: string;
  aafkScore: number | null;
  opponentScore: number | null;
  result: "S" | "U" | "T" | null;
  afterExtraTime: boolean;
  decidedOnPenalties: boolean;
  wonOnPenalties: boolean | null;
  url: string;
}

const SUGGESTIONS = [
  "Hva er den eldste kampen i arkivet?",
  "Hvilken motstander har vi tapt flest ganger mot?",
  "Hvordan har vi gjort det i cupen gjennom årene?",
  "Hvilken sesong hadde vi best målforskjell?",
];

type AskSource = "form" | "suggestion" | "followup";

/**
 * Direkte kampsøk og en avgrenset arkivsamtale.
 *
 * Hovedfeltet starter en samtale. Etter første svar eier resultatflaten
 * interaksjonen: brukeren kan ta én strukturert oppfølging eller starte på nytt.
 * Det hindrer at et tilfeldig tastetrykk sletter et svar som fortsatt er kontekst.
 */
export function AskBox() {
  const [question, setQuestion] = useState("");
  const deferredQuestion = useDeferredValue(question);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "done">("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const askRef = useRef<AbortController | null>(null);
  const turnSequence = useRef(0);

  const hasConversation = turns.length > 0;
  const isLoading = turns.some((turn) => turn.state === "loading");

  useEffect(() => {
    if (hasConversation) {
      setMatches([]);
      setSearchState("idle");
      return;
    }

    const query = deferredQuestion.trim();
    if (query.length < 2) {
      setMatches([]);
      setSearchState("idle");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchState("loading");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Søket feilet");
        const data = (await response.json()) as { matches?: SearchMatch[] };
        setMatches(data.matches ?? []);
        setSearchState("done");
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === "AbortError") return;
        setMatches([]);
        setSearchState("done");
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [deferredQuestion, hasConversation]);

  function updateTurn(id: string, change: (turn: ConversationTurn) => ConversationTurn) {
    setTurns((current) => current.map((turn) => turn.id === id ? change(turn) : turn));
  }

  function reset() {
    askRef.current?.abort();
    askRef.current = null;
    setQuestion("");
    setTurns([]);
    setActiveTool(null);
    setCopiedTurnId(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function ask(q: string, source: AskSource, previousTurns: ConversationTurn[] = []) {
    const trimmed = q.trim();
    if (trimmed === "" || isLoading) return;

    askRef.current?.abort();
    const controller = new AbortController();
    askRef.current = controller;
    const id = `turn-${++turnSequence.current}`;
    const turn: ConversationTurn = {
      id,
      question: trimmed,
      answer: "",
      queries: [],
      followUp: null,
      state: "loading",
    };
    const baseTurns = source === "followup" ? previousTurns : [];
    setTurns([...baseTurns, turn]);
    setActiveTool(null);
    setCopiedTurnId(null);

    trackEvent("ask-submitted", { source });
    const startedAt = performance.now();
    const answered = (status: "ok" | "error") =>
      trackEvent("ask-answered", {
        status,
        seconds: Math.round((performance.now() - startedAt) / 100) / 10,
      });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: historyFromTurns(baseTurns) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        updateTurn(id, (current) => ({
          ...current,
          state: "error",
          error: data.error ?? "Noe gikk galt. Prøv igjen om litt.",
        }));
        answered("error");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Ingen svarstrøm");
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;
      let completed = false;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) return;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const eventLine = frame.split("\n").find((line) => line.startsWith("event: "));
          const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;

          if (event === "text") {
            setActiveTool(null);
            updateTurn(id, (current) => ({
              ...current,
              answer: current.answer + String(data.text ?? ""),
            }));
          } else if (event === "tool") {
            setActiveTool(String(data.name ?? ""));
          } else if (event === "queries") {
            updateTurn(id, (current) => ({
              ...current,
              queries: (data.queries as ExecutedQuery[]) ?? [],
            }));
          } else if (event === "followup") {
            const followUp = parseFollowUp(data);
            if (followUp) {
              updateTurn(id, (current) => ({ ...current, followUp }));
              trackEvent("followup-shown", {});
            }
          } else if (event === "error") {
            failed = true;
            updateTurn(id, (current) => ({
              ...current,
              state: "error",
              followUp: null,
              error: String(data.message ?? "Ukjent feil"),
            }));
          } else if (event === "done") {
            completed = true;
            setActiveTool(null);
            updateTurn(id, (current) => ({
              ...current,
              state: failed ? "error" : "done",
              followUp: failed ? null : current.followUp,
            }));
          }
        }
      }

      if (!completed) {
        updateTurn(id, (current) => ({
          ...current,
          state: failed ? "error" : "done",
          followUp: failed ? null : current.followUp,
        }));
      }
      answered(failed ? "error" : "ok");
    } catch (streamError) {
      if (streamError instanceof Error && streamError.name === "AbortError") return;
      updateTurn(id, (current) => ({
        ...current,
        state: "error",
        followUp: null,
        error: "Mistet forbindelsen. Prøv igjen.",
      }));
      answered("error");
    } finally {
      if (askRef.current === controller) askRef.current = null;
    }
  }

  function acceptFollowUp(turnId: string, followUp: FollowUp) {
    if (isLoading) return;
    trackEvent("followup-yes", {});
    const previousTurns = turns.map((turn) =>
      turn.id === turnId ? { ...turn, followUp: null } : turn,
    );
    void ask(followUp.yesPrompt, "followup", previousTurns);
  }

  function declineFollowUp(turnId: string) {
    trackEvent("followup-no", {});
    setTurns((current) => current.map((turn) =>
      turn.id === turnId ? { ...turn, followUp: null } : turn,
    ));
  }

  async function copyAnswer(turn: ConversationTurn) {
    const visible = stripProseDashes(shareableAnswerText(turn.answer), false);
    try {
      await navigator.clipboard.writeText(visible);
      setCopiedTurnId(turn.id);
      trackEvent("answer-copied", {});
      window.setTimeout(() => {
        setCopiedTurnId((current) => current === turn.id ? null : current);
      }, 1800);
    } catch {
      setCopiedTurnId(null);
    }
  }

  const showSearch = !hasConversation && deferredQuestion.trim().length >= 2;

  return (
    <section className="ask" aria-labelledby="sporre">
      <p className="eyebrow">Smart kampsøk</p>
      <h2 id="sporre">Hva leter du etter?</h2>
      <p className="prose muted">
        Skriv <strong>2024</strong>, <strong>Sogndal</strong> eller <strong>2013 Tromsø</strong> for
        direkte treff. Trykk Enter for å få et utfyllende svar fra arkivet.
      </p>

      <form className="ask-form" onSubmit={(event) => {
        event.preventDefault();
        void ask(question, "form");
      }}>
        <input
          ref={inputRef}
          className="ask-input"
          type="search"
          value={question}
          maxLength={1000}
          placeholder="Søk eller spør arkivet …"
          aria-label="Søk i eller spør arkivet"
          aria-controls="direkte-treff"
          autoComplete="off"
          enterKeyHint="search"
          disabled={hasConversation}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") reset(); }}
        />
        <button className="ask-button" type="submit" disabled={isLoading || hasConversation}>
          {isLoading ? "Svarer …" : "Spør arkivet"}
        </button>
      </form>

      {showSearch && (
        <div id="direkte-treff" className="live-results" aria-live="polite">
          <div className="live-results-heading">
            <strong>Direkte kamptreff</strong>
            <span className="small muted">
              {searchState === "loading" ? "Søker …" : `${matches.length} ${matches.length === 1 ? "kamp" : "kamper"}`}
            </span>
          </div>
          {searchState === "done" && matches.length === 0 ? (
            <p className="small muted live-empty">Ingen direkte treff. Trykk Enter for å spørre arkivet.</p>
          ) : (
            <ul className="match-results">
              {matches.map((match, index) => (
                <SearchResult key={match.matchId} match={match} position={index + 1} />
              ))}
            </ul>
          )}
        </div>
      )}

      {!hasConversation && (
        <div className="suggestions" aria-label="Forslag til spørsmål">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="suggestion"
              onClick={() => {
                setQuestion(suggestion);
                void ask(suggestion, "suggestion");
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {hasConversation && (
        <div className="answer-head">
          <p className="small muted">Aktiv arkivsamtale</p>
          <button type="button" className="answer-reset" onClick={reset}>
            Nytt spørsmål
          </button>
        </div>
      )}

      <div className="conversation">
        {turns.map((turn, index) => {
          const visibleAnswer = stripProseDashes(turn.answer, turn.state === "loading");
          const isActive = index === turns.length - 1;
          return (
            <article className="conversation-turn" key={turn.id}>
              <p className="conversation-question small muted">
                {index === 0 ? "Du spurte" : "Oppfølging"}: «{turn.question}»
              </p>
              <div
                className="answer"
                aria-live={isActive ? "polite" : undefined}
                aria-busy={turn.state === "loading"}
              >
                {turn.answer === "" && turn.state === "loading" ? (
                  <ThinkingLine activeTool={isActive ? activeTool : null} />
                ) : (
                  <Answer text={visibleAnswer} />
                )}

                {turn.error && (
                  <p className="notice notice-error" role="alert">{turn.error}</p>
                )}

                {turn.state === "done" && turn.answer !== "" && (
                  <div className="answer-actions">
                    <button type="button" onClick={() => void copyAnswer(turn)}>
                      {copiedTurnId === turn.id ? "Kopiert" : "Kopier svar"}
                    </button>
                  </div>
                )}

                {turn.queries.length > 0 && (
                  <details className="queries">
                    <summary>
                      Vis spørringen{turn.queries.length > 1 ? `e (${turn.queries.length})` : ""} som ble kjørt
                    </summary>
                    {turn.queries.map((query, queryIndex) => (
                      <div key={`${query.sql}-${queryIndex}`}>
                        <pre>{query.sql}</pre>
                        <p className="small muted">
                          {query.error
                            ? `Feilet: ${query.error}`
                            : `${query.rowCount} rader · ${query.durationMs} ms`}
                        </p>
                      </div>
                    ))}
                  </details>
                )}
              </div>

              {turn.state === "done" && turn.followUp && (
                <div className="answer-followup" aria-label="Forslag til oppfølging">
                  <p>{turn.followUp.question}</p>
                  <div className="answer-followup-actions">
                    <button
                      type="button"
                      onClick={() => acceptFollowUp(turn.id, turn.followUp!)}
                    >
                      {turn.followUp.yesLabel}
                    </button>
                    <button type="button" onClick={() => declineFollowUp(turn.id)}>
                      Nei
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Én treffrad.
 *
 * Leser resultatet med den samme funksjonen som kamplistene ellers på nettstedet.
 * Den hadde sin egen versjon før, og den skrev bindestrek der resten av arkivet
 * skriver tankestrek, viste «-» både for en kamp uten kjent resultat og en kamp
 * som ikke er spilt, og lot en cupkamp avgjort på straffer se uavgjort ut.
 */
function SearchResult({ match, position }: { match: SearchMatch; position: number }) {
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
          {qualifier && <span className="score-qualifier"> {qualifier}</span>}
        </strong>
        <span className="small muted">
          {upcoming ? "Ikke spilt · " : ""}{match.competition}
        </span>
      </a>
    </li>
  );
}

function Answer({ text }: { text: string }) {
  const lines = absolutizeAnswerLinks(text).split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!.trim();
    if (!line) { index += 1; continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const content = inline(heading[2]!, `h-${index}`);
      blocks.push(heading[1]!.length === 1 ? <h2 key={index}>{content}</h2> : <h3 key={index}>{content}</h3>);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index]!.trim())) {
        items.push(<li key={index}>{inline(lines[index]!.trim().replace(/^[-*]\s+/, ""), `u-${index}`)}</li>);
        index += 1;
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index]!.trim())) {
        items.push(<li key={index}>{inline(lines[index]!.trim().replace(/^\d+[.)]\s+/, ""), `o-${index}`)}</li>);
        index += 1;
      }
      blocks.push(<ol key={`ol-${index}`}>{items}</ol>);
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index]!.trim() && !/^(#{1,3})\s+|^[-*]\s+|^\d+[.)]\s+/.test(lines[index]!.trim())) {
      paragraph.push(lines[index]!.trim());
      index += 1;
    }
    blocks.push(<p key={`p-${index}`}>{inline(paragraph.join(" "), `p-${index}`)}</p>);
  }
  return <div className="answer-content">{blocks}</div>;
}

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\((?:\/[^)\s]*|https?:\/\/[^)\s]+)\))/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > last) parts.push(text.slice(last, start));
    const token = match[0];
    const link = /^\[([^\]]+)\]\((\/[^)\s]*|https?:\/\/[^)\s]+)\)$/.exec(token);
    parts.push(link
      ? <a key={`${keyPrefix}-${start}`} href={link[2]}>{link[1]}</a>
      : <strong key={`${keyPrefix}-${start}`}>{token.slice(2, -2)}</strong>);
    last = start + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
