/**
 * Kampfakta lest ut av avisas resultatboks.
 *
 * ## Hvorfor boksen, og ikke referatet
 *
 * Sunnmørsposten setter fra slutten av 1970-tallet kampene i en fast boks:
 *
 *     ÅFK-SUNNDAL 3-0 (1-0) Kråmyra 800 tilskuere
 *     Mål: 1-0 Einar Arne Rotvold (12), 2-0 … (78, straffe).
 *     Dommer: Ernst Myhre, Spjelkavik. Gult kort: …
 *
 * Det er arena, tilskuertall, pausestilling, målscorere med minutt og dommer, i
 * en form en maskin kan lese. Referatteksten rundt er velskrevet og ubrukelig
 * til dette: den sier «etter en corner på overtid», ikke «2-0 (88)».
 *
 * ## Hvorfor hver boks må ankres
 *
 * En sportsside har mange bokser. Spør man OCR-en om «Dommer» i utgaven fra 9.
 * juni 1986, er første treff dommeren i Skottland–Vest-Tyskland i VM — samme
 * side, samme format, feil kamp. Derfor leses ingen boks uten at overskriften
 * navngir begge lagene i kampen vi spør om, med den stillingen vi allerede
 * kjenner. Uten anker, ingen fakta.
 *
 * Det som ikke lar seg lese entydig, blir ikke gjettet. Et felt som mangler kan
 * hentes senere; et felt som er feil står i arkivet som et faktum.
 */

export interface FactSourceRef {
  /** Trykt sidetall i utgaven, når OCR-en oppgir det. */
  page?: string;
  /** Boksen slik den sto, forkortet. Til kontroll — aldri til publisering. */
  quote: string;
}

export interface ExtractedGoal {
  /** Stillingen etter målet, slik avisa skriver den: «2-0». */
  standing: string;
  scorer: string;
  minute?: number;
  penalty?: boolean;
  ownGoal?: boolean;
}

export interface ExtractedFacts {
  venue?: string;
  attendance?: number;
  referee?: string;
  halfTime?: { home: number; away: number };
  goals: ExtractedGoal[];
  /** Kort, slik boksen lister dem. Navnene er ikke slått opp i personregisteret. */
  cards: Array<{ type: "yellow" | "red"; players: string }>;
  /**
   * Laguppstillinger slik OCR-en leste dem, uordnet og uoppslått. Skrivemåten er
   * ofte ødelagt («Sverre kngeskar»), så disse er et utgangspunkt for en
   * håndkontroll — ikke fakta.
   */
  lineups: Array<{ team: string; namesRaw: string }>;
  sources: FactSourceRef[];
}

export interface FactExtractionOptions {
  /** Alle skrivemåter av hjemmelaget, inkludert forkortelser. */
  homeNames: string[];
  awayNames: string[];
  /** Sluttresultatet arkivet allerede kjenner, som «3-0». */
  score: string;
}

export interface FactFragment {
  pageNumber?: string;
  pageId?: string;
  text: string;
}

/**
 * Stillingen i en resultatboks: «2-0», med pausestillingen etter når den står der.
 *
 * Lagnavnene er med vilje ikke med i uttrykket. Et mønster som skal ta hele
 * «ÅFK-SUNNDAL 3-0 (1-0)» i én jafs må la navneklassen og mellomromsklassen
 * overlappe, og et flertydig uttrykk sluppet løs på OCR-tekst vi ikke
 * kontrollerer er en kostnad ingen har oversikt over. Stillingen er derimot et
 * entydig mønster. Den finner vi først, og lagnavnene leser vi bakover fra den
 * med vanlige strengoperasjoner.
 */
const HEADER_SCORE = /(?:^| )(\d{1,2}) ?[-–—] ?(\d{1,2})(?: \((\d{1,2}) ?[-–—] ?(\d{1,2})\))?/gu;

/** Lengste lagnavn vi leser ut fra hver side av bindestreken. */
const NAME_WINDOW = 34;

interface BoxHeader {
  teams: [string, string];
  score: string;
  halfTime?: { home: number; away: number };
  start: number;
  /** Der overskriften slutter — der arena og tilskuertall begynner. */
  end: number;
}

