import type { Archive } from "@aafkstats/schema/load";

/**
 * Steg 0: hvilke måneder kampen sannsynligvis ble spilt i.
 *
 * ## Hvorfor det lønner seg å tenke før man søker
 *
 * Et datoløst resultat sveipes måned for måned gjennom sesongen. Sju måneder er
 * sju søk per søkevariant, og — viktigere — sju måneders kandidater å lese
 * gjennom for den som skal bekrefte funnet. Vet vi at kampen er en NM-kamp i
 * andre runde, vet vi også at den nesten alltid ligger i juni eller mai.
 *
 * ## Hva prioren er verdt, målt
 *
 * Rangeringen er kontrollert mot arkivets egne 1501 daterte kamper, hver kamp
 * holdt utenfor sitt eget grunnlag: riktig måned kom først i 56 % av tilfellene,
 * lå blant de to øverste i 86 % og blant de tre øverste i 92 %. For NM trengs
 * tre–fire måneder for å dekke 90 % av kampene, for en seriekamp i en gitt runde
 * holder det med to.
 *
 * Derfor er dette en **rekkefølge**, ikke et filter. Alle månedene i sesongen
 * blir med; prioren bestemmer bare hvilke som prøves først, slik at et anker som
 * finnes blir funnet tidlig. Skal noe kuttes bort, må den som kjører si det
 * eksplisitt — 8 % feilrate er billig å bære når prisen for å ta feil er en kamp
 * ingen finner igjen.
 */

/** Månedene det spilles fotball i Norge. Vintermånedene har ingen kamper å finne. */
export const SEASON_MONTHS = [4, 5, 6, 7, 8, 9, 10];

export interface PlanQuery {
  season: number;
  competitionId?: string | null;
  round?: number | null;
  /** Datoene til nabokampene i kildens egen rekkefølge, når de er kjent. */
  after?: string;
  before?: string;
}

export interface SearchPlan {
  /** Månedene i den rekkefølgen de bør prøves. */
  months: number[];
  /** Hvor mange av dem som dekker 90 % av det grunnlaget prioren bygger på. */
  likelyCount: number;
  reason: string;
}

export function planMonths(archive: Archive, query: PlanQuery): SearchPlan {
  const bracket = bracketMonths(query);
  if (bracket) return bracket;

  const counts = monthCounts(archive, query);
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total < 4) {
    return { months: [...SEASON_MONTHS], likelyCount: SEASON_MONTHS.length, reason: "ingen prior — hele sesongen" };
  }

  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([month]) => month);
  const months = [...ranked, ...SEASON_MONTHS.filter((month) => !ranked.includes(month))];

  let covered = 0;
  let likelyCount = 0;
  for (const month of ranked) {
    covered += counts.get(month)!;
    likelyCount += 1;
    if (covered / total >= 0.9) break;
  }

  const label = query.round === null || query.round === undefined
    ? `${query.competitionId}`
    : `${query.competitionId} runde ${query.round}`;
  return {
    months,
    likelyCount,
    reason: `${label}: ${months.slice(0, likelyCount).map(monthName).join(", ")} dekker 90 % av ${total} kjente kamper`,
  };
}

/**
 * Månedene mellom to kamper som alt er datert.
 *
 * Kildenes sesongoppstillinger er kronologiske og nummererte. Er kamp 7 og kamp
 * 11 datert, ligger kamp 9 mellom dem — og det er en hardere opplysning enn noen
 * statistikk over hvor NM-runder pleier å ligge.
 */
function bracketMonths(query: PlanQuery): SearchPlan | null {
  if (!query.after && !query.before) return null;

  const first = query.after ? Number(query.after.slice(5, 7)) : SEASON_MONTHS[0]!;
  const last = query.before ? Number(query.before.slice(5, 7)) : SEASON_MONTHS.at(-1)!;
  if (last < first) return null;

  const between: number[] = [];
  for (let month = first; month <= last; month += 1) between.push(month);
  return {
    months: [...between, ...SEASON_MONTHS.filter((month) => !between.includes(month))],
    likelyCount: between.length,
    reason: `mellom nabokampene ${query.after ?? "sesongstart"} og ${query.before ?? "sesongslutt"}`,
  };
}

function monthCounts(archive: Archive, query: PlanQuery): Map<number, number> {
  const counts = new Map<number, number>();
  if (!query.competitionId) return counts;

  for (const match of archive.matches) {
    if (match.dateConfidence !== "exact") continue;
    if (match.competition.id !== query.competitionId) continue;
    // Med runde oppgitt teller bare den runden. Uten runde teller hele
    // konkurransen — en NM-kamp uten rundetall ligger uansett ikke i april.
    if (query.round !== null && query.round !== undefined && match.competition.round !== query.round) continue;
    const month = Number(match.date.slice(5, 7));
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return counts;
}

const MONTH_NAMES = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}
