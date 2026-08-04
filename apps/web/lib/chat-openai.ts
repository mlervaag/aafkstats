/**
 * Verktøyløkka mot OpenAI.
 *
 * Samme jobb som `chat-anthropic.ts`, med håndskrevet løkke: Responses-API-et har
 * ingen `toolRunner`, så runden er vår egen. Vi sender inn, leser strømmen, kjører
 * verktøyene modellen ba om, legger svarene bakerst i `input` og går en runde til.
 *
 * Tre ting er verdt å kjenne igjen, fordi de skiller seg fra Anthropic-veien:
 *
 *   1. **Hele `output` spilles tilbake, ikke bare verktøykallene.** Tenkeleddene
 *      ligger i den samme lista, og et `function_call` uten sitt tenkeledd blir
 *      avvist. Derfor `input.push(...final.output)` og ikke et utvalg.
 *   2. **Systemprompten sendes som `instructions`.** Den er identisk mellom kall,
 *      og OpenAI cacher lange prefikser av seg selv — det finnes ikke noe
 *      `cache_control` å sette, og trengs ikke.
 *   3. **Verktøyskjemaene lages av Zod her.** Anthropic-SDK-et har `betaZodTool`;
 *      her går vi via JSON Schema, og parser argumentene selv på vei inn.
 */

import OpenAI from "openai";
import { z } from "zod/v4";
import { systemPrompt } from "@aafkstats/query/prompt";
import { tools as toolDefs, toolsByName } from "@aafkstats/query/tools";
import type { ToolContext } from "@aafkstats/query/tools";
import {
  MAX_ITERATIONS,
  MAX_TOKENS,
  wrapToolResult,
  type ChatResult,
  type ChatRun,
  type ChatSetup,
} from "@/lib/chat-model";

/**
 * Verktøydefinisjonen slik Responses-API-et vil ha den.
 *
 * `strict: false` er et valg. Streng modus krever at *alle* felt står i
 * `required` og at `additionalProperties` er false, men halvparten av filtrene
 * våre er valgfrie med vilje — `search_matches` har ni av dem. Å tvinge dem
 * gjennom ville betydd `null` overalt og et skjema som lyver om hva verktøyet
 * er. Argumentene valideres uansett av Zod før de når handleren.
 */
const openaiTools: OpenAI.Responses.Tool[] = toolDefs.map((def) => ({
  type: "function",
  name: def.name,
  description: def.description,
  parameters: jsonSchema(def.inputSchema),
  strict: false,
}));

/** Zod-skjemaet som JSON Schema, i den formen OpenAI godtar. */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  // «input» og ikke «output»: det er argumentene modellen skal skrive, og et felt
  // med .default() er valgfritt på vei inn selv om det alltid finnes på vei ut.
  const json = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  // API-et vil ha selve skjemaet, ikke metaen rundt det.
  delete json.$schema;
  return json;
}

export async function runOpenAI(setup: ChatSetup, run: ChatRun): Promise<ChatResult> {
  const client = new OpenAI();

  const input: OpenAI.Responses.ResponseInputItem[] = [
    ...run.history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user" as const, content: run.question },
  ];

  let inputTokens = 0;
  let outputTokens = 0;

  for (let round = 0; round < MAX_ITERATIONS; round++) {
    const stream = await client.responses.create({
      model: setup.model,
      instructions: systemPrompt(),
      input,
      tools: openaiTools,
      // Tenkning på «medium», som hos Anthropic og av samme grunn: et spørsmål som
      // må oversettes til SQL over seks views er ikke et oppslag, men det er heller
      // ikke et resonnement som tåler å koste det «high» koster.
      reasoning: { effort: "medium" },
      // Taket dekker tenketokens også, ikke bare teksten brukeren ser.
      max_output_tokens: MAX_TOKENS,
      // Ingenting lagres hos leverandøren. Vi sender hele samtalen på nytt hver
      // runde uansett, og et arkiv som logger uten IP skal ikke etterlate
      // spørsmålene et sted vi ikke har oversikt over.
      store: false,
      stream: true,
    });

    let final: OpenAI.Responses.Response | null = null;

    for await (const event of stream) {
      if (event.type === "response.output_item.added" && event.item.type === "function_call") {
        run.send("tool", { name: event.item.name });
      } else if (event.type === "response.output_text.delta") {
        run.send("text", { text: event.delta });
      } else if (event.type === "response.completed" || event.type === "response.incomplete") {
        final = event.response;
      }
    }

    if (!final) throw new Error("Strømmen fra OpenAI sluttet uten et ferdig svar.");

    inputTokens += final.usage?.input_tokens ?? 0;
    outputTokens += final.usage?.output_tokens ?? 0;
    // Castet er SDK-ets, ikke vårt: `output`- og `input`-unionene beskriver de
    // samme leddene, men er ikke identiske for verktøytyper vi aldri slår på
    // (computer use har en ekstra status). Leddene vi faktisk får — tekst,
    // tenkning og function_call — hører hjemme i begge.
    input.push(...(final.output as unknown as OpenAI.Responses.ResponseInputItem[]));

    const refused = final.output.some(
      (item) => item.type === "message" && item.content.some((part) => part.type === "refusal"),
    );
    if (refused) {
      const failure = "Modellen avslo å svare på dette spørsmålet.";
      run.send("error", { message: failure });
      return { inputTokens, outputTokens, failure };
    }

    const calls = final.output.filter((item) => item.type === "function_call");
    // Ingen verktøykall betyr at modellen er ferdig. Er runden brukt opp mens den
    // fortsatt kaller verktøy, stopper løkka her — samme tak som Anthropic-veien
    // har i max_iterations, og samme utfall: svaret blir det som er strømmet ut.
    if (calls.length === 0) break;

    for (const call of calls) {
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: await runTool(call.name, call.arguments, run.ctx),
      });
    }
  }

  return { inputTokens, outputTokens, failure: null };
}

/**
 * Kjører ett verktøykall og gir tilbake teksten modellen skal lese.
 *
 * Feil kastes ikke videre. En ugyldig SQL eller et argument som ikke validerer er
 * noe modellen kan rette opp i neste runde, og feilmeldingen er skrevet for å
 * leses av den. Kaster vi i stedet, mister brukeren hele svaret.
 */
async function runTool(name: string, args: string, ctx: ToolContext): Promise<string> {
  const def = toolsByName.get(name);
  if (!def) return JSON.stringify({ error: `Ukjent verktøy: ${name}` });

  try {
    // Zod her gjør to ting: validerer det modellen skrev, og fyller inn
    // standardverdiene (som limit) som skjemaet lover og handleren regner med.
    const parsed = def.inputSchema.parse(JSON.parse(args));
    const result = await def.run(parsed, ctx);
    return wrapToolResult(name, result.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: `Verktøykallet feilet: ${message}` });
  }
}
