import { loadMissingOverview } from "@aafkstats/query";
import { apiOptions, apiResponse } from "@/lib/public-api";

export const runtime = "nodejs";
export function GET() { return apiResponse(loadMissingOverview()); }
export const OPTIONS = apiOptions;
