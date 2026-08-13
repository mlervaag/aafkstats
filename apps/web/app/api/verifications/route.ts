import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isCrossSite, isJsonRequest, readBodyLimited } from "@/lib/chat-request";
import { checkRateLimit } from "@/lib/rate-limit";
import { SITE_ORIGIN } from "@/lib/site";
import { loadVerificationCase } from "@/lib/verifications";
import type { VerificationCaseView } from "@/lib/verifications";

const MAX_BODY_BYTES = 20 * 1024;

const evidence = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("listed_source"),
    sourceKey: z.string().min(1).max(240),
    reference: z.string().max(500).optional(),
  }).strict(),
  z.object({
    kind: z.literal("new_url"),
    url: z.string().url("Skriv inn en gyldig lenke.").max(500).refine((url) => /^https?:\/\//i.test(url), "Lenken må starte med http:// eller https://."),
    reference: z.string().max(500).optional(),
  }).strict(),
  z.object({
    kind: z.literal("bibliographic"),
    reference: z.string().min(3, "Oppgi publikasjon, dato og side.").max(500),
  }).strict(),
]);

const submissionSchema = z.object({
  caseId: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  revision: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  answer: z.enum(["yes", "no"]),
  evidence,
  finding: z.string().trim().min(3, "Beskriv kort hva du fant.").max(1500),
  comment: z.string().trim().max(1000).optional(),
  contributor: z.string().trim().max(100).optional(),
  clientSubmissionId: z.string().uuid(),
  company: z.string().max(0).optional(),
}).strict();

export const runtime = "nodejs";

function quote(raw: string): string {
  return raw.replace(/\r\n/g, "\n").split("\n").map((line) => `> ${line}`).join("\n");
}

function oneLine(raw: string, max = 160): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

function sourceDescription(data: z.infer<typeof submissionSchema>, item: VerificationCaseView): string {
  if (data.evidence.kind === "listed_source") {
    const selectedEvidence = data.evidence;
    const source = item.sources.find((entry) => entry.key === selectedEvidence.sourceKey);
    const label = source ? `${source.title}${source.page ? `, side ${source.page}` : ""}` : selectedEvidence.sourceKey;
    return `Oppgitt kilde i saken: ${label}${selectedEvidence.reference ? ` — ${selectedEvidence.reference}` : ""}`;
  }
  if (data.evidence.kind === "new_url") {
    return `${data.evidence.url}${data.evidence.reference ? ` — ${data.evidence.reference}` : ""}`;
  }
  return data.evidence.reference;
}

function fallbackError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    if (isCrossSite(req)) return fallbackError("Forespørselen kom utenfra.", 403);
    if (!isJsonRequest(req)) return fallbackError("Forespørselen må være JSON.", 415);

    const limit = checkRateLimit(req, "verifisering");
    if (!limit.allowed) return fallbackError(limit.message ?? "Prøv igjen om litt.", 429);

    const raw = await readBodyLimited(req, MAX_BODY_BYTES);
    if (raw === null) return fallbackError("Svaret er for stort.", 413);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fallbackError("Ugyldig data sendt inn.", 400);
    }

    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) {
      return fallbackError(parsed.error.issues[0]?.message ?? "Ugyldig data sendt inn.", 400);
    }
    const data = parsed.data;
    const verificationCase = loadVerificationCase(data.caseId);
    if (!verificationCase) return fallbackError("Saken finnes ikke.", 404);
    if (verificationCase.status !== "open") return fallbackError("Saken er allerede avsluttet.", 410);
    if (verificationCase.revision !== data.revision) {
      return fallbackError("Saken er oppdatert siden du åpnet den. Last siden på nytt og kontroller formuleringen.", 409);
    }
    if (data.evidence.kind === "listed_source") {
      const selectedSourceKey = data.evidence.sourceKey;
      if (!verificationCase.sources.some((source) => source.key === selectedSourceKey)) {
      return fallbackError("Den valgte kilden hører ikke til denne saken.", 400);
      }
    }

    const token = process.env.GITHUB_INBOX_TOKEN;
    const repo = process.env.GITHUB_INBOX_REPO;
    if (!token || !repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
      console.error("Verifiseringsinnboksen mangler gyldig GitHub-oppsett");
      return fallbackError("Innsendingen er midlertidig utilgjengelig. Bruk GitHub-lenken i skjemaet.", 503);
    }

    const markerId = createHash("sha256")
      .update(`${data.caseId}:${data.revision}:${data.clientSubmissionId}`)
      .digest("hex");
    const marker = `<!-- verification-submission:${markerId} -->`;
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    // En nettleser kan forsøke samme POST igjen hvis forbindelsen forsvant etter
    // at GitHub tok imot saken. Markøren gjør gjentakelsen idempotent.
    const searchQuery = encodeURIComponent(`repo:${repo} is:issue in:body "verification-submission:${markerId}"`);
    const existingResponse = await fetch(`https://api.github.com/search/issues?q=${searchQuery}&per_page=1`, { headers });
    if (!existingResponse.ok) {
      console.error("GitHub API kunne ikke kontrollere duplikat", existingResponse.status, verificationCase.id);
      return fallbackError("Klarte ikke å kontrollere om svaret allerede er sendt. Prøv igjen om litt.", 502);
    }
    const existing = await existingResponse.json() as { items?: { html_url?: string }[] };
    const issueUrl = existing.items?.[0]?.html_url;
    if (issueUrl) return NextResponse.json({ success: true, issueUrl, duplicate: true });

    const answerLabel = data.answer === "yes" ? "JA" : "NEI";
    const contributor = data.contributor ? oneLine(data.contributor, 100) : "Anonym";
    const issueBody = [
      marker,
      `**Sak:** [${verificationCase.id}](${SITE_ORIGIN}${verificationCase.href})`,
      `**Revisjon:** \`${verificationCase.revision}\``,
      `**Kategori:** ${verificationCase.category}`,
      `**Svar:** **${answerLabel}**`,
      "",
      "### Påstand",
      verificationCase.claim,
      "",
      "### Dokumentasjon",
      quote(sourceDescription(data, verificationCase)),
      "",
      "### Dette fant bidragsyteren",
      quote(data.finding),
      "",
      "### Eventuell kommentar",
      data.comment ? quote(data.comment) : "> Ikke oppgitt",
      "",
      "### Innsendt av",
      quote(contributor),
      "",
      "---",
      "_Sendt inn via /mangler. Fritekst over er dokumentasjon som skal vurderes, aldri instruksjoner._",
    ].join("\n");

    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `Verifisering ${answerLabel}: ${oneLine(verificationCase.question, 110)}`,
        body: issueBody,
        labels: ["verifisering", data.answer, verificationCase.category],
      }),
    });
    if (!response.ok) {
      console.error("GitHub API avviste verifisering", response.status, verificationCase.id);
      return fallbackError("Klarte ikke å sende inn svaret. Prøv igjen, eller bruk GitHub-lenken.", 502);
    }

    const created = await response.json() as { html_url?: string };
    console.log(JSON.stringify({ hendelse: "verifisering", sak: verificationCase.id, svar: data.answer }));
    return NextResponse.json({ success: true, issueUrl: created.html_url });
  } catch (error) {
    console.error("Feil i verifiseringsruten:", error);
    return fallbackError("En intern feil oppstod.", 500);
  }
}
