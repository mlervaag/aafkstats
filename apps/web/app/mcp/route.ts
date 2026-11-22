import { isCrossSite, readBodyLimited } from "@/lib/chat-request";
import { mcpHandler } from "@/lib/mcp-server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const MAX_MCP_BODY_BYTES = 64 * 1024;
/**
 * Tak på hvor mange meldinger én forespørsel får bære.
 *
 * JSON-RPC tillater en tabell med meldinger, og SDK-en kjører dem samtidig.
 * Hvert verktøykall starter en egen prosess for spørringen, så en tabell med
 * flere hundre kall ble flere hundre prosesser — for ett trekk på fartsgrensen.
 * Eldre klienter som samler opp noen få meldinger, slipper fortsatt gjennom.
 */
const MAX_MCP_BATCH = 5;

/** Antall meldinger i kroppen, eller null når den ikke er en JSON-tabell. */
function batchSize(raw: string): number | null {
  // Bare en tabell begynner med «[». Alt annet får SDK-en tolke og avvise selv.
  if (!raw.trimStart().startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

async function handle(request: Request) {
  if (isCrossSite(request)) {
    return Response.json({ error: "cross_origin_not_allowed" }, { status: 403 });
  }
  const limit = checkRateLimit(request, "mcp");
  if (!limit.allowed) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } });
  if (request.method !== "POST") return mcpHandler.fetch(request);
  const raw = await readBodyLimited(request, MAX_MCP_BODY_BYTES);
  if (raw === null) return Response.json({ error: "request_too_large" }, { status: 413 });
  const size = batchSize(raw);
  if (size !== null && size > MAX_MCP_BATCH) {
    return Response.json({ error: "batch_too_large", maxBatch: MAX_MCP_BATCH }, { status: 400 });
  }
  const forwarded = new Request(request.url, { method: request.method, headers: request.headers, body: raw });
  return mcpHandler.fetch(forwarded);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
