import type { SourceResult, SourceResultCollection } from "../source-result.js";
import { flattenSourceResults } from "../source-result.js";
import type { SourceClaimLineageItem, SourceClaimLineageManifest } from "./source-claim-lineage.js";

export interface SourceClaimIndex {
  claimById: Map<string, SourceResult>;
  claimByCoordinate: Map<string, SourceResult>; // `${sourceId}:${season}:${no}`
  currentHypothesisToClaimId: Map<string, string>; // `${sourceId}#${season}-${String(no).padStart(3, "0")}`
  historicalHypothesisToClaimIds: Map<string, Set<string>>; // hypothesisId -> Set of claimIds that historically held this coordinate
  lineageByClaimId: Map<string, SourceClaimLineageItem>;
}

export function buildSourceClaimIndex(
  collections: SourceResultCollection[],
  lineageManifest?: SourceClaimLineageManifest,
): SourceClaimIndex {
  const claimById = new Map<string, SourceResult>();
  const claimByCoordinate = new Map<string, SourceResult>();
  const currentHypothesisToClaimId = new Map<string, string>();
  const historicalHypothesisToClaimIds = new Map<string, Set<string>>();
  const lineageByClaimId = new Map<string, SourceClaimLineageItem>();

  for (const collection of collections) {
    const flat = flattenSourceResults(collection);
    for (const r of flat) {
      if (r.claimId) {
        claimById.set(r.claimId, r);
      }
    }
    // Indekser etter gjeldende sesong og nummer
    for (const season of collection.seasons) {
      for (const res of season.results) {
        const coordKey = `${collection.sourceId}:${season.year}:${res.no}`;
        const flatItem = flat.find((f) => f.season === season.year && f.claimId === res.claimId);
        if (flatItem && res.claimId) {
          claimByCoordinate.set(coordKey, flatItem);
          const currentHypothesisId = `${collection.sourceId}#${season.year}-${String(res.no).padStart(3, "0")}`;
          currentHypothesisToClaimId.set(currentHypothesisId, res.claimId);
        }
      }
    }
  }

  if (lineageManifest) {
    for (const item of lineageManifest.claims) {
      lineageByClaimId.set(item.claimId, item);
      for (const hist of item.coordinateHistory) {
        const oldCoordHypothesis = `${item.sourceId}#${hist.season}-${String(hist.no).padStart(3, "0")}`;
        if (!historicalHypothesisToClaimIds.has(oldCoordHypothesis)) {
          historicalHypothesisToClaimIds.set(oldCoordHypothesis, new Set());
        }
        historicalHypothesisToClaimIds.get(oldCoordHypothesis)!.add(item.claimId);

        const oldCoordKey = `${item.sourceId}:${hist.season}:${hist.no}`;
        if (!historicalHypothesisToClaimIds.has(oldCoordKey)) {
          historicalHypothesisToClaimIds.set(oldCoordKey, new Set());
        }
        historicalHypothesisToClaimIds.get(oldCoordKey)!.add(item.claimId);
      }
      for (const legacyHyp of item.legacyHypothesisIds) {
        if (!historicalHypothesisToClaimIds.has(legacyHyp)) {
          historicalHypothesisToClaimIds.set(legacyHyp, new Set());
        }
        historicalHypothesisToClaimIds.get(legacyHyp)!.add(item.claimId);
      }
    }
  }

  return {
    claimById,
    claimByCoordinate,
    currentHypothesisToClaimId,
    historicalHypothesisToClaimIds,
    lineageByClaimId,
  };
}

export function resolveSourceClaimById(
  claimId: string,
  index: SourceClaimIndex,
): SourceResult | undefined {
  return index.claimById.get(claimId);
}

export function resolveSourceClaim(
  coordinate: { sourceId: string; season: number; no: number },
  index: SourceClaimIndex,
): SourceResult | undefined {
  const key = `${coordinate.sourceId}:${coordinate.season}:${coordinate.no}`;
  const direct = index.claimByCoordinate.get(key);
  if (direct) return direct;

  const historicalClaimIds = index.historicalHypothesisToClaimIds.get(key);
  if (historicalClaimIds && historicalClaimIds.size === 1) {
    const cid = Array.from(historicalClaimIds)[0]!;
    return index.claimById.get(cid);
  }
  return undefined;
}

