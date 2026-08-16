import type { Person } from "../person.js";
import type { SourceResultCollection, SourceResult } from "../source-result.js";
import { flattenSourceResults } from "../source-result.js";
import type { OrganizationSnapshot } from "../organization.js";
import type { HistoricalObservation } from "../historical-observation.js";
import type { Match } from "../match.js";
import { sourceRefKey } from "./preservation.js";

export interface SemanticHarvestMetrics {
  newPeople: number;
  existingPeopleEnriched: number;
  personSourceRefsAdded: number;

  rolesCreated: number;
  rolesSourceEnriched: number;
  honoraryRolesCreated: number;

  sourceResultCollectionsAdded: number;
  sourceResultEntriesAdded: number;
  sourceResultEntriesLinked: number;

  canonicalMatchesCreated: number;
  canonicalMatchesEnriched: number;

  snapshotsAdded: number;
  historicalObservationsAdded: number;

  conflictsCreated: number;
  conflictsResolved: number;

  destructiveChanges: number;
  approvedExceptions: number;
}

export interface HarvestDiffDatasets {
  basePeople: Map<string, Person>;
  headPeople: Map<string, Person>;
  baseSourceResults: Map<string, SourceResultCollection>;
  headSourceResults: Map<string, SourceResultCollection>;
  baseSnapshots: Map<string, OrganizationSnapshot>;
  headSnapshots: Map<string, OrganizationSnapshot>;
  baseObservations: Map<string, HistoricalObservation>;
  headObservations: Map<string, HistoricalObservation>;
  baseMatches: Map<string, Match>;
  headMatches: Map<string, Match>;
}

/**
 * Beregner semantiske batch-metrikker mellom BASE og HEAD.
 */
