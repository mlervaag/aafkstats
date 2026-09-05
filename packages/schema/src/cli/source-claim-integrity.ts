import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArchiveYaml as parseYaml } from "../yaml.js";
import { loadArchive, repoRoot } from "../load.js";
import { flattenSourceResults } from "../source-result.js";
import { sourceClaimLineageManifest } from "../historical/source-claim-lineage.js";
import { buildSourceClaimIndex } from "../historical/source-claim-registry.js";

export interface IntegrityReport {
  valid: boolean;
  totalSourceResults: number;
  totalUniqueClaimIds: number;
  missingClaimIds: number;
  duplicateClaimIds: string[];
  invalidFormatClaimIds: string[];
  lineageClaimsChecked: number;
  lineageErrors: string[];
  downstreamReferencesChecked: number;
  downstreamReferenceErrors: string[];
}

/**
 * Søker rekursivt etter alle forekomster av `sourceClaimId` i et vilkårlig JavaScript-objekt/array.
 */
function extractSourceClaimIds(obj: unknown, collected: string[] = []): string[] {
  if (!obj || typeof obj !== "object") return collected;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractSourceClaimIds(item, collected);
    }
    return collected;
  }

  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === "sourceClaimId" && typeof value === "string") {
      collected.push(value);
    } else if (key === "sourceClaimIds" && Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === "string") collected.push(v);
      }
    } else if (typeof value === "object" && value !== null) {
      extractSourceClaimIds(value, collected);
    }
  }

  return collected;
}

