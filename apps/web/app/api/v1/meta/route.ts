import { loadPublicCoverageSummary } from "@aafkstats/query";
import { apiOptions, apiRateLimit, apiResponse, publicApiInfo } from "@/lib/public-api";

export const runtime = "nodejs";

export function GET(request: Request) {
  const limited = apiRateLimit(request);
  if (limited) return limited;
  return apiResponse({
    ...publicApiInfo,
    coverage: loadPublicCoverageSummary(),
  });
}

export const OPTIONS = apiOptions;
