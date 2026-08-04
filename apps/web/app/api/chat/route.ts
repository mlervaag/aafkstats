import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { systemPrompt } from "@aafkstats/query/prompt";
import { tools as toolDefs } from "@aafkstats/query/tools";
import type { ToolContext } from "@aafkstats/query/tools";
import { checkRateLimit, logQuestion } from "@/lib/rate-limit";
import {
  MAX_QUESTION_CHARS,
  isCrossSite,
  readBodyLimited,
  sanitizeHistory,
} from "@/lib/chat-request";

export const runtime = "nodejs";

/**
 * Streaming med verktøybruk kan ta godt over standardgrensen på Vercel. Tallet må
 * ligge innenfor det planen tillater — Hobby har et lavere tak enn Pro. Kuttes svar
 * midt i, er det dette som skal opp (eller effort som skal ned).
 */
export const maxDuration = 60;

/**
 * Sonnet 5, ikke Opus 5.
 *
 * Arbeidet her er avgrenset: les et dokumentert skjema, velg et verktøy, skriv
 * én SELECT mot seks views. Det er ikke det Opus er til for, og prislappen er
 * dobbel: 5/25 dollar per million tokens mot Sonnet 5s 3/15 (2/10 i
 * introduksjonspris ut august 2026). For et gratis supporterarkiv er det
 * forskjellen som betyr noe.
 *
 * Overgangen krevde ingen andre endringer. Sonnet 5 tar samme forespørsel som
 * Opus 5: adaptiv tenkning, effort i output_config, ingen temperature. Haiku
 * 4.5 ville derimot brutt begge — den avviser effort og kjenner ikke adaptiv
 * tenkning, bare det utgåtte budget_tokens. Den er ikke et alternativ her uten
 * å skrive om kallet.
 *
 * Kan overstyres med AAFK_CHAT_MODEL for å prøve en annen modell uten å
 * deploye på nytt.
 */
const MODEL = process.env.AAFK_CHAT_MODEL ?? "claude-sonnet-5";
// Et statistikksvar skal være kort. Dette er også et hardt tak på kostnaden per kall.
const MAX_TOKENS = 6_000;
/** Maks antall runder modellen får med verktøy før vi stopper løkken. */
const MAX_ITERATIONS = 5;

interface ChatRequest {
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

/** Én SSE-hendelse. */
function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Spørrefunksjonen er ikke satt opp: ANTHROPIC_API_KEY mangler." },
      { status: 503 },
    );
  }

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

  const client = new Anthropic();

  const runnableTools = toolDefs.map((def) =>
    betaZodTool({
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema,
      run: async (input) => {
        const result = await def.run(input, ctx);
        // Verktøysvaret pakkes i en tydelig avgrenser. Systemprompten slår fast at
        // alt innenfor er data fra arkivet, aldri instruksjoner — det er forsvaret
        // mot at en bidragsyter legger en beskjed til modellen i et kampreferat.
        return [
          {
            type: "text" as const,
            text:
              `<arkivdata verktoy="${def.name}">\n` +
              JSON.stringify(result.content) +
              `\n</arkivdata>`,
          },
        ];
      },
    }),
  );

  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      let answer = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let failure: string | null = null;

      try {
        const runner = client.beta.messages.toolRunner({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          // Adaptiv tenkning står PÅ med vilje. Slås den av, kan modellen skrive
          // verktøykall som vanlig tekst i stedet for en tool_use-blokk. Kallet
          // kjører aldri, uten feilmelding. Kostnaden styres med effort i stedet,
          // som er trygt.
          thinking: { type: "adaptive" },
          // Hevet fra «low» sammen med modellbyttet. Sonnet 5 respekterer effort
          // strengt i nedre ende, og et spørsmål som må oversettes til SQL over
          // seks views er ikke et oppslag. «medium» på Sonnet 5 ligger omtrent
          // der Sonnet 4.6 lå på «high», og koster fortsatt en brøkdel av Opus.
          output_config: { effort: "medium" },
          system: [
            {
              type: "text",
              text: systemPrompt(),
              // Systemprompten og verktøydefinisjonene er identiske mellom kall, så
              // hele prefikset caches. Ingenting her endrer seg per forespørsel.
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [...history, { role: "user" as const, content: question }],
          tools: runnableTools,
          max_iterations: MAX_ITERATIONS,
          stream: true,
        });

        for await (const messageStream of runner) {
          for await (const event of messageStream) {
            if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
              send("tool", { name: event.content_block.name });
            }
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              answer += event.delta.text;
              send("text", { text: event.delta.text });
            }
          }

          const message = await messageStream.finalMessage();
          inputTokens += message.usage.input_tokens ?? 0;
          outputTokens += message.usage.output_tokens ?? 0;

          if (message.stop_reason === "refusal") {
            failure = "Modellen avslo å svare på dette spørsmålet.";
            send("error", { message: failure });
          }
        }

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
            answerLength: answer.length,
            queries: executedQueries,
            durationMs: Date.now() - started,
            inputTokens,
            outputTokens,
            error: failure,
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
