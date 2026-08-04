import type { ToolContext } from "@aafkstats/query/tools";
import { checkRateLimit, logQuestion } from "@/lib/rate-limit";
import {
  MAX_QUESTION_CHARS,
  isCrossSite,
  readBodyLimited,
  sanitizeHistory,
} from "@/lib/chat-request";
import { resolveChatSetup } from "@/lib/chat-model";
import { runAnthropic } from "@/lib/chat-anthropic";
import { runOpenAI } from "@/lib/chat-openai";

export const runtime = "nodejs";

/**
 * Streaming med verktøybruk kan ta godt over standardgrensen på Vercel. Tallet må
 * ligge innenfor det planen tillater — Hobby har et lavere tak enn Pro. Kuttes svar
 * midt i, er det dette som skal opp (eller effort som skal ned).
 */
export const maxDuration = 60;

interface ChatRequest {
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

/** Én SSE-hendelse. */
function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request): Promise<Response> {
  // Hvilken leverandør og modell som gjelder, avgjøres av miljøet. Se
  // lib/chat-model.ts for rekkefølgen når begge nøklene er satt.
  const resolved = resolveChatSetup();
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: 503 });
  }
  const setup = resolved.setup;

  if (isCrossSite(req)) {
    return Response.json({ error: "Forespørselen kom fra et annet nettsted." }, { status: 403 });
  }

  const rawBody = await readBodyLimited(req);
  if (rawBody === null) {
    return Response.json({ error: "Forespørselen er for stor." }, { status: 413 });
  }

  let body: ChatRequest;
  try {
    body = JSON.parse(rawBody) as ChatRequest;
  } catch {
    return Response.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question === "") {
    return Response.json({ error: "Spørsmålet er tomt." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return Response.json(
      { error: `Spørsmålet er for langt (maks ${MAX_QUESTION_CHARS} tegn).` },
      { status: 400 },
    );
  }

  const history = sanitizeHistory(body.history);

  const verdict = checkRateLimit(req);
  if (!verdict.allowed) {
    return Response.json(
      { error: verdict.message },
      {
        status: 429,
        headers: verdict.retryAfterSeconds
          ? { "Retry-After": String(verdict.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  // Spørringene modellen faktisk kjørte. Sendes til grensesnittet så brukeren kan se
  // hva svaret bygger på, og logges for feilsøking og misbruksdeteksjon.
  const executedQueries: { sql: string; durationMs: number; rowCount: number; error?: string }[] = [];
  // Ingen tilkobling å sende med: hver spørring åpner arkivfilen skrivebeskyttet
  // i sin egen child-prosess. Standardstien gjelder.
  const ctx: ToolContext = {
    onQuery: (info) => executedQueries.push(info),
  };

  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answerLength = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let failure: string | null = null;

      // Svarlengden telles her, der teksten faktisk går ut, og ikke inne i løkka.
      // Da står tallet også når kallet kaster midtveis, og det er nettopp da det
      // er verdt noe: et svar på null tegn er signaturen på at løkka gikk rundt
      // uten å produsere noe.
      const send = (event: string, data: unknown) => {
        if (event === "text") answerLength += String((data as { text: string }).text).length;
        controller.enqueue(encoder.encode(sse(event, data)));
      };

      try {
        const run = { question, history, ctx, send };
        const result =
          setup.provider === "openai" ? await runOpenAI(setup, run) : await runAnthropic(setup, run);

        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        failure = result.failure;

        // Spørringene sendes til slutt, så grensesnittet kan vise dem under svaret.
        send("queries", { queries: executedQueries });
        send("done", { durationMs: Date.now() - started });
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err);
        send("error", {
          message: "Noe gikk galt under svaret. Prøv å formulere spørsmålet på nytt.",
        });
      } finally {
        try {
          logQuestion({
            question,
            answerLength,
            queries: executedQueries,
            durationMs: Date.now() - started,
            inputTokens,
            outputTokens,
            error: failure,
            provider: setup.provider,
            model: setup.model,
          });
        } catch {
          // Logging skal aldri velte et svar som ellers gikk bra.
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
