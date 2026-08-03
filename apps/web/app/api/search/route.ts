import { searchMatches } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ matches: [] });
  if (query.length > 100) return Response.json({ error: "Søket er for langt." }, { status: 400 });

  try {
    return Response.json({ matches: searchMatches(query) });
  } catch (error) {
    console.error("Direktesøket feilet:", error instanceof Error ? error.message : String(error));
    return Response.json({ error: "Kunne ikke søke i arkivet." }, { status: 500 });
  }
}
