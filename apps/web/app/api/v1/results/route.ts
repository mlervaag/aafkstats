import { apiError, apiOptions, apiRateLimit, integerParam, runPublicTool } from "@/lib/public-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = apiRateLimit(request);
  if (limited) return limited;
  try {
    const search = new URL(request.url).searchParams;
    return runPublicTool("search_all_results", {
      season: integerParam(search, "season"), seasonFrom: integerParam(search, "seasonFrom"),
      seasonTo: integerParam(search, "seasonTo"), opponent: search.get("opponent") || undefined,
      opponentClubId: search.get("opponentClubId") || undefined, result: search.get("result") || undefined,
      ranking: search.get("ranking") || undefined, limit: integerParam(search, "limit") ?? 20,
    });
  } catch (error) {
    return apiError("invalid_parameter", error instanceof Error ? error.message : "Ugyldig parameter.");
  }
}

export const OPTIONS = apiOptions;
