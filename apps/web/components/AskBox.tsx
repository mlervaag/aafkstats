"use client";

import { useRef, useState } from "react";

interface ExecutedQuery {
  sql: string;
  durationMs: number;
  rowCount: number;
  error?: string;
}

const SUGGESTIONS = [
  "Når tapte vi sist med 6 mål på hjemmebane?",
  "Hvilken motstander har vi tapt flest ganger mot?",
  "Hvor mange mål scoret vi i 2024?",
  "Har vi noen gang vunnet en cupkamp på straffer?",
];

/**
 * Spørrefeltet — portalens hovedinngang.
 *
 * Leser SSE-strømmen fra /api/chat rå i stedet for å bruke et bibliotek: formatet er
 * fire hendelsestyper, og en egen avhengighet for det ville kostet mer enn den sparer.
 */
export function AskBox() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [queries, setQueries] = useState<ExecutedQuery[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask(q: string) {
    if (q.trim() === "" || state === "loading") return;

    setState("loading");
    setAnswer("");
    setQueries([]);
    setError(null);
    setActiveTool(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Noe gikk galt. Prøv igjen om litt.");
        setState("error");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Ingen svarstrøm");
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE-rammer skilles av blank linje. Alt etter siste blanke linje er en
        // ufullstendig ramme og må ligge igjen i bufferet til neste chunk.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;

          if (event === "text") {
            setActiveTool(null);
            setAnswer((prev) => prev + String(data.text ?? ""));
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
      setState((s) => (s === "loading" ? "done" : s));
    } catch {
      setError("Mistet forbindelsen. Prøv igjen.");
      setState("error");
    }
  }

  return (
    <section className="ask" aria-labelledby="sporre">
      <h1 id="sporre">Spør arkivet</h1>
      <p className="prose muted">
        Still et spørsmål om AaFKs kamphistorikk. Svaret bygger på arkivet, og du får se
        nøyaktig hvilken spørring som ble kjørt.
      </p>

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          ref={inputRef}
          className="ask-input"
          type="text"
          value={question}
          maxLength={1000}
          placeholder="Når tapte vi sist med 6 mål på hjemmebane?"
          aria-label="Spørsmål til arkivet"
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="ask-button" type="submit" disabled={state === "loading"}>
          {state === "loading" ? "Søker …" : "Spør"}
        </button>
      </form>

      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="suggestion"
            onClick={() => {
              setQuestion(s);
              void ask(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="answer notice notice-error" role="alert" style={{ marginTop: "1.5rem" }}>
          {error}
        </div>
      )}

      {(state === "loading" || answer !== "") && !error && (
        <div className="answer" aria-live="polite" aria-busy={state === "loading"}>
          {answer === "" ? (
            <p className="thinking">
              <span className="dot" aria-hidden="true" />
              {activeTool ? `Slår opp i arkivet (${activeTool}) …` : "Tenker …"}
            </p>
          ) : (
            <Answer text={answer} />
          )}

          {queries.length > 0 && (
            <details className="queries">
              <summary>
                Vis spørringen{queries.length > 1 ? `e (${queries.length})` : ""} som ble kjørt
              </summary>
              {queries.map((q, i) => (
                <div key={i}>
                  <pre>{q.sql}</pre>
                  <p className="small muted">
                    {q.error ? `Feilet: ${q.error}` : `${q.rowCount} rader · ${q.durationMs} ms`}
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

/**
 * Renderer svaret med markdown-lenker som ekte lenker.
 *
 * Bevisst minimal: kun avsnitt og [tekst](/sti). Vi tar ikke inn en markdown-parser
 * for å rendre modellgenerert tekst — det utvider angrepsflaten (rå HTML, bilder,
 * eksterne URL-er) for en gevinst vi ikke trenger. Kun interne stier slipper gjennom.
 */
function Answer({ text }: { text: string }) {
  const linkPattern = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

  return (
    <>
      {text.split(/\n\n+/).map((paragraph, pi) => {
        const parts: React.ReactNode[] = [];
        let last = 0;
        for (const m of paragraph.matchAll(linkPattern)) {
          const start = m.index;
          if (start > last) parts.push(paragraph.slice(last, start));
          parts.push(
            <a key={`${pi}-${start}`} href={m[2]}>
              {m[1]}
            </a>,
          );
          last = start + m[0].length;
        }
        if (last < paragraph.length) parts.push(paragraph.slice(last));
        return <p key={pi}>{parts}</p>;
      })}
    </>
  );
}
