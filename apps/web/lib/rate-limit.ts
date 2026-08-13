/**
 * Rate-limiting for spørrefunksjonen.
 *
 * Da datalaget ble SQLite i byggesteget forsvant stedet å skrive tellere — filen er
 * skrivebeskyttet, og Vercels filsystem er det uansett. Vi la ikke til en database
 * bare for dette. I stedet er ansvaret delt i to:
 *
 *   1. Vercel Firewall (Pro) teller forespørsler per IP ute på kanten, før koden
 *      vår kjører. Ingen lagring å drifte.
 *   2. Utgiftstaket hos modelleverandøren er det harde kostnadsgulvet — Anthropic
 *      Console eller OpenAI-plattformen, avhengig av hvilken nøkkel som er i bruk.
 *      Det er den eneste grensen som virker uansett hva som skjer i lagene over.
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
/**
 * Bidrag har sin egen kvote.
 *
 * Telleren var felles: ett innsendt bidrag brukte opp ett spørsmål, og ti
 * rettelser låste chatten en time. De to koster ikke det samme og skal ikke dele
 * budsjett — et spørsmål koster penger hos modelleverandøren, et bidrag koster
 * en sak i en innboks.
 */
const CONTRIBUTIONS_PER_HOUR = 5;
/** Verifiseringer er smÃ¥, men skal ikke kunne fylle GitHub-innboksen uten grenser. */
const VERIFICATIONS_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;
/**
 * Tak på antall avsendere vi holder styr på samtidig.
 *
 * Kartet var tidligere ubegrenset: opprydningen over 5000 nøkler slettet bare
 * utløpte vinduer, så en strøm av nye avsendere ryddet ingenting og utløste i
 * stedet en full gjennomgang av kartet ved *hver* forespørsel. Kostnaden per
 * forespørsel vokste med et kart som aldri sluttet å vokse. Nå er taket hardt,
 * og vi kaster de eldste når det er nådd.
 */
const MAX_TRACKED = 5000;

/** Hva som telles. Hver kvote har sitt eget vindu per avsender. */
export type RateLimitBucket = "chat" | "bidrag" | "verifisering";

const LIMITS: Record<RateLimitBucket, number> = {
  chat: QUESTIONS_PER_HOUR,
  bidrag: CONTRIBUTIONS_PER_HOUR,
  verifisering: VERIFICATIONS_PER_HOUR,
};

/** Teller per avsender og kvote i denne instansens minne. Se forbeholdet over. */
const recent = new Map<string, number[]>();

/**
 * Hvem forespørselen kommer fra, så godt vi kan vite det.
 *
 * `x-forwarded-for` er den svakeste kilden: alle ledd i kjeden kan legge til i
 * den, og den kan settes av avsenderen selv. På Vercel overskrives den av
 * plattformen, men koden kjører også lokalt og bak andre proxyer, og der er den
 * fri tekst. Derfor leses de plattformsatte hodene først. Faller vi ned på
 * `x-forwarded-for`, tas den *siste* oppføringen — den er lagt på av leddet
 * nærmest oss, mens den første er den avsenderen kunne finne på selv.
 */
export function clientIp(req: Request): string {
  const platform = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip");
  if (platform) return platform.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]!;
  }
  return "ukjent";
}

function tooManyMessage(bucket: RateLimitBucket): string {
  if (bucket !== "chat") {
    return `Du har sendt inn ${LIMITS[bucket]} svar denne timen. PrÃ¸v igjen om litt.`;
  }
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
function checkInMemory(ip: string, bucket: RateLimitBucket): RateLimitVerdict {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (hits.length >= LIMITS[bucket]) {
    const oldest = hits[0]!;
    return {
      allowed: false,
      message: tooManyMessage(bucket),
      retryAfterSeconds: Math.max(60, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
      enforcedBy: "in-memory",
    };
  }

  hits.push(now);
  // Sett på nytt slik at nøkkelen flyttes bakerst i innsettingsrekkefølgen. Map
  // bevarer den, og det er dét utkastingen under bruker til å finne de eldste.
  recent.delete(key);
  recent.set(key, hits);

  if (recent.size > MAX_TRACKED) {
    // Først de som uansett er utløpt.
    for (const [tracked, times] of recent) {
      if (times.every((t) => now - t >= WINDOW_MS)) recent.delete(tracked);
    }
    // Er vi fortsatt over taket, kastes de eldste til vi er under. Det gir en
    // avsender som fyller kartet en vei ut av sitt eget vindu, men kostnaden er
    // avgrenset — og det harde kostnadsgulvet ligger hos modelleverandøren.
    for (const tracked of recent.keys()) {
      if (recent.size <= MAX_TRACKED) break;
      recent.delete(tracked);
    }
  }

  return { allowed: true, enforcedBy: "in-memory" };
}

export function checkRateLimit(req: Request, bucket: RateLimitBucket = "chat"): RateLimitVerdict {
  return checkInMemory(clientIp(req), bucket);
}

/**
 * Logger et spørsmål til stdout, som havner i Vercel Logs.
 *
 * Erstatter chat_usage-tabellen fra Postgres-utkastet. Loggen viser volum,
 * modell, tokenbruk, kjøretid og SQL-form uten å lagre brukerens fritekst.
 *
 * IP-en logges aldri. Strengliteraler i SQL kan stamme fra spørsmålet og
 * redigeres derfor bort før logging.
 */
export function redactSqlLiterals(sql: string): string {
  return sql.replace(/'(?:''|[^'])*'/g, "'?'");
}

export function logQuestion(entry: {
  question: string;
  answerLength: number;
  queries: { sql: string; durationMs: number; rowCount: number; error?: string }[];
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  error?: string | null;
  /** Hvem som svarte. Tokentallene betyr ikke det samme hos de to, og prisen heller ikke. */
  provider?: string;
  model?: string;
}): void {
  console.log(
    JSON.stringify({
      hendelse: "chat",
      // Spørsmålet kan inneholde navn, kontaktopplysninger eller annet en
      // bruker ikke forventer skal bli liggende i driftsloggene. Lengden er nok
      // til kapasitets- og misbruksanalyse; selve friteksten lagres ikke.
      spørsmålLengde: entry.question.length,
      // Et svar på null tegn uten feil er signaturen til feilmodusen vi frykter
      // mest: modellen skrev verktøykallet som tekst i stedet for et tool_use-blokk,
      // og løkka gikk rundt uten å produsere noe. Uten dette tallet er den usynlig.
      svarLengde: entry.answerLength,
      spørringer: entry.queries.map((q) => ({
        sql: redactSqlLiterals(q.sql),
        ms: q.durationMs,
        rader: q.rowCount,
        feil: q.error,
      })),
      varighetMs: entry.durationMs,
      leverandør: entry.provider,
      modell: entry.model,
      tokens: { inn: entry.inputTokens, ut: entry.outputTokens },
      feil: entry.error ?? undefined,
    }),
  );
}
