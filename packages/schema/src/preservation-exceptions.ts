import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { slug, sourceRef } from "./primitives.js";

/**
 * Gyldige endringstyper som kan unntas fra bevaringskontrollen.
 */
export const preservationChangeType = z.enum(["remove", "mutate", "delete_file"]);
export type PreservationChangeType = z.infer<typeof preservationChangeType>;

export const preservationExceptionEntity = z.enum([
  "person",
  "source",
  "source_result",
  "match",
  "observation",
  "organization_snapshot",
]);
export type PreservationExceptionEntity = z.infer<typeof preservationExceptionEntity>;

/**
 * En målrettet dispensasjon/unntak fra kravet om streng historisk additivitet.
 *
 * Brede wildcards (f.eks. «*», «roles/*», «people/*») er uttrykkelig forbudt
 * for å forhindre at hele kataloger eller personer mister bevaringsvernet.
 */
export const preservationException = z
  .object({
    entity: preservationExceptionEntity,
    id: slug,
    path: z
      .string()
      .min(1)
      .refine(
        (p) => !p.includes("*") && p !== "roles" && p !== "sources" && p !== "conflicts" && p !== "names",
        "brede wildcards eller overordnede arrays uten konkret ID er forbudt i unntak",
      ),
    change: preservationChangeType,
    reason: z.string().min(10, "begrunnelse må være meningsfull (minst 10 tegn)"),
    sources: z.array(sourceRef).default([]),
    approvedIn: z.union([z.string(), z.number()]).optional(),
  })
  .strict();

export type PreservationException = z.infer<typeof preservationException>;

export const preservationExceptionsFile = z
  .object({
    exceptions: z.array(preservationException).default([]),
  })
  .strict();

export type PreservationExceptionsFile = z.infer<typeof preservationExceptionsFile>;

/**
 * Parser og validerer innholdet i en unntaksfil.
 */
export function parsePreservationExceptions(rawText: string): PreservationException[] {
  const parsedYaml = parseYaml(rawText, { schema: "core" }) ?? {};
  return preservationExceptionsFile.parse(parsedYaml).exceptions;
}

/**
 * Leser og validerer unntaksfilen. Returnerer en tom liste dersom filen ikke eksisterer.
 */
export async function loadPreservationExceptions(
  dataDir: string,
  fileName = "preservation-exceptions.yaml",
): Promise<{ exceptions: PreservationException[]; fileFound: boolean }> {
  const filePath = join(dataDir, fileName);
  if (!existsSync(filePath)) {
    return { exceptions: [], fileFound: false };
  }

  const rawText = await readFile(filePath, "utf8");
  return { exceptions: parsePreservationExceptions(rawText), fileFound: true };
}

/**
 * Identiteten til et unntak — det som avgjør om to oppføringer gir samme
 * dispensasjon. Begrunnelse og kildehenvisninger kan endres uten at
 * dispensasjonen regnes som en annen.
 */
export function preservationExceptionKey(ex: PreservationException): string {
  const normalizedPath = ex.path.replace(/\[/g, "/").replace(/\]/g, "").replace(/\./g, "/");
  return `${ex.entity}|${ex.id}|${normalizedPath}|${ex.change}`;
}

export interface AuthorizedExceptionsResult {
  /** Unntak som fantes i BASE og dermed er godkjent utenfor denne endringen. */
  authorized: PreservationException[];
  /** Unntak som er lagt til i selve endringen, og som derfor ikke gjelder. */
  selfApproved: PreservationException[];
}

/**
 * Skiller godkjente unntak fra selvgodkjente.
 *
 * Et unntak gjelder bare dersom det allerede fantes i BASE. Uten dette kunne
 * samme commit både slette historikk og legge inn dispensasjonen som godkjenner
 * slettingen — porten ville hatt hengelåsen på innsiden. Et nytt unntak må
 * derfor inn via en egen endring som blir vurdert for seg.
 */
export function resolveAuthorizedExceptions(
  baseExceptions: PreservationException[],
  headExceptions: PreservationException[],
): AuthorizedExceptionsResult {
  const baseKeys = new Set(baseExceptions.map(preservationExceptionKey));
  const authorized: PreservationException[] = [];
  const selfApproved: PreservationException[] = [];

  for (const ex of headExceptions) {
    if (baseKeys.has(preservationExceptionKey(ex))) {
      authorized.push(ex);
    } else {
      selfApproved.push(ex);
    }
  }

  return { authorized, selfApproved };
}
