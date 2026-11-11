import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Archive } from "./load.js";

/**
 * Tallene i «Arkivet i tall» i README, regnet ut av arkivet.
 *
 * ## Feilen dette retter
 *
 * `archive-truths.test.ts` krever at tallene i README stemmer med arkivet, og
 * det er riktig: tallet for kamper sto en gang stille lenge etter at arkivet
 * hadde vokst forbi det. Men kravet gjorde README til en fil som må redigeres
 * for hånd hver gang arkivet vokser — også når det er rutinen etter kamp som
 * lar det vokse. Fører rutinen inn overgangen bak en ny spiller, er det én
 * person mer i arkivet. Spilles kampen på en arena arkivet ikke kjenner, er det
 * ett stadion mer. Begge deler er rutinens vanlige arbeid, og begge ga rød CI
 * til noen husket å endre et tall i en tabell.
 *
 * Tallene er utledet, og det som er utledet skal ikke vedlikeholdes for hånd.
 * Testen står som før og er fortsatt porten; denne modulen er måten å komme
 * gjennom den på uten å telle selv.
 *
 * ## Hva den rører
 *
 * Bare tallet. Radene, forklaringene og rekkefølgen i tabellen er skrevet av et
 * menneske og blir stående. Finner den ikke en rad, sier den fra og lar README
 * være — en rad som er omskrevet skal ikke gjettes tilbake på plass.
 */

/** Det av arkivet tallene regnes ut fra. */
export type ReadmeStatsArchive = Pick<
  Archive,
  "matches" | "sourceResults" | "clubs" | "venues" | "people" | "providers" | "sources"
>;

interface ReadmeStat {
  /** Navnet i rapporten. */
  label: string;
  /**
   * Tre grupper: det som står foran tallet, tallet, og det som står etter.
   * Teksten rundt tallet er det som gjør at riktig tall blir funnet.
   */
  pattern: RegExp;
  value: (archive: ReadmeStatsArchive) => number;
}

const NUMBER = "\\d[\\d\\u00a0 ]*";

function canonicalYears(archive: ReadmeStatsArchive): Set<number> {
  return new Set(archive.matches.map((match) => match.competition.season));
}

function sourceResultRows(archive: ReadmeStatsArchive) {
  return archive.sourceResults.flatMap((collection) => collection.seasons.flatMap((season) => season.results));
}

/**
 * Samme tall og samme definisjoner som `archive-truths.test.ts` kontrollerer.
 * Legges det til en rad der, hører den hjemme her også.
 */
const README_STATS: ReadmeStat[] = [
  {
    label: "kamper",
    pattern: new RegExp(`(\\*\\*)(${NUMBER})( kamper\\*\\*)`, "u"),
    value: (archive) => archive.matches.length,
  },
  {
    // Samme tall står én gang til, i avsnittet om kilder og rettigheter.
    label: "kamper (kildeavsnittet)",
    pattern: new RegExp(`(Arkivet dekker )(${NUMBER})( kamper)`, "u"),
    value: (archive) => archive.matches.length,
  },
  {
    label: "kildedokumenterte resultatoppføringer",
    pattern: new RegExp(`(\\*\\*)(${NUMBER})( kildedokumenterte resultatoppføringer\\*\\*)`, "u"),
    value: (archive) => sourceResultRows(archive).length,
  },
  {
    label: "resultatoppføringer uten kampkobling",
    pattern: new RegExp(`(\\*\\*)(${NUMBER})( mangler fortsatt kobling)`, "u"),
    value: (archive) => sourceResultRows(archive).filter((result) => result.matchId === null).length,
  },
  {
    label: "år med kanoniske kamper",
    pattern: new RegExp(`(\\*\\*)(${NUMBER})( år med kanoniske kamper\\*\\*)`, "u"),
    value: (archive) => canonicalYears(archive).size,
  },
  {
    label: "år med historisk kampinformasjon",
    pattern: new RegExp(`(\\*\\*)(${NUMBER})( år med historisk kampinformasjon\\*\\*)`, "u"),
    value: (archive) => new Set([
      ...canonicalYears(archive),
      ...archive.sourceResults.flatMap((collection) => collection.seasons.map((season) => season.year)),
    ]).size,
  },
  {
    label: "klubber",
    pattern: new RegExp(`(\\*\\*)(${NUMBER})( klubber)`, "u"),
    value: (archive) => archive.clubs.length,
  },
  {
    label: "stadion",
    pattern: new RegExp(`(klubber · )(${NUMBER})( stadion\\*\\*)`, "u"),
    value: (archive) => archive.venues.length,
  },
  {
    label: "personer",
    pattern: new RegExp(`(\\*\\*)(${NUMBER})( personer\\*\\*)`, "u"),
    value: (archive) => archive.people.length,
  },
  {
    label: "dataleverandører",
    pattern: new RegExp(`(\\*\\*)(${NUMBER})( dataleverandører\\*\\*)`, "u"),
    value: (archive) => archive.providers.length,
  },
  {
    label: "historiske kilder",
    pattern: new RegExp(`(\\*\\*)(${NUMBER})( historiske kilder\\*\\*)`, "u"),
    value: (archive) => archive.sources.length,
  },
];

export interface ReadmeStatChange {
  label: string;
  from: number;
  to: number;
}

export interface ReadmeStatsResult {
  /** README med riktige tall. Lik inndata når ingenting var galt. */
  text: string;
  changes: ReadmeStatChange[];
  /** Rader som ikke ble funnet. De er ikke rørt, og et menneske må se på dem. */
  missing: string[];
}

function parseCount(text: string): number {
  return Number(text.replace(/[\s\u00a0]/gu, ""));
}

/**
 * Tusenskille som i resten av README: «1 724», ikke «1724». Skilletegnet arves
 * fra tallet som sto der, slik at et hardt mellomrom forblir et hardt mellomrom.
 */
function formatCount(value: number, previous: string): string {
  const separator = previous.includes("\u00a0") ? "\u00a0" : " ";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, separator);
}

/** Retter tallene i README mot arkivet, og sier hva som ble endret. */
export function syncReadmeStats(readme: string, archive: ReadmeStatsArchive): ReadmeStatsResult {
  let text = readme;
  const changes: ReadmeStatChange[] = [];
  const missing: string[] = [];

  for (const stat of README_STATS) {
    const found = stat.pattern.exec(text);
    if (!found) {
      missing.push(stat.label);
      continue;
    }
    const [whole, before, stated, after] = found as unknown as [string, string, string, string];
    const from = parseCount(stated);
    const to = stat.value(archive);
    if (from === to) continue;
    text = text.slice(0, found.index)
      + before + formatCount(to, stated) + after
      + text.slice(found.index + whole.length);
    changes.push({ label: stat.label, from, to });
  }

  return { text, changes, missing };
}

/**
 * Det samme mot fila på disk. Skriver bare når noe faktisk er endret, slik at
 * en kjøring uten nye tall ikke etterlater spor.
 */
export async function syncReadmeFile(
  repoRoot: string,
  archive: ReadmeStatsArchive,
  options: { write: boolean },
): Promise<ReadmeStatsResult> {
  const path = join(repoRoot, "README.md");
  const result = syncReadmeStats(await readFile(path, "utf8"), archive);
  if (options.write && result.changes.length > 0) await writeFile(path, result.text, "utf8");
  return result;
}
