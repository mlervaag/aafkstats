import { runSafeSql } from "@aafkstats/db/sql";
import { toolError, toolsByName, type ToolContext, type ToolResult } from "./tools.js";

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
  "get_person",
  "search_sources",
  "get_source",
  "search_historical_results",
] as const;

export type PublicToolName = (typeof PUBLIC_TOOL_NAMES)[number];

export function resolvePublicTools(names: readonly PublicToolName[] = PUBLIC_TOOL_NAMES) {
  return names.map((name) => {
    const tool = toolsByName.get(name);
    if (!tool) throw new Error(`Offentlig verktøy finnes ikke: ${name}`);
    return tool;
  });
}

export const publicTools = resolvePublicTools();

export async function executePublicTool(name: PublicToolName, input: unknown, context: ToolContext = {}): Promise<ToolResult> {
  const tool = toolsByName.get(name);
  if (!tool || !PUBLIC_TOOL_NAMES.includes(name)) {
    return toolError("TOOL_NOT_PUBLIC", `Verktøyet ${name} er ikke del av den offentlige kontrakten.`, {
      suggestions: [`Tilgjengelige verktøy: ${PUBLIC_TOOL_NAMES.join(", ")}.`],
    });
  }
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    return toolError("INVALID_PARAMETERS", "Ugyldige parametere.", { issues: parsed.error.issues });
  }
  return tool.run(parsed.data, context);
}

export interface ArchiveContentTotals {
  canonicalMatches: number;
  sourceClaims: number;
  seasons: number;
  firstSeason: number | null;
  lastSeason: number | null;
  people: number;
  sources: number;
  clubs: number;
  historicalObservations: number;
  scheduledMatches: number;
}

/**
 * Størrelsen på arkivet, slik en ekstern klient kan forstå hva den snakker med.
 *
 * Kanoniske kamper og kildepåstander telles hver for seg og skal ikke legges sammen —
 * samme regel som ellers i kontrakten.
 */
export async function loadArchiveContentTotals(context: ToolContext = {}): Promise<ArchiveContentTotals> {
  const result = await runSafeSql(
    `SELECT
       (SELECT count(*) FROM matches WHERE status IN ('played', 'awarded')) AS canonical_matches,
       (SELECT count(*) FROM result_groups) AS source_claims,
       (SELECT count(*) FROM matches WHERE status = 'scheduled') AS scheduled_matches,
       (SELECT count(DISTINCT season) FROM matches) AS seasons,
       (SELECT min(season) FROM matches) AS first_season,
       (SELECT max(season) FROM matches) AS last_season,
       (SELECT count(*) FROM people) AS people,
       (SELECT count(*) FROM sources) AS sources,
       (SELECT count(*) FROM opponents) AS clubs,
       (SELECT count(*) FROM historical_observations) AS historical_observations`,
    { dbPath: context.dbPath },
  );
  const row = (result.rows[0] ?? {}) as Record<string, number | null>;
  const count = (key: string) => Number(row[key] ?? 0);
  return {
    canonicalMatches: count("canonical_matches"),
    sourceClaims: count("source_claims"),
    scheduledMatches: count("scheduled_matches"),
    seasons: count("seasons"),
    firstSeason: row.first_season ?? null,
    lastSeason: row.last_season ?? null,
    people: count("people"),
    sources: count("sources"),
    clubs: count("clubs"),
    historicalObservations: count("historical_observations"),
  };
}
