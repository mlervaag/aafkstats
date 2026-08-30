import { person } from "../person.js";
import type { PreservationException } from "../preservation-exceptions.js";
import { loadYamlMap } from "./git.js";
import { runPreservationAudit, type PreservationChangeDetail, type PreservationAuditResult } from "./preservation.js";
import { runArchivePreservationAudit } from "./archive-preservation.js";
import { loadArchiveDomains, loadAuthorizedExceptions, loadCoordinateMigrations } from "./archive-load.js";

export interface FullPreservationSummary {
  peopleChecked: number;
  existingPeopleChanged: number;
  newPeopleAdded: number;
  peopleDeleted: number;
  archiveEntitiesChecked: number;
  archiveFilesDeleted: number;
  additions: number;
  safeEnrichments: number;
  reviewRequired: number;
  approvedExceptions: number;
  approvedCoordinateMigrations: number;
  approvedMatchMoves: number;
  destructiveChanges: number;
  staleExceptions: PreservationException[];
  selfApprovedExceptions: PreservationException[];
}

export interface FullPreservationResult {
  baseRef: string;
  headRef: string;
  passed: boolean;
  summary: FullPreservationSummary;
  changes: PreservationChangeDetail[];
  /** Delresultatet for `data/people/`, for konsumenter som bare trenger det. */
  people: PreservationAuditResult;
}

/**
 * Kjører komplett bevaringskontroll: den semantiske personmotoren pluss den
 * generiske strukturkontrollen over resten av arkivet, med unntak som må være
 * godkjent i BASE, og maskinelt verifiserte koordinatmigreringer.
 */
export async function runFullPreservationAudit(
  baseSha: string,
  headRef: string | "working-tree",
  headSha: string,
  repoRoot: string,
): Promise<FullPreservationResult> {
  const { authorized, selfApproved } = await loadAuthorizedExceptions(baseSha, headRef, repoRoot);
  const migrations = await loadCoordinateMigrations(headRef, repoRoot);

  const basePeopleLoad = await loadYamlMap(baseSha, "data/people", person, repoRoot);
  const headPeopleLoad = await loadYamlMap(
    headRef === "working-tree" ? null : headSha,
    "data/people",
    person,
    repoRoot,
  );

  const loadErrors = [...basePeopleLoad.errors, ...headPeopleLoad.errors];
  if (loadErrors.length > 0) {
    throw new Error(
      `Person-skjemafeil:\n${loadErrors.map((e) => `  ${e.file}: ${e.message}`).join("\n")}`,
    );
  }

  const peopleResult = runPreservationAudit(
    basePeopleLoad.items,
    headPeopleLoad.items,
    authorized,
    baseSha,
    headSha,
  );

  const archiveInputs = await loadArchiveDomains(baseSha, headRef, repoRoot);
  const archiveResult = runArchivePreservationAudit(archiveInputs, authorized, migrations);

  const changes = [...peopleResult.changes, ...archiveResult.changes];

  // Et unntak er «stale» først når verken personmotoren eller arkivkontrollen
  // fant en endring det dekker.
  const staleExceptions = authorized.filter(
    (ex) => peopleResult.summary.staleExceptions.includes(ex) && !archiveResult.usedExceptions.has(ex),
  );

  const destructiveChanges =
    peopleResult.summary.destructiveChanges + archiveResult.destructiveChanges;

  const summary: FullPreservationSummary = {
    peopleChecked: peopleResult.summary.peopleChecked,
    existingPeopleChanged: peopleResult.summary.existingPeopleChanged,
    newPeopleAdded: peopleResult.summary.newPeopleAdded,
    peopleDeleted: peopleResult.summary.peopleDeleted,
    archiveEntitiesChecked: archiveResult.entitiesChecked,
    archiveFilesDeleted: archiveResult.filesDeleted,
    additions: peopleResult.summary.additions,
    safeEnrichments: peopleResult.summary.safeEnrichments,
    reviewRequired: peopleResult.summary.reviewRequired,
    approvedExceptions: peopleResult.summary.approvedExceptions + archiveResult.approvedExceptions,
    approvedCoordinateMigrations: archiveResult.approvedCoordinateMigrations,
    approvedMatchMoves: archiveResult.approvedMatchMoves,
    destructiveChanges,
    staleExceptions,
    selfApprovedExceptions: selfApproved,
  };

  // Selvgodkjente unntak feller kjøringen uansett. Ellers ville en agent kunne
  // legge inn dispensasjonen og bruke den i samme commit.
  const passed = destructiveChanges === 0 && selfApproved.length === 0;

  return {
    baseRef: baseSha,
    headRef: headSha,
    passed,
    summary,
    changes,
    people: peopleResult,
  };
}
