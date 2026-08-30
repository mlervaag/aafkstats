import { apiOptions, PUBLIC_CACHE } from "@/lib/public-api";
import { openApiDocument } from "@/lib/openapi";

export function GET() {
  return Response.json(openApiDocument, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": PUBLIC_CACHE } });
}
export const OPTIONS = apiOptions;
