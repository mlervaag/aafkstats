import { apiError, apiOptions, apiRateLimit, apiResponse } from "@/lib/public-api";
import { executePublicTool } from "@aafkstats/query";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ year: string }> }) {
  const limited = apiRateLimit(request);
  if (limited) return limited;
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) return apiError("invalid_parameter", "year må være et firesifret årstall.");
  const result = await executePublicTool("get_season_summary", { season: Number(year) });
  if (result.isError) return apiError("invalid_request", "Sesongen kunne ikke hentes.");
  const content = result.content as { rows?: unknown[] };
  if (!content.rows?.length) return apiError("not_found", "Sesongen finnes ikke.", 404);
  return apiResponse(content.rows);
}

export const OPTIONS = apiOptions;
