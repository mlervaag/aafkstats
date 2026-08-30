import { apiOptions, apiRateLimit, PUBLIC_CACHE } from "@/lib/public-api";
import { openApiDocument } from "@/lib/openapi";

export function GET(request: Request) {
  const limited = apiRateLimit(request);
  if (limited) return limited;
  return Response.json(openApiDocument, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": PUBLIC_CACHE } });
}
export const OPTIONS = apiOptions;
