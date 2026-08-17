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

/** Overskriftslinja i en resultatboks: «ÅFK-SUNNDAL 3-0 (1-0)». */
const HEADER = /([^\s\d][^\d\n]{1,34}?)\s*[-–—]\s*([^\s\d][^\d\n]{1,34}?)\s+(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*(?:\((\d{1,2})\s*[-–—]\s*(\d{1,2})\))?/u;

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
    const header = HEADER.exec(text);
    if (header?.[5] !== undefined && header[6] !== undefined && facts.halfTime === undefined) {
      facts.halfTime = { home: Number(header[5]), away: Number(header[6]) };
    }

    // Arena og tilskuertall står mellom overskriften og «Mål:», i to former:
    // «Kråmyra stadion 3200 tilskuere» og «Kuventræ stadion Tilskuere: 650».
    // Pausestillingen i parentes mangler i mange bokser, så den kan ikke være
    // festepunktet — teksten rett etter overskriften er det.
    const tail = header ? text.slice(header.index + header[0].length) : "";
    const crowd = /^([^\d]{0,45}?)\s*(?:([\d][\d\s.]{0,7}?)\s*tilskuere|tilskuere:?\s*([\d][\d\s.]{0,7}))/iu.exec(tail);
    if (crowd) {
      const attendance = Number((crowd[2] ?? crowd[3] ?? "").replace(/[\s.]/g, ""));
      if (facts.venue === undefined && tidy(crowd[1]!) !== "") facts.venue = tidy(crowd[1]!);
      if (facts.attendance === undefined && Number.isInteger(attendance) && attendance > 0) {
        facts.attendance = attendance;
      }
    }

    const referee = /Dommer:?\s*([^,.;:]{3,40})/u.exec(text);
    if (referee && facts.referee === undefined) facts.referee = tidy(referee[1]!);

    for (const goal of goalsIn(text)) {
      if (!facts.goals.some((existing) => existing.standing === goal.standing && existing.minute === goal.minute)) {
        facts.goals.push(goal);
      }
    }

    for (const [type, pattern] of [["yellow", /Gult? kort:?\s*([^.]{3,120})/u], ["red", /Rødt kort:?\s*([^.]{3,120})/u]] as const) {
      const card = pattern.exec(text);
      if (card && !facts.cards.some((existing) => existing.type === type)) {
        facts.cards.push({ type, players: tidy(card[1]!) });
      }
    }

    for (const team of [options.homeNames, options.awayNames]) {
      const lineup = lineupIn(text, team);
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
  const header = HEADER.exec(clean(text));
  if (!header) return false;

  const [, first, second, home, away] = header;
  if (`${home}-${away}` !== normalizeScore(options.score)) return false;

  const left = normalize(first!);
  const right = normalize(second!);
  const matches = (names: string[], value: string) =>
    names.some((name) => normalize(name) !== "" && (value.includes(normalize(name)) || normalize(name).includes(value)));

  return (matches(options.homeNames, left) && matches(options.awayNames, right))
    || (matches(options.homeNames, right) && matches(options.awayNames, left));
}

function goalsIn(text: string): ExtractedGoal[] {
  const section = /Mål:?\s*(.{5,400})/su.exec(text);
  if (!section) return [];

  const goals: ExtractedGoal[] = [];
  // Parentesen har ingen fast rekkefølge: både «(37, straffe)» og
  // «(straffe, 37)» står i samme avis. Innholdet leses derfor som et sett.
  const pattern = /(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+([^()\d]{3,40}?)\s*\(([^)]{1,25})\)/gu;
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
    const pattern = new RegExp(`${escapeRegExp(name)}:\\s*([^.:]{20,300})`, "iu");
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
