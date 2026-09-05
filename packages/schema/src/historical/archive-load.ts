import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArchiveYaml as parseYaml } from "../yaml.js";
import {
  parsePreservationExceptions,
  resolveAuthorizedExceptions,
  type AuthorizedExceptionsResult,
  type PreservationException,
} from "../preservation-exceptions.js";
import { listYamlFiles, readFileFromGit, readFilesBatchFromGit } from "./git.js";
import { ARCHIVE_DOMAIN_SPECS, type ArchivePreservationInput } from "./archive-preservation.js";

export const PRESERVATION_EXCEPTIONS_PATH = "data/preservation-exceptions.yaml";

/**
 * Leser rå YAML fra en katalog under en git-ref eller fra arbeidstreet, nøklet
 * på entitets-ID.
 *
 * Bevisst uten skjemavalidering: bevaringskontrollen skal verne data som ble
 * skrevet under et tidligere skjema like godt som data som validerer i dag.
 */
export async function loadRawYamlById(
  ref: string | "working-tree" | null,
  relativeDir: string,
  repoRoot: string,
  filterFile?: (file: string) => boolean,
): Promise<Map<string, unknown>> {
  let files = await listYamlFiles(ref, relativeDir, repoRoot);
  if (filterFile) files = files.filter(filterFile);

  const contents = new Map<string, string>();
  if (!ref || ref === "working-tree") {
    for (const file of files) {
      const fullPath = join(repoRoot, file);
      if (existsSync(fullPath)) {
        contents.set(file, await readFile(fullPath, "utf8"));
      }
    }
  } else {
    const batch = await readFilesBatchFromGit(ref, files, repoRoot);
    for (const [file, content] of batch) contents.set(file, content);
  }

  const out = new Map<string, unknown>();
  for (const [file, text] of contents) {
    let raw: unknown;
    try {
      raw = parseYaml(text);
    } catch {
      // En fil som ikke lar seg parse kan ikke sammenlignes strukturelt.
      // `pnpm validate` fanger dette separat og med bedre feilmelding.
      continue;
    }
    const fallbackId = basename(file).replace(/\.ya?ml$/, "");
    const id =
      raw !== null && typeof raw === "object" && !Array.isArray(raw)
        ? ((raw as { id?: unknown }).id !== undefined ? String((raw as { id?: unknown }).id) : fallbackId)
        : fallbackId;
    out.set(id, raw);
  }

  return out;
}

/**
 * Laster rådata for samtlige vernede arkivdomener fra BASE og HEAD.
 */
export async function loadArchiveDomains(
  baseRef: string,
  headRef: string | "working-tree",
  repoRoot: string,
): Promise<ArchivePreservationInput[]> {
  const inputs: ArchivePreservationInput[] = [];
  for (const spec of ARCHIVE_DOMAIN_SPECS) {
    const [base, head] = await Promise.all([
      loadRawYamlById(baseRef, spec.dir, repoRoot, spec.filterFile),
      loadRawYamlById(headRef === "working-tree" ? null : headRef, spec.dir, repoRoot, spec.filterFile),
    ]);
    inputs.push({ domain: spec.domain, base, head });
  }
  return inputs;
}

/**
 * Laster unntaksfilen fra både BASE og HEAD og avgjør hvilke unntak som faktisk
 * gjelder. Unntak som først dukker opp i HEAD er selvgodkjente og teller ikke.
 */
export async function loadAuthorizedExceptions(
  baseRef: string,
  headRef: string | "working-tree",
  repoRoot: string,
): Promise<AuthorizedExceptionsResult & { baseFileFound: boolean }> {
  const baseText = await readFileFromGit(baseRef, PRESERVATION_EXCEPTIONS_PATH, repoRoot);

  let headText: string | null;
  if (headRef === "working-tree") {
    const fullPath = join(repoRoot, PRESERVATION_EXCEPTIONS_PATH);
    headText = existsSync(fullPath) ? await readFile(fullPath, "utf8") : null;
  } else {
    headText = await readFileFromGit(headRef, PRESERVATION_EXCEPTIONS_PATH, repoRoot);
  }

  const baseExceptions: PreservationException[] = baseText ? parsePreservationExceptions(baseText) : [];
  const headExceptions: PreservationException[] = headText ? parsePreservationExceptions(headText) : [];

  return {
    ...resolveAuthorizedExceptions(baseExceptions, headExceptions),
    baseFileFound: baseText !== null,
  };
}

/**
 * Laster deklarerte koordinat-migreringsmanifester fra data/discovery/.
 */
export async function loadCoordinateMigrations(
  headRef: string | "working-tree",
  repoRoot: string,
): Promise<any[]> {
  const dir = "data/discovery";
  const files = await listYamlFiles(headRef === "working-tree" ? null : headRef, dir, repoRoot);
  const manifests: any[] = [];

  for (const file of files) {
    let rawText: string | null = null;
    if (headRef === "working-tree") {
      const fullPath = join(repoRoot, file);
      if (existsSync(fullPath)) {
        rawText = await readFile(fullPath, "utf8");
      }
    } else {
      rawText = await readFileFromGit(headRef, file, repoRoot);
    }
    if (!rawText) continue;

    try {
      const doc = parseYaml(rawText) as any;
      if (
        doc &&
        typeof doc === "object" &&
        (doc.contract?.includes("year-shift-repair") ||
          doc.contract?.includes("source-coordinate-migration") ||
          (Array.isArray(doc.movedItems) && Array.isArray(doc.renumberedItems)))
      ) {
        manifests.push(doc);
      }
    } catch {
      // Ignorer uleselig YAML her
    }
  }

  return manifests;
}
