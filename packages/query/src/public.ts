import { toolsByName, type ToolContext, type ToolResult } from "./tools.js";

/**
 * Strukturert allowlist for eksterne grensesnitt. `run_sql` er bevisst utelatt:
 * et dokumentert databaseview er ikke automatisk en publiseringsbeslutning.
 */
export const PUBLIC_TOOL_NAMES = [
  "search_matches",
  "search_all_results",
  "get_match",
  "get_season_summary",
  "head_to_head",
  "search_reports",
  "search_people",
  "search_historical_results",
] as const;

export type PublicToolName = (typeof PUBLIC_TOOL_NAMES)[number];

export const publicTools = PUBLIC_TOOL_NAMES.map((name) => toolsByName.get(name)!).filter(Boolean);

export async function executePublicTool(name: PublicToolName, input: unknown, context: ToolContext = {}): Promise<ToolResult> {
  const tool = toolsByName.get(name);
  if (!tool || !PUBLIC_TOOL_NAMES.includes(name)) {
    return { content: { error: "Verktøyet er ikke del av den offentlige kontrakten." }, isError: true };
  }
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      content: { error: "Ugyldige parametere.", issues: parsed.error.issues },
      isError: true,
    };
  }
  return tool.run(parsed.data, context);
}
