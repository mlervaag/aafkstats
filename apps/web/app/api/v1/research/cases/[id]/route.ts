import { loadPublicVerificationCase } from "@aafkstats/query";
import { apiError, apiOptions, apiRateLimit, apiResponse } from "@/lib/public-api";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = apiRateLimit(request);
  if (limited) return limited;
  const { id } = await params;
  const item = loadPublicVerificationCase(id);
  return item ? apiResponse(item) : apiError("not_found", "Den åpne saken finnes ikke.", 404);
}

export const OPTIONS = apiOptions;
