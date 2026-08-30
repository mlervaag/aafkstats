import { apiError, apiOptions, booleanParam, integerParam, runPublicTool } from "@/lib/public-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    return runPublicTool("search_matches", {
      season: integerParam(search, "season"), seasonFrom: integerParam(search, "seasonFrom"),
      seasonTo: integerParam(search, "seasonTo"), opponent: search.get("opponent") || undefined,
      competitionType: search.get("competitionType") || undefined, isHome: booleanParam(search, "isHome"),
      result: search.get("result") || undefined, minGoalDifference: integerParam(search, "minGoalDifference"),
      maxGoalDifference: integerParam(search, "maxGoalDifference"), limit: integerParam(search, "limit") ?? 20,
    });
  } catch (error) {
    return apiError("invalid_parameter", error instanceof Error ? error.message : "Ugyldig parameter.");
  }
}

export const OPTIONS = apiOptions;
