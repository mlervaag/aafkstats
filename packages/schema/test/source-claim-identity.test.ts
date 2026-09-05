import { createHash } from "node:crypto";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseArchiveYaml as parseYaml } from "../src/yaml.js";
import { loadArchive, repoRoot, type Archive } from "../src/load.js";
import { flattenSourceResults, sourceResultCollection } from "../src/source-result.js";
import {
  sourceClaimLineageManifest,
  type SourceClaimLineageManifest,
} from "../src/historical/source-claim-lineage.js";
import {
  buildSourceClaimIndex,
  evaluateReviewValidityAgainstCurrentClaim,
  resolveLegacyHypothesisId,
  resolveSourceClaim,
  resolveSourceClaimById,
  type SourceClaimIndex,
} from "../src/historical/source-claim-registry.js";
import { runSourceClaimBackfill } from "../src/cli/backfill-source-claim-ids.js";
import { runSourceClaimIntegrityCheck } from "../src/cli/source-claim-integrity.js";
import { diffStructuralAdditivity } from "../src/historical/archive-preservation.js";
import { newspaperVerificationCandidateManifest } from "../src/newspaper-verification-candidates.js";
import { verificationCaseInput } from "../src/verification-case.js";

describe("Source Claim Stable Identity & Lineage (PR #207)", () => {
  let archive: Archive;
  let index: SourceClaimIndex;
  let lineageManifest: SourceClaimLineageManifest;

  beforeAll(async () => {
    archive = await loadArchive();
    const root = repoRoot();
    const raw = await readFile(
      join(root, "data", "migrations", "source-claim-lineage.yaml"),
      "utf8",
    );
    lineageManifest = sourceClaimLineageManifest.parse(parseYaml(raw));
    index = buildSourceClaimIndex(archive.sourceResults, lineageManifest);
  }, 60_000);

  it("TEST A: Alle 2149 kilderesultater har gyldig, unik 128-bit claimId (32 hex-siffer) i arkivet", () => {
    const allClaims = archive.sourceResults.flatMap(flattenSourceResults);
    expect(allClaims).toHaveLength(2149);

    const claimIds = new Set<string>();
    const regex = /^srcclaim-[a-f0-9]{32}$/;

    for (const claim of allClaims) {
      expect(claim.claimId).toBeDefined();
      expect(regex.test(claim.claimId)).toBe(true);
      expect(claimIds.has(claim.claimId)).toBe(false);
      claimIds.add(claim.claimId);
    }

    expect(claimIds.size).toBe(2149);
  });

  it("TEST B: Backfill-verktøyet er reelt idempotent ved dobbel --apply i temp-katalog", async () => {
    const root = repoRoot();
    const tmpBase = await mkdtemp(join(tmpdir(), "aafk-claim-idempotency-"));
    const tmpSourceResults = join(tmpBase, "source-results");
    const tmpMigrations = join(tmpBase, "migrations");

    try {
      await cp(join(root, "data", "source-results"), tmpSourceResults, { recursive: true });
      await cp(join(root, "data", "migrations"), tmpMigrations, { recursive: true });

      // Apply #1: allerede backfillet katalog
      const res1 = await runSourceClaimBackfill({
        apply: true,
        dataDir: tmpSourceResults,
        migrationsDir: tmpMigrations,
      });

      expect(res1.totalSourceResults).toBe(2149);
      expect(res1.claimIdsCreated).toBe(0);
      expect(res1.claimIdsUnchanged).toBe(2149);
      expect(res1.uniqueClaimIds).toBe(2149);
      expect(res1.filesWritten).toBe(0);
      expect(res1.lineageFileWritten).toBe(false);

      // Beregn SHA-256 for samtlige filer etter run 1
      const fileHashesRun1 = new Map<string, string>();
      const files = await readdir(tmpSourceResults);
      for (const f of files) {
        const content = await readFile(join(tmpSourceResults, f));
        const hash = createHash("sha256").update(content).digest("hex");
        fileHashesRun1.set(f, hash);
      }
      const lineageContent1 = await readFile(join(tmpMigrations, "source-claim-lineage.yaml"));
      const lineageHash1 = createHash("sha256").update(lineageContent1).digest("hex");

      // Apply #2: andre kjøring
      const res2 = await runSourceClaimBackfill({
        apply: true,
        dataDir: tmpSourceResults,
        migrationsDir: tmpMigrations,
      });

      expect(res2.totalSourceResults).toBe(2149);
      expect(res2.claimIdsCreated).toBe(0);
      expect(res2.claimIdsUnchanged).toBe(2149);
      expect(res2.uniqueClaimIds).toBe(2149);
      expect(res2.filesWritten).toBe(0);
      expect(res2.lineageFileWritten).toBe(false);

      // Verifiser byte-for-byte likhet for samtlige filer
      for (const f of files) {
        const content = await readFile(join(tmpSourceResults, f));
        const hash = createHash("sha256").update(content).digest("hex");
        expect(hash).toBe(fileHashesRun1.get(f));
      }
      const lineageContent2 = await readFile(join(tmpMigrations, "source-claim-lineage.yaml"));
      const lineageHash2 = createHash("sha256").update(lineageContent2).digest("hex");
      expect(lineageHash2).toBe(lineageHash1);
    } finally {
      await rm(tmpBase, { recursive: true, force: true });
    }
  }, 30_000);

  it("TEST C: Source claim integrity CLI returnerer PASS med 0 feil", async () => {
    const report = await runSourceClaimIntegrityCheck();
    expect(report.valid).toBe(true);
    expect(report.missingClaimIds).toBe(0);
    expect(report.duplicateClaimIds).toHaveLength(0);
    expect(report.invalidFormatClaimIds).toHaveLength(0);
    expect(report.lineageErrors).toHaveLength(0);
    expect(report.downstreamReferenceErrors).toHaveLength(0);
  }, 30_000);

  it("TEST D: Skiller stabil claim-identitet fra mutable koordinater (season, no)", () => {
    const dummyClaimId = "srcclaim-8e6f0dcdeb5b00000000000000000001";
    const collection = sourceResultCollection.parse({
      sourceId: "medlemsblad-1965",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1955,
          page: 14,
          results: [
            {
              claimId: dummyClaimId,
              no: 1,
              opponent: "Guard",
              score: [2, 0],
            },
          ],
        },
      ],
    });

    const flat1 = flattenSourceResults(collection);
    expect(flat1[0]?.claimId).toBe(dummyClaimId);
    expect(flat1[0]?.season).toBe(1955);
    expect(flat1[0]?.id).toBe("1955-001");

    // Korrigerer kildekoordinat til 1954 #2
    const migratedCollection = sourceResultCollection.parse({
      sourceId: "medlemsblad-1965",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1954,
          page: 14,
          results: [
            {
              claimId: "srcclaim-00000000000000000000000000000002",
              no: 1,
              opponent: "Rollon",
              score: [1, 1],
            },
            {
              claimId: dummyClaimId,
              no: 2,
              opponent: "Guard",
              score: [2, 0],
            },
          ],
        },
      ],
    });

    const flat2 = flattenSourceResults(migratedCollection);
    expect(flat2[1]?.claimId).toBe(dummyClaimId);
    expect(flat2[1]?.season).toBe(1954);
    expect(flat2[1]?.id).toBe("1954-002");
  });

  it("TEST E: Validering av source-claim-lineage@1: avviser duplikater og sykluser", () => {
    const validManifest: SourceClaimLineageManifest = {
      contract: "source-claim-lineage@1",
      claims: [
        {
          claimId: "srcclaim-1234567890abcdef1234567890abcdef",
          sourceId: "kilde-a",
          currentCoordinate: { season: 1954, no: 10 },
          coordinateHistory: [
            {
              season: 1955,
              no: 1,
              supersededBy: { reason: "year_shift", pr: 205 },
            },
          ],
          legacyHypothesisIds: ["kilde-a#1955-001"],
        },
      ],
    };
    expect(sourceClaimLineageManifest.safeParse(validManifest).success).toBe(true);

    // Syklus: gammel koordinat er identisk med nåværende koordinat
    const cycleManifest = {
      contract: "source-claim-lineage@1",
      claims: [
        {
          claimId: "srcclaim-1234567890abcdef1234567890abcdef",
          sourceId: "kilde-a",
          currentCoordinate: { season: 1954, no: 10 },
          coordinateHistory: [
            {
              season: 1954,
              no: 10,
            },
          ],
          legacyHypothesisIds: [],
        },
      ],
    };
    expect(sourceClaimLineageManifest.safeParse(cycleManifest).success).toBe(false);

    // Ikke-bijektiv historikk: to claims som hevder samme gamle koordinat
    const nonBijectionManifest = {
      contract: "source-claim-lineage@1",
      claims: [
        {
          claimId: "srcclaim-11111111111111111111111111111111",
          sourceId: "kilde-a",
          currentCoordinate: { season: 1954, no: 10 },
          coordinateHistory: [{ season: 1955, no: 1 }],
          legacyHypothesisIds: [],
        },
        {
          claimId: "srcclaim-22222222222222222222222222222222",
          sourceId: "kilde-a",
          currentCoordinate: { season: 1954, no: 11 },
          coordinateHistory: [{ season: 1955, no: 1 }],
          legacyHypothesisIds: [],
        },
      ],
    };
    expect(sourceClaimLineageManifest.safeParse(nonBijectionManifest).success).toBe(false);
  });

  it("TEST F: Reversibelt oppslag: finner claim på stabil ID, koordinat og legacy hypothesis", () => {
    // Oppslag via claimId
    const sampleClaim = archive.sourceResults[0]?.seasons[0]?.results[0];
    expect(sampleClaim?.claimId).toBeDefined();

    const byId = resolveSourceClaimById(sampleClaim!.claimId, index);
    expect(byId).toBeDefined();
    expect(byId?.claimId).toBe(sampleClaim!.claimId);

    // Oppslag via koordinat
    const byCoord = resolveSourceClaim(
      {
        sourceId: archive.sourceResults[0]!.sourceId,
        season: archive.sourceResults[0]!.seasons[0]!.year,
        no: sampleClaim!.no,
      },
      index,
    );
    expect(byCoord).toBeDefined();
    expect(byCoord?.claimId).toBe(sampleClaim!.claimId);
  });

  it("TEST G: PR #205 Golden Case: Gjenbrukt koordinat (#1955-001) oppdages som eksplisitt tvetydig", () => {
    const legacyHypothesis = "medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-001";
    const resolved = resolveLegacyHypothesisId(legacyHypothesis, index);

    // Finn forventet claimId for Guard 1954 #10 fra lineage
    const guardLineage = lineageManifest.claims.find(
      (c) =>
        c.sourceId === "medlemsblad-for-aalesunds-fotb-1965-a2c9" &&
        c.currentCoordinate.season === 1954 &&
        c.currentCoordinate.no === 10,
    );
    expect(guardLineage).toBeDefined();
    const guardClaimId = guardLineage!.claimId;

    // Både dagens 1955 #1 og historisk 1955 #1 (som flyttet til 1954 #10) finnes -> må være tvetydig
    expect(resolved.status).toBe("ambiguous_reused_coordinate");
    if (resolved.status === "ambiguous_reused_coordinate") {
      expect(resolved.currentClaim).toBeDefined();
      expect(resolved.currentClaim?.season).toBe(1955);
      expect(resolved.historicalClaims).toHaveLength(1);
      expect(resolved.historicalClaims[0]?.claimId).toBe(guardClaimId);
      expect(resolved.historicalClaims[0]?.season).toBe(1954);
      expect(resolved.historicalClaims[0]?.opponent).toBe("Guard");
    }

    // Direkte oppslag på permanent claimId er entydig og uavhengig av koordinatendringen
    const resolvedDirect = resolveSourceClaimById(guardClaimId, index);
    expect(resolvedDirect).toBeDefined();
    expect(resolvedDirect?.season).toBe(1954);
    expect(resolvedDirect?.opponent).toBe("Guard");
  });

  it("TEST H: Review-validering evaluerer semantisk gyldighet vs revalideringskrav", () => {
    const validClaimId = "srcclaim-8e6f0dcdeb5b00000000000000000001";
    const currentClaim = {
      id: "1954-010",
      claimId: validClaimId,
      sourceId: "medlemsblad-1965",
      season: 1954,
      order: 10,
      page: 14,
      opponent: "Guard",
      opponentClubId: "guard",
      aafkGoals: 2,
      opponentGoals: 0,
      competitionId: null,
      status: "played" as const,
      replay: false,
      extraTime: false,
      round: null,
      matchId: null,
    };

    // Review utført mot nøyaktig samme claim og sesong
    const exactReview = evaluateReviewValidityAgainstCurrentClaim(
      {
        sourceClaimId: validClaimId,
        sourceCoordinateAtReview: { season: 1954, no: 10 },
      },
      currentClaim,
    );
    expect(exactReview.validity).toBe("valid");

    // Review utført før PR #205 year shift (sesong 1955)
    const shiftedReview = evaluateReviewValidityAgainstCurrentClaim(
      {
        sourceClaimId: validClaimId,
        sourceCoordinateAtReview: { season: 1955, no: 1 },
      },
      currentClaim,
    );
    expect(shiftedReview.validity).toBe("requires_revalidation");
    expect(shiftedReview.reason).toContain("Årsskifte");

    // Review med feil claimId
    const mismatchReview = evaluateReviewValidityAgainstCurrentClaim(
      {
        sourceClaimId: "srcclaim-99999999999999999999999999999999",
      },
      currentClaim,
    );
    expect(mismatchReview.validity).toBe("invalid");
  });

  it("TEST I: Archive preservation verifiserer at claimId pares på tvers av renummerering", () => {
    const baseObj = {
      sourceId: "test-kilde",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1950,
          page: 10,
          results: [
            {
              claimId: "srcclaim-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              no: 1,
              opponent: "Rollon",
              score: [2, 1],
            },
            {
              claimId: "srcclaim-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              no: 2,
              opponent: "Hødd",
              score: [3, 0],
            },
          ],
        },
      ],
    };

    // HEAD har byttet om rekkefølgen (#1 Hødd, #2 Rollon), men beholder samme claimId
    const headObj = {
      sourceId: "test-kilde",
      scorePerspective: "aafk",
      seasons: [
        {
          year: 1950,
          page: 10,
          results: [
            {
              claimId: "srcclaim-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              no: 1,
              opponent: "Hødd",
              score: [3, 0],
            },
            {
              claimId: "srcclaim-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              no: 2,
              opponent: "Rollon",
              score: [2, 1],
            },
          ],
        },
      ],
    };

    const diff = diffStructuralAdditivity(baseObj, headObj, "test-kilde");
    // claimId sikrer at Rollon pares med Rollon og Hødd med Hødd -> ingen faktamutasjon!
    expect(diff.filter((d) => d.changeType === "remove")).toHaveLength(0);
  });

  it("TEST J: Ende-til-ende proveniens: source-result.claimId -> discovery -> candidate -> verificationCase", () => {
    const sampleClaim = archive.sourceResults[0]?.seasons[0]?.results[0];
    expect(sampleClaim?.claimId).toBeDefined();
    const claimId = sampleClaim!.claimId;

    // 1. Discovery referanse
    const discoveryRef = {
      sourceClaimId: claimId,
      sourceId: archive.sourceResults[0]!.sourceId,
      season: archive.sourceResults[0]!.seasons[0]!.year,
      no: sampleClaim!.no,
    };
    expect(discoveryRef.sourceClaimId).toBe(claimId);

    // 2. Candidate manifest med sourceClaimId
    const candidateData = {
      contract: "nb-newspaper-community-candidates@1" as const,
      candidates: [
        {
          candidateId: "cand-test-001",
          communityReviewable: true,
          visibility: "community_reviewable" as const,
          publication: { status: "draft" as const },
          sourceResult: {
            sourceClaimId: claimId,
            sourceId: discoveryRef.sourceId,
            year: discoveryRef.season,
            no: discoveryRef.no,
            opponent: "Rollon",
            expectedScore: { aafk: 2, opponent: 1 },
          },
          hypothesis: {
            id: "hyp-test-001",
            discoveryStatus: "confirmed" as const,
          },
          newspaper: {
            title: "Sunnmørsposten",
            issueDate: "1950-05-15",
            page: "4",
            pageUrl: "https://www.nb.no/items/URN:NBN:no-nb_digavis_sunnmorsposten_null_null_null",
          },
        },
      ],
    };
    const parsedCandidate = newspaperVerificationCandidateManifest.parse(candidateData);
    expect(parsedCandidate.candidates[0]?.sourceResult.sourceClaimId).toBe(claimId);

    // 3. Verification case med newspaper.sourceResult.sourceClaimId
    const verificationInput = {
      id: "nb-avis-1950-test-01",
      sourceClaimId: claimId,
      status: "draft" as const,
      category: "match" as const,
      claim: "AaFK spilte mot Rollon i 1950 og vant 2-1",
      question: "Stemmer dette resultatet?",
      context: "Kilderesultat fra medlemsbladet",
      whyItMatters: "Viktig for historisk statistikk",
      yesMeaning: "Resultatet er bekreftet",
      noMeaning: "Resultatet avvises",
      instructions: ["Sjekk faksimile"],
      estimatedMinutes: 5,
      priority: 50,
      searchHint: "Sunnmørsposten mai 1950",
      target: {
        type: "source" as const,
        id: discoveryRef.sourceId,
        field: "results",
      },
      newspaper: {
        candidateId: "cand-test-001",
        communityReviewable: true as const,
        sourceResult: {
          sourceClaimId: claimId,
          sourceId: discoveryRef.sourceId,
          year: discoveryRef.season,
          no: discoveryRef.no,
          opponent: "Rollon",
          expectedScore: { aafk: 2, opponent: 1 },
        },
        hypothesis: {
          id: "hyp-test-001",
          discoveryStatus: "confirmed" as const,
        },
        newspaper: {
          title: "Sunnmørsposten",
          issueDate: "1950-05-15",
          page: "4",
          pageUrl: "https://www.nb.no/items/URN:NBN:no-nb_digavis_sunnmorsposten_null_null_null",
        },
      },
    };
    const parsedVerification = verificationCaseInput.parse(verificationInput);
    expect(parsedVerification.sourceClaimId).toBe(claimId);
    expect(parsedVerification.newspaper?.sourceResult.sourceClaimId).toBe(claimId);
  });
});