/** Overskriftene i ett tekstvindu, lest ut fra hver stilling som står i det. */
function headersIn(text: string): BoxHeader[] {
  const headers: BoxHeader[] = [];

  for (const match of text.matchAll(HEADER_SCORE)) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 2 * NAME_WINDOW), index);
    const dash = lastDashIn(before);
    if (dash < 0) continue;

    const first = nameBefore(before.slice(0, dash));
    const second = nameAfter(before.slice(dash + 1));
    if (first === "" || second === "") continue;

    headers.push({
      teams: [first, second],
      score: `${Number(match[1])}-${Number(match[2])}`,
      ...(match[3] === undefined || match[4] === undefined
        ? {}
        : { halfTime: { home: Number(match[3]), away: Number(match[4]) } }),
      start: index,
      end: index + match[0].length,
    });
  }

  return headers;
}

function lastDashIn(value: string): number {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if ("-–—".includes(value[index]!)) return index;
  }
  return -1;
}

/** Lagnavnet foran bindestreken: det siste stykket, avskåret ved forrige tall. */
function nameBefore(segment: string): string {
  const window = segment.slice(-NAME_WINDOW);
  let start = 0;
  for (let index = window.length - 1; index >= 0; index -= 1) {
    const character = window[index]!;
    if (character >= "0" && character <= "9") {
      start = index + 1;
      break;
    }
  }
  return tidyName(window.slice(start));
}

/** Lagnavnet etter bindestreken, avskåret ved første tall. */
function nameAfter(segment: string): string {
  const window = segment.slice(0, NAME_WINDOW);
  let end = window.length;
  for (let index = 0; index < window.length; index += 1) {
    const character = window[index]!;
    if (character >= "0" && character <= "9") {
      end = index;
      break;
    }
  }
  return tidyName(window.slice(0, end));
}

function tidyName(value: string): string {
  return value.replace(/^[^\p{L}]+/u, "").replace(/[^\p{L}.]+$/u, "").trim();
}

export function extractMatchFacts(
  fragments: FactFragment[],
  options: FactExtractionOptions,
): ExtractedFacts | null {
  const anchored = fragments
    .map((fragment) => ({ fragment, text: clean(fragment.text) }))
    .filter(({ text }) => isAnchored(text, options));
  if (anchored.length === 0) return null;

  const facts: ExtractedFacts = { goals: [], cards: [], lineups: [], sources: [] };

  for (const { fragment, text } of anchored) {
    const header = anchoredHeader(text, options);
    if (header?.halfTime !== undefined && facts.halfTime === undefined) facts.halfTime = header.halfTime;
    if (!header) continue;
    const nextHeader = headersIn(text).find((candidate) => candidate.start > header.start);
    const claim = text.slice(header.end, nextHeader?.start ?? text.length);

    // Arena og tilskuertall står mellom overskriften og «Mål:», i to former:
    // «Kråmyra stadion 3200 tilskuere» og «Kuventræ stadion Tilskuere: 650».
    // Pausestillingen i parentes mangler i mange bokser, så den kan ikke være
    // festepunktet — teksten rett etter overskriften er det.
    const crowd = crowdIn(claim);
    if (crowd) {
      if (facts.venue === undefined && crowd.venue !== "") facts.venue = crowd.venue;
      if (facts.attendance === undefined && crowd.attendance !== undefined) facts.attendance = crowd.attendance;
    }

    // Personnavn krever en eksplisitt rollemarkør. Et navn som bare står i
    // nærheten av kampboksen er ikke tilstrekkelig personbinding.
    const referee = /\bDommer\s*[:\u2013\u2014-]\s*([^,.;:]{3,40})/iu.exec(claim);
    if (referee && facts.referee === undefined) facts.referee = tidy(referee[1]!);

    for (const goal of goalsIn(claim)) {
      if (!facts.goals.some((existing) => existing.standing === goal.standing && existing.minute === goal.minute)) {
        facts.goals.push(goal);
      }
    }

    for (const [type, pattern] of [["yellow", /Gult? kort:?([^.:]{3,120})/u], ["red", /Rødt kort:?([^.:]{3,120})/u]] as const) {
      const card = pattern.exec(claim);
      if (card && !facts.cards.some((existing) => existing.type === type)) {
        facts.cards.push({ type, players: tidy(card[1]!) });
      }
    }

    for (const team of [options.homeNames, options.awayNames]) {
      const lineup = lineupIn(claim, team);
      if (lineup && !facts.lineups.some((existing) => existing.team === lineup.team)) facts.lineups.push(lineup);
    }

    facts.sources.push({
      ...(fragment.pageNumber ? { page: fragment.pageNumber } : {}),
      quote: text.slice(0, 300),
    });
  }

  facts.goals.sort((a, b) => (a.minute ?? 200) - (b.minute ?? 200));
  return facts;
}

