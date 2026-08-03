import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { systemPrompt } from "@aafkstats/query/prompt";
import { tools as toolDefs } from "@aafkstats/query/tools";
import type { ToolContext } from "@aafkstats/query/tools";
import { checkRateLimit, logQuestion } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Streaming med verktøybruk kan ta godt over standardgrensen på Vercel. Tallet må
 * ligge innenfor det planen tillater — Hobby har et lavere tak enn Pro. Kuttes svar
 * midt i, er det dette som skal opp (eller effort som skal ned).
 */
export const maxDuration = 60;

const MODEL = "claude-opus-5";
const MAX_TOKENS = 16_000;
/** Maks antall runder modellen får med verktøy før vi stopper løkken. */
const MAX_ITERATIONS = 8;

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

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (question === "") {
    return Response.json({ error: "Spørsmålet er tomt." }, { status: 400 });
  }
  if (question.length > 1000) {
    return Response.json({ error: "Spørsmålet er for langt (maks 1000 tegn)." }, { status: 400 });
  }

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
          // Adaptiv tenkning står PÅ med vilje. Slås den av på Opus 5, kan modellen
          // skrive verktøykall som vanlig tekst i stedet for et tool_use-blokk —
          // kallet kjører aldri, uten feilmelding. Kostnaden styres med effort i
          // stedet, som er trygt.
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          system: [
            {
              type: "text",
              text: systemPrompt(),
              // Systemprompten og verktøydefinisjonene er identiske mellom kall, så
              // hele prefikset caches. Ingenting her endrer seg per forespørsel.
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            ...(body.history ?? []).slice(-6).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user" as const, content: question },
          ],
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
