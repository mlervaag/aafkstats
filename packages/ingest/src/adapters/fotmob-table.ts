import { fetchJson } from "../http.js";
import type { DivisionResult, RawTableRow } from "./rsssf-table.js";

/**
 * Tabellen og runderekka for én sesong hos FotMob.
 *
 * ## Hvorfor denne finnes ved siden av RSSSF-tabellene
 *
 * RSSSF publiserer sluttabellen etter at sesongen er over. Det er riktig kilde
 * for historien, og feil kilde for året vi står i: 2026-tabellen finnes ikke der
 * ennå. FotMob har den, og har dessuten hele divisjonens runderekke, som er det
 * plasseringskurven må regnes ut av.
 *
 * ## Hva den ikke gjør
 *
 * Den leser ikke `qualColor` eller fargelegenden som utfall. Legenden hos kilden
 * sier hvor Champions League-plassene *ville* gått om tabellen ble stående i dag,
 * og det er en spådom, ikke noe plasseringen har ført til. `outcome` blir derfor
 * `none` på hver rad i en sesong som pågår. Feltet betyr «hva det ble til», og
 * det vet ingen ennå.
 */

const BASE = "https://www.fotmob.com/api/data";

interface RawLeagueTableRow {
  id?: string | number;
  name?: string;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  scoresStr?: string;
  pts?: number;
  idx?: number;
  deduction?: number | null;
}

interface RawLeagueFixture {
  round?: string | number;
  home?: { name?: string };
  away?: { name?: string };
  status?: { finished?: boolean; cancelled?: boolean; awarded?: boolean; scoreStr?: string };
}

export interface RawLeague {
  details?: { name?: string; selectedSeason?: string };
  table?: { data?: { table?: { all?: RawLeagueTableRow[] } } }[];
  fixtures?: { allMatches?: RawLeagueFixture[] };
}

export interface FotmobTable {
  /** Divisjonsnavnet slik kilden skriver det. */
  leagueName: string | undefined;
  /** Tabellrader i kildens rekkefølge, plassering 1 først. */
  rows: RawTableRow[];
  /**
   * Kildens egen lag-ID per rad, i samme rekkefølge som `rows`.
   *
   * Arkivet fører den allerede som `aliases.fotmob` på klubbene, og en ID er en
   * sikrere kobling enn et navn: kilden skriver «Aalesund» der arkivet skriver
   * «Aalesunds FK», og de to normaliserer ikke likt. Navnet er reserven for de
   * lagene arkivet ikke har noen alias for.
   */
  externalIds: (string | undefined)[];
  /** Ferdigspilte kamper i hele divisjonen, til utregningen av kurven. */
  results: DivisionResult[];
  /** Kamper kilden har, men som ikke er spilt ennå. Bare til rapporten. */
  unfinished: number;
  url: string;
}

export const FOTMOB_TABLE_ADAPTER = "fotmob-table@1";

export async function fetchFotmobTable(options: {
  leagueId: string;
  season: number;
  sourceSeason?: string | undefined;
  refresh?: boolean | undefined;
}): Promise<FotmobTable> {
  const askedFor = options.sourceSeason ?? String(options.season);
  const url = `${BASE}/leagues?id=${options.leagueId}&season=${encodeURIComponent(askedFor)}`;
  const league = await fetchJson<RawLeague>(url, { refresh: options.refresh });
  return parseFotmobTable(league, {
    askedFor,
    url: `https://www.fotmob.com/leagues/${options.leagueId}/table?season=${encodeURIComponent(askedFor)}`,
  });
}

/**
 * Lesingen, skilt fra hentingen.
 *
 * Delt slik at parsingen kan prøves mot et fast svar uten å røre nettet. Det er
 * her feilene bor: en rad uten målscore, en runde som ikke er et tall, en kamp
 * som er avlyst framfor spilt.
 */
export function parseFotmobTable(
  league: RawLeague,
  context: { askedFor: string; url: string },
): FotmobTable {
  // Kilden svarer med *en* sesong uansett hva vi ba om, og et feilskrevet
  // årstall gir da forrige sesong uten at noe sier fra. Samme kontroll som
  // kampinnhøstingen gjør.
  const got = league.details?.selectedSeason;
  if (got !== undefined && got !== context.askedFor) {
    throw new Error(`kilden returnerte sesong ${got}, ikke ${context.askedFor}`);
  }

  const rawRows = league.table?.[0]?.data?.table?.all ?? [];
  if (rawRows.length < 2) throw new Error("kilden har ingen tabell for denne sesongen");

  const externalIds = rawRows.map((row) => (row.id === undefined ? undefined : String(row.id)));
  const rows = rawRows.map((row, index) => {
    const goals = /^(\d+)\s*-\s*(\d+)$/.exec(row.scoresStr ?? "");
    if (!goals) throw new Error(`raden «${row.name ?? index + 1}» mangler målscore`);
    return {
      name: required(row.name, `lagnavn på plass ${index + 1}`),
      played: required(row.played, `kamper for ${row.name}`),
      wins: required(row.wins, `seire for ${row.name}`),
      draws: required(row.draws, `uavgjorte for ${row.name}`),
      losses: required(row.losses, `tap for ${row.name}`),
      goalsFor: Number(goals[1]),
      goalsAgainst: Number(goals[2]),
      points: required(row.pts, `poeng for ${row.name}`),
      // Utfallet leses ikke av kilden. Se toppen av fila.
      status: "",
    } satisfies RawTableRow;
  });

  const results: DivisionResult[] = [];
  let unfinished = 0;
  for (const fixture of league.fixtures?.allMatches ?? []) {
    const status = fixture.status ?? {};
    // En avlyst kamp har ingen sluttstilling å regne på, og skal heller ikke
    // telles som «gjenstår». Samme skille som `core_played` i basen.
    if (status.cancelled) continue;
    const score = /^(\d+)\s*-\s*(\d+)$/.exec(status.scoreStr ?? "");
    const round = Number(fixture.round);
    const home = fixture.home?.name;
    const away = fixture.away?.name;
    if (!status.finished || !score || !Number.isInteger(round) || !home || !away) {
      unfinished += 1;
      continue;
    }
    results.push({ round, home, away, homeGoals: Number(score[1]), awayGoals: Number(score[2]) });
  }

  return {
    leagueName: league.details?.name,
    rows,
    externalIds,
    results,
    unfinished,
    url: context.url,
  };
}

function required<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`kilden mangler ${what}`);
  return value;
}