export type HypothesisResolutionResult =
  | { status: "exact_current"; claimId: string; claim: SourceResult }
  | {
      status: "superseded_coordinate_alias";
      claimId: string;
      claim: SourceResult;
      currentCoordinate: { season: number; no: number };
    }
  | {
      status: "ambiguous_reused_coordinate";
      hypothesisId: string;
      currentClaim?: SourceResult;
      historicalClaims: SourceResult[];
      message: string;
    }
  | { status: "not_found" };

/**
 * Løser opp en eldre koordinatstreng / hypotesestreng.
 *
 * Dersom samme koordinatstreng både er nåværende koordinat for én claim og
 * historisk koordinat for en annen claim (som f.eks. Medlemsblad 1965 #1955-001),
 * returneres eksplisitt status «ambiguous_reused_coordinate». Den skal aldri gjette.
 */
export function resolveLegacyHypothesisId(
  hypothesisId: string,
  index: SourceClaimIndex,
): HypothesisResolutionResult {
  const currentClaimId = index.currentHypothesisToClaimId.get(hypothesisId);
  const historicalClaimIds = index.historicalHypothesisToClaimIds.get(hypothesisId);

  const currentClaim = currentClaimId ? index.claimById.get(currentClaimId) : undefined;
  const historicalClaims: SourceResult[] = [];
  if (historicalClaimIds) {
    for (const cid of historicalClaimIds) {
      if (cid !== currentClaimId) {
        const c = index.claimById.get(cid);
        if (c) historicalClaims.push(c);
      }
    }
  }

  // Tvetydig gjenbruk: koordinatnavnet betyr to forskjellige kildepåstander avhengig av tidspunkt
  if (currentClaim && historicalClaims.length > 0) {
    return {
      status: "ambiguous_reused_coordinate",
      hypothesisId,
      currentClaim,
      historicalClaims,
      message: `Dette koordinatnavnet («${hypothesisId}») er gjenbrukt og tvetydig. Bruk permanent claimId for entydig oppslag.`,
    };
  }

  if (currentClaim && (!historicalClaimIds || historicalClaims.length === 0)) {
    return {
      status: "exact_current",
      claimId: currentClaim.claimId,
      claim: currentClaim,
    };
  }

  if (!currentClaim && historicalClaims.length === 1) {
    const singleHistorical = historicalClaims[0]!;
    const lineage = index.lineageByClaimId.get(singleHistorical.claimId);
    const currentNo = lineage?.currentCoordinate.no ?? parseInt(singleHistorical.id.split("-")[1] || "1", 10);
    return {
      status: "superseded_coordinate_alias",
      claimId: singleHistorical.claimId,
      claim: singleHistorical,
      currentCoordinate: {
        season: singleHistorical.season,
        no: currentNo,
      },
    };
  }

  if (!currentClaim && historicalClaims.length > 1) {
    return {
      status: "ambiguous_reused_coordinate",
      hypothesisId,
      historicalClaims,
      message: `Flere historiske claims har hatt dette koordinatet. Bruk claimId for entydig oppslag.`,
    };
  }

  return { status: "not_found" };
}

export type ReviewValidityOutcome =
  | "valid"
  | "coordinate_changed_but_semantics_unchanged"
  | "requires_revalidation"
  | "superseded"
  | "invalid";

export function evaluateReviewValidityAgainstCurrentClaim(
  review: {
    sourceClaimId?: string;
    hypothesisId?: string;
    sourceCoordinateAtReview?: { season: number; no: number };
  },
  currentClaim: SourceResult,
): { validity: ReviewValidityOutcome; reason?: string } {
  if (review.sourceClaimId && review.sourceClaimId !== currentClaim.claimId) {
    return {
      validity: "invalid",
      reason: `Review peker til claimId «${review.sourceClaimId}», men mottatt claim har «${currentClaim.claimId}»`,
    };
  }

  const reviewSeason = review.sourceCoordinateAtReview?.season;
  const reviewNo = review.sourceCoordinateAtReview?.no;

  if (reviewSeason !== undefined && reviewSeason !== currentClaim.season) {
    return {
      validity: "requires_revalidation",
      reason: `Sesong endret fra ${reviewSeason} til ${currentClaim.season}. Årsskifte krever ny visuell validering av temporalt kontekstgrunnlag.`,
    };
  }

  if (reviewNo !== undefined && reviewNo !== parseInt(currentClaim.id.split("-")[1] || "0", 10)) {
    return {
      validity: "coordinate_changed_but_semantics_unchanged",
      reason: `Rekkefølgenummer endret fra #${reviewNo} til #${currentClaim.id.split("-")[1]} innen samme sesong ${currentClaim.season}.`,
    };
  }

  return { validity: "valid" };
}
