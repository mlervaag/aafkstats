import { searchHistoricalObservations, searchMatches, searchPeople, searchSources } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Svaret endrer seg bare når arkivet rulles ut på nytt, og en ny utrulling tømmer
 * kanten uansett. Samme søk fra neste besøkende kan derfor serveres fra kanten
 * i stedet for å åpne SQLite-fila igjen. Feilsvar caches ikke.
 */
const CACHE_HEADERS = { "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400" };

export function GET(request: Request): Response {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ matches: [], people: [], sources: [], observations: [] }, { headers: CACHE_HEADERS });
  if (query.length > 100) return Response.json({ error: "Søket er for langt." }, { status: 400 });

  try {
    return Response.json({
      matches: searchMatches(query),
      people: searchPeople(query),
      sources: searchSources(query),
      observations: searchHistoricalObservations(query),
    }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Direktesøket feilet:", error instanceof Error ? error.message : String(error));
    return Response.json({ error: "Kunne ikke søke i arkivet." }, { status: 500 });
  }
}
