import { createMcpHandler, McpServer, type McpRequestContext } from "@modelcontextprotocol/server";
import { executePublicTool, loadMissingOverview, loadPublicVerificationCase, loadPublicVerificationCases, publicTools, type PublicToolName } from "@aafkstats/query";
import { z } from "zod4";
import { API_VERSION, publicApiInfo } from "./public-api";
import { SITE_ORIGIN } from "./site";
import { POST as submitVerification } from "../app/api/verifications/route";
import { mcpResearchFindingSchema } from "./verification-submission-schema";

const MAX_OUTPUT_CHARS = 100_000;

const limit100 = z.number().int().min(1).max(100).default(20);
const publicToolSchemas: Record<PublicToolName, z.ZodType> = {
  search_matches: z.object({
    season: z.number().int().optional(), seasonFrom: z.number().int().optional(), seasonTo: z.number().int().optional(),
    opponent: z.string().optional(), competitionType: z.enum(["league", "national_cup", "european", "friendly", "playoff"]).optional(),
    isHome: z.boolean().optional(), result: z.enum(["S", "U", "T"]).optional(), minGoalDifference: z.number().int().optional(),
    maxGoalDifference: z.number().int().optional(), minXg: z.number().min(0).optional(), maxXg: z.number().min(0).optional(),
    hasStats: z.boolean().optional(), limit: limit100,
  }),
  search_all_results: z.object({
    season: z.number().int().min(1914).max(2100).optional(), seasonFrom: z.number().int().min(1914).max(2100).optional(),
    seasonTo: z.number().int().min(1914).max(2100).optional(), opponent: z.string().optional(), opponentClubId: z.string().optional(),
    result: z.enum(["S", "U", "T"]).optional(), ranking: z.enum(["largest_win", "largest_defeat", "most_goals_for", "most_goals_total", "newest", "oldest"]).default("newest"), limit: limit100,
  }),
  get_match: z.object({ matchId: z.string() }),
  get_season_summary: z.object({ season: z.number().int() }),
  head_to_head: z.object({ opponent: z.string() }),
  search_reports: z.object({ q: z.string().min(1), limit: z.number().int().min(1).max(50).default(10) }),
  search_people: z.object({ q: z.string().optional(), category: z.enum(["player", "coach", "sporting_staff", "board", "administration", "honorary", "founder", "project"]).optional(), year: z.number().int().min(1914).max(2100).optional(), limit: limit100 }),
  search_historical_results: z.object({ season: z.number().int().min(1914).max(2100).optional(), opponent: z.string().optional(), limit: limit100 }),
};

function toolResult(content: unknown, isError = false) {
  const text = JSON.stringify(content);
  if (text.length > MAX_OUTPUT_CHARS) {
    return { isError: true, content: [{ type: "text" as const, text: "Resultatet er for stort. Bruk smalere filtre eller lavere limit." }] };
  }
  return {
    ...(isError ? { isError: true } : {}),
    content: [{ type: "text" as const, text }],
    ...(content && typeof content === "object"
      ? { structuredContent: Array.isArray(content) ? { items: content } : content as Record<string, unknown> }
      : {}),
  };
}

export function forwardedClientHeaders(request?: Request): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  if (!request) return headers;
  for (const name of ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function createArchiveServer(context: McpRequestContext) {
  const server = new McpServer(
    { name: "aafkarkivet", version: API_VERSION },
    { instructions: "AaFK-arkivet skiller canonical_match fra source_claim. De skal aldri summeres. Confidence, conflicts og missingFields skal bevares. En verification case er et spørsmål, ikke et faktum." },
  );

  for (const tool of publicTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: publicToolSchemas[tool.name as PublicToolName],
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (input: unknown) => {
        const result = await executePublicTool(tool.name as PublicToolName, input, {
          onQuery: ({ durationMs, rowCount, error }) => console.info(JSON.stringify({ event: "mcp_tool", tool: tool.name, durationMs, rowCount, success: !error })),
        });
        return toolResult(result.content, result.isError);
      },
    );
  }

  server.registerTool(
    "get_research_overview",
    { description: "Hent det brede bildet av hva AaFK-arkivet mangler. Dette er dekningshull, ikke én oppgave per rad.", inputSchema: {}, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    async () => toolResult(loadMissingOverview()),
  );

  server.registerTool(
    "list_verification_cases",
    {
      description: "List publiserte, åpne researchsaker. Hver sak er et spørsmål som trenger dokumentasjon, ikke en sann påstand.",
      inputSchema: { category: z.string().optional(), targetType: z.enum(["person", "match", "season", "club", "source"]).optional(), limit: z.number().int().min(1).max(100).default(20) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ category, targetType, limit }) => toolResult(loadPublicVerificationCases().filter((item) => !category || item.category === category).filter((item) => !targetType || item.target.type === targetType).slice(0, limit)),
  );

  server.registerTool(
    "get_verification_case",
    { description: "Hent én publisert, åpen researchsak med revisjon, target, eksisterende kilder og researchTask. Saken er arbeidsgrunnlag, ikke sannhet.", inputSchema: { id: z.string().min(1).max(100) }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    async ({ id }) => {
      const item = loadPublicVerificationCase(id);
      return item ? toolResult(item) : toolResult({ error: "Åpen, publisert sak finnes ikke." }, true);
    },
  );

  server.registerTool(
    "submit_research_finding",
    {
      description: "Send dokumentasjon til eksisterende redaksjonell innboks for én åpen sak med researchTask. Dette verifiserer, publiserer eller endrer aldri arkivet; svaret er bare pending_review.",
      inputSchema: mcpResearchFindingSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (input) => {
      const item = loadPublicVerificationCase(input.caseId);
      if (!item?.researchTask) return toolResult({ error: "Saken er ikke en åpen, publisert researchTask." }, true);
      const response = await submitVerification(new Request(`${SITE_ORIGIN}/api/verifications`, {
        method: "POST",
        headers: forwardedClientHeaders(context.requestInfo),
        body: JSON.stringify(input),
      }));
      const payload = await response.json() as { success?: boolean; duplicate?: boolean; issueUrl?: string; error?: string };
      if (!response.ok) return toolResult({ error: payload.error ?? "Innsendingen feilet.", status: response.status }, true);
      return toolResult({ status: "pending_review", duplicate: payload.duplicate ?? false, submissionUrl: payload.issueUrl ?? null });
    },
  );

  server.registerResource("dataset", "aafk://dataset", { title: "AaFK-arkivets datasett", mimeType: "application/json" }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(publicApiInfo) }] }));
  server.registerResource("rights", "aafk://rights", { title: "Rettigheter og lisens", mimeType: "text/markdown" }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: `Se ${SITE_ORIGIN}/data#lisens-og-rettigheter. Tredjepartsfakta og kilder får ikke ny lisens gjennom API eller MCP.` }] }));

  return server;
}

export const mcpHandler = createMcpHandler(createArchiveServer, {
  legacy: "stateless",
  onerror: (error) => console.error(JSON.stringify({ event: "mcp_error", message: error.message })),
});
