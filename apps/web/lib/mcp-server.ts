import { createMcpHandler, McpServer, type McpRequestContext } from "@modelcontextprotocol/server";
import { DATASET_VERSION, executePublicTool, loadArchiveContentTotals, loadMissingOverview, loadPublicVerificationCase, loadPublicVerificationCases, publicTools, summarizeMissingOverview, type PublicToolName, type VerificationCaseView } from "@aafkstats/query";
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
  head_to_head: z.object({ opponent: z.string(), includeEvidence: z.boolean().default(false) }),
  search_reports: z.object({ q: z.string().min(1), limit: z.number().int().min(1).max(50).default(10) }),
  search_people: z.object({ q: z.string().optional(), category: z.enum(["player", "coach", "sporting_staff", "board", "administration", "honorary", "founder", "project"]).optional(), year: z.number().int().min(1914).max(2100).optional(), limit: limit100 }),
  get_person: z.object({ personId: z.string().min(1) }),
  search_transfers: z.object({
    season: z.number().int().min(1900).max(2100).optional(), seasonFrom: z.number().int().min(1900).max(2100).optional(),
    seasonTo: z.number().int().min(1900).max(2100).optional(), direction: z.enum(["in", "out"]).optional(),
    kind: z.enum(["transfer", "loan", "loan_return", "free", "academy", "released", "retired"]).optional(),
    club: z.string().optional(), clubId: z.string().optional(), person: z.string().optional(), personId: z.string().optional(),
    limit: limit100,
  }),
  get_squad: z.object({ season: z.number().int().min(1900).max(2100), limit: z.number().int().min(1).max(100).default(60) }),
  get_standings: z.object({ season: z.number().int().min(1900).max(2100), competitionId: z.string().optional(), includeProgression: z.boolean().default(false) }),
  search_sources: z.object({ q: z.string().optional(), type: z.string().optional(), year: z.number().int().min(1800).max(2100).optional(), yearFrom: z.number().int().min(1800).max(2100).optional(), yearTo: z.number().int().min(1800).max(2100).optional(), limit: limit100 }),
  get_source: z.object({ sourceId: z.string().min(1), claimLimit: z.number().int().min(0).max(50).default(10) }),
  search_historical_results: z.object({ season: z.number().int().min(1914).max(2100).optional(), opponent: z.string().optional(), limit: limit100 }),
};

const MCP_JSON_COLUMNS = new Set([
  "claims", "claim_summary", "conflicts", "missing_fields", "notes", "providers", "role_categories",
  "sources", "tags", "unlinked_source_references", "person_ids", "season_years", "match_ids",
  "competition_ids", "venue_ids",
]);

/** Gjør SQLite-JSON og interne stier direkte brukbare for en ekstern MCP-klient. */
export function mcpPublicValue(value: unknown, key = ""): unknown {
  if (typeof value === "string" && MCP_JSON_COLUMNS.has(key)) {
    try { return mcpPublicValue(JSON.parse(value), key); } catch { return value; }
  }
  if (Array.isArray(value)) return value.map((entry) => mcpPublicValue(entry));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      result[childKey] = mcpPublicValue(childValue, childKey);
    }
    for (const linkKey of ["url", "href"] as const) {
      const link = result[linkKey];
      if (typeof link === "string" && link.startsWith("/")) {
        result.path ??= link;
        result[linkKey] = `${SITE_ORIGIN}${link}`;
      }
    }
    return result;
  }
  return value;
}

function toolResult(content: unknown, isError = false) {
  const normalized = mcpPublicValue(content);
  const text = JSON.stringify(normalized);
  if (text.length > MAX_OUTPUT_CHARS) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify({ error: {
        code: "RESULT_TOO_LARGE",
        message: "Resultatet er for stort til ett svar.",
        suggestions: ["Sett en lavere limit.", "Snevre inn med season, seasonFrom eller seasonTo.", "Hent detaljene per rad med et get-verktøy i stedet."],
      } }) }],
    };
  }
  return {
    ...(isError ? { isError: true } : {}),
    content: [{ type: "text" as const, text }],
    ...(normalized && typeof normalized === "object"
      ? { structuredContent: Array.isArray(normalized) ? { items: normalized } : normalized as Record<string, unknown> }
      : {}),
  };
}

