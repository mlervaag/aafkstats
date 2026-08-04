import { clubKey } from "@aafkstats/schema";
import type { StandingsRow } from "@aafkstats/schema";
import { cleanTeam, MATCH_LINE, ROUND_HEADING } from "./rsssf.js";

/**
 * Sluttabellen nederst på en RSSSF-sesongside.
 *
 * Tabellen har ligget der hele tiden. Kampparseren leser resultatlinjene og
 * kaster resten, så arkivet har 32 seriesesonger uten å vite hvor laget endte i
 * en eneste av dem — `final_position` er NULL for alle 85 rader i `core_seasons`.
 *
 * Ingen ny kilde og ingen ny henting: dette er samme side, allerede i cachen.
 */

/** En rad slik den står på sida, med kildens eget klubbnavn. */
export interface RawTableRow {
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Det som står bak poengsummen: «Promoted», «Relegated», «Champions League». */
  status: string;
}

/**
 * Leser én tabellrad.
 *
 * Kolonnene er `navn spilt S U T mål-mål poeng [status]`, men navnet kan
 * inneholde tall — «Sarpsborg 08», «Lyn 1896» — så en grådig lesing fra venstre
 * tar årstallet som kampantall. Vi prøver derfor hvert mulige skille mellom navn
 * og tallblokk, og godtar det første der `S + U + T = spilt`. Den regelen holder
 * for ekte tabellrader og treffer aldri en tilfeldig linje med tall i.
 */
export function parseTableRow(line: string): RawTableRow | undefined {
  // «76- 44» finnes i årgangene rundt 2001. Målene er ett felt for leseren, og
  // må bli ett felt her også før linja splittes.
  const tokens = line.trim().replace(/(\d+)\s*-\s*(\d+)/g, "$1-$2").split(/\s+/);

  for (let split = 1; split + 6 <= tokens.length; split++) {
    const [rawPlayed, rawWins, rawDraws, rawLosses, rawGoals, rawPoints] = tokens.slice(split, split + 6);
    const goals = /^(\d+)-(\d+)$/.exec(rawGoals!);
    if (!goals) continue;

    const played = Number(rawPlayed);
    const wins = Number(rawWins);
    const draws = Number(rawDraws);
    const losses = Number(rawLosses);
    // Poengtrekk noteres med stjerne og en fotnote lenger nede på sida.
    const points = Number(rawPoints!.replace(/\*+$/, ""));
    if (![played, wins, draws, losses, points].every(Number.isInteger)) continue;
    if (wins + draws + losses !== played) continue;

    const name = tokens.slice(0, split).join(" ");
    if (name === "") continue;

    return {
      name,
      played,
      wins,
      draws,
      losses,
      goalsFor: Number(goals[1]),
      goalsAgainst: Number(goals[2]),
      points,
      status: tokens.slice(split + 6).join(" "),
    };
  }
  return undefined;
}

/**
 * Alle tabellblokker på sida, i rekkefølge.
 *
 * Sida har som regel flere. RSSSF trykker en halvveistabell etter siste runde før
 * sommeren, og noen årganger har hjemme- og bortetabeller etter sluttabellen.
 * Skillelinjene (`-----` for opp- og nedrykk, `- - - -` for andre grenser) bryter
 * ikke en blokk; de er en del av tabellen.
 */
export function parseTableBlocks(text: string): RawTableRow[][] {
  const blocks: RawTableRow[][] = [];
  let current: RawTableRow[] = [];

  const flush = () => {
    // Fire lag er lavere enn noen norsk divisjon, og høyt nok til at to
    // tilfeldige linjer med tall i ikke blir en tabell.
    if (current.length >= 4) blocks.push(current);
    current = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const row = parseTableRow(line);
    if (row) {
      current.push(row);
      continue;
    }
    // Skillelinjene for opp- og nedrykk (`-----` og `- - - -`) hører til tabellen
    // og bryter den ikke. Alt annet gjør det, blanke linjer inkludert: uten det
    // smelter en halvveistabell og sluttabellen sammen til én blokk, og den
    // blokka ser like gyldig ut som hver av dem.
    if (/^[-\s]*-[-\s]*$/.test(line.trim()) && line.trim() !== "") continue;
    flush();
  }
  flush();
  return blocks;
}

/**
 * Sluttabellen blant blokkene.
 *
 * Velges på høyeste kampantall, ikke på posisjon på sida. «Siste tabell» er feil
 * for årganger med hjemme- og bortetabell til slutt, og «første» er feil for alle
 * som har en halvveistabell. Kampantallet skiller dem uten å gjette: halvveis er
 * lavere, hjemme/borte er halvparten.
 */
export function finalTable(text: string): RawTableRow[] | undefined {
  const blocks = parseTableBlocks(text);
  if (blocks.length === 0) return undefined;
  const depth = (block: RawTableRow[]) => Math.max(...block.map((row) => row.played));
  const deepest = Math.max(...blocks.map(depth));
  return blocks.find((block) => depth(block) === deepest);
}

