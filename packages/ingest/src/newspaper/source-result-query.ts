import { flattenSourceResults } from "@aafkstats/schema";
import { AAFK_CLUB_ID } from "@aafkstats/schema";
import { parseNote } from "./note-parser.js";
import type { Archive } from "@aafkstats/schema/load";
import type { Club } from "@aafkstats/schema";
import type { NewspaperQuery } from "./evidence.js";
import type { NoteHints } from "./note-parser.js";
import type { MatchHypothesis } from "./allocation.js";

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
  /**
   * Nøkkelen som avgjør hvilke rader som kjemper om de samme avisutgavene.
   *
   * Klubb-ID der den finnes, ellers det trykte navnet normalisert. Uten
   * klubb-ID ville «Clausenengen», «CFK» og «Clausenengen FK» blitt tre
   * forskjellige motstandere, og søskenkampene aldri funnet hverandre.
   */
  groupKey: string;
  /** Flere kildepåstander om samme antatte kamp, fra sammenslåingen i #172. */
  resultGroupId?: string;
  /** Raden peker alt på en kanonisk kamp. */
  linked: boolean;
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
      if (result.status !== "played") continue;

      const printed = result.opponent?.trim();
      const club = result.opponentClubId ? clubs.get(result.opponentClubId) : undefined;
      // Det trykte navnet beholdes alltid som eget alias. Registeret vet hva
      // klubben heter i dag; avisa skrev det den skrev.
      const names = [...new Set([...(printed ? [printed] : []), ...clubNames(club)])];
      if (names.length === 0) continue;

      const hints = parseNote(result.note);
      const groupKey = `${result.season}|${result.opponentClubId ?? normalizeName(printed ?? names[0]!)}`;
      queries.push({
        groupKey,
        linked: result.matchId !== null,
        ...(result.resultGroupId ? { resultGroupId: result.resultGroupId } : {}),
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

  // Søsken telles over hele populasjonen, før brukerfilteret. Slår man opp
  // bare rad #27, må verktøyet likevel vite at sesongen har en kamp til mot den
  // samme motstanderen — ellers er det ingenting å skille kampene på.
  const counts = new Map<string, number>();
  for (const query of queries) counts.set(query.groupKey, (counts.get(query.groupKey) ?? 0) + 1);
  for (const query of queries) query.siblingCount = counts.get(query.groupKey) ?? 1;

  return queries
    .filter((query) => selected(query, options))
    .sort((a, b) => a.year - b.year || a.ref.no - b.ref.no);
}

/** Brukerens utvalg, brukt etter at søsknene er talt opp. */
function selected(query: SourceResultQuery, options: SelectOptions): boolean {
  if (options.season !== undefined && query.year !== options.season) return false;
  if (options.fromYear !== undefined && query.year < options.fromYear) return false;
  if (options.toYear !== undefined && query.year > options.toYear) return false;
  if (options.no !== undefined && query.ref.no !== options.no) return false;
  if (options.unlinkedOnly && query.linked) return false;
  return true;
}

/**
 * Alle rader som kjemper om de samme avisutgavene som de valgte.
 *
 * Fordelingen trenger hele gruppen, ikke bare den raden brukeren spurte om.
 * Uten søsknene på venstresiden finnes det ingen konkurranse om hendelsene, og
 * da er vi tilbake til at begge Raufoss-radene får oktoberkampen.
 */
export function withSiblings(archive: Archive, options: SelectOptions): Map<string, SourceResultQuery[]> {
  const chosen = sourceResultQueries(archive, options);
  const groups = new Set(chosen.map((query) => query.groupKey));
  const all = sourceResultQueries(archive, { ...(options.sourceId ? { sourceId: options.sourceId } : {}) });

  const byGroup = new Map<string, SourceResultQuery[]>();
  for (const query of all) {
    if (!groups.has(query.groupKey)) continue;
    byGroup.set(query.groupKey, [...(byGroup.get(query.groupKey) ?? []), query]);
  }
  return byGroup;
}

/**
 * Kamppåstandene i en gruppe.
 *
 * Har flere kildepåstander samme `resultGroupId`, handler de om én antatt kamp —
 * det er nettopp den sammenslåingen #172 gjorde — og de skal være én node i
 * fordelingen, ikke tre. Da vet discovery dessuten før søket at kildene selv er
 * uenige, og avisa kan bli den som avgjør.
 */
export function hypothesisId(query: SourceResultQuery): string {
  return query.resultGroupId ?? `${query.ref.sourceId}#${query.ref.season}-${query.ref.no}`;
}

export function buildHypotheses(queries: SourceResultQuery[]): MatchHypothesis[] {
  const byGroup = new Map<string, SourceResultQuery[]>();
  for (const query of queries) {
    const key = hypothesisId(query);
    byGroup.set(key, [...(byGroup.get(key) ?? []), query]);
  }

  return [...byGroup]
    .map(([id, members]) => ({ id, queries: members, order: Math.min(...members.map((member) => member.ref.no)) }))
    .sort((a, b) => a.order - b.order);
}

export interface SourceResultPopulationSummary {
  rawSourceResults: number;
  unlinkedSourceResults: number;
  hypotheses: number;
  singletonHypotheses: number;
  siblingHypotheses: number;
  siblingGroups: number;
  siblingGroupsBySize: Record<string, number>;
  siblingGroupsWithDistinctScores: number;
  siblingGroupsWithIdenticalOrUnknownScores: number;
}

export interface PlannedHypothesis {
  hypothesis: MatchHypothesis;
  groupKey: string;
  siblingGroupSize: number;
  groupHypotheses: MatchHypothesis[];
}

export interface SourceResultPopulation {
  selectedQueries: SourceResultQuery[];
  hypotheses: PlannedHypothesis[];
  summary: SourceResultPopulationSummary;
}

/**
 * Planlegg batchen uten nettverkskall.
 *
 * Brukerfilteret velger hvilke hypoteser som rapporteres. Sibling-størrelsen
 * beregnes alltid fra hele kildefila, slik at `--no` og `--limit` ikke kan gjøre
 * en vanskelig gruppe om til en tilsynelatende singleton.
 */
export function sourceResultPopulation(archive: Archive, options: SelectOptions): SourceResultPopulation {
  const scope = sourceResultQueries(archive, { ...(options.sourceId ? { sourceId: options.sourceId } : {}) });
  const selectedQueries = sourceResultQueries(archive, options);
  const selectedIds = new Set(selectedQueries.map(hypothesisId));
  const allHypotheses = buildHypotheses(scope);
  const groups = new Map<string, MatchHypothesis[]>();

  for (const hypothesis of allHypotheses) {
    const groupKey = hypothesis.queries[0]!.groupKey;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), hypothesis]);
  }

  const hypotheses = allHypotheses
    .filter((hypothesis) => selectedIds.has(hypothesis.id))
    .map((hypothesis) => ({
      hypothesis,
      groupKey: hypothesis.queries[0]!.groupKey,
      siblingGroupSize: groups.get(hypothesis.queries[0]!.groupKey)?.length ?? 1,
      groupHypotheses: groups.get(hypothesis.queries[0]!.groupKey) ?? [hypothesis],
    }))
    .sort((left, right) => left.hypothesis.queries[0]!.year - right.hypothesis.queries[0]!.year
      || left.hypothesis.order - right.hypothesis.order);

  const siblingGroups = new Map<string, MatchHypothesis[]>();
  for (const planned of hypotheses) {
    const group = groups.get(planned.groupKey) ?? [];
    if (group.length > 1) siblingGroups.set(planned.groupKey, group);
  }

  const siblingGroupsBySize: Record<string, number> = {};
  let siblingGroupsWithDistinctScores = 0;
  let siblingGroupsWithIdenticalOrUnknownScores = 0;
  for (const group of siblingGroups.values()) {
    siblingGroupsBySize[String(group.length)] = (siblingGroupsBySize[String(group.length)] ?? 0) + 1;
    const scores = group.flatMap((hypothesis) => {
      const score = hypothesis.queries.find((query) => query.expectedScore !== undefined)?.expectedScore;
      return score ? [`${score[0]}-${score[1]}`] : [];
    });
    if (scores.length === group.length && new Set(scores).size > 1) siblingGroupsWithDistinctScores += 1;
    else siblingGroupsWithIdenticalOrUnknownScores += 1;
  }

  return {
    selectedQueries,
    hypotheses,
    summary: {
      rawSourceResults: selectedQueries.length,
      unlinkedSourceResults: selectedQueries.filter((query) => !query.linked).length,
      hypotheses: hypotheses.length,
      singletonHypotheses: hypotheses.filter((planned) => planned.siblingGroupSize === 1).length,
      siblingHypotheses: hypotheses.filter((planned) => planned.siblingGroupSize > 1).length,
      siblingGroups: siblingGroups.size,
      siblingGroupsBySize,
      siblingGroupsWithDistinctScores,
      siblingGroupsWithIdenticalOrUnknownScores,
    },
  };
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase("nb").normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9æøå]+/giu, "");
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
