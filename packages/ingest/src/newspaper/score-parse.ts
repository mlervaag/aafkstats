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

export interface TeamPairScoreBinding {
  found: ParsedScore;
  /** Om sifrene står motsatt av source-resultets AaFK-perspektiv. */
  reversed: boolean;
  matchesExpected: boolean;
  /** Den minste tekstlige påstanden som binder lagparet til sifrene. */
  context: string;
  /** Påstanden beskriver uttrykkelig et tidligere møte. */
  retrospective: boolean;
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

const RETROSPECTIVE = /\b(?:første|forrige|tidligere)\s+(?:møte|oppgjør|kamp)|\bsist\s+(?:lagene\s+)?møttes|\btidligere\s+i\s+sesongen\b/iu;
const ANAPHORIC_RESULT = /^\s*(?:seieren|seiren|tapet|kampen|oppgjøret|resultatet|sluttresultatet|stillingen)\b/iu;

/**
 * Finn en score som er bundet til det konkrete lagparet, ikke bare til hele
 * OCR-vinduet. Separate notiser og setninger er separate påstander. En kort
 * anaforisk fortsettelse (f.eks. «Seieren ble 1–0») får arve lagparet fra
 * setningen rett foran, men en vilkårlig sifferkombinasjon får ikke det.
 */
export function findTeamPairScore(
  text: string,
  aafkNames: string[],
  opponentNames: string[],
  expected: readonly [number, number],
): TeamPairScoreBinding | undefined {
  const explicit = explicitTeamPairScores(text, aafkNames, opponentNames);
  const bindings = explicit.length > 0
    ? explicit
    : teamPairClaimContexts(text, aafkNames, opponentNames)
      .map((context) => ({ context, scores: parseScores(context) }))
      .filter((binding) => binding.scores.length > 0);

  // Flere separate påstander om samme lagpar i ett vindu kan være forskjellige
  // møter. Uten hendelsesidentitet er riktig failure mode ukjent score.
  if (bindings.length !== 1) return undefined;

  const binding = bindings[0]!;
  const distinctScores = [...new Map(binding.scores.map((score) => [`${score.home}-${score.away}`, score])).values()];
  const matching = distinctScores.filter((score) =>
    (score.home === expected[0] && score.away === expected[1]) ||
    (score.home === expected[1] && score.away === expected[0]));
  const found = matching.length === 1
    ? matching[0]
    : distinctScores.length === 1 ? distinctScores[0] : undefined;
  if (!found) return undefined;

  const straight = found.home === expected[0] && found.away === expected[1];
  const reversed = found.home === expected[1] && found.away === expected[0] && !straight;
  return {
    found,
    reversed,
    matchesExpected: straight || reversed,
    context: binding.context,
    retrospective: isRetrospectiveTeamPairContext(binding.context, opponentNames),
  };
}

function explicitTeamPairScores(
  text: string,
  aafkNames: string[],
  opponentNames: string[],
): Array<{ context: string; scores: ParsedScore[] }> {
  const clean = text.replace(/<\/?(?:em|strong|b|i)>/gi, " ");
  const pairContexts = teamPairClaimContexts(clean, aafkNames, opponentNames);
  const scorePattern = "[\\dOoIl]{1,2}\\s*[-–—−:]\\s*[\\dOoIl]{1,2}";
  const found = new Map<string, { context: string; scores: ParsedScore[] }>();

  for (const aafkName of aafkNames) {
    const aafk = flexibleNamePattern(aafkName);
    if (!aafk) continue;
    for (const opponentName of opponentNames) {
      const opponent = flexibleNamePattern(opponentName);
      if (!opponent) continue;
      for (const pair of [`${aafk}\\s*[-–—:]\\s*${opponent}`, `${opponent}\\s*[-–—:]\\s*${aafk}`]) {
        const pattern = new RegExp(`${pair}\\s*(?:[-–—:]\\s*)?(${scorePattern})([^\\r\\n.!?;]{0,160})`, "giu");
        for (const match of clean.matchAll(pattern)) {
          const scores = parseScores(match[1]!);
          if (scores.length !== 1) continue;
          const tail = match[2] ?? "";
          const nextScore = /[\dOoIl]{1,2}\s*[-–—−:]\s*[\dOoIl]{1,2}/u.exec(tail);
          const localTail = nextScore ? tail.slice(0, nextScore.index) : tail;
          const localContext = `${match[0].slice(0, match[0].length - tail.length)}${localTail}`.trim();
          const broaderContext = pairContexts.find((candidate) => {
            if (!candidate.includes(match[1]!)) return false;
            const distinct = new Set(parseScores(candidate).map((score) => `${score.home}-${score.away}`));
            return distinct.size === 1;
          });
          const context = broaderContext ?? localContext;
          found.set(`${match.index ?? 0}|${scores[0]!.home}-${scores[0]!.away}`, { context, scores });
        }
      }
    }
  }
  return [...found.values()];
}

function flexibleNamePattern(name: string): string {
  const words = name.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length === 0) return "";
  return words.map((word) => [...word].map(escapeRegExp).join("\\s*\\.?\\s*")).join("\\s+");
}

