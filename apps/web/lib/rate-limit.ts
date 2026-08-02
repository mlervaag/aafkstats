import { createHash } from "node:crypto";
import type { Sql } from "@aafkstats/db";

/** Spørsmål per IP per time. */
const QUESTIONS_PER_HOUR = 10;
/** Samlet tak per døgn for hele tjenesten, som kostnadsbrems. */
const QUESTIONS_PER_DAY_TOTAL = 2000;

/**
 * IP-en lagres aldri i klartekst — bare en saltet hash.
 *
 * Vi trenger å telle spørsmål per avsender, ikke å vite hvem de er. Uten saltet ville
 * hashen vært trivielt reversérbar for IPv4, siden hele adresserommet kan gjennomsøkes
 * på minutter.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "aafkstats-lokal-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "ukjent";
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Melding vist til brukeren når grensen er nådd. */
  message?: string;
  retryAfterSeconds?: number;
}

/**
 * Rate-limiting i Postgres i stedet for Redis.
 *
 * Datamengden er liten (én rad per spørsmål) og det holder tjenestelisten på én.
 * Skulle trafikken vokse forbi det dette tåler, er byttet til en egen teller-tjeneste
 * en isolert endring i denne filen.
 */
export async function checkRateLimit(sql: Sql, ipHash: string): Promise<RateLimitVerdict> {
  const [perIp] = await sql<{ count: string; oldest: Date | null }[]>`
    SELECT count(*)::text AS count, min(asked_at) AS oldest
    FROM core.chat_usage
    WHERE ip_hash = ${ipHash} AND asked_at > now() - interval '1 hour'
  `;

  if (Number(perIp?.count ?? 0) >= QUESTIONS_PER_HOUR) {
    const oldest = perIp?.oldest ? new Date(perIp.oldest).getTime() : Date.now();
    const retryAfterSeconds = Math.max(60, Math.ceil((oldest + 3_600_000 - Date.now()) / 1000));
    return {
      allowed: false,
      message:
        `Du har brukt ${QUESTIONS_PER_HOUR} spørsmål denne timen. ` +
        `Arkivet er gratis å bruke, og grensen finnes bare for å holde kostnadene nede. ` +
        `Prøv igjen om litt — i mellomtiden kan du bla i sesongene eller bruke API-et.`,
      retryAfterSeconds,
    };
  }

  const [total] = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM core.chat_usage
    WHERE asked_at > now() - interval '1 day'
  `;

  if (Number(total?.count ?? 0) >= QUESTIONS_PER_DAY_TOTAL) {
    return {
      allowed: false,
      message:
        "Spørrefunksjonen har nådd dagens tak og er slått av til i morgen. " +
        "Resten av arkivet virker som vanlig — sesonger, kampsider og API-et er åpne.",
      retryAfterSeconds: 3600,
    };
  }

  return { allowed: true };
}

export async function logQuestion(
  sql: Sql,
  entry: {
    ipHash: string;
    question: string;
    sqlRun?: string | null;
    durationMs?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    error?: string | null;
  },
): Promise<void> {
  await sql`
    INSERT INTO core.chat_usage
      (ip_hash, question, sql_run, duration_ms, input_tokens, output_tokens, error)
    VALUES (
      ${entry.ipHash}, ${entry.question}, ${entry.sqlRun ?? null},
      ${entry.durationMs ?? null}, ${entry.inputTokens ?? null},
      ${entry.outputTokens ?? null}, ${entry.error ?? null}
    )
  `;
}