function verificationCaseSummary(item: VerificationCaseView) {
  return {
    id: item.id,
    category: item.category,
    question: item.question,
    targetType: item.target.type,
    targetId: item.target.id,
    priority: item.priority,
    estimatedMinutes: item.estimatedMinutes,
    hasResearchTask: item.researchTask !== null,
    canSubmitViaMcp: item.researchTask !== null,
    href: item.href,
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
    "get_archive_capabilities",
    {
      description:
        "Hent hva denne MCP-serveren faktisk er: kontraktversjoner, størrelsen på datasettet, " +
        "hvilke sesonger som er dekket og hvor ferskt innholdet er. Arkivet er ikke en " +
        "livetjeneste og skal ikke brukes som kilde for pågående eller nettopp avsluttede kamper.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const totals = await loadArchiveContentTotals();
      return toolResult({
        contract: "aafk-archive-mcp@1",
        archiveVersion: API_VERSION,
        datasetVersion: DATASET_VERSION,
        build: publicApiInfo.build,
        responseContracts: [
          "archive-result-evidence@2", "archive-head-to-head-evidence@1",
          "archive-transfer-evidence@1", "archive-squad@1", "archive-standings@1",
          "nb-community-research@1",
        ],
        // canonicalMatches og sourceClaims er to lag som aldri summeres, også her.
        content: totals,
        seasonsCovered: { from: totals.firstSeason, to: totals.lastSeason, count: totals.seasons },
        // Kampene dekker hele spennet; overganger, stall og tabeller gjør det
        // ikke. Sies det ikke her, blir et tomt svar lest som at ingenting skjedde.
        partialCoverage: {
          transfers: {
            rows: totals.transfers,
            seasons: totals.transferSeasons,
            note: "Overganger er kildeført enkeltvis og dekker langt fra alle sesonger. Et år uten rader betyr at ingen kilde er ført inn ennå, ikke at ingen skiftet klubb.",
          },
          squad: {
            seasons: totals.squadSeasons,
            note: "Stallen er utledet av lagoppstillingene, som starter i 2010. Eldre sesonger har kamper, men ingen stall.",
          },
          standings: {
            seasons: totals.standingsSeasons,
            note: "Serietabeller er innhøstet per sesong. Et år uten tabell er en manglende kilde, ikke en sesong uten serie.",
          },
        },
        // Kampen som spilles akkurat nå finnes ikke her. Sies ikke det rett ut, blir
        // arkivet brukt som sanntidskilde, og et tomt svar lest som «ingen kamp».
        freshness: {
          liveScores: false,
          scheduledMatches: true,
          typicalUpdateMode: "post_ingestion",
          note:
            "Arkivet oppdateres etter redaksjonell ingest, ikke fortløpende. Et manglende resultat betyr at kampen ikke er lagt inn ennå, ikke at den ikke ble spilt. Bruk en livetjeneste for pågående kamper.",
        },
        writeAccess: {
          canonicalData: false,
          note: "MCP kan bare sende dokumentasjon til pending_review med submit_research_finding. Ingen verktøy her endrer, kanoniserer eller lukker noe i arkivet.",
        },
        rightsNoticeUrl: publicApiInfo.rightsNoticeUrl,
      });
    },
  );

  server.registerTool(
    "get_research_overview",
    { description: "Hent et kompakt sammendrag av hva AaFK-arkivet mangler. Bruk egne list-verktøy bare når du trenger detaljene.", inputSchema: {}, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    async () => toolResult(summarizeMissingOverview(loadMissingOverview())),
  );

  server.registerTool(
    "list_incomplete_seasons",
    { description: "List ufullstendige seriesesonger. Dette er detaljene bak telleren i get_research_overview.", inputSchema: { limit: z.number().int().min(1).max(100).default(20) }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    async ({ limit }) => toolResult(loadMissingOverview().incompleteSeasons.slice(0, limit)),
  );

  server.registerTool(
    "list_lineup_review_candidates",
    { description: "List avgrensede lagoppstillingskandidater med kilde. Kandidatene er ikke kanoniske kampfakta.", inputSchema: { limit: z.number().int().min(1).max(100).default(20) }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    async ({ limit }) => {
      const overview = loadMissingOverview();
      const items = overview.lineupReview.items.flatMap((source) => source.candidates.map((candidate) => ({
        ...candidate,
        sourceId: source.sourceId,
        sourceTitle: source.title,
        sourceUrl: source.sourceUrl,
        href: source.url,
      })));
      return toolResult(items.slice(0, limit));
    },
  );

  server.registerTool(
    "list_identity_issues",
    { description: "List spilleridentiteter som mangler personfil eller kampkobling. Dette er arbeidskandidater, ikke identitetsavgjørelser.", inputSchema: { limit: z.number().int().min(1).max(100).default(20) }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    async ({ limit }) => {
      const identity = loadMissingOverview().identity;
      return toolResult({
        playersWithoutFile: identity.playersWithoutFile.slice(0, limit),
        filesWithoutMatches: identity.filesWithoutMatches.slice(0, limit),
      });
    },
  );

  server.registerTool(
    "list_verification_cases",
    {
      description: "List publiserte, åpne researchsaker. Hver sak er et spørsmål som trenger dokumentasjon, ikke en sann påstand.",
      inputSchema: { category: z.string().optional(), targetType: z.enum(["person", "match", "season", "club", "source"]).optional(), limit: z.number().int().min(1).max(100).default(20) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ category, targetType, limit }) => toolResult(loadPublicVerificationCases().filter((item) => !category || item.category === category).filter((item) => !targetType || item.target.type === targetType).slice(0, limit).map(verificationCaseSummary)),
  );

  server.registerTool(
    "get_verification_case",
    { description: "Hent én publisert, åpen researchsak med revisjon, target, eksisterende kilder og researchTask. Saken er arbeidsgrunnlag, ikke sannhet.", inputSchema: { id: z.string().min(1).max(100) }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    async ({ id }) => {
      const item = loadPublicVerificationCase(id);
      if (!item) {
        return toolResult({ error: {
          code: "VERIFICATION_CASE_NOT_FOUND",
          message: `Det finnes ingen åpen, publisert researchsak med ID ${id}.`,
          suggestions: ["Bruk list_verification_cases. Lukkede og upubliserte saker er ikke tilgjengelige."],
        } }, true);
      }
      return toolResult({ ...item, canSubmitViaMcp: item.researchTask !== null });
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
      if (!item?.researchTask) {
        return toolResult({ error: {
          code: "SUBMISSION_NOT_ALLOWED",
          message: `Saken ${input.caseId} er ikke en åpen, publisert sak med researchTask, og tar ikke imot innsending.`,
          suggestions: ["Bruk list_verification_cases og se etter canSubmitViaMcp = true."],
        } }, true);
      }
      const response = await submitVerification(new Request(`${SITE_ORIGIN}/api/verifications`, {
        method: "POST",
        headers: forwardedClientHeaders(context.requestInfo),
        body: JSON.stringify(input),
      }));
      const payload = await response.json() as { success?: boolean; duplicate?: boolean; issueUrl?: string; error?: string; code?: string };
      if (!response.ok) {
        return toolResult({ error: {
          code: payload.code ?? "SUBMISSION_FAILED",
          message: payload.error ?? "Innsendingen feilet.",
          status: response.status,
          ...(payload.code === "REVISION_MISMATCH"
            ? { suggestions: ["Hent saken på nytt med get_verification_case og send inn med den revisjonen svaret gir."] }
            : {}),
        } }, true);
      }
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
