import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const contributionSchema = z.object({
  scope: z.enum(["match", "season"]),
  targetId: z.string().min(1).max(100),
  kind: z.enum(["observation", "error", "source"]),
  pageUrl: z.string().max(200).optional(),
  text: z.string().min(1, "Tekstfeltet kan ikke være tomt.").max(2000, "Teksten er for lang."),
  source: z.string().max(300).optional(),
  contributor: z.string().max(100).optional(),
});

export const runtime = "nodejs";

const typeLabels: Record<string, string> = {
  observation: "Observasjon",
  error: "Feil",
  source: "Kilde/Fakta"
};

export async function POST(req: Request) {
  try {
    // 1. Rate limiting (samme som for chat)
    const limit = checkRateLimit(req);
    if (!limit.allowed) {
      return NextResponse.json({ error: "For mange forespørsler. Prøv igjen senere." }, { status: 429 });
    }

    // 2. Pars input
    const body = await req.json();
    const result = contributionSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: "Ugyldig data sendt inn." }, { status: 400 });
    }

    const data = result.data;

    // 3. GitHub API
    const token = process.env.GITHUB_INBOX_TOKEN;
    const repo = process.env.GITHUB_INBOX_REPO;

    if (!token || !repo) {
      console.error("Missing GITHUB_INBOX_TOKEN or GITHUB_INBOX_REPO");
      return NextResponse.json({ error: "Systemfeil: Kunne ikke koble til innboks." }, { status: 500 });
    }

    const typeLabel = typeLabels[data.kind] || data.kind;
    const title = `${typeLabel}: ${data.scope === "match" ? "Kamp" : "Sesong"} ${data.targetId}`;
    
    const issueBody = `
**Type:** ${typeLabel}
**Kontekst:** ${data.scope === "match" ? "Kamp" : "Sesong"} \`${data.targetId}\`
**Side:** ${data.pageUrl || "Ukjent"}
**Innsendt av:** ${data.contributor || "Anonym"}

### Innspill
${data.text}

### Kilde/Lenke
${data.source || "Ikke oppgitt"}
`.trim();

    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body: issueBody,
        labels: ["bidrag", data.kind, data.scope]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", errorText);
      return NextResponse.json({ error: "Klarte ikke å opprette sak. Prøv igjen senere." }, { status: 502 });
    }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Contribution API error:", error);
    return NextResponse.json({ error: "En intern feil oppstod." }, { status: 500 });
  }
}
