import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArchiveYaml as parseYaml } from "../yaml.js";
import { loadArchive, repoRoot } from "../load.js";
import { sourceClaimLineageManifest } from "../historical/source-claim-lineage.js";
import { buildSourceClaimIndex, resolveLegacyHypothesisId } from "../historical/source-claim-registry.js";

async function main() {
  const query = process.argv.slice(2).find((a) => a !== "--");
  if (!query) {
    console.error("Bruk: pnpm data:source-claim -- <claimId | hypothesisId | sourceId#season-no>");
    process.exit(1);
  }

  const root = repoRoot();
  const archive = await loadArchive();

  let lineageManifest: any = undefined;
  const lineagePath = join(root, "data", "migrations", "source-claim-lineage.yaml");
  if (existsSync(lineagePath)) {
    const raw = await readFile(lineagePath, "utf8");
    const parsed = parseYaml(raw);
    const validated = sourceClaimLineageManifest.safeParse(parsed);
    if (validated.success) lineageManifest = validated.data;
  }

  const index = buildSourceClaimIndex(archive.sourceResults, lineageManifest);

  let claim = index.claimById.get(query);
  let resolvedVia = "direct_claim_id";

  if (!claim) {
    const res = resolveLegacyHypothesisId(query, index);
    if (res.status === "exact_current") {
      claim = res.claim;
      resolvedVia = `exact_current (${query})`;
    } else if (res.status === "superseded_coordinate_alias") {
      claim = res.claim;
      resolvedVia = `superseded_coordinate_alias (${query} -> ${claim.claimId} på ${res.currentCoordinate.season} #${res.currentCoordinate.no})`;
    } else if (res.status === "ambiguous_reused_coordinate") {
      console.log("════════════════════════════════════════════════════════════════════");
      console.log("⚠️  ADVARSEL: TVETYDIG GJENBRUK AV KILDEKOORDINAT");
      console.log("────────────────────────────────────────────────────────────────────");
      console.log(`Koordinatnavnet «${query}» refererer til forskjellige kildepåstander:`);
      if (res.currentClaim) {
        console.log("\nNÅVÆRENDE CLAIM:");
        console.log(`  claimId:           ${res.currentClaim.claimId}`);
        console.log(`  Posisjon:          ${res.currentClaim.season} #${res.currentClaim.id.split("-")[1]} (${res.currentClaim.opponent} ${res.currentClaim.aafkGoals !== null ? `${res.currentClaim.aafkGoals}–${res.currentClaim.opponentGoals}` : ""})`);
      }
      if (res.historicalClaims.length > 0) {
        console.log("\nHISTORISK(E) CLAIM(S) SOM TIDLIGERE HADDE DETTE KOORDINATET:");
        for (const hc of res.historicalClaims) {
          console.log(`  claimId:           ${hc.claimId}`);
          console.log(`  Nåværende posisjon: ${hc.season} #${hc.id.split("-")[1]} (${hc.opponent} ${hc.aafkGoals !== null ? `${hc.aafkGoals}–${hc.opponentGoals}` : ""})`);
        }
      }
      console.log("\nHandling: Oppgi spesifikk claimId (f.eks. pnpm data:source-claim -- srcclaim-...)");
      console.log("════════════════════════════════════════════════════════════════════");
      return;
    }
  }

  if (!claim) {
    console.error(`Fant ingen source-result claim for «${query}».`);
    process.exit(1);
  }

  const lineage = index.lineageByClaimId.get(claim.claimId);
  const canonicalMatch = claim.matchId
    ? archive.matches.find((m) => m.id === claim?.matchId)
    : undefined;

  console.log("════════════════════════════════════════════════════════════════════");
  console.log(`CLAIM IDENTITET:     ${claim.claimId}`);
  console.log(`Oppslag:             ${resolvedVia}`);
  console.log("────────────────────────────────────────────────────────────────────");
  console.log(`Kilde:               ${claim.sourceId}`);
  console.log(`Nåværende koordinat: ${claim.season} #${claim.id.split("-")[1] || claim.id} (Side ${claim.page})`);
  console.log(`Motstander:          ${claim.opponent} (${claim.opponentClubId || "uavklart"})`);
  console.log(`Resultat:            ${claim.aafkGoals !== null ? `${claim.aafkGoals}–${claim.opponentGoals}` : claim.status}`);
  console.log(`Status:              ${claim.status}`);
  if (claim.competitionId) console.log(`Konkurranse:         ${claim.competitionId}${claim.round ? ` (runde ${claim.round})` : ""}`);
  if (claim.extraTime) console.log(`Ekstraomganger:      ja`);
  if (claim.replay) console.log(`Omkamp:              ja`);
  if (claim.resultGroupId) console.log(`Resultatgruppe:      ${claim.resultGroupId}`);
  if (claim.note) console.log(`Kildenotat:          ${claim.note}`);

  if (canonicalMatch) {
    console.log("────────────────────────────────────────────────────────────────────");
    console.log(`Kanonisk kamp:       ${canonicalMatch.id} (${canonicalMatch.date})`);
    console.log(`Stilling:            ${canonicalMatch.home.score}–${canonicalMatch.away.score} (${canonicalMatch.home.clubId} vs ${canonicalMatch.away.clubId})`);
  } else {
    console.log("────────────────────────────────────────────────────────────────────");
    console.log("Kanonisk kamp:       Ingen koblet kampId");
  }

  if (lineage && lineage.coordinateHistory.length > 0) {
    console.log("────────────────────────────────────────────────────────────────────");
    console.log("KOORDINATHISTORIKK (Lineage):");
    for (const h of lineage.coordinateHistory) {
      console.log(`  - ${h.season} #${h.no} (gyldig til ${h.validUntil || "ukjent"}) -> Superseded by: ${h.supersededBy?.reason || "ukjent"} (PR ${h.supersededBy?.pr || "?"})`);
    }
    if (lineage.legacyHypothesisIds.length > 0) {
      console.log(`  - Gamle hypoteser: ${lineage.legacyHypothesisIds.join(", ")}`);
    }
  }

  console.log("════════════════════════════════════════════════════════════════════");
}

if (process.argv[1]?.includes("source-claim")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
