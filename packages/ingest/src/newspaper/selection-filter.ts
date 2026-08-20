import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { PlannedHypothesis } from "./source-result-query.js";

export interface SelectionFilterOptions {
  hypothesisIds?: string[];
  hypothesisIdsFile?: string;
  groupKeys?: string[];
}

/**
 * Leser hypothesisId-er fra en fil (YAML-array, JSON-array eller én ID per linje).
 * Sjekker for duplikater i filen.
 */
export async function readHypothesisIdsFile(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, "utf8");
  const trimmed = content.trim();

  let ids: string[] = [];
  if (trimmed.startsWith("[") || trimmed.startsWith("-")) {
    const parsed = parseYaml(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error(`Filen ${filePath} må inneholde en liste over hypothesisId-er.`);
    }
    ids = parsed.map((item) => String(item).trim()).filter(Boolean);
  } else {
    ids = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  }

  return ids;
}

/**
 * Validerer og filtrerer en liste over kamphypoteser basert på id-er og gruppenøkler.
 * Kaster feil ved duplikate ID-er eller ukjente ID-er / gruppenøkler.
 */
export function filterHypotheses(
  population: PlannedHypothesis[],
  options: SelectionFilterOptions,
): PlannedHypothesis[] {
  const populationById = new Map(population.map((h) => [h.hypothesis.id, h]));
  const populationGroups = new Set(population.map((h) => h.groupKey));

  let filtered = [...population];

  if (options.groupKeys && options.groupKeys.length > 0) {
    const unknownGroups = options.groupKeys.filter((k) => !populationGroups.has(k));
    if (unknownGroups.length > 0) {
      throw new Error(`Ukjente groupKey-er oppgitt: ${unknownGroups.join(", ")}`);
    }
    const groupSet = new Set(options.groupKeys);
    filtered = filtered.filter((h) => groupSet.has(h.groupKey));
  }

  const requestedIds = [
    ...(options.hypothesisIds ?? []),
  ];

  if (requestedIds.length > 0) {
    // Sjekk duplikater blant oppgitte ID-er
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const id of requestedIds) {
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    if (duplicates.size > 0) {
      throw new Error(`Dupliserte hypothesisId-er oppgitt: ${[...duplicates].join(", ")}`);
    }

    // Sjekk at alle ID-er finnes i populasjonen
    const unknownIds = requestedIds.filter((id) => !populationById.has(id));
    if (unknownIds.length > 0) {
      throw new Error(`Ukjente hypothesisId-er oppgitt: ${unknownIds.join(", ")}`);
    }

    const idSet = new Set(requestedIds);
    filtered = filtered.filter((h) => idSet.has(h.hypothesis.id));
  }

  return filtered;
}
