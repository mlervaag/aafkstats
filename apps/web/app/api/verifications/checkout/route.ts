import { NextResponse } from "next/server";
import { z } from "zod";
import { isCrossSite, isJsonRequest, readBodyLimited } from "@/lib/chat-request";
import { checkedOutCaseIds, claimVerificationCase, releaseVerificationCase } from "@/lib/verification-checkout";
import { loadVerificationCase } from "@/lib/verifications";

const payload = z.object({
  caseId: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  owner: z.string().uuid(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner") ?? undefined;
  return NextResponse.json({ checkedOut: checkedOutCaseIds(owner) }, { headers: { "Cache-Control": "no-store" } });
}

async function parsePayload(req: Request) {
  if (isCrossSite(req) || !isJsonRequest(req)) return null;
  const raw = await readBodyLimited(req, 2048);
  if (raw === null) return null;
  try { return payload.parse(JSON.parse(raw)); } catch { return null; }
}

export async function POST(req: Request) {
  const data = await parsePayload(req);
  if (!data) return NextResponse.json({ error: "Ugyldig reservasjon." }, { status: 400 });
  const item = loadVerificationCase(data.caseId);
  if (!item || item.status !== "open") return NextResponse.json({ error: "Saken er ikke åpen." }, { status: 404 });
  const result = claimVerificationCase(data.caseId, data.owner);
  return NextResponse.json(result, { status: result.acquired ? 200 : 409, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const data = await parsePayload(req);
  if (!data) return NextResponse.json({ error: "Ugyldig reservasjon." }, { status: 400 });
  releaseVerificationCase(data.caseId, data.owner);
  return NextResponse.json({ released: true }, { headers: { "Cache-Control": "no-store" } });
}
