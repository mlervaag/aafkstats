import type { Person } from "../person.js";
import type { Match } from "../match.js";
import type { OrganizationSnapshot } from "../organization.js";
import type { HistoricalObservation } from "../historical-observation.js";
import type { SourceResultCollection } from "../source-result.js";
import type { HarvestFinding } from "./harvest-finding.js";

/**
 * En ny opplysning i arkivet som kan tilskrives en bestemt innhøstingsbatch,
 * fordi den siterer en av batchens kilder.
 */
export interface AttributedAddition {
  entity: "person" | "source_result" | "match" | "observation" | "organization_snapshot";
  id: string;
  /** Underelement, f.eks. `roles/formann-1924`. Utelatt for hele entiteter. */
  path?: string;
  /** Kilden i batchen som opplysningen siterer. */
  sourceId: string;
  label: string;
}

interface SourceCiting {
  sources?: Array<{ sourceId: string }> | undefined;
}

/**
 * Finner den første av batchens kilder som en entitet siterer.
 */
function citedBatchSource(item: SourceCiting, batchSourceIds: Set<string>): string | undefined {
  for (const ref of item.sources ?? []) {
    if (batchSourceIds.has(ref.sourceId)) return ref.sourceId;
  }
  return undefined;
}

/**
 * Samler alt som er lagt til mellom BASE og HEAD og som siterer en av batchens
 * kilder.
 *
 * Filteret på batchens kilder er avgjørende: en PR kan inneholde endringer som
 * ikke har noe med denne batchen å gjøre, og en ferdig batch skal ikke felles
 * av at noen senere legger til en person fra en helt annen kilde. Det som
 * derimot siterer batchens kilder, er batchens ansvar.
 */
export function collectAttributedAdditions(
  batchSourceIds: Set<string>,
  base: {
    people: Map<string, Person>;
    sourceResults: Map<string, SourceResultCollection>;
    matches: Map<string, Match>;
    observations: Map<string, HistoricalObservation>;
    snapshots: Map<string, OrganizationSnapshot>;
  },
  head: {
    people: Map<string, Person>;
    sourceResults: Map<string, SourceResultCollection>;
    matches: Map<string, Match>;
    observations: Map<string, HistoricalObservation>;
    snapshots: Map<string, OrganizationSnapshot>;
  },
): AttributedAddition[] {
  const additions: AttributedAddition[] = [];

  for (const [id, headPerson] of head.people) {
    const basePerson = base.people.get(id);

    if (!basePerson) {
      const sourceId = citedBatchSource(headPerson, batchSourceIds);
      if (sourceId) {
        additions.push({
          entity: "person",
          id,
          sourceId,
          label: `Ny person «${headPerson.name}»`,
        });
      }
    }

    const baseRoleIds = new Set((basePerson?.roles ?? []).map((r) => r.id));
    for (const role of headPerson.roles) {
      if (baseRoleIds.has(role.id)) continue;
      const sourceId = citedBatchSource(role, batchSourceIds);
      if (sourceId) {
        additions.push({
          entity: "person",
          id,
          path: `roles/${role.id}`,
          sourceId,
          label: `Ny rolle «${role.title ?? role.id}» på «${headPerson.name}»`,
        });
      }
    }
  }

  for (const [id, headCol] of head.sourceResults) {
    if (!batchSourceIds.has(headCol.sourceId)) continue;
    const baseCol = base.sourceResults.get(id);

    if (!baseCol) {
      additions.push({
        entity: "source_result",
        id,
        sourceId: headCol.sourceId,
        label: `Ny source-result-samling «${id}»`,
      });
      continue;
    }

    const baseEntryCount = baseCol.seasons.reduce((sum, s) => sum + s.results.length, 0);
    const headEntryCount = headCol.seasons.reduce((sum, s) => sum + s.results.length, 0);
    if (headEntryCount > baseEntryCount) {
      additions.push({
        entity: "source_result",
        id,
        sourceId: headCol.sourceId,
        label: `${headEntryCount - baseEntryCount} nye kilderesultater i «${id}»`,
      });
    }
  }

  for (const [id, headMatch] of head.matches) {
    if (base.matches.has(id)) continue;
    const sourceId = citedBatchSource(headMatch, batchSourceIds);
    if (sourceId) {
      additions.push({ entity: "match", id, sourceId, label: `Ny kamp «${id}»` });
    }
  }

  for (const [id, headObs] of head.observations) {
    if (base.observations.has(id)) continue;
    const sourceId = citedBatchSource(headObs, batchSourceIds);
    if (sourceId) {
      additions.push({ entity: "observation", id, sourceId, label: `Ny observasjon «${id}»` });
    }
  }

  for (const [id, headSnap] of head.snapshots) {
    if (base.snapshots.has(id)) continue;
    const sourceId = citedBatchSource(headSnap, batchSourceIds);
    if (sourceId) {
      additions.push({
        entity: "organization_snapshot",
        id,
        sourceId,
        label: `Nytt organisasjonssnapshot «${id}»`,
      });
    }
  }

  return additions;
}

/**
 * Nøkkelen et finding-target dekker.
 */
function targetKey(entity: string, id: string, path?: string): string {
  return path ? `${entity}|${id}|${path}` : `${entity}|${id}`;
}

/**
 * Bygger settet av alt manifestets funn faktisk gjør rede for.
 *
 * Et target uten `path` dekker hele entiteten, inkludert underelementer — et
 * funn som oppretter en person står også inne for personens rolle.
 */
export function buildFindingCoverage(findings: HarvestFinding[]): {
  exact: Set<string>;
  whole: Set<string>;
  containers: Set<string>;
} {
  const exact = new Set<string>();
  const whole = new Set<string>();
  const containers = new Set<string>();

  for (const finding of findings) {
    for (const target of finding.targets) {
      exact.add(targetKey(target.entity, target.id, target.path));
      if (target.path) {
        // En rolle kan ikke eksistere uten personen som bærer den. Et funn som
        // gjør rede for rollen gjør derfor også rede for at personfilen er ny —
        // men ikke for andre roller på samme person, som må ha egne funn.
        containers.add(targetKey(target.entity, target.id));
      } else {
        whole.add(targetKey(target.entity, target.id));
      }
    }
  }

  return { exact, whole, containers };
}

/**
 * Finner alt som er lagt til i arkivet uten at noe funn gjør rede for det.
 *
 * Dette er kontrollen i motsatt retning av target-valideringen: den sjekker at
 * hvert funn peker på noe som finnes, denne sjekker at alt som finnes kom fra
 * et funn. Uten den kan et manifest med tre funn ledsage femti nye personer.
 */
export function findUnaccountedAdditions(
  additions: AttributedAddition[],
  findings: HarvestFinding[],
): AttributedAddition[] {
  const { exact, whole, containers } = buildFindingCoverage(findings);

  return additions.filter((addition) => {
    if (exact.has(targetKey(addition.entity, addition.id, addition.path))) return false;
    if (whole.has(targetKey(addition.entity, addition.id))) return false;
    // Selve entiteten regnes som dekket når et funn peker på noe inne i den.
    if (!addition.path && containers.has(targetKey(addition.entity, addition.id))) return false;
    return true;
  });
}
