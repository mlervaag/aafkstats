import type { HarvestBatchManifest } from "./harvest-manifest.js";
import { SOURCE_PROFILES, inferSourceProfile } from "./source-profile.js";
import { TARGET_REQUIRED_DISPOSITIONS } from "./harvest-finding.js";
import type { Source } from "../source.js";
import type { Provider } from "../entities.js";
import type { PublicationExtraction } from "../extraction.js";
import type { SourceResultCollection } from "../source-result.js";
import { flattenSourceResults } from "../source-result.js";
import type { Person } from "../person.js";
import type { OrganizationSnapshot } from "../organization.js";
import type { HistoricalObservation } from "../historical-observation.js";
import type { Match } from "../match.js";
import type { PreservationException } from "../preservation-exceptions.js";
import { runPreservationAudit, type PreservationAuditResult } from "./preservation.js";
import { calculateHarvestMetrics, type SemanticHarvestMetrics } from "./harvest-diff.js";

export interface HarvestAuditIssue {
  type: "error" | "warning";
  category: "manifest" | "inventory" | "coverage" | "passes" | "finding" | "target" | "provenance" | "preservation" | "lifecycle";
  message: string;
  findingId?: string;
  sourceId?: string;
  targetId?: string;
}

export interface HarvestAuditReport {
  manifest: HarvestBatchManifest;
  profileName: string;
  mode: string;
  status: string;
  sourcesSummary: {
    inScope: number;
    reviewed: number;
    reprints: number;
    unavailable: number;
    outOfScope: number;
    unknown: number;
  };
  pagesSummary: {
    expected: number;
    reviewed: number;
    coveragePct: number;
    isFull: boolean;
  };
  findingsSummary: {
    total: number;
    normalized: number;
    unresolved: number;
    observed: number;
    missingDisposition: number;
    byType: Record<string, number>;
    byDisposition: Record<string, number>;
  };
  targetsSummary: {
    personTargets: number;
    roles: number;
    sourceResults: number;
    canonicalMatches: number;
    observations: number;
    snapshots: number;
  };
  preservation: {
    destructiveChanges: number;
    approvedExceptions: number;
    passed: boolean;
  };
  metrics: SemanticHarvestMetrics;
  issues: HarvestAuditIssue[];
  passed: boolean;
}

export interface HarvestAuditContext {
  manifest: HarvestBatchManifest;
  allSources: Map<string, Source>;
  allProviders: Map<string, Provider>;
  allExtractions: Map<string, PublicationExtraction>;
  allSourceResults: Map<string, SourceResultCollection>;
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
  exceptions: PreservationException[];
  baseSha?: string;
  headSha?: string;
}

/**
 * Utfører komplett cross-layer audit av et Harvest Batch Manifest mot arkivdataene.
 */
