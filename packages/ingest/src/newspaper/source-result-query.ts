import { flattenSourceResults } from "@aafkstats/schema";
import { AAFK_CLUB_ID } from "@aafkstats/schema";
import { parseNote } from "./note-parser.js";
import type { Archive } from "@aafkstats/schema/load";
import type { Club } from "@aafkstats/schema";
import type { NewspaperQuery } from "./evidence.js";
import type { NoteHints } from "./note-parser.js";

/**
 * Et kilderesultat oversatt til noe NB-søket kan bruke.
 *
 * ## Hvorfor det er et eget lag
 *
 * Avissøket skal ikke kjenne YAML-formatet i `data/source-results`, og
 * kilderesultatene skal ikke vite hvordan Nasjonalbibliotekets API rangerer
 * treff. Mellom dem står denne oversettelsen: motstander med alle skrivemåter,
 * resultat fra AaFKs side, og konteksten notatet røper.
 *
 * Da kan søket forbedres uten å røre datamodellen, og en ny kildetype kan kobles
 * på uten å røre søket.
 */

export interface SourceResultRef {
  sourceId: string;
  file: string;
  season: number;
  no: number;
}

export interface SourceResultQuery extends NewspaperQuery {
  ref: SourceResultRef;
  /** Motstanderen slik kilden trykte navnet, uansett hva registeret kaller klubben. */
  printedOpponent: string;
  opponentClubId?: string;
  replay: boolean;
  extraTime: boolean;
  hints: NoteHints;
}

/**
 * AaFKs skrivemåter i avisene.
 *
 * «Aa.F.K.» og «Aalesunds Fotballklub» hører de eldste årgangene til, mens «ÅFK»
 * overtar senere. Alle tas med — de koster ingenting i et navnetreff. Bare
 * «AFK» alene er utelatt: den formen dukker opp i altfor mye annet.
 */
export const AAFK_NEWSPAPER_ALIASES = [
  "Aalesund",
  "Aalesunds",
  "ÅFK",
  "AAFK",
  "Aa.F.K.",
  "Aalesunds F.K.",
  "Aalesunds Fotballklub",
  "Aalesunds Fotballklubb",
];

export interface SelectOptions {
  season?: number;
  fromYear?: number;
  toYear?: number;
  no?: number;
  /** Bare rader som ikke alt er koblet til en kanonisk kamp. */
  unlinkedOnly?: boolean;
  sourceId?: string;
}

export function sourceResultQueries(archive: Archive, options: SelectOptions): SourceResultQuery[] {
  const clubs = new Map(archive.clubs.map((club) => [club.id, club]));
  const aafkAliases = [...new Set([...clubNames(clubs.get(AAFK_CLUB_ID)), ...AAFK_NEWSPAPER_ALIASES])];
  const queries: SourceResultQuery[] = [];

  for (const collection of archive.sourceResults) {
    if (options.sourceId !== undefined && collection.sourceId !== options.sourceId) continue;

    for (const result of flattenSourceResults(collection)) {
      if (options.season !== undefined && result.season !== options.season) continue;
      if (options.fromYear !== undefined && result.season < options.fromYear) continue;
      if (options.toYear !== undefined && result.season > options.toYear) continue;
      if (options.no !== undefined && !result.id.endsWith(String(options.no).padStart(3, "0"))) continue;
      if (options.unlinkedOnly && result.matchId !== null) continue;
      if (result.status !== "played") continue;

      const printed = result.opponent?.trim();
      const club = result.opponentClubId ? clubs.get(result.opponentClubId) : undefined;
      // Det trykte navnet beholdes alltid som eget alias. Registeret vet hva
      // klubben heter i dag; avisa skrev det den skrev.
      const names = [...new Set([...(printed ? [printed] : []), ...clubNames(club)])];
      if (names.length === 0) continue;

      const hints = parseNote(result.note);
      queries.push({
        ref: {
          sourceId: collection.sourceId,
          file: collection.file,
          season: result.season,
          no: Number(result.id.slice(-3)),
        },
        year: result.season,
        opponent: names[0]!,
        printedOpponent: printed ?? names[0]!,
        opponentAliases: names.slice(1),
        aafkAliases,
        ...(result.opponentClubId ? { opponentClubId: result.opponentClubId } : {}),
        ...(result.aafkGoals !== null && result.opponentGoals !== null
          ? { expectedScore: [result.aafkGoals, result.opponentGoals] as [number, number] }
          : {}),
        ...(hints.competitionHint ? { competitionHint: hints.competitionHint } : {}),
        ...(hints.homeAwayHint ? { homeAwayHint: hints.homeAwayHint } : {}),
        replay: result.replay || hints.replay === true,
        extraTime: result.extraTime || hints.extraTime === true,
        hints,
      });
    }
  }

  // Møtte laget den samme motstanderen flere ganger i sesongen, deler radene
  // treffsett, og da må avstemmingen vite det.
  const counts = new Map<string, number>();
  for (const query of queries) {
    const key = `${query.year}|${query.opponent.toLocaleLowerCase("nb")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const query of queries) {
    query.siblingCount = counts.get(`${query.year}|${query.opponent.toLocaleLowerCase("nb")}`) ?? 1;
  }

  return queries.sort((a, b) => a.year - b.year || a.ref.no - b.ref.no);
}

/** `sourceId:år:nr`, formen en enkelt rad kan pekes ut med fra kommandolinja. */
export function parseSourceResultId(value: string): { sourceId: string; season: number; no: number } | undefined {
  const parts = value.split(":");
  if (parts.length !== 3) return undefined;
  const season = Number(parts[1]);
  const no = Number(parts[2]);
  if (!Number.isInteger(season) || !Number.isInteger(no)) return undefined;
  return { sourceId: parts[0]!, season, no };
}

/** Kildefila kan pekes ut med sti; `sourceId` leses ut av den. */
export function sourceIdFromPath(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop()!.replace(/\.ya?ml$/i, "");
}

function clubNames(club: Club | undefined): string[] {
  if (!club) return [];
  return [
    club.name,
    ...(club.shortName ? [club.shortName] : []),
    ...club.nameVariants,
    ...club.names.map((historical) => historical.name),
  ].map((name) => name.trim()).filter((name) => name !== "");
}
