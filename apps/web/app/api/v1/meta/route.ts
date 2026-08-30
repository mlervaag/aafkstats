import { loadMissingOverview } from "@aafkstats/query";
import { apiOptions, apiResponse, publicApiInfo } from "@/lib/public-api";

export const runtime = "nodejs";

export function GET() {
  const overview = loadMissingOverview();
  return apiResponse({
    ...publicApiInfo,
    coverage: {
      canonicalMatches: overview.playedMatches,
      unlinkedSourceResults: overview.historicalResults.total,
      openCoverageGaps: overview.matchFields.reduce((sum, item) => sum + item.matches, 0),
    },
  });
}

export const OPTIONS = apiOptions;