/**
 * Hva statusteksten betyr.
 *
 * RSSSF skriver den i fritekst og med varianter per årgang: «Promotion
 * play-off», «Play-off (UEFA Cup (cup winner))», «Champions League». Vi tolker
 * bare det som endrer divisjon, og lar resten stå som den er i `note` — en
 * europacupplass er en opplysning, men ikke en av våre.
 */
export function readOutcome(status: string): StandingsRow["outcome"] {
  const text = status.toLowerCase();
  if (/relegation play-?off/.test(text)) return "relegation_playoff";
  if (/promotion play-?off/.test(text)) return "promotion_playoff";
  if (/relegated/.test(text)) return "relegated";
  if (/promoted/.test(text)) return "promoted";
  if (/^play-?off/.test(text)) return "playoff";
  return "none";
}

/** Overskrifter som betyr at serierundene er over for denne omgangen. */
const SECTION_END = /^\s*(Match statistics|Play-?off|Qualification|Relegation|Promotion|Home\/away)/i;

/** Ett resultat på sida, uten hensyn til hvem som spilte. */
export interface DivisionResult {
  round: number;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

/**
 * Alle resultater i divisjonen, med rundenummer.
 *
 * Kampparseren filtrerer bort alt uten AaFK, som er riktig for kampfilene. Her
 * trengs de andre kampene også: en tabell etter runde 12 kan ikke regnes ut av
 * AaFKs tolv. Ingenting av dette lagres — det lever bare til progresjonen er
 * regnet ut.
 */
export function parseDivisionResults(text: string): DivisionResult[] {
  const results: DivisionResult[] = [];
  let round: number | undefined;
  const seen = new Set<string>();

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const heading = ROUND_HEADING.exec(line);
    if (heading) {
      round = Number(heading[1]);
      continue;
    }

    // En tabellrad eller en ny overskrift avslutter runden.
    //
    // Kvalifiseringskampene etter siste serierunde står uten egen `Round`-linje,
    // og uten dette arver de nummeret til runde 30. I 2015 ga det runde 30
    // tretten kamper i stedet for åtte, og fire lag som ikke spilte i divisjonen
    // fikk poeng i tabellen vi regnet ut.
    if (parseTableRow(line) || SECTION_END.test(line)) {
      round = undefined;
      continue;
    }
    if (round === undefined) continue;

    const found = MATCH_LINE.exec(line);
    if (!found) continue;
    const [, , , homeRaw, awayRaw, homeGoals, awayGoals] = found;
    const home = cleanTeam(homeRaw!);
    const away = cleanTeam(awayRaw!);
    if (home === "" || away === "") continue;

    // Samme oppgjør står noen ganger både under runden og i et sammendrag.
    const key = `${round}|${home}|${away}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ round, home, away, homeGoals: Number(homeGoals), awayGoals: Number(awayGoals) });
  }
  return results;
}

/**
 * Hvor mange poeng en seier ga.
 *
 * Leses ut av tabellen i stedet for av årstallet. To poeng for seier gjaldt til
 * 1987, men overgangen skjedde ikke samtidig i alle divisjoner, og en regel på
 * årstall ville vært en påstand vi ikke kan belegge. Tabellen vet svaret: den
 * verdien som stemmer for flest rader er den som gjaldt.
 *
 * Flest, ikke alle: poengtrekk finnes, og ett trekk skal ikke velte regelen.
 */
export function pointsPerWin(table: RawTableRow[]): number {
  const fits = (per: number) =>
    table.filter((row) => row.wins * per + row.draws === row.points).length;
  return fits(3) >= fits(2) ? 3 : 2;
}

/**
 * Hvor klubben lå etter hver runde.
 *
 * Tabellen bygges opp runde for runde av divisjonens egne resultater, og
 * plasseringen leses av etter hver. Sorteringen er poeng, så målforskjell, så
 * scorede mål — den norske regelen, og den samme RSSSF selv bruker.
 *
 * Runder der klubben ikke er ferdigspilt teller likevel: står kampen igjen, står
 * laget lavere, og det er slik tabellen faktisk så ut den uka.
 */
export function computeProgression(
  results: DivisionResult[],
  clubName: string,
  perWin = 3,
): { round: number; position: number; points: number; played: number; goalDifference: number }[] {
  // Navnene slås sammen på kanonisk identitet før de telles. Tabellen for 2022
  // skriver «Kristiansund BK» og «Sandefjord Fotball», mens resultatlinjene på
  // samme side skriver «Kristiansund» og «Sandefjord». Uten dette blir hver av
  // dem to lag i tabellen vi regner ut, og alle under dem får feil plassering.
  const totals = new Map<string, { points: number; played: number; gf: number; ga: number }>();
  const of = (team: string) => {
    const key = clubKey(team);
    let row = totals.get(key);
    if (!row) totals.set(key, (row = { points: 0, played: 0, gf: 0, ga: 0 }));
    return row;
  };
  const own = clubKey(clubName);

  const rounds = [...new Set(results.map((result) => result.round))].sort((a, b) => a - b);
  const progression = [];

  for (const round of rounds) {
    for (const result of results.filter((entry) => entry.round === round)) {
      const home = of(result.home);
      const away = of(result.away);
      home.played += 1;
      away.played += 1;
      home.gf += result.homeGoals;
      home.ga += result.awayGoals;
      away.gf += result.awayGoals;
      away.ga += result.homeGoals;
      // Satsen kommer fra tabellen, ikke fra årstallet. To poeng for seier endrer
      // ikke bare poengsummen vi lagrer, men rekkefølgen: med to poeng er en seier
      // og et tap dårligere enn to uavgjorte, med tre er det bedre.
      if (result.homeGoals > result.awayGoals) home.points += perWin;
      else if (result.homeGoals < result.awayGoals) away.points += perWin;
      else { home.points += 1; away.points += 1; }
    }

    const standing = [...totals.entries()].sort(([nameA, a], [nameB, b]) =>
      b.points - a.points
      || (b.gf - b.ga) - (a.gf - a.ga)
      || b.gf - a.gf
      || nameA.localeCompare(nameB),
    );
    const index = standing.findIndex(([key]) => key === own);
    if (index === -1) continue;
    const [, entry] = standing[index]!;
    progression.push({
      round,
      position: index + 1,
      points: entry.points,
      played: entry.played,
      goalDifference: entry.gf - entry.ga,
    });
  }

  return progression;
}

/**
 * Stemmer den utregnede kurven med tabellen kilden trykte?
 *
 * Siste punkt i progresjonen skal være identisk med klubbens rad i sluttabellen.
 * Gjør det ikke det, har utregningen mistet en kamp eller tatt med en som ikke
 * hører hjemme, og hele kurven er upålitelig — ikke bare det siste punktet.
 *
 * Feilen finnes i praksis. RSSSF-sida for 2015 skriver «Aalesund Stabæk 1-1»
 * uten bindestreken mellom lagnavnene, og resultatlinja lar seg ikke lese. Uten
 * denne kontrollen ville arkivet vist en kurve som endte ett poeng og én kamp
 * feil, og ingenting hadde avslørt det.
 */
export function progressionAgreesWithTable(
  progression: { position: number; points: number; played: number; goalDifference: number }[],
  row: RawTableRow,
  position: number,
): { ok: true } | { ok: false; reason: string } {
  const last = progression.at(-1);
  if (!last) return { ok: false, reason: "kilden har ingen runderekke å regne ut av" };

  const mismatch = [
    last.played !== row.played && `kamper ${last.played} mot ${row.played}`,
    last.points !== row.points && `poeng ${last.points} mot ${row.points}`,
    last.position !== position && `plass ${last.position} mot ${position}`,
    last.goalDifference !== row.goalsFor - row.goalsAgainst
      && `målforskjell ${last.goalDifference} mot ${row.goalsFor - row.goalsAgainst}`,
  ].filter((entry): entry is string => typeof entry === "string");

  return mismatch.length === 0
    ? { ok: true }
    : { ok: false, reason: `utregnet slutt avviker fra tabellen: ${mismatch.join(", ")}` };
}

/**
 * Har runderekka de samme lagene som tabellen?
 *
 * Uavhengig av poengkontrollen, og fanger noe annen: at et lag mangler eller er
 * for mye i utregningen. Sida for 2022 skriver «Strømsgodet» på én resultatlinje
 * og «Strømsgodset» på alle andre, og det ekstra laget flytter alle under det.
 *
 * Poengkontrollen alene ville sluppet den gjennom i 2022, fordi de splittede
 * lagene tilfeldigvis lå under AaFK. Neste gang gjør de ikke det.
 */
export function divisionClubsMatch(
  results: DivisionResult[],
  table: RawTableRow[],
): { ok: true } | { ok: false; reason: string } {
  const inResults = new Set(results.flatMap((r) => [clubKey(r.home), clubKey(r.away)]));
  const inTable = new Set(table.map((row) => clubKey(row.name)));
  const extra = [...inResults].filter((key) => !inTable.has(key));
  const missing = [...inTable].filter((key) => !inResults.has(key));
  if (extra.length === 0 && missing.length === 0) return { ok: true };
  return {
    ok: false,
    reason: [
      extra.length > 0 && `lag i resultatene som ikke står i tabellen: ${extra.join(", ")}`,
      missing.length > 0 && `lag i tabellen uten kamper: ${missing.join(", ")}`,
    ].filter(Boolean).join("; "),
  };
}
