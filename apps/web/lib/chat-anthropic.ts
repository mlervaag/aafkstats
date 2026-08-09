/**
 * Verktøyløkka mot Anthropic.
 *
 * Den opprinnelige veien, og standarden når begge nøklene er satt. Løkka er
 * SDK-ets egen (`toolRunner`): den kaller verktøyene, legger svarene tilbake i
 * samtalen og kjører videre til modellen er ferdig eller runde fem er brukt opp.
 */

import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { systemPrompt } from "@aafkstats/query/prompt";
import { datasetCoverage } from "@/lib/chat-coverage";
import { tools as toolDefs } from "@aafkstats/query/tools";
import {
  MAX_ITERATIONS,
  MAX_TOKENS,
  wrapToolResult,
  type ChatResult,
  type ChatRun,
  type ChatSetup,
} from "@/lib/chat-model";

export async function runAnthropic(setup: ChatSetup, run: ChatRun): Promise<ChatResult> {
  const client = new Anthropic();

  const runnableTools = toolDefs.map((def) =>
    betaZodTool({
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema,
      run: async (input) => {
        const result = await def.run(input, run.ctx);
        return [{ type: "text" as const, text: wrapToolResult(def.name, result.content) }];
      },
    }),
  );

  let inputTokens = 0;
  let outputTokens = 0;
  let failure: string | null = null;

  const runner = client.beta.messages.toolRunner({
    model: setup.model,
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
        text: systemPrompt(datasetCoverage()),
        // Systemprompten og verktøydefinisjonene er identiske mellom kall, så
        // hele prefikset caches. Ingenting her endrer seg per forespørsel.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [...run.history, { role: "user" as const, content: run.question }],
    tools: runnableTools,
    max_iterations: MAX_ITERATIONS,
    stream: true,
  });

  for await (const messageStream of runner) {
    for await (const event of messageStream) {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        run.send("tool", { name: event.content_block.name });
      }
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        run.send("text", { text: event.delta.text });
      }
    }

    const message = await messageStream.finalMessage();
    inputTokens += message.usage.input_tokens ?? 0;
    outputTokens += message.usage.output_tokens ?? 0;

    if (message.stop_reason === "refusal") {
      failure = "Modellen avslo å svare på dette spørsmålet.";
      run.send("error", { message: failure });
    }
  }

  return { inputTokens, outputTokens, failure };
}
