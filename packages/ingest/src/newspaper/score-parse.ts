/**
 * Kampresultater lest ut av OCR som ikke kan stole på sine egne tall.
 *
 * ## Hva som faktisk står på trykk
 *
 * Fra de utgavene denne modulen ble skrevet mot:
 *
 *     «3—3 2—o 3—3 I—2»        (Sunnmørsposten 10.06.1963)
 *     «Sist vant Sunnmøre 2—l der nede»
 *     «Seiren ble riktignok så knepen som 1—0»
 *
 * Tallet null blir til bokstaven o, ettallet til I eller l, og bindestreken er
 * snart tankestrek, snart kolon. En parser som bare kjenner «1-0» finner ikke
 * halvparten av resultatene i en årgang.
 *
 * ## Hvorfor bokstavene bare byttes i tallposisjon
 *
 * «o» og «l» er vanlige bokstaver. Bytter man dem overalt, blir «Molde» til
 * «M0lde» og teksten rundt uleselig for alle andre regler. Derfor gjøres byttet
 * bare der mønsteret allerede ser ut som et resultat: to korte grupper med en
 * strek imellom, og minst ett ekte siffer blant dem.
 */

export interface ParsedScore {
  home: number;
  away: number;
  /** Slik det sto på trykk, til kontroll. */
  raw: string;
}

/** Tegnene OCR bruker mellom måltallene. */
const SEPARATORS = "-–—−:";

/**
 * Et resultat er to korte tallgrupper med skilletegn imellom. Gruppene får
 * inneholde de bokstavene OCR forveksler med siffer, men ikke bare bokstaver —
 * «o—l» uten et eneste ekte siffer er like gjerne en orddeling.
 */
const SCORE = /(?<!\d)([\dOoIl]{1,2}) ?[-–—−:] ?([\dOoIl]{1,2})(?!\d)/gu;

export function parseScores(text: string): ParsedScore[] {
  const scores: ParsedScore[] = [];

  for (const match of text.matchAll(SCORE)) {
    const home = digitsFrom(match[1]!);
    const away = digitsFrom(match[2]!);
    if (home === undefined || away === undefined) continue;
    // Minst ett ekte siffer. Ellers er «I—l» bare to bokstaver med strek.
    if (!/\d/.test(match[1]!) && !/\d/.test(match[2]!)) continue;
    scores.push({ home, away, raw: match[0].trim() });
  }

  return scores;
}

/** Sant hvis resultatet står i teksten, i den rekkefølgen. */
export function containsScore(text: string, score: readonly [number, number]): boolean {
  return parseScores(text).some((parsed) => parsed.home === score[0] && parsed.away === score[1]);
}

/**
 * Resultatet i teksten som gjelder denne kampen, uansett lagrekkefølge.
 *
 * Kildene fører resultatet fra AaFKs side, avisa fra hjemmelagets. Uten å vite
 * hvem som var hjemme må begge lesemåter prøves — og hvilken vei som traff er i
 * seg selv en opplysning om hjemme eller borte.
 */
export function matchScore(
  text: string,
  expected: readonly [number, number],
): { found: ParsedScore; reversed: boolean } | undefined {
  const scores = parseScores(text);
  const straight = scores.find((parsed) => parsed.home === expected[0] && parsed.away === expected[1]);
  if (straight) return { found: straight, reversed: false };

  const reversed = scores.find((parsed) => parsed.home === expected[1] && parsed.away === expected[0]);
  return reversed ? { found: reversed, reversed: true } : undefined;
}

function digitsFrom(group: string): number | undefined {
  const digits = [...group]
    .map((character) => {
      if (character >= "0" && character <= "9") return character;
      if (character === "O" || character === "o") return "0";
      if (character === "I" || character === "l") return "1";
      return "";
    })
    .join("");
  if (digits === "" || digits.length !== group.length) return undefined;
  const value = Number(digits);
  return Number.isInteger(value) && value <= 30 ? value : undefined;
}

export { SEPARATORS };
