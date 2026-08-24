import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import { buildDatelessCanonicalPlan } from "../../ingest/src/cli/nb-dateless-canonical-review.js";
import { loadArchive, repoRoot } from "../src/load.js";
import { flattenSourceResults } from "../src/source-result.js";

const manifestPath = `${repoRoot()}/data/discovery/nb-dateless-canonical-review-1950-1971.yaml`;

describe("datoløs canonical review", () => {
  it("avstemmer alle tre avgrensede arbeidsstrømmene", async () => {
    const raw = await readFile(manifestPath, "utf8");
    const manifest = parseYaml(raw, { schema: "core" }) as any;
    expect(manifest.contract).toBe("nb-dateless-canonical-review@1");
    expect(manifest.decisionGate).toBe("NB_DATELESS_CANONICAL_REVIEW_CLOSED");
    expect(manifest.existingMatchReconciliation.safeLinks).toHaveLength(24);
    expect(manifest.existingMatchReconciliation.blocked).toHaveLength(4);
    expect(manifest.dateReviews).toHaveLength(2);
    expect(manifest.facsimilePilot.units).toHaveLength(10);
    expect(manifest.facsimilePilot.units.flatMap((unit: any) => unit.sourceClaimIds)).toHaveLength(13);
    expect(manifest.facsimilePilot.result).toMatchObject({ canonicalReady: 1, stopped: true, remainingCandidateClaimsNotReviewed: 41 });
    expect(raw).not.toMatch(/^\s+quote:/mu);
  });

  it("har brukt alle sikre actions og er idempotent", async () => {
    const plan = await buildDatelessCanonicalPlan();
    expect(plan.counts).toEqual({ linksCreated: 0, matchesCreated: 0, observationsCreated: 0, filesWritten: 0 });

    const archive = await loadArchive();
    const byClaim = new Map(archive.sourceResults.flatMap(flattenSourceResults).map((result) => [result.claimId, result]));
    for (const item of plan.safeLinks) expect(byClaim.get(item.sourceClaimId)?.matchId).toBe(item.targetMatchId);
    for (const item of plan.blocked) expect(byClaim.get(item.sourceClaimId)?.matchId).toBeNull();
    expect(archive.matches.some((match) => match.id === "1959-04-07-aalesunds-fk-guard")).toBe(true);
  }, 60_000);
});
