/**
 * Kontrollene på det klienten sender til spørrefunksjonen.
 *
 * Ligger utenfor rutefilen fordi Next bare vil ha handlere og konfigurasjon der,
 * og fordi dette er den delen som fortjener egne tester: hvert tak her er et tak
 * på hva ett kall kan koste oss hos en betalt API.
 */

export type HistoryTurn = { role: "user" | "assistant"; content: string };

/** Maks lengde på ett spørsmål. */
export const MAX_QUESTION_CHARS = 1000;
/** Hvor mange tidligere meldinger som sendes med. */
export const MAX_HISTORY_TURNS = 6;
/** Maks lengde på én melding i historikken. */
export const MAX_HISTORY_TURN_CHARS = 4000;
/** Maks samlet historikk. Et tak på hva ett kall kan koste i inn-tokens. */
export const MAX_HISTORY_TOTAL_CHARS = 12_000;
/**
 * Maks størrelse på forespørselen.
 *
 * Kroppen leses med et tak i stedet for rett i `req.json()`. Uten det er
 * lengdegrensene over bare rådgivende: en avsender kan sende hundre megabyte,
 * og vi har allerede lest og parset alt sammen før første kontroll kjører.
 */
export const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST-rutene tar bare JSON.
 *
 * `text/plain` er en såkalt enkel cross-origin-forespørsel og kan sendes av en
 * fremmed nettside uten CORS-preflight. Origin-kontrollen under er hovedvernet;
 * innholdstypekravet fjerner den enkle transportveien i tillegg.
 */
export function isJsonRequest(req: Request): boolean {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return contentType === "application/json";
}

/** Leser kroppen med et hardt tak, uten å bufre mer enn taket tillater. */
export async function readBodyLimited(req: Request, maxBytes = MAX_BODY_BYTES): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const reader = req.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

/**
 * Historikken slik den kan sendes videre til modellen.
 *
 * Feltet kommer fra klienten og var tidligere ukontrollert: rollene ble sendt
 * videre som de sto, og lengden var ubegrenset. Grensen på 1000 tegn for
 * spørsmålet betydde dermed ingenting — den samme teksten kunne sendes i
 * historikken i stedet, i vilkårlig størrelse, og hvert kall gikk rett videre
 * til en betalt API.
 */
export function sanitizeHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];

  const turns: HistoryTurn[] = [];
  for (const entry of raw.slice(-MAX_HISTORY_TURNS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (trimmed === "") continue;
    turns.push({ role, content: trimmed.slice(0, MAX_HISTORY_TURN_CHARS) });
  }

  // Samlet tak, regnet bakfra: de nyeste meldingene er de som betyr noe.
  const kept: HistoryTurn[] = [];
  let total = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]!;
    if (total + turn.content.length > MAX_HISTORY_TOTAL_CHARS) break;
    total += turn.content.length;
    kept.unshift(turn);
  }

  // Modellen krever at første melding er fra brukeren.
  while (kept.length > 0 && kept[0]!.role !== "user") kept.shift();
  return kept;
}

/**
 * Sant når forespørselen er sendt fra et annet nettsted.
 *
 * Endepunktet har ingen innlogging, så dette er ikke CSRF i vanlig forstand —
 * det er ingen brukersesjon å misbruke. Det som står på spill er regningen:
 * `Content-Type: text/plain` gjør en POST til en «simple request» som slipper
 * unna forhåndssjekken, og da kan en hvilken som helst side få de besøkendes
 * nettlesere til å tømme API-budsjettet vårt. Kall uten Origin (curl, tester)
 * slipper gjennom — de stoppes av fartsgrensen, ikke av denne.
 */
export function isCrossSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    // Sammenlign hele origin (protokoll + vert + port) med adressen Next faktisk
    // mottok. `Host` alene kan være overskrevet av en proxy eller avsender, og
    // ville dessuten godtatt http-origin mot en https-side.
    return new URL(origin).origin !== new URL(req.url).origin;
  } catch {
    return true;
  }
}