/** Lokale tekstpåstander som faktisk navngir begge lagene. */
export function teamPairClaimContexts(text: string, aafkNames: string[], opponentNames: string[]): string[] {
  const claims = splitClaims(text);
  const contexts: string[] = [];
  for (const [index, claim] of claims.entries()) {
    if (!containsAnyName(claim, aafkNames, true) || !containsAnyName(claim, opponentNames, false)) continue;
    const continuation = claims[index + 1];
    contexts.push(continuation && ANAPHORIC_RESULT.test(continuation) ? `${claim} ${continuation}` : claim);
  }
  const unique = [...new Set(contexts)];
  // Når fortsettelsen selv gjentar begge lagnavnene, er den allerede del av
  // den lengre anaforiske konteksten og skal ikke telles som et nytt møte.
  return unique.filter((context) => !unique.some((other) => other !== context && other.includes(context)));
}

export function isRetrospectiveTeamPairContext(context: string, opponentNames: string[]): boolean {
  if (RETROSPECTIVE.test(context)) return true;
  const normalized = normalizeName(context);
  return opponentNames.some((name) => {
    const opponent = normalizeName(name);
    return opponent.length >= 2 && new RegExp(`\\b(?:etter|siden)\\s+${escapeRegExp(opponent)}\\s+kamp(?:en)?\\b`, "iu").test(normalized);
  });
}

function splitClaims(text: string): string[] {
  const abbreviationMarker = "\uE000";
  return text
    .replace(/\b(?:dr|st|jr|sr|kl|ca|bl|dvs|feks|mfl|osv|fk|aa|a|f|k)\./giu, (abbreviation) => `${abbreviation.slice(0, -1)}${abbreviationMarker}`)
    .split(/[\r\n]+|(?<=[.!?])\s+(?=[A-ZÆØÅ])|;\s+|\s+(?:mens|derimot)\s+|\s+i\s+en\s+annen\s+(?:kamp|notis)\s+/u)
    .map((claim) => claim.replaceAll(abbreviationMarker, ".").trim())
    .filter((claim) => claim !== "");
}

function containsAnyName(text: string, names: string[], rejectAalesundAsPlace: boolean): boolean {
  const normalizedText = normalizeName(text);
  return names.some((name) => {
    const needle = normalizeName(name);
    if (needle.length < 2) return false;
    let index = normalizedText.indexOf(needle);
    while (index >= 0) {
      const before = normalizedText.slice(Math.max(0, index - 4), index);
      const after = normalizedText.slice(index + needle.length);
      const boundaryBefore = index === 0 || /\s$/u.test(before);
      const boundaryAfter = after === "" || /^\s/u.test(after);
      const isPlace = rejectAalesundAsPlace && (needle === "aalesund" || needle === "alesund") && /(?:^|\s)(?:i|på|fra|for)\s$/u.test(before);
      if (boundaryBefore && boundaryAfter && !isPlace) return true;
      index = normalizedText.indexOf(needle, index + 1);
    }
    return false;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeName(value: string): string {
  return value
    .replace(/<\/?(?:em|strong|b|i)>/gi, " ")
    .toLocaleLowerCase("nb")
    .replace(/å/gu, "aa")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