export function calculateHarvestMetrics(
  datasets: HarvestDiffDatasets,
  destructiveChanges = 0,
  approvedExceptions = 0,
): SemanticHarvestMetrics {
  const {
    basePeople,
    headPeople,
    baseSourceResults,
    headSourceResults,
    baseSnapshots,
    headSnapshots,
    baseObservations,
    headObservations,
    baseMatches,
    headMatches,
  } = datasets;

  let newPeople = 0;
  let existingPeopleEnriched = 0;
  let personSourceRefsAdded = 0;
  let rolesCreated = 0;
  let rolesSourceEnriched = 0;
  let honoraryRolesCreated = 0;
  let conflictsCreated = 0;
  let conflictsResolved = 0;

  // Person- og rollestatistikk
  for (const [id, headPerson] of headPeople) {
    const basePerson = basePeople.get(id);
    if (!basePerson) {
      newPeople += 1;
      personSourceRefsAdded += headPerson.sources.length;
      rolesCreated += headPerson.roles.length;
      honoraryRolesCreated += headPerson.roles.filter((r) => r.category === "honorary").length;
      conflictsCreated += headPerson.conflicts.length;
      continue;
    }

    let isEnriched = false;

    // Top-level sources
    const baseSrcKeys = new Set(basePerson.sources.map(sourceRefKey));
    const newSrcs = headPerson.sources.filter((s) => !baseSrcKeys.has(sourceRefKey(s)));
    if (newSrcs.length > 0) {
      personSourceRefsAdded += newSrcs.length;
      isEnriched = true;
    }

    // Roller
    const baseRoleMap = new Map(basePerson.roles.map((r) => [r.id, r]));
    for (const headRole of headPerson.roles) {
      const baseRole = baseRoleMap.get(headRole.id);
      if (!baseRole) {
        rolesCreated += 1;
        if (headRole.category === "honorary") honoraryRolesCreated += 1;
        isEnriched = true;
      } else {
        const baseRoleSrcKeys = new Set(baseRole.sources.map(sourceRefKey));
        const addedRoleSources = headRole.sources.filter((s) => !baseRoleSrcKeys.has(sourceRefKey(s)));
        if (addedRoleSources.length > 0) {
          rolesSourceEnriched += 1;
          isEnriched = true;
        }
        if (baseRole.to === null && headRole.to !== null) {
          isEnriched = true;
        }
      }
    }

    // Konflikter
    const baseConflictMap = new Map(basePerson.conflicts.map((c) => [c.field, c]));
    for (const headConflict of headPerson.conflicts) {
      const baseConflict = baseConflictMap.get(headConflict.field);
      if (!baseConflict) {
        conflictsCreated += 1;
        isEnriched = true;
      } else if (!baseConflict.resolved && headConflict.resolved) {
        conflictsResolved += 1;
        isEnriched = true;
      }
    }

    // Navn & trenerperioder
    if (headPerson.names.length > basePerson.names.length) isEnriched = true;
    if (headPerson.coachSpells.length > basePerson.coachSpells.length) isEnriched = true;

    if (isEnriched) {
      existingPeopleEnriched += 1;
    }
  }

  // Source-results statistikk
  let sourceResultCollectionsAdded = 0;
  let sourceResultEntriesAdded = 0;
  let sourceResultEntriesLinked = 0;

  function sourceResultSemanticKey(r: SourceResult): string {
    return `${r.sourceId}|${r.season}|${r.date ?? "nodate"}|${r.opponent ?? ""}|${r.opponentClubId ?? ""}|${r.aafkGoals ?? "x"}-${r.opponentGoals ?? "x"}|${r.competitionId ?? ""}|${r.status}`;
  }

  const baseResultsById = new Map<string, SourceResult>();
  const baseResultsBySemantic = new Map<string, SourceResult[]>();

  for (const [colId, col] of baseSourceResults) {
    for (const r of flattenSourceResults(col)) {
      baseResultsById.set(`${colId}|${r.id}`, r);
      const semKey = sourceResultSemanticKey(r);
      const list = baseResultsBySemantic.get(semKey) ?? [];
      list.push(r);
      baseResultsBySemantic.set(semKey, list);
    }
  }

  for (const [colId, headCol] of headSourceResults) {
    if (!baseSourceResults.has(colId)) {
      sourceResultCollectionsAdded += 1;
    }
    const usedBaseSemanticIndices = new Map<string, number>();

    for (const headResult of flattenSourceResults(headCol)) {
      const idKey = `${colId}|${headResult.id}`;
      const baseResultById = baseResultsById.get(idKey);

      let matchedBaseResult: SourceResult | undefined = undefined;

      if (baseResultById && sourceResultSemanticKey(baseResultById) === sourceResultSemanticKey(headResult)) {
        matchedBaseResult = baseResultById;
      } else {
        const semKey = sourceResultSemanticKey(headResult);
        const candidates = baseResultsBySemantic.get(semKey);
        if (candidates && candidates.length > 0) {
          const usedIdx = usedBaseSemanticIndices.get(semKey) ?? 0;
          if (usedIdx < candidates.length) {
            matchedBaseResult = candidates[usedIdx];
            usedBaseSemanticIndices.set(semKey, usedIdx + 1);
          }
        }
      }

      if (!matchedBaseResult) {
        sourceResultEntriesAdded += 1;
        if (headResult.matchId !== null) {
          sourceResultEntriesLinked += 1;
        }
      } else {
        if (matchedBaseResult.matchId === null && headResult.matchId !== null) {
          sourceResultEntriesLinked += 1;
        }
      }
    }
  }

  // Matches statistikk
  let canonicalMatchesCreated = 0;
  let canonicalMatchesEnriched = 0;

  for (const [id, headMatch] of headMatches) {
    const baseMatch = baseMatches.get(id);
    if (!baseMatch) {
      canonicalMatchesCreated += 1;
    } else {
      let isMatchEnriched = false;

      // 1. Sjekk nye eller berikede sources
      const baseSourceMap = new Map((baseMatch.sources ?? []).map((s) => [s.sourceId, s]));
      for (const headSrc of headMatch.sources ?? []) {
        const baseSrc = baseSourceMap.get(headSrc.sourceId);
        if (!baseSrc) {
          isMatchEnriched = true;
          break;
        }
        const baseFields = new Set(baseSrc.fields ?? []);
        if ((headSrc.fields ?? []).some((f) => !baseFields.has(f))) {
          isMatchEnriched = true;
          break;
        }
      }

      // 2. Sjekk nye eller berikede providers
      if (!isMatchEnriched) {
        const baseProviderMap = new Map((baseMatch.providers ?? []).map((p) => [p.providerId, p]));
        for (const headProv of headMatch.providers ?? []) {
          const baseProv = baseProviderMap.get(headProv.providerId);
          if (!baseProv) {
            isMatchEnriched = true;
            break;
          }
          const baseFields = new Set(baseProv.fields ?? []);
          if ((headProv.fields ?? []).some((f) => !baseFields.has(f))) {
            isMatchEnriched = true;
            break;
          }
        }
      }

      // 3. Sjekk hendelser, oppstillinger, tilskuertall osv.
      if (!isMatchEnriched) {
        if ((headMatch.events?.length ?? 0) > (baseMatch.events?.length ?? 0)) isMatchEnriched = true;
        else if (!baseMatch.attendance && headMatch.attendance) isMatchEnriched = true;
        else if (!baseMatch.referee && headMatch.referee) isMatchEnriched = true;
        else if (!baseMatch.venueId && headMatch.venueId) isMatchEnriched = true;
        else if (!baseMatch.lineups && headMatch.lineups) isMatchEnriched = true;
        else if (!baseMatch.report && headMatch.report) isMatchEnriched = true;
      }

      if (isMatchEnriched) {
        canonicalMatchesEnriched += 1;
      }
    }
  }

  // Snapshots & Observations
  let snapshotsAdded = 0;
  for (const [id] of headSnapshots) {
    if (!baseSnapshots.has(id)) snapshotsAdded += 1;
  }

  let historicalObservationsAdded = 0;
  for (const [id] of headObservations) {
    if (!baseObservations.has(id)) historicalObservationsAdded += 1;
  }

  return {
    newPeople,
    existingPeopleEnriched,
    personSourceRefsAdded,
    rolesCreated,
    rolesSourceEnriched,
    honoraryRolesCreated,
    sourceResultCollectionsAdded,
    sourceResultEntriesAdded,
    sourceResultEntriesLinked,
    canonicalMatchesCreated,
    canonicalMatchesEnriched,
    snapshotsAdded,
    historicalObservationsAdded,
    conflictsCreated,
    conflictsResolved,
    destructiveChanges,
    approvedExceptions,
  };
}
