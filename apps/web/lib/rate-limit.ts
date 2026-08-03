/**
 * Rate-limiting for spørrefunksjonen.
 *
 * Da datalaget ble SQLite i byggesteget forsvant stedet å skrive tellere — filen er
 * skrivebeskyttet, og Vercels filsystem er det uansett. Vi la ikke til en database
 * bare for dette. I stedet er ansvaret delt i to:
 *
 *   1. Vercel Firewall (Pro) teller forespørsler per IP ute på kanten, før koden
 *      vår kjører. Ingen lagring å drifte.
 *   2. Utgiftstaket i Anthropic Console er det harde kostnadsgulvet. Det er den
 *      eneste grensen som virker uansett hva som skjer i lagene over.
 *
 * Uten Firewall (lokalt, eller på Hobby) faller vi tilbake til en teller i minnet.
 * Den er en fartsdump, ikke en mur: hver serverless-instans har sin egen, så en
 * fordelt avsender kommer forbi. Det er akseptabelt nettopp fordi utgiftstaket
 * ligger under — men det skal være tydelig at det er slik det henger sammen.
 */

export interface RateLimitVerdict {
  allowed: boolean;
  message?: string;
  retryAfterSeconds?: number;
  /** Hvilket lag som avgjorde. Logges, så vi ser om Firewall faktisk er i bruk. */
  enforcedBy: "firewall" | "in-memory";
}

const QUESTIONS_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000;

/** Teller per IP i denne instansens minne. Se forbeholdet i filkommentaren. */
const recent = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "ukjent";
}

function tooManyMessage(): string {
  return (
    `Du har brukt ${QUESTIONS_PER_HOUR} spørsmål denne timen. ` +
    "Arkivet er gratis å bruke, og grensen finnes bare for å holde kostnadene nede. " +
    "Prøv igjen om litt — i mellomtiden kan du bla i sesongene og motstanderne."
  );
}

/**
 * Vercel Firewall svarer selv med 429 før forespørselen når hit, så når koden
 * vår kjører har den allerede sluppet gjennom kant-laget. Denne funksjonen er
 * derfor bare reservelaget.
 */
function checkInMemory(ip: string): RateLimitVerdict {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (hits.length >= QUESTIONS_PER_HOUR) {
    const oldest = hits[0]!;
    return {
      allowed: false,
      message: tooManyMessage(),
      retryAfterSeconds: Math.max(60, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
      enforcedBy: "in-memory",
    };
  }

  hits.push(now);
  recent.set(ip, hits);

  // Hold kartet lite. Uten dette vokser det ubegrenset i en langlevd instans.
  if (recent.size > 5000) {
    for (const [key, times] of recent) {
      if (times.every((t) => now - t >= WINDOW_MS)) recent.delete(key);
    }
  }

  return { allowed: true, enforcedBy: "in-memory" };
}

export function checkRateLimit(req: Request): RateLimitVerdict {
  return checkInMemory(clientIp(req));
}

/**
 * Logger et spørsmål til stdout, som havner i Vercel Logs.
 *
 * Erstatter chat_usage-tabellen fra Postgres-utkastet. Det vi trengte den til —
 * å se hva som spørres om, hvilken SQL modellen skrev, og hva det kostet — får vi
 * like godt fra strukturert logg, uten en database å vedlikeholde.
 *
 * IP-en logges aldri. Vi trenger ikke vite hvem som spurte for å se hva som spørres om.
 */
export function logQuestion(entry: {
  question: string;
  answerLength: number;
  queries: { sql: string; durationMs: number; rowCount: number; error?: string }[];
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  error?: string | null;
}): void {
  console.log(
    JSON.stringify({
      hendelse: "chat",
      spørsmål: entry.question,
      // Et svar på null tegn uten feil er signaturen til feilmodusen vi frykter
      // mest: modellen skrev verktøykallet som tekst i stedet for et tool_use-blokk,
      // og løkka gikk rundt uten å produsere noe. Uten dette tallet er den usynlig.
      svarLengde: entry.answerLength,
      spørringer: entry.queries.map((q) => ({
        sql: q.sql,
        ms: q.durationMs,
        rader: q.rowCount,
        feil: q.error,
      })),
      varighetMs: entry.durationMs,
      tokens: { inn: entry.inputTokens, ut: entry.outputTokens },
      feil: entry.error ?? undefined,
    }),
  );
}
