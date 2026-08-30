import { loadPublicVerificationCase } from "@aafkstats/query";
import { apiError, apiOptions, apiResponse } from "@/lib/public-api";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = loadPublicVerificationCase(id);
  return item ? apiResponse(item) : apiError("not_found", "Den åpne saken finnes ikke.", 404);
}

export const OPTIONS = apiOptions;
