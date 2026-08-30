import { loadMissingOverview } from "@aafkstats/query";
import { apiOptions, apiRateLimit, apiResponse } from "@/lib/public-api";

export const runtime = "nodejs";
export function GET(request: Request) {
  const limited = apiRateLimit(request);
  return limited ?? apiResponse(loadMissingOverview());
}
export const OPTIONS = apiOptions;
