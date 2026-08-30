import { apiError, apiOptions, apiResponse } from "@/lib/public-api";
import { executePublicTool } from "@aafkstats/query";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await executePublicTool("get_match", { matchId: id });
  if (result.isError) return apiError("invalid_request", "Kampen kunne ikke hentes.");
  const content = result.content as { match?: { rows?: unknown[] } };
  if (!content.match?.rows?.length) return apiError("not_found", "Kampen finnes ikke.", 404);
  return apiResponse(result.content);
}

export const OPTIONS = apiOptions;
