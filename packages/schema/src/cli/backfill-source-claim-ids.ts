import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { repoRoot } from "../load.js";
import {
  sourceClaimLineageManifest,
  type SourceClaimLineageItem,
  type SourceClaimLineageManifest,
} from "../historical/source-claim-lineage.js";

/**
 * Genererer et ugjennomsiktig (opaque), tilfeldig token for nye source-claims.
 *
 * Identiteten er bevisst IKKE avledet fra kildedata (som år, nr, motstander eller score),
 * slik at identiteten forblir stabil og uavhengig selv om kildekoordinater eller fakta korrigeres.
 */
export function generateOpaqueClaimId(): string {
  const token = randomBytes(16).toString("hex"); // 32 hex siffer (128 bit entropi)
  return `srcclaim-${token}`;
}

export interface BackfillResult {
  totalSourceResults: number;
  claimIdsCreated: number;
  claimIdsUnchanged: number;
  uniqueClaimIds: number;
  filesExamined: number;
  filesWritten: number;
  lineageClaimsCount: number;
  lineageFileWritten: boolean;
  duplicateClaimIds: string[];
}

export async function runSourceClaimBackfill(options: {
  apply?: boolean;
  dataDir?: string;
  migrationsDir?: string;
} = {}): Promise<BackfillResult> {
  const root = repoRoot();
  const targetDir = options.dataDir || join(root, "data", "source-results");
  const migrationsDir = options.migrationsDir || join(root, "data", "migrations");
  const isApply = Boolean(options.apply);

  let totalSourceResults = 0;
  let claimIdsCreated = 0;
  let claimIdsUnchanged = 0;
  let filesExamined = 0;
  let filesWritten = 0;
  let lineageFileWritten = false;

  const allAssignedIds = new Set<string>();
  const duplicates: string[] = [];

  // Kart for å finne gjeldende koordinater for hver claimId
  const currentCoordinateByClaimId = new Map<string, { sourceId: string; season: number; no: number }>();
  const claimIdByCoordinate = new Map<string, string>();

  if (!existsSync(targetDir)) {
    throw new Error(`Katalog finnes ikke: ${targetDir}`);
  }

  const fileNames = (await readdir(targetDir)).filter(
    (f) => f.endsWith(".yaml") || f.endsWith(".yml"),
  );

  const fileUpdates: Array<{ filePath: string; content: string; changed: boolean }> = [];

  for (const fileName of fileNames) {
    filesExamined += 1;
    const filePath = join(targetDir, fileName);
    const raw = await readFile(filePath, "utf8");
    const data = parseYaml(raw, { schema: "core" }) as any;
    if (!data || !Array.isArray(data.seasons)) continue;

    const sourceId = data.sourceId || fileName.replace(/\.ya?ml$/, "");
    let fileChanged = false;

    for (const season of data.seasons) {
      if (!Array.isArray(season.results)) continue;
      for (const result of season.results) {
        totalSourceResults += 1;
        let cid = result.claimId;

        if (cid && typeof cid === "string" && /^srcclaim-[a-f0-9]{32}$/.test(cid)) {
          claimIdsUnchanged += 1;
        } else {
          fileChanged = true;
          claimIdsCreated += 1;
          cid = generateOpaqueClaimId();
          while (allAssignedIds.has(cid)) {
            cid = generateOpaqueClaimId();
          }
          result.claimId = cid;
        }

        if (allAssignedIds.has(cid)) {
          duplicates.push(cid);
        }
        allAssignedIds.add(cid);

        currentCoordinateByClaimId.set(cid, {
          sourceId,
          season: season.year,
          no: result.no,
        });
        claimIdByCoordinate.set(`${sourceId}:${season.year}:${result.no}`, cid);
      }
    }

    if (fileChanged) {
      const updatedYaml = stringifyYaml(data, { indent: 2, lineWidth: 0 });
      fileUpdates.push({ filePath, content: updatedYaml, changed: true });
    } else {
      fileUpdates.push({ filePath, content: raw, changed: false });
    }
  }

  // Håndter Source Claim Lineage
  const lineagePath = join(migrationsDir, "source-claim-lineage.yaml");
  let existingLineage: SourceClaimLineageManifest | null = null;

  if (existsSync(lineagePath)) {
    try {
      const raw = await readFile(lineagePath, "utf8");
      const parsed = parseYaml(raw, { schema: "core" });
      existingLineage = sourceClaimLineageManifest.parse(parsed);
    } catch {
      // Fallback dersom eksisterende fil har gamle 48-bit IDs
      try {
        const raw = await readFile(lineagePath, "utf8");
        const parsed = parseYaml(raw, { schema: "core" }) as any;
        if (parsed && Array.isArray(parsed.claims)) {
          existingLineage = parsed;
        }
      } catch {
        existingLineage = null;
      }
    }
  }

  const lineageItems: SourceClaimLineageItem[] = [];

  if (existingLineage) {
    for (const item of existingLineage.claims) {
      const coordKey = `${item.sourceId}:${item.currentCoordinate.season}:${item.currentCoordinate.no}`;
      const matchedClaimId = claimIdByCoordinate.get(coordKey) || item.claimId;
      const curr = currentCoordinateByClaimId.get(matchedClaimId);
      if (curr) {
        const hypothesisId = `${curr.sourceId}#${curr.season}-${String(curr.no).padStart(3, "0")}`;
        lineageItems.push({
          ...item,
          claimId: matchedClaimId,
          sourceId: curr.sourceId,
          currentCoordinate: {
            season: curr.season,
            no: curr.no,
            hypothesisId,
          },
        });
      } else {
        lineageItems.push({
          ...item,
          claimId: matchedClaimId,
        });
      }
    }
  }

  const existingClaimsJson = existingLineage ? JSON.stringify(existingLineage.claims) : "";
  const newClaimsJson = JSON.stringify(lineageItems);
  const claimsEqual = existingClaimsJson !== "" && existingClaimsJson === newClaimsJson;

  const lineageManifest: SourceClaimLineageManifest = {
    contract: "source-claim-lineage@1",
    generatedAt: existingLineage?.generatedAt || "2026-08-22T12:00:00.000Z",
    claims: lineageItems,
  };

  if (isApply) {
    for (const update of fileUpdates) {
      if (update.changed) {
        await writeFile(update.filePath, update.content, "utf8");
        filesWritten += 1;
      }
    }

    if (!claimsEqual || !existsSync(lineagePath)) {
      if (!existsSync(migrationsDir)) {
        await mkdir(migrationsDir, { recursive: true });
      }
      const newYaml = stringifyYaml(lineageManifest, { indent: 2, lineWidth: 0 });
      await writeFile(lineagePath, newYaml, "utf8");
      lineageFileWritten = true;
      filesWritten += 1;
    }
  }

  return {
    totalSourceResults,
    claimIdsCreated,
    claimIdsUnchanged,
    uniqueClaimIds: allAssignedIds.size,
    filesExamined,
    filesWritten,
    lineageClaimsCount: lineageItems.length,
    lineageFileWritten,
    duplicateClaimIds: duplicates,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  console.log(`Source claim ID backfill (${apply ? "APPLY" : "DRY RUN"})...`);
  const res = await runSourceClaimBackfill({ apply });

  console.log(`\nResultater:`);
  console.log(`  Source results total:   ${res.totalSourceResults}`);
  console.log(`  Claim IDs created:      ${res.claimIdsCreated}`);
  console.log(`  Claim IDs unchanged:    ${res.claimIdsUnchanged}`);
  console.log(`  Unique claim IDs:       ${res.uniqueClaimIds}`);
  console.log(`  Duplicate claim IDs:    ${res.duplicateClaimIds.length}`);
  console.log(`  Files examined:         ${res.filesExamined}`);
  console.log(`  Files written:          ${res.filesWritten}`);
  console.log(`  Lineage file written:   ${res.lineageFileWritten}`);
  console.log(`  Lineage claims tracked: ${res.lineageClaimsCount}`);

  if (res.duplicateClaimIds.length > 0) {
    console.error(`\nFEIL: Fant duplikate claimId-er!`, res.duplicateClaimIds);
    process.exit(1);
  }

  if (!apply && res.claimIdsCreated > 0) {
    console.log(`\nKjør med --apply for å lagre endringene til disk.`);
  }
}

if (process.argv[1]?.includes("backfill-source-claim-ids")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