export function auditHarvestBatch(context: HarvestAuditContext): HarvestAuditReport {
  const {
    manifest,
    allSources,
    allExtractions,
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
    exceptions,
    baseSha = "BASE",
    headSha = "HEAD",
  } = context;

  const issues: HarvestAuditIssue[] = [];
  const isCompleteStatus = manifest.status === "complete";

  // 1. Profil-validering
  const profileId = manifest.profile ?? inferSourceProfile();
  const profile = SOURCE_PROFILES[profileId] ?? SOURCE_PROFILES.generic_publication;

  // 2. Source Inventory & Scope-kontroll
  let inScopeCount = 0;
  let reviewedCount = 0;
  let reprintsCount = 0;
  let unavailableCount = 0;
  let outOfScopeCount = 0;
  let unknownCount = 0;

  const inventorySourceIds = new Set<string>();

  for (const item of manifest.sourceInventory) {
    inventorySourceIds.add(item.sourceId);

    if (!allSources.has(item.sourceId)) {
      issues.push({
        type: "error",
        category: "inventory",
        sourceId: item.sourceId,
        message: `Frosset kilde «${item.sourceId}» finnes ikke i kildekatalogen (data/sources/)`,
      });
    }

    if (item.reviewStatus === "reviewed") {
      reviewedCount += 1;
      inScopeCount += 1;
    } else if (item.reviewStatus === "duplicate_or_reprint") {
      reprintsCount += 1;
      inScopeCount += 1;
      if (item.duplicateOf && !allSources.has(item.duplicateOf)) {
        issues.push({
          type: "warning",
          category: "inventory",
          sourceId: item.sourceId,
          message: `Reprint refererer til ukjent duplicateOf «${item.duplicateOf}»`,
        });
      }
    } else if (item.reviewStatus === "unavailable") {
      unavailableCount += 1;
      inScopeCount += 1;
    } else if (item.reviewStatus === "out_of_scope") {
      outOfScopeCount += 1;
    } else {
      unknownCount += 1;
      inScopeCount += 1;
      if (isCompleteStatus) {
        issues.push({
          type: "error",
          category: "inventory",
          sourceId: item.sourceId,
          message: `Kilde «${item.sourceId}» har uavklart reviewStatus «${item.reviewStatus}» i en fullført batch`,
        });
      }
    }
  }

  // Sjekk om scope.sourceIds mangler i frosset inventar
  for (const sid of manifest.scope.sourceIds) {
    if (!inventorySourceIds.has(sid)) {
      issues.push({
        type: "warning",
        category: "inventory",
        sourceId: sid,
        message: `Scope inneholder sourceId «${sid}» som ikke er oppført i sourceInventory`,
      });
    }
  }

  // 3. Side- og seksjonsdekning
  let expectedPages = manifest.coverage?.expected ?? 0;
  const reviewedPages = manifest.coverage?.reviewed ?? 0;

  if (!manifest.coverage && manifest.sourceInventory.length > 0) {
    // Summer forventede sider fra extractions dersom ikke eksplisitt oppgitt
    for (const item of manifest.sourceInventory) {
      const ext = allExtractions.get(item.sourceId);
      if (ext) {
        expectedPages += ext.pagesExpected;
      }
    }
  }

  const isFullCoverage =
    manifest.coverage ? reviewedPages >= expectedPages && expectedPages > 0 : expectedPages === 0 || reviewedPages >= expectedPages;
  const coveragePct = expectedPages > 0 ? Math.min(100, Math.round((reviewedPages / expectedPages) * 100)) : 100;

  if (isCompleteStatus && manifest.coverage && !isFullCoverage) {
    const isFacsimileUnavailable = manifest.reviewMethod?.facsimile === "unavailable";
    if (!isFacsimileUnavailable) {
      issues.push({
        type: "error",
        category: "coverage",
        message: `Visuell sidekontroll er ufullstendig (${reviewedPages}/${expectedPages} sider, ${coveragePct}%)`,
      });
    }
  }

  // 4. Passes-validering
  for (const reqPass of profile.requiredPasses) {
    const passState = manifest.passes[reqPass.id];
    if (isCompleteStatus) {
      if (!passState || (passState.status !== "complete" && passState.status !== "reviewed")) {
        issues.push({
          type: "error",
          category: "passes",
          message: `Påkrevd innhøstingspass «${reqPass.name}» (${reqPass.id}) er ikke fullført (status: ${passState?.status ?? "mangler"})`,
        });
      }
    }
  }

  // 5. Findings & Dispositions & Targets
  const byType: Record<string, number> = {};
  const byDisposition: Record<string, number> = {};
  const totalFindings = manifest.findings.length;
  let normalizedCount = 0;
  let unresolvedCount = 0;
  let observedCount = 0;
  let missingDispCount = 0;

  let personTargetsCount = 0;
  let rolesCount = 0;
  let sourceResultsCount = 0;
  let canonicalMatchesCount = 0;
  let observationsCount = 0;
  let snapshotsCount = 0;

  const findingIds = new Set<string>();

  for (const finding of manifest.findings) {
    // Unik finding-ID
    if (findingIds.has(finding.id)) {
      issues.push({
        type: "error",
        category: "finding",
        findingId: finding.id,
        message: `Duplikat finding-ID «${finding.id}»`,
      });
    }
    findingIds.add(finding.id);

    byType[finding.type] = (byType[finding.type] ?? 0) + 1;
    byDisposition[finding.disposition] = (byDisposition[finding.disposition] ?? 0) + 1;

    if (finding.status === "normalized") {
      normalizedCount += 1;
    } else if (finding.status === "unresolved" || finding.disposition === "identity_uncertain") {
      unresolvedCount += 1;
    } else if (finding.status === "observed") {
      observedCount += 1;
    }

    if (!finding.disposition) {
      missingDispCount += 1;
      issues.push({
        type: "error",
        category: "finding",
        findingId: finding.id,
        message: `Funn «${finding.id}» mangler disposition`,
      });
    }

    if (isCompleteStatus && finding.status === "observed") {
      issues.push({
        type: "error",
        category: "lifecycle",
        findingId: finding.id,
        message: `Funn «${finding.id}» står fortsatt som «observed» i en fullført batch (må være normalized eller unresolved)`,
      });
    }

    // Sjekk kildetilgjengelighet
    const primarySourceId = finding.source?.sourceId ?? finding.sources[0]?.sourceId;
    if (primarySourceId && !allSources.has(primarySourceId)) {
      issues.push({
        type: "error",
        category: "finding",
        findingId: finding.id,
        sourceId: primarySourceId,
        message: `Funn «${finding.id}» refererer til ukjent sourceId «${primarySourceId}»`,
      });
    }

    // Valider target-required dispositions
    const requiresTarget = TARGET_REQUIRED_DISPOSITIONS.has(finding.disposition);

    if (requiresTarget && finding.targets.length === 0) {
      issues.push({
        type: "error",
        category: "target",
        findingId: finding.id,
        message: `Disposisjonen «${finding.disposition}» krever minst ett target, men ingen targets ble oppgitt`,
      });
    }

    // Valider alle oppgitte targets
    for (const target of finding.targets) {
      if (target.entity === "person") {
        personTargetsCount += 1;
        const p = headPeople.get(target.id);
        if (!p) {
          issues.push({
            type: "error",
            category: "target",
            findingId: finding.id,
            targetId: target.id,
            message: `Target person «${target.id}» finnes ikke i data/people/`,
          });
        } else {
          // Hvis path er f.eks. roles/formann-1924
          if (target.path?.startsWith("roles/")) {
            rolesCount += 1;
            const roleId = target.path.replace(/^roles\//, "");
            const r = p.roles.find((role) => role.id === roleId);
            if (!r) {
              issues.push({
                type: "error",
                category: "target",
                findingId: finding.id,
                targetId: target.id,
                message: `Target role «${roleId}» finnes ikke på person «${target.id}»`,
              });
            } else if (primarySourceId) {
              // Provenienssjekk: inneholder rollen finding-kilden?
              const hasSource = r.sources.some((s) => s.sourceId === primarySourceId);
              if (!hasSource) {
                issues.push({
                  type: "warning",
                  category: "provenance",
                  findingId: finding.id,
                  targetId: target.id,
                  message: `Rolle «${roleId}» på person «${target.id}» mangler sourceRef til kilden «${primarySourceId}»`,
                });
              }
            }
          } else if (primarySourceId) {
            const hasPersonSource = p.sources.some((s) => s.sourceId === primarySourceId);
            if (!hasPersonSource) {
              issues.push({
                type: "warning",
                category: "provenance",
                findingId: finding.id,
                targetId: target.id,
                message: `Person «${target.id}» mangler top-level sourceRef til kilden «${primarySourceId}»`,
              });
            }
          }
        }
      } else if (target.entity === "source_result") {
        sourceResultsCount += 1;
        const col = headSourceResults.get(target.id);
        if (!col) {
          issues.push({
            type: "error",
            category: "target",
            findingId: finding.id,
            targetId: target.id,
            message: `Target source-result collection «${target.id}» finnes ikke i data/source-results/`,
          });
        } else if (target.path) {
          const flat = flattenSourceResults(col);
          const matchEntry = flat.find((r) => r.id === target.path || `${r.season}/${r.id}` === target.path);
          if (!matchEntry) {
            // Hvis path er f.eks. seasons/1954/results/3
            const pathMatch = target.path.match(/results\/(\d+)/);
            if (!pathMatch) {
              issues.push({
                type: "warning",
                category: "target",
                findingId: finding.id,
                targetId: target.id,
                message: `Kunne ikke bekrefte resultatsti «${target.path}» i source-results «${target.id}»`,
              });
            }
          }
        }
      } else if (target.entity === "match") {
        canonicalMatchesCount += 1;
        const m = headMatches.get(target.id);
        if (!m) {
          issues.push({
            type: "error",
            category: "target",
            findingId: finding.id,
            targetId: target.id,
            message: `Target match «${target.id}» finnes ikke i sesongarkivet (data/seasons/)`,
          });
        } else if (primarySourceId) {
          const hasMatchSource = m.sources?.some((s) => s.sourceId === primarySourceId);
          if (!hasMatchSource) {
            issues.push({
              type: "warning",
              category: "provenance",
              findingId: finding.id,
              targetId: target.id,
              message: `Kamp «${target.id}» mangler sourceRef til kilden «${primarySourceId}»`,
            });
          }
        }
      } else if (target.entity === "observation") {
        observationsCount += 1;
        const obs = headObservations.get(target.id);
        if (!obs) {
          issues.push({
            type: "error",
            category: "target",
            findingId: finding.id,
            targetId: target.id,
            message: `Target historical observation «${target.id}» finnes ikke i data/observations/`,
          });
        }
      } else if (target.entity === "organization_snapshot") {
        snapshotsCount += 1;
        const snap = headSnapshots.get(target.id);
        if (!snap) {
          issues.push({
            type: "error",
            category: "target",
            findingId: finding.id,
            targetId: target.id,
            message: `Target organization snapshot «${target.id}» finnes ikke i data/organization/snapshots/`,
          });
        }
      }
    }
  }

  // Sjekk unresolved-køen
  for (const unresolvedItem of manifest.unresolved) {
    if (!findingIds.has(unresolvedItem.findingId)) {
      issues.push({
        type: "warning",
        category: "finding",
        findingId: unresolvedItem.findingId,
        message: `Unresolved queue oppføring refererer til ukjent findingId «${unresolvedItem.findingId}»`,
      });
    }
  }

  // 6. Preservation Guardrail (#158)
  const preservationResult: PreservationAuditResult = runPreservationAudit(
    basePeople,
    headPeople,
    exceptions,
    baseSha,
    headSha,
  );

  if (!preservationResult.passed) {
    for (const record of preservationResult.changes) {
      if (record.status === "DESTRUCTIVE_CHANGE") {
        issues.push({
          type: "error",
          category: "preservation",
          targetId: record.id,
          message: `Destruktiv endring uten unntak: ${record.path} (${record.message})`,
        });
      }
    }
  }

  // 7. Semantiske metrikker
  const metrics = calculateHarvestMetrics(
    {
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
    },
    preservationResult.summary.destructiveChanges,
    preservationResult.summary.approvedExceptions,
  );

  // 8. Sluttstatus og samlet pass
  const hasErrors = issues.some((i) => i.type === "error");
  const passed = !hasErrors && preservationResult.passed;

  return {
    manifest,
    profileName: profile.name,
    mode: manifest.mode,
    status: manifest.status,
    sourcesSummary: {
      inScope: inScopeCount,
      reviewed: reviewedCount,
      reprints: reprintsCount,
      unavailable: unavailableCount,
      outOfScope: outOfScopeCount,
      unknown: unknownCount,
    },
    pagesSummary: {
      expected: expectedPages,
      reviewed: reviewedPages,
      coveragePct,
      isFull: isFullCoverage,
    },
    findingsSummary: {
      total: totalFindings,
      normalized: normalizedCount,
      unresolved: unresolvedCount,
      observed: observedCount,
      missingDisposition: missingDispCount,
      byType,
      byDisposition,
    },
    targetsSummary: {
      personTargets: personTargetsCount,
      roles: rolesCount,
      sourceResults: sourceResultsCount,
      canonicalMatches: canonicalMatchesCount,
      observations: observationsCount,
      snapshots: snapshotsCount,
    },
    preservation: {
      destructiveChanges: preservationResult.summary.destructiveChanges,
      approvedExceptions: preservationResult.summary.approvedExceptions,
      passed: preservationResult.passed,
    },
    metrics,
    issues,
    passed,
  };
}