export async function runSourceClaimIntegrityCheck(): Promise<IntegrityReport> {
  const archive = await loadArchive();
  const root = repoRoot();

  const allClaims = archive.sourceResults.flatMap(flattenSourceResults);
  const totalSourceResults = allClaims.length;

  const claimIds = new Set<string>();
  const duplicateClaimIds: string[] = [];
  const invalidFormatClaimIds: string[] = [];
  let missingClaimIds = 0;

  const regex = /^srcclaim-[a-f0-9]{32}$/;

  for (const claim of allClaims) {
    const cid = claim.claimId;
    if (!cid || typeof cid !== "string") {
      missingClaimIds += 1;
      continue;
    }

    if (!regex.test(cid)) {
      invalidFormatClaimIds.push(`${claim.sourceId} ${claim.season} #${claim.id}: "${cid}"`);
    }

    if (claimIds.has(cid)) {
      duplicateClaimIds.push(`${claim.sourceId} ${claim.season} #${claim.id}: "${cid}"`);
    }
    claimIds.add(cid);
  }

  // Check Lineage manifest if present
  const lineagePath = join(root, "data", "migrations", "source-claim-lineage.yaml");
  let lineageClaimsChecked = 0;
  const lineageErrors: string[] = [];

  if (existsSync(lineagePath)) {
    const raw = await readFile(lineagePath, "utf8");
    const parsed = parseYaml(raw);
    const validated = sourceClaimLineageManifest.safeParse(parsed);
    if (!validated.success) {
      for (const err of validated.error.issues) {
        lineageErrors.push(`${err.path.join(".")}: ${err.message}`);
      }
    } else {
      lineageClaimsChecked = validated.data.claims.length;

      const index = buildSourceClaimIndex(archive.sourceResults, validated.data);

      for (const item of validated.data.claims) {
        const foundClaim = index.claimById.get(item.claimId);
        if (!foundClaim) {
          lineageErrors.push(`Lineage claim «${item.claimId}» finnes ikke i arkivets source-results`);
          continue;
        }

        // Verify currentCoordinate matches actual source-result
        const orderNo = parseInt(foundClaim.id.split("-")[1] || "0", 10);
        if (
          foundClaim.sourceId !== item.sourceId ||
          foundClaim.season !== item.currentCoordinate.season ||
          orderNo !== item.currentCoordinate.no
        ) {
          lineageErrors.push(
            `Lineage currentCoordinate ${item.sourceId} ${item.currentCoordinate.season} #${item.currentCoordinate.no} matcher ikke faktisk claim ${foundClaim.sourceId} ${foundClaim.season} #${foundClaim.id}`,
          );
        }
      }
    }
  }

  // Downstream Reference Integrity Checks across Discovery, Verification Cases & Harvests
  let downstreamReferencesChecked = 0;
  const downstreamReferenceErrors: string[] = [];

  // 1. Check discovery artifacts in data/discovery/
  const discoveryDir = join(root, "data", "discovery");
  if (existsSync(discoveryDir)) {
    const files = (await readdir(discoveryDir)).filter(
      (f) => (f.endsWith(".yaml") || f.endsWith(".yml")) && !f.startsWith("tmp-"),
    );
    for (const file of files) {
      const filePath = join(discoveryDir, file);
      if (!existsSync(filePath)) continue;
      try {
        const raw = await readFile(filePath, "utf8");
        const data = parseYaml(raw);
        const extracted = extractSourceClaimIds(data);
        for (const cid of extracted) {
          downstreamReferencesChecked += 1;
          if (!claimIds.has(cid)) {
            downstreamReferenceErrors.push(
              `Discovery fil ${file}: sourceClaimId «${cid}» finnes ikke i arkivets kildedata`,
            );
          }
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          downstreamReferenceErrors.push(`Kunne ikke parse discovery-fil ${file}: ${(err as Error).message}`);
        }
      }
    }
  }

  // 2. Check verification cases in data/verification-cases/
  const verificationCasesDir = join(root, "data", "verification-cases");
  if (existsSync(verificationCasesDir)) {
    const files = (await readdir(verificationCasesDir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
    for (const file of files) {
      const filePath = join(verificationCasesDir, file);
      const raw = await readFile(filePath, "utf8");
      try {
        const data = parseYaml(raw);
        const extracted = extractSourceClaimIds(data);
        for (const cid of extracted) {
          downstreamReferencesChecked += 1;
          if (!claimIds.has(cid)) {
            downstreamReferenceErrors.push(
              `Verification case ${file}: sourceClaimId «${cid}» finnes ikke i arkivet`,
            );
          }
        }
      } catch (err) {
        downstreamReferenceErrors.push(`Kunne ikke parse verification case ${file}: ${(err as Error).message}`);
      }
    }
  }

  // 3. Check harvest batch manifests in data/harvests/
  const harvestsDir = join(root, "data", "harvests");
  if (existsSync(harvestsDir)) {
    const harvestFiles = (await readdir(harvestsDir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
    for (const hFile of harvestFiles) {
      const filePath = join(harvestsDir, hFile);
      const raw = await readFile(filePath, "utf8");
      try {
        const data = parseYaml(raw);
        const extracted = extractSourceClaimIds(data);
        for (const cid of extracted) {
          downstreamReferencesChecked += 1;
          if (!claimIds.has(cid)) {
            downstreamReferenceErrors.push(
              `Harvest manifest ${hFile}: sourceClaimId «${cid}» finnes ikke i arkivet`,
            );
          }
        }
      } catch (err) {
        downstreamReferenceErrors.push(`Kunne ikke parse harvest-fil ${hFile}: ${(err as Error).message}`);
      }
    }
  }

  const valid =
    missingClaimIds === 0 &&
    duplicateClaimIds.length === 0 &&
    invalidFormatClaimIds.length === 0 &&
    lineageErrors.length === 0 &&
    downstreamReferenceErrors.length === 0;

  return {
    valid,
    totalSourceResults,
    totalUniqueClaimIds: claimIds.size,
    missingClaimIds,
    duplicateClaimIds,
    invalidFormatClaimIds,
    lineageClaimsChecked,
    lineageErrors,
    downstreamReferencesChecked,
    downstreamReferenceErrors,
  };
}

async function main() {
  console.log("Kjører integritetssjekk for source-result claim-identiteter...\n");
  const report = await runSourceClaimIntegrityCheck();

  console.log(`Source results total:           ${report.totalSourceResults}`);
  console.log(`Unique claim IDs:               ${report.totalUniqueClaimIds}`);
  console.log(`Missing claim IDs:              ${report.missingClaimIds}`);
  console.log(`Duplicate claim IDs:            ${report.duplicateClaimIds.length}`);
  console.log(`Invalid format claim IDs:       ${report.invalidFormatClaimIds.length}`);
  console.log(`Lineage claims checked:         ${report.lineageClaimsChecked}`);
  console.log(`Lineage errors:                 ${report.lineageErrors.length}`);
  console.log(`Downstream references checked:  ${report.downstreamReferencesChecked}`);
  console.log(`Downstream reference errors:    ${report.downstreamReferenceErrors.length}`);

  if (!report.valid) {
    if (report.duplicateClaimIds.length > 0) {
      console.error("\nDuplikate claim IDs:", report.duplicateClaimIds);
    }
    if (report.invalidFormatClaimIds.length > 0) {
      console.error("\nUgyldig format claim IDs:", report.invalidFormatClaimIds);
    }
    if (report.lineageErrors.length > 0) {
      console.error("\nLineage-feil:", report.lineageErrors);
    }
    if (report.downstreamReferenceErrors.length > 0) {
      console.error("\nDownstream-referansefeil:", report.downstreamReferenceErrors);
    }
    process.exit(1);
  }

  console.log("\n✓ PASS – Alle source-result claim-identiteter, lineage og downstream-referanser er gyldige og konsistente.");
}

if (process.argv[1]?.includes("source-claim-integrity")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
