import { loadPublicVerificationCases } from "@aafkstats/query";
import { apiError, apiOptions, apiResponse, integerParam } from "@/lib/public-api";

export const runtime = "nodejs";

export function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const category = search.get("category");
    const targetType = search.get("targetType");
    const priority = integerParam(search, "priority");
    const limit = integerParam(search, "limit") ?? 20;
    if (limit < 1 || limit > 100) return apiError("invalid_parameter", "limit må være mellom 1 og 100.");
    const cases = loadPublicVerificationCases()
      .filter((item) => !category || item.category === category)
      .filter((item) => !targetType || item.target.type === targetType)
      .filter((item) => priority === undefined || item.priority === priority)
      .slice(0, limit);
    return apiResponse(cases, { count: cases.length, nextCursor: null });
  } catch (error) {
    return apiError("invalid_parameter", error instanceof Error ? error.message : "Ugyldig parameter.");
  }
}

export const OPTIONS = apiOptions;