/**
 * Sant når boksen navngir begge lagene og viser stillingen vi spurte om.
 *
 * Begge kravene trengs. Bare lagnavn treffer forhåndsomtalen av kampen, som
 * ikke har fakta ennå; bare stilling treffer en hvilken som helst 3-0 på siden.
 */
export function isAnchored(text: string, options: FactExtractionOptions): boolean {
  return anchoredHeader(clean(text), options) !== undefined;
}

/** Den første overskriften i teksten som faktisk gjelder kampen vi spør om. */
function anchoredHeader(text: string, options: FactExtractionOptions): BoxHeader | undefined {
  const wanted = normalizeScore(options.score);
  const matches = (names: string[], value: string) =>
    names.some((name) => normalize(name) !== "" && (value.includes(normalize(name)) || normalize(name).includes(value)));

  return headersIn(text).find((header) => {
    if (header.score !== wanted) return false;
    const left = normalize(header.teams[0]);
    const right = normalize(header.teams[1]);
    return (matches(options.homeNames, left) && matches(options.awayNames, right))
      || (matches(options.homeNames, right) && matches(options.awayNames, left));
  });
}

/**
 * Arena og tilskuertall i teksten rett etter overskriften.
 *
 * «tilskuere» er festepunktet, og tallet står enten foran ordet eller etter
 * kolonet bak det. Begge deler leses fra korte utsnitt rundt ordet, slik at
 * ingen klasse strekker seg gjennom teksten på leting.
 */
function crowdIn(tail: string): { venue: string; attendance?: number } | undefined {
  const marker = tail.toLocaleLowerCase("nb").indexOf("tilskuere");
  if (marker < 0 || marker > 60) return undefined;

  const before = tail.slice(Math.max(0, marker - 12), marker);
  const after = tail.slice(marker + "tilskuere".length, marker + "tilskuere".length + 14);
  const leading = /(\d[\d .]*)$/u.exec(before)?.[1];
  const trailing = leading === undefined ? /^:? ?(\d[\d .]*)/u.exec(after)?.[1] : undefined;

  const digits = (leading ?? trailing ?? "").replace(/[\s.]/g, "");
  const attendance = digits === "" ? undefined : Number(digits);
  const venueEnd = leading === undefined ? marker : marker - leading.length;

  return {
    venue: tidy(tail.slice(0, Math.max(0, venueEnd))),
    ...(attendance !== undefined && Number.isInteger(attendance) && attendance > 0 ? { attendance } : {}),
  };
}

function goalsIn(text: string): ExtractedGoal[] {
  // Målrekka står etter «Mål:» og stopper ved neste kolon, som i praksis er
  // «Dommer:». Å slutte der holder uttrykket kort og entydig.
  const section = /Mål:([^:]{5,400})/u.exec(text);
  if (!section) return [];

  const goals: ExtractedGoal[] = [];
  // Parentesen har ingen fast rekkefølge: både «(37, straffe)» og
  // «(straffe, 37)» står i samme avis. Innholdet leses derfor som et sett.
  // Navneklassen er grådig og kan ikke matche parentesen den etterfølges av, så
  // det finnes bare én måte å dele opp treffet på.
  const pattern = /(\d{1,2}) ?[-–—] ?(\d{1,2}) ([^()\d]{3,40})\(([^)]{1,25})\)/gu;
  for (const goal of section[1]!.matchAll(pattern)) {
    const note = goal[4]!.toLocaleLowerCase("nb");
    const minute = /(\d{1,3})/u.exec(note)?.[1];
    goals.push({
      standing: `${goal[1]}-${goal[2]}`,
      scorer: tidy(goal[3]!),
      ...(minute === undefined ? {} : { minute: Number(minute) }),
      ...(note.includes("straffe") ? { penalty: true } : {}),
      ...(note.includes("selvmål") ? { ownGoal: true } : {}),
    });
  }
  return goals;
}

/** «ÅFK: Sverre …, Bobbo …» — laget, og navnerekka slik OCR-en leste den. */
function lineupIn(text: string, names: string[]): { team: string; namesRaw: string } | null {
  for (const name of names) {
    const pattern = new RegExp(`${escapeRegExp(name)}:([^.:]{20,300})`, "iu");
    const found = pattern.exec(text);
    if (found) return { team: name, namesRaw: tidy(found[1]!) };
  }
  return null;
}

function clean(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "").trim();
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("nb")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/giu, "")
    .trim();
}

function normalizeScore(score: string): string {
  const match = /^(\d+)\s*[-–—:]\s*(\d+)$/u.exec(score.trim());
  return match ? `${Number(match[1])}-${Number(match[2])}` : score;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
