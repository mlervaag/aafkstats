import { apiError, apiOptions, apiRateLimit, apiResponse } from "@/lib/public-api";
import { executePublicTool } from "@aafkstats/query";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ year: string }> }) {
  const limited = apiRateLimit(request);
  if (limited) return limited;
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) return apiError("invalid_parameter", "year må være et firesifret årstall.");
  const result = await executePublicTool("get_season_summary", { season: Number(year) });
  if (result.isError) {
    const { error } = result.content as { error?: { code?: string } };
    if (error?.code === "SEASON_NOT_FOUND") return apiError("not_found", "Sesongen finnes ikke.", 404);
    return apiError("invalid_request", "Sesongen kunne ikke hentes.");
  }
  // REST v1 svarer fortsatt med listen av konkurranser. `overall` er lagt til for
  // MCP-klienter og endrer ikke formen på dette svaret.
  const content = result.content as { competitions?: unknown[] };
  return apiResponse(content.competitions ?? []);
}

export const OPTIONS = apiOptions;
