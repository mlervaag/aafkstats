/**
 * Kampdatoen utledet av hva avisa sier om tid, ikke av når den kom ut.
 *
 * ## Hvorfor utgivelsesdatoen ikke duger alene
 *
 * En avis fra 16. juli 1948 kan omtale en kamp som ble spilt dagen før, samme
 * kveld, eller neste helg. Setter man kampdato lik utgivelsesdato, blir omtrent
 * halvparten feil — og en feil dato i arkivet er verre enn ingen dato, fordi den
 * ser like riktig ut som en riktig.
 *
 * ## Uttrykkene som faktisk står der
 *
 * Kontrollert mot Sunnmørsposten for de tre kampene denne modulen ble skrevet
 * for:
 *
 * - 5. mai 1952: «mot Clausenengen i Kristiansund **i går** … så knepen som 1—0»
 * - 15. juli 1948: «Interessen for **morgendagens** fotballkamp mellom Sarpsborg
 *   FK og ÅFK på Nørve»
 * - 16. juli 1948: «Til **kveldens kamp** mellom Sarpsborg og ÅFK på Nørve»
 *
 * Tre utgaver, tre forskjellige uttrykk, samme kamp. Det er derfor uttrykkene —
 * og ikke utgivelsesdatoen — er festepunktet, og derfor flere utgaver til sammen
 * sier mer enn én.
 *
 * ## Hva som ikke gjettes
 *
 * Ukedagsnavn uten «i går» eller «i morgen» rundt seg får lav tillit og aldri en
 * dato alene: «kampen søndag» kan like gjerne være søndagen som kommer som den
 * som var. Står det ingenting tolkbart, settes ingen dato. En kamp uten dato kan
 * dateres senere; en kamp med gal dato må noen først oppdage.
 */

export type DateConfidence = "high" | "medium" | "low";

export interface TemporalEvidence {
  /** Uttrykket slik det sto, til kontroll. */
  phrase: string;
  /** Dager fra utgivelsesdato til kampdato. −1 er dagen før. */
  offset: number;
  inferredMatchDate: string;
  confidence: DateConfidence;
}

interface Rule {
  pattern: RegExp;
  offset: number;
  confidence: DateConfidence;
}

/**
 * Uttrykkene, sterkeste først.
 *
 * «i går» og «i morgen» er utvetydige. «i kveld», «i dag» og «kveldens kamp»
 * peker på utgivelsesdagen selv — avisa kom om morgenen, kampen var samme kveld.
 * OCR skriver dem både med og uten mellomrom.
 */
const RULES: Rule[] = [
  { pattern: /\bi\s?går\b/iu, offset: -1, confidence: "high" },
  { pattern: /\bgårsdagens\b/iu, offset: -1, confidence: "high" },
  { pattern: /\bi\s?morgen\b/iu, offset: 1, confidence: "high" },
  { pattern: /\bmorgendagens\b/iu, offset: 1, confidence: "high" },
  { pattern: /\bkveldens kamp\b/iu, offset: 0, confidence: "high" },
  { pattern: /\bi\s?kveld\b/iu, offset: 0, confidence: "medium" },
  { pattern: /\bi\s?dag\b/iu, offset: 0, confidence: "medium" },
];

const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

/**
 * Kampdatoen ett tekstvindu peker på, hvis det peker på noen.
 *
 * `issued` er utgavens dato på formen ÅÅÅÅMMDD, slik NB oppgir den.
 */
export function inferMatchDate(text: string, issued: string): TemporalEvidence | undefined {
  const issueDate = parseCompact(issued);
  if (!issueDate) return undefined;

  for (const rule of RULES) {
    const found = rule.pattern.exec(text);
    if (!found) continue;
    return {
      phrase: found[0].trim(),
      offset: rule.offset,
      inferredMatchDate: shift(issueDate, rule.offset),
      confidence: rule.confidence,
    };
  }

  return weekdayEvidence(text, issueDate);
}

/**
 * Ukedag uten «i går»/«i morgen»: nærmeste dag med det navnet, bakover.
 *
 * Bakover fordi et referat er vanligere enn en forhåndsomtale, men tilliten er
 * lav med vilje — dette skal aldri avgjøre en dato alene, bare støtte en annen
 * utgave som sier det samme.
 */
function weekdayEvidence(text: string, issueDate: Date): TemporalEvidence | undefined {
  const lower = text.toLocaleLowerCase("nb");
  for (const [index, weekday] of WEEKDAYS.entries()) {
    if (!lower.includes(weekday)) continue;
    const difference = (issueDate.getUTCDay() - index + 7) % 7;
    const offset = difference === 0 ? -7 : -difference;
    return {
      phrase: weekday,
      offset,
      inferredMatchDate: shift(issueDate, offset),
      confidence: "low",
    };
  }
  return undefined;
}

export function parseCompact(issued: string): Date | undefined {
  if (!/^\d{8}$/.test(issued)) return undefined;
  const date = new Date(Date.UTC(Number(issued.slice(0, 4)), Number(issued.slice(4, 6)) - 1, Number(issued.slice(6, 8))));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function shift(date: Date, days: number): string {
  const shifted = new Date(date.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Datoen et sett med tidsuttrykk peker på, når de peker samme vei.
 *
 * To utgaver som uavhengig av hverandre gir 16. juli — «morgendagens kamp» den
 * 15. og «kveldens kamp» den 16. — er et mye sterkere belegg enn hver av dem.
 * Er de uenige, vinner den best belagte datoen, men uenigheten rapporteres.
 */
export function resolveMatchDate(
  evidence: Array<{ temporal: TemporalEvidence; weight?: number }>,
): { date: string; confidence: DateConfidence; agreement: number; disagreement: string[] } | undefined {
  if (evidence.length === 0) return undefined;

  const confidenceWeight: Record<DateConfidence, number> = { high: 3, medium: 2, low: 1 };
  const byDate = new Map<string, { weight: number; best: DateConfidence; count: number }>();

  for (const { temporal, weight = 1 } of evidence) {
    const current = byDate.get(temporal.inferredMatchDate) ?? { weight: 0, best: "low" as DateConfidence, count: 0 };
    // Vekten fra beviset selv avgjør. En utgave som både har tidsuttrykket og
    // resultatet skal slå en som bare nevner lagene i forbifarten — ellers
    // vinner den utgaven som tilfeldigvis skrev «i går» om en annen kamp.
    current.weight += confidenceWeight[temporal.confidence] * Math.max(1, weight);
    current.count += 1;
    if (confidenceWeight[temporal.confidence] > confidenceWeight[current.best]) current.best = temporal.confidence;
    byDate.set(temporal.inferredMatchDate, current);
  }

  const ranked = [...byDate].sort((a, b) => b[1].weight - a[1].weight || a[0].localeCompare(b[0]));
  const [date, winner] = ranked[0]!;

  return {
    date,
    // To uavhengige utgaver som sier det samme løfter tilliten et hakk.
    confidence: winner.count > 1 && winner.best !== "low" ? "high" : winner.best,
    agreement: winner.count,
    disagreement: ranked.slice(1).map(([other]) => other),
  };
}
