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
import {
  collectAttributedAdditions,
  findUnaccountedAdditions,
  type AttributedAddition,
} from "./harvest-attribution.js";
import { runArchivePreservationAudit, type ArchivePreservationInput } from "./archive-preservation.js";

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
    archiveDestructiveChanges: number;
    passed: boolean;
  };
  /** Tillegg i arkivet som siterer batchens kilder uten å være dekket av et funn. */
  unaccountedAdditions: AttributedAddition[];
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
 * Kildene i batchen som fortsatt krever visuell kontroll. `out_of_scope` er den
 * eneste statusen som legitimt tar en kilde ut av dekningsregnskapet.
 */
function manifestSourceIdsInScope(manifest: HarvestBatchManifest): string[] {
  return manifest.sourceInventory
    .filter((item) => item.reviewStatus !== "out_of_scope")
    .map((item) => item.sourceId);
}

/**
 * Utleder forventet sidetall fra ekstraksjonene i stedet for å stole på
 * manifestet. Returnerer undefined når ingen av kildene har en ekstraksjon —
 * da finnes det ikke noe maskinelt sidetall å måle mot, og kravet kan ikke
 * håndheves.
 */
function deriveExpectedPagesFromExtractions(
  manifest: HarvestBatchManifest,
  allExtractions: Map<string, PublicationExtraction>,
): number | undefined {
  let total = 0;
  let found = false;
  for (const sourceId of manifestSourceIdsInScope(manifest)) {
    const ext = allExtractions.get(sourceId);
    if (ext) {
      total += ext.pagesExpected;
      found = true;
    }
  }
  return found ? total : undefined;
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

  // Proveniens er ikke en formalitet. Et funn som påstår at en opplysning kom
  // fra en gitt kilde, men der målet mangler sourceRef til den kilden, er en
  // udokumentert påstand. Underveis er det en påminnelse; i en batch som
  // erklæres fullført er det en feil.
  const provenanceIssueType: "error" | "warning" = isCompleteStatus ? "error" : "warning";

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

    // Sjekk om inventaroppføring tilhører scope (retning 2)
    if (manifest.scope.sourceIds.length > 0 && !manifest.scope.sourceIds.includes(item.sourceId)) {
      if (item.reviewStatus !== "out_of_scope") {
        if (isCompleteStatus) {
          issues.push({
            type: "error",
            category: "inventory",
            sourceId: item.sourceId,
            message: `Kilde «${item.sourceId}» i sourceInventory tilhører ikke batchens scope og er ikke merket out_of_scope`,
          });
        } else {
          issues.push({
            type: "warning",
            category: "inventory",
            sourceId: item.sourceId,
            message: `Kilde «${item.sourceId}» i sourceInventory tilhører ikke batchens scope (bør merkes out_of_scope dersom den beholdes)`,
          });
        }
      }
    }
  }

  // Sjekk om scope.sourceIds mangler i frosset inventar (retning 1)
  for (const sid of manifest.scope.sourceIds) {
    if (!inventorySourceIds.has(sid)) {
      if (isCompleteStatus) {
        issues.push({
          type: "error",
          category: "inventory",
          sourceId: sid,
          message: `Kilde «${sid}» i scope mangler i frosset sourceInventory`,
        });
      } else {
        issues.push({
          type: "warning",
          category: "inventory",
          sourceId: sid,
          message: `Scope inneholder sourceId «${sid}» som ikke er oppført i sourceInventory`,
        });
      }
    }
  }

  // 3. Side- og seksjonsdekning
  const isFacsimileUnavailable = manifest.reviewMethod?.facsimile === "unavailable";
  const expectedPages = manifest.coverage?.expected ?? 0;
  const reviewedPages = manifest.coverage?.reviewed ?? 0;

  // Sidetallet kan ikke være en ren påstand. Ekstraksjonene vet hvor mange
  // sider kilden faktisk har, og manifestet må stemme med dem. Uten dette
  // holder det å skrive «4/4» for et 62-siders blad for å få 100 % dekning.
  const derivedExpectedPages = deriveExpectedPagesFromExtractions(manifest, allExtractions);

  if (manifest.coverage?.mode !== "sections" && derivedExpectedPages !== undefined) {
    if (expectedPages < derivedExpectedPages) {
      issues.push({
        type: "error",
        category: "coverage",
        message:
          `coverage.expected (${expectedPages}) er lavere enn sidetallet ekstraksjonene rapporterer ` +
          `(${derivedExpectedPages}). Dekningen kan ikke settes lavere enn kildens faktiske omfang.`,
      });
    } else if (expectedPages > derivedExpectedPages) {
      issues.push({
        type: "warning",
        category: "coverage",
        message:
          `coverage.expected (${expectedPages}) er høyere enn sidetallet ekstraksjonene rapporterer ` +
          `(${derivedExpectedPages}). Kontroller at inventaret og ekstraksjonene er i takt.`,
      });
    }
  }

  // «Faksimile utilgjengelig» er den eneste veien utenom dekningskravet, og
  // må derfor være et faktum om kilden — ikke et valg. Finnes det ALTO-skann,
  // finnes det faksimile.
  if (isFacsimileUnavailable) {
    const altoSources = manifestSourceIdsInScope(manifest).filter(
      (sid) => allExtractions.get(sid)?.ocrAccess === "alto",
    );
    if (altoSources.length > 0) {
      issues.push({
        type: "error",
        category: "coverage",
        sourceId: altoSources[0],
        message:
          `reviewMethod.facsimile er «unavailable», men ${altoSources.length} kilde(r) i batchen har ` +
          `ALTO-ekstraksjon og dermed tilgjengelig faksimile (${altoSources.slice(0, 3).join(", ")}). ` +
          `Dekningskravet kan ikke settes til side for disse.`,
      });
    }
  }

  const isFullCoverage =
    manifest.coverage ? reviewedPages >= expectedPages && expectedPages > 0 : expectedPages === 0 || reviewedPages >= expectedPages;
  const coveragePct = expectedPages > 0 ? Math.min(100, Math.round((reviewedPages / expectedPages) * 100)) : 100;

  if (isCompleteStatus) {
    if (isFacsimileUnavailable) {
      if (!manifest.reviewMethod?.reason || manifest.reviewMethod.reason.trim().length === 0) {
        issues.push({
          type: "error",
          category: "manifest",
          message: "reviewMethod.facsimile er «unavailable» uten obligatorisk begrunnelse (reason)",
        });
      }
    } else {
      if (!manifest.coverage) {
        issues.push({
          type: "error",
          category: "coverage",
          message: "En batch med status: complete og facsimile required krever eksplisitt coverage",
        });
      } else if (manifest.coverage.expected <= 0) {
        issues.push({
          type: "error",
          category: "coverage",
          message: `Visuell kontroll kan ikke ha expected: ${manifest.coverage.expected} når faksimile er påkrevd`,
        });
      } else if (!isFullCoverage) {
        issues.push({
          type: "error",
          category: "coverage",
          message: `Visuell sidekontroll er ufullstendig (${reviewedPages}/${expectedPages} sider/seksjoner, ${coveragePct}%)`,
        });
      }
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

    if (isCompleteStatus && (finding.status === "observed" || finding.status === "reviewed")) {
      issues.push({
        type: "error",
        category: "lifecycle",
        findingId: finding.id,
        message: `Funn «${finding.id}» har status «${finding.status}» i en fullført batch (må være normalized eller unresolved)`,
      });
    }

    // Sjekk kildetilgjengelighet og sidetall
    const primarySourceId = finding.source?.sourceId ?? finding.sources[0]?.sourceId;
    const findingPage =
      finding.source?.page !== undefined && finding.source?.page !== null
        ? String(finding.source.page).trim()
        : (finding.sources[0]?.page !== undefined && finding.sources[0]?.page !== null
            ? String(finding.sources[0].page).trim()
            : undefined);

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
              const matchingSources = r.sources.filter((s) => s.sourceId === primarySourceId);
              if (matchingSources.length === 0) {
                issues.push({
                  type: provenanceIssueType,
                  category: "provenance",
                  findingId: finding.id,
                  targetId: target.id,
                  message: `Rolle «${roleId}» på person «${target.id}» mangler sourceRef til kilden «${primarySourceId}»`,
                });
              } else if (findingPage) {
                const hasPageMatch = matchingSources.some(
                  (s) => s.page !== undefined && s.page !== null && String(s.page).trim() === findingPage,
                );
                if (!hasPageMatch && matchingSources.some((s) => s.page !== undefined && s.page !== null)) {
                  issues.push({
                    type: provenanceIssueType,
                    category: "provenance",
                    findingId: finding.id,
                    targetId: target.id,
                    message: `Proveniens side-avvik for rolle «${roleId}» på person «${target.id}»: funn angir side ${findingPage}, men rollen refererer til side ${matchingSources.map((s) => s.page).join(", ")}`,
                  });
                }
              }
            }
          } else if (primarySourceId) {
            const matchingSources = p.sources.filter((s) => s.sourceId === primarySourceId);
            if (matchingSources.length === 0) {
              issues.push({
                type: provenanceIssueType,
                category: "provenance",
                findingId: finding.id,
                targetId: target.id,
                message: `Person «${target.id}» mangler top-level sourceRef til kilden «${primarySourceId}»`,
              });
            } else if (findingPage) {
              const hasPageMatch = matchingSources.some(
                (s) => s.page !== undefined && s.page !== null && String(s.page).trim() === findingPage,
              );
              if (!hasPageMatch && matchingSources.some((s) => s.page !== undefined && s.page !== null)) {
                issues.push({
                  type: provenanceIssueType,
                  category: "provenance",
                  findingId: finding.id,
                  targetId: target.id,
                  message: `Proveniens side-avvik for person «${target.id}»: funn angir side ${findingPage}, men person refererer til side ${matchingSources.map((s) => s.page).join(", ")}`,
                });
              }
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
          const normalizedPath = target.path.trim();

          let found = flat.some(
            (r) =>
              r.id === normalizedPath ||
              `${r.season}/${r.id}` === normalizedPath ||
              `seasons/${r.season}/results/${r.order}` === normalizedPath ||
              `${r.season}/${r.order}` === normalizedPath ||
              `${r.season}-${r.order}` === normalizedPath ||
              `${r.season}-${String(r.order).padStart(3, "0")}` === normalizedPath,
          );

          if (!found) {
            const pathMatch =
              normalizedPath.match(/^(?:seasons\/)?(\d{4})\/(?:results\/)?(\d+)$/) ||
              normalizedPath.match(/^(\d{4})-(\d+)$/);
            if (pathMatch) {
              const year = Number.parseInt(pathMatch[1]!, 10);
              const no = Number.parseInt(pathMatch[2]!, 10);
              const seasonObj = col.seasons.find((s) => s.year === year);
              if (seasonObj) {
                found = seasonObj.results.some((res, idx) => res.no === no || idx + 1 === no);
              }
            }
          }

          if (!found) {
            issues.push({
              type: "error",
              category: "target",
              findingId: finding.id,
              targetId: target.id,
              message: `Target source-result entry «${target.path}» finnes ikke i source-results for «${target.id}»`,
            });
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
          const matchingSources = m.sources?.filter((s) => s.sourceId === primarySourceId) ?? [];
          if (matchingSources.length === 0) {
            issues.push({
              type: provenanceIssueType,
              category: "provenance",
              findingId: finding.id,
              targetId: target.id,
              message: `Kamp «${target.id}» mangler sourceRef til kilden «${primarySourceId}»`,
            });
          } else if (findingPage) {
            const hasPageMatch = matchingSources.some(
              (s) => s.page !== undefined && s.page !== null && String(s.page).trim() === findingPage,
            );
            if (!hasPageMatch && matchingSources.some((s) => s.page !== undefined && s.page !== null)) {
              issues.push({
                type: provenanceIssueType,
                category: "provenance",
                findingId: finding.id,
                targetId: target.id,
                message: `Proveniens side-avvik for kamp «${target.id}»: funn angir side ${findingPage}, men kampen refererer til side ${matchingSources.map((s) => s.page).join(", ")}`,
              });
            }
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

  // 5b. Omvendt dekningskontroll: alt som er lagt til i arkivet og som siterer
  // batchens kilder må gjøres rede for av et funn. Target-valideringen over
  // sjekker at hvert funn peker på noe ekte; denne sjekker det motsatte, at
  // ingenting ekte kom uten et funn.
  const batchSourceIds = new Set(manifestSourceIdsInScope(manifest));
  const attributedAdditions = collectAttributedAdditions(
    batchSourceIds,
    {
      people: basePeople,
      sourceResults: baseSourceResults,
      matches: baseMatches,
      observations: baseObservations,
      snapshots: baseSnapshots,
    },
    {
      people: headPeople,
      sourceResults: headSourceResults,
      matches: headMatches,
      observations: headObservations,
      snapshots: headSnapshots,
    },
  );
  const unaccounted = findUnaccountedAdditions(attributedAdditions, manifest.findings);

  for (const addition of unaccounted) {
    issues.push({
      type: isCompleteStatus ? "error" : "warning",
      category: "coverage",
      targetId: addition.id,
      sourceId: addition.sourceId,
      message:
        `${addition.label} siterer batchens kilde «${addition.sourceId}», men ingen funn i manifestet ` +
        `gjør rede for den${addition.path ? ` (${addition.path})` : ""}.`,
    });
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

  // Bevaringsvernet for resten av arkivet, slik at batchsjekken håndhever det
  // samme som den harde porten i CI.
  const archiveInputs: ArchivePreservationInput[] = [
    { domain: "source_result", base: baseSourceResults, head: headSourceResults },
    { domain: "match", base: baseMatches, head: headMatches },
    { domain: "observation", base: baseObservations, head: headObservations },
    { domain: "organization_snapshot", base: baseSnapshots, head: headSnapshots },
  ];
  const archiveResult = runArchivePreservationAudit(archiveInputs, exceptions);

  for (const record of archiveResult.changes) {
    if (record.status === "DESTRUCTIVE_CHANGE") {
      issues.push({
        type: "error",
        category: "preservation",
        targetId: record.id,
        message: `Destruktiv endring uten unntak i ${record.entity} «${record.id}»: ${record.message}`,
      });
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
  const passed = !hasErrors && preservationResult.passed && archiveResult.destructiveChanges === 0;

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
      approvedExceptions: preservationResult.summary.approvedExceptions + archiveResult.approvedExceptions,
      archiveDestructiveChanges: archiveResult.destructiveChanges,
      passed: preservationResult.passed && archiveResult.destructiveChanges === 0,
    },
    unaccountedAdditions: unaccounted,
    metrics,
    issues,
    passed,
  };
}
