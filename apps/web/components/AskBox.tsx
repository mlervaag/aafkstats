"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";

interface ExecutedQuery {
  sql: string;
  durationMs: number;
  rowCount: number;
  error?: string;
}

interface SearchMatch {
  matchId: string;
  date: string;
  competition: string;
  isHome: boolean;
  opponent: string;
  aafkScore: number | null;
  opponentScore: number | null;
  result: "S" | "U" | "T" | null;
  url: string;
}

/**
 * Forslagene skal vise bredden i arkivet, ikke bare at det virker.
 *
 * Ett spørsmål per type: tidsdybde, innbyrdes statistikk, en enkelt sesong, og
 * noe fra cupen. De to første viser at arkivet nå rekker tilbake til 1980-tallet
 * — det gjorde det ikke da forslagene ble skrevet.
 */
const SUGGESTIONS = [
  "Hva er den eldste kampen i arkivet?",
  "Hvilken motstander har vi tapt flest ganger mot?",
  "Hvordan har vi gjort det i cupen gjennom årene?",
  "Hvilken sesong hadde vi best målforskjell?",
];

/** Portalens hovedinngang: direkte kampsøk mens man skriver, AI-svar ved innsending. */
export function AskBox() {
  const [question, setQuestion] = useState("");
  const deferredQuestion = useDeferredValue(question);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "done">("idle");
  const [answer, setAnswer] = useState("");
  const [queries, setQueries] = useState<ExecutedQuery[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
  }, [deferredQuestion]);

  async function ask(q: string) {
    if (q.trim() === "" || state === "loading") return;

    setState("loading");
    setAnswer("");
    setQueries([]);
    setError(null);
    setActiveTool(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Noe gikk galt. Prøv igjen om litt.");
        setState("error");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Ingen svarstrøm");
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
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
            setAnswer((previous) => previous + String(data.text ?? ""));
          } else if (event === "tool") {
            setActiveTool(String(data.name ?? ""));
          } else if (event === "queries") {
            setQueries((data.queries as ExecutedQuery[]) ?? []);
          } else if (event === "error") {
            setError(String(data.message ?? "Ukjent feil"));
          } else if (event === "done") {
            setState("done");
          }
        }
      }
      setState((current) => current === "loading" ? "done" : current);
    } catch {
      setError("Mistet forbindelsen. Prøv igjen.");
      setState("error");
    }
  }

  const showSearch = deferredQuestion.trim().length >= 2 && state !== "loading";

  return (
    <section className="ask" aria-labelledby="sporre">
      <p className="eyebrow">Smart kampsøk</p>
      <h2 id="sporre">Hva leter du etter?</h2>
      <p className="prose muted">
        Skriv år og motstander for direkte treff, for eksempel <strong>2024</strong>,{" "}
        <strong>Sogndal</strong> eller <strong>2013 Tromsø</strong>. Skriv et spørsmål og trykk
        Enter for et AI-generert svar som bare bruker arkivdataene.
      </p>

      <form className="ask-form" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
        <input
          ref={inputRef}
          className="ask-input"
          type="search"
          value={question}
          maxLength={1000}
          placeholder="Søk på år eller motstander, eller still et spørsmål …"
          aria-label="Søk i eller spør arkivet"
          aria-controls="direkte-treff"
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button className="ask-button" type="submit" disabled={state === "loading"}>
          {state === "loading" ? "Svarer …" : "Spør AI"}
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
            <p className="small muted live-empty">Ingen direkte treff. Trykk Enter for å spørre AI.</p>
          ) : (
            <ul className="match-results">
              {matches.map((match) => <SearchResult key={match.matchId} match={match} />)}
            </ul>
          )}
        </div>
      )}

      <div className="suggestions" aria-label="Forslag til spørsmål">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="suggestion"
            onClick={() => { setQuestion(suggestion); void ask(suggestion); }}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {error && <div className="answer notice notice-error" role="alert">{error}</div>}

      {(state === "loading" || answer !== "") && !error && (
        <div className="answer" aria-live="polite" aria-busy={state === "loading"}>
          {answer === "" ? (
            <p className="thinking">
              <span className="dot" aria-hidden="true" />
              {activeTool ? `Slår opp i arkivet (${activeTool}) …` : "Tolker spørsmålet …"}
            </p>
          ) : <Answer text={answer} />}

          {queries.length > 0 && (
            <details className="queries">
              <summary>Vis spørringen{queries.length > 1 ? `e (${queries.length})` : ""} som ble kjørt</summary>
              {queries.map((query, index) => (
                <div key={`${query.sql}-${index}`}>
                  <pre>{query.sql}</pre>
                  <p className="small muted">
                    {query.error ? `Feilet: ${query.error}` : `${query.rowCount} rader · ${query.durationMs} ms`}
                  </p>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function SearchResult({ match }: { match: SearchMatch }) {
  const score = match.aafkScore === null || match.opponentScore === null
    ? "–"
    : match.isHome
      ? `${match.aafkScore}–${match.opponentScore}`
      : `${match.opponentScore}–${match.aafkScore}`;
  return (
    <li>
      <a className="match-result-link" href={match.url}>
        <span className="num muted">{match.date}</span>
        <span className="result-opponent">
          {match.result && <span className={`result-badge result-${match.result}`}>{match.result}</span>}
          {match.isHome ? "AaFK – " : ""}{match.opponent}{match.isHome ? "" : " – AaFK"}
        </span>
        <strong className="score">{score}</strong>
        <span className="small muted">{match.competition}</span>
      </a>
    </li>
  );
}

function Answer({ text }: { text: string }) {
  const lines = text.split("\n");
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
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(\/[^)\s]*\))/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > last) parts.push(text.slice(last, start));
    const token = match[0];
    const link = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(token);
    parts.push(link
      ? <a key={`${keyPrefix}-${start}`} href={link[2]}>{link[1]}</a>
      : <strong key={`${keyPrefix}-${start}`}>{token.slice(2, -2)}</strong>);
    last = start + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
