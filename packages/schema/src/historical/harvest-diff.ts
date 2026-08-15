import type { Person } from "../person.js";
import type { SourceResultCollection } from "../source-result.js";
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

  const baseResultsMap = new Map<string, { matchId: string | null }>();
  for (const [colId, col] of baseSourceResults) {
    for (const r of flattenSourceResults(col)) {
      baseResultsMap.set(`${colId}|${r.id}`, r);
    }
  }

  for (const [colId, headCol] of headSourceResults) {
    if (!baseSourceResults.has(colId)) {
      sourceResultCollectionsAdded += 1;
    }
    for (const headResult of flattenSourceResults(headCol)) {
      const key = `${colId}|${headResult.id}`;
      const baseResult = baseResultsMap.get(key);
      if (!baseResult) {
        sourceResultEntriesAdded += 1;
        if (headResult.matchId !== null) {
          sourceResultEntriesLinked += 1;
        }
      } else {
        if (baseResult.matchId === null && headResult.matchId !== null) {
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
      // Sjekk om ny kilde eller felt er lagt til
      const baseSources = new Set(baseMatch.sources?.map((s) => s.sourceId) ?? []);
      const headSources = new Set(headMatch.sources?.map((s) => s.sourceId) ?? []);
      const baseProviders = new Set(baseMatch.providers?.map((p) => p.providerId) ?? []);
      const headProviders = new Set(headMatch.providers?.map((p) => p.providerId) ?? []);

      if (
        [...headSources].some((s) => !baseSources.has(s)) ||
        [...headProviders].some((p) => !baseProviders.has(p))
      ) {
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
