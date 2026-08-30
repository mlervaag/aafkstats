import { readBodyLimited } from "@/lib/chat-request";
import { mcpHandler } from "@/lib/mcp-server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const MAX_MCP_BODY_BYTES = 64 * 1024;

async function handle(request: Request) {
  const limit = checkRateLimit(request, "mcp");
  if (!limit.allowed) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return Response.json({ error: "cross_origin_not_allowed" }, { status: 403 });
  }
  if (request.method !== "POST") return mcpHandler.fetch(request);
  const raw = await readBodyLimited(request, MAX_MCP_BODY_BYTES);
  if (raw === null) return Response.json({ error: "request_too_large" }, { status: 413 });
  const forwarded = new Request(request.url, { method: request.method, headers: request.headers, body: raw });
  return mcpHandler.fetch(forwarded);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
