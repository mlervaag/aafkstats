import { NextResponse } from "next/server";
import { z } from "zod";
import { isCrossSite, isJsonRequest, readBodyLimited } from "@/lib/chat-request";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkedOutCaseIds, claimVerificationCase, releaseVerificationCase } from "@/lib/verification-checkout";
import { pendingVerificationCaseIds } from "@/lib/verification-submissions";
import { loadVerificationCase } from "@/lib/verifications";

const payload = z.object({
  caseId: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  owner: z.string().uuid(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner") ?? undefined;
  const checkedOut = checkedOutCaseIds(owner);
  const submitted = await pendingVerificationCaseIds();
  return NextResponse.json(
    { checkedOut, submitted, unavailable: [...new Set([...checkedOut, ...submitted])] },
    { headers: { "Cache-Control": "no-store" } },
  );
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
  // Etter at kroppen er godkjent, så feilformede kall ikke bruker av kvoten.
  // Klienten behandler et avslag her som «ingen reservasjon» og lar leseren
  // svare likevel: reservasjonen er en kollisjonsbrems, ikke en port.
  const limit = checkRateLimit(req, "reservasjon");
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.message }, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSeconds ?? 60) },
    });
  }
  const item = loadVerificationCase(data.caseId);
  if (!item || item.status !== "open") return NextResponse.json({ error: "Saken er ikke åpen." }, { status: 404 });
  if ((await pendingVerificationCaseIds()).includes(data.caseId)) {
    return NextResponse.json({ acquired: false, submitted: true }, {
      status: 409,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const result = claimVerificationCase(data.caseId, data.owner);
  return NextResponse.json(result, { status: result.acquired ? 200 : 409, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const data = await parsePayload(req);
  if (!data) return NextResponse.json({ error: "Ugyldig reservasjon." }, { status: 400 });
  releaseVerificationCase(data.caseId, data.owner);
  return NextResponse.json({ released: true }, { headers: { "Cache-Control": "no-store" } });
}
