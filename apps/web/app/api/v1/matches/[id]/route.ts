import { apiError, apiOptions, apiRateLimit, apiResponse } from "@/lib/public-api";
import { executePublicTool } from "@aafkstats/query";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = apiRateLimit(request);
  if (limited) return limited;
  const { id } = await params;
  const result = await executePublicTool("get_match", { matchId: id });
  if (result.isError) {
    const { error } = result.content as { error?: { code?: string } };
    if (error?.code === "MATCH_NOT_FOUND") return apiError("not_found", "Kampen finnes ikke.", 404);
    return apiError("invalid_request", "Kampen kunne ikke hentes.");
  }
  return apiResponse(result.content);
}

export const OPTIONS = apiOptions;
