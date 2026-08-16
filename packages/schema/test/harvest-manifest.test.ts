import { describe, it, expect } from "vitest";
import {
  harvestBatchManifest,
  harvestFindingSchema,
  historicalDispositionEnum,
  TARGET_REQUIRED_DISPOSITIONS,
  ZERO_TARGET_DISPOSITIONS,
  SOURCE_PROFILES,
  inferSourceProfile,
  type PublicationExtraction,
  type Source,
} from "../src/index.js";
import { generateHarvestBatchManifest } from "../src/cli/historical-harvest-init.js";

describe("Harvest Batch Manifest Schema", () => {
  it("validerer et gyldig initialt batch-manifest", () => {
    const valid = {
      version: 1,
      id: "nff-yearbooks-1921-1925",
      title: "NFF-årbøker 1921–1925",
      profile: "yearbook",
      mode: "initial",
      status: "reviewing",
      scope: {
        years: { from: 1921, to: 1925 },
        sourceIds: ["nff-arbok-1921", "nff-arbok-1922"],
      },
      sourceInventory: [
        { sourceId: "nff-arbok-1921", reviewStatus: "reviewed" },
        { sourceId: "nff-arbok-1922", reviewStatus: "duplicate_or_reprint", duplicateOf: "nff-arbok-1921" },
      ],
      coverage: {
        mode: "pages",
        expected: 500,
        reviewed: 250,
      },
      passes: {
        facsimile_review: { status: "in_progress", findings: 5 },
        explicit_results: { status: "pending", findings: 0 },
      },
      reviewMethod: {
        facsimile: "required",
      },
      findings: [
        {
          id: "f-001",
          source: { sourceId: "nff-arbok-1921", page: 42 },
          type: "person_role",
          claim: { text: "Styremedlem i NFF" },
          disposition: "role_created",
          targets: [{ entity: "person", id: "nils-jangaard", path: "roles/styre-1921" }],
          status: "normalized",
        },
      ],
      unresolved: [],
    };

    const res = harvestBatchManifest.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.version).toBe(1);
      expect(res.data.profile).toBe("yearbook");
      expect(res.data.findings.length).toBe(1);
    }
  });

  it("avviser ugyldig kildeprofil eller versjon", () => {
    const invalidProfile = {
      version: 1,
      id: "batch-1",
      title: "Test",
      profile: "super_custom_profile",
      mode: "initial",
      status: "discovered",
    };
    expect(harvestBatchManifest.safeParse(invalidProfile).success).toBe(false);

    const invalidVersion = {
      version: 2,
      id: "batch-2",
      title: "Test",
      profile: "generic_publication",
      mode: "initial",
      status: "discovered",
    };
    expect(harvestBatchManifest.safeParse(invalidVersion).success).toBe(false);
  });

  it("støtter reharvest og supplement moduser med previousWork", () => {
    const reharvest = {
      version: 1,
      id: "aafk-50-ar-reharvest",
      title: "Re-harvest av AaFK 50 år",
      profile: "anniversary_book",
      mode: "reharvest",
      status: "reviewing",
      previousWork: {
        pullRequests: [140],
        notes: ["Tidligere innhøsting fokuserte kun på resultater."],
      },
      findings: [],
    };

    const res = harvestBatchManifest.safeParse(reharvest);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.mode).toBe("reharvest");
      expect(res.data.previousWork?.pullRequests).toContain(140);
    }
  });
});

describe("Disposisjoner og Target-krav", () => {
  it("validerer alle autoritative disposisjoner", () => {
    expect(historicalDispositionEnum.options.length).toBeGreaterThanOrEqual(25);
    expect(TARGET_REQUIRED_DISPOSITIONS.has("role_created")).toBe(true);
    expect(TARGET_REQUIRED_DISPOSITIONS.has("source_result_created")).toBe(true);
    expect(ZERO_TARGET_DISPOSITIONS.has("identity_uncertain")).toBe(true);
    expect(ZERO_TARGET_DISPOSITIONS.has("non_senior")).toBe(true);
    expect(ZERO_TARGET_DISPOSITIONS.has("duplicate_publication")).toBe(true);
  });

  it("krever kildeangivelse (source eller sources) på findings", () => {
    const withoutSource = {
      id: "f-bad",
      type: "match_result",
      claim: { text: "AaFK vant 3-1" },
      disposition: "source_result_created",
      targets: [],
    };
    expect(harvestFindingSchema.safeParse(withoutSource).success).toBe(false);

    const withSource = {
      id: "f-good",
      source: { sourceId: "medlemsblad-1954", page: 12 },
      type: "match_result",
      claim: { text: "AaFK vant 3-1" },
      disposition: "source_result_created",
      targets: [{ entity: "source_result", id: "medlemsblad-1954", path: "seasons/1954/results/1" }],
    };
    expect(harvestFindingSchema.safeParse(withSource).success).toBe(true);
  });

  it("krever eksplisitt og ikke-tom reason når reviewMethod.facsimile er unavailable", () => {
    const valid = {
      version: 1,
      id: "batch-1",
      title: "Test",
      profile: "generic_publication",
      reviewMethod: {
        facsimile: "unavailable",
        reason: "Fysisk hefte tapt i brann",
      },
    };
    expect(harvestBatchManifest.safeParse(valid).success).toBe(true);

    const invalid = {
      version: 1,
      id: "batch-1",
      title: "Test",
      profile: "generic_publication",
      reviewMethod: {
        facsimile: "unavailable",
      },
    };
    expect(harvestBatchManifest.safeParse(invalid).success).toBe(false);

    const emptyReason = {
      version: 1,
      id: "batch-1",
      title: "Test",
      profile: "generic_publication",
      reviewMethod: {
        facsimile: "unavailable",
        reason: "   ",
      },
    };
    expect(harvestBatchManifest.safeParse(emptyReason).success).toBe(false);
  });
});

describe("Source Profiles og Automatisk Profil-inferens", () => {
  it("har registrert samtlige 6 kildeprofiler", () => {
    const profileKeys = Object.keys(SOURCE_PROFILES);
    expect(profileKeys).toContain("member_magazine");
    expect(profileKeys).toContain("yearbook");
    expect(profileKeys).toContain("annual_report");
    expect(profileKeys).toContain("anniversary_book");
    expect(profileKeys).toContain("match_program");
    expect(profileKeys).toContain("generic_publication");
  });

  it("utleder profil fra metadata", () => {
    expect(inferSourceProfile({ sourceType: "member_magazine" })).toBe("member_magazine");
    expect(inferSourceProfile({ parentSourceId: "aafk-medlemsblad" })).toBe("member_magazine");
    expect(inferSourceProfile({ sourceType: "annual_report" })).toBe("annual_report");
    expect(inferSourceProfile({ id: "nff-arbok-1925" })).toBe("yearbook");
    expect(inferSourceProfile({ title: "AaFK 50 år" })).toBe("anniversary_book");
    expect(inferSourceProfile({ title: "Aalesunds FK 100 år" })).toBe("anniversary_book");
    expect(inferSourceProfile({ title: "Jubileumsbok 1964" })).toBe("anniversary_book");
    expect(inferSourceProfile({ title: "Festskrift for Aalesunds FK" })).toBe("anniversary_book");
    expect(inferSourceProfile({ sourceType: "match_program" })).toBe("match_program");
    expect(inferSourceProfile({ sourceType: "other", title: "Vanlig boktittel om fotballhistorie" })).toBe("generic_publication");
    expect(inferSourceProfile()).toBe("generic_publication");
  });

  it("evaluerer lineært og trygt på ekstremt lange strenger uten ReDoS", () => {
    const hugeTitle = "9".repeat(500000) + " år";
    const start = Date.now();
    const profile = inferSourceProfile({ title: hugeTitle });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Må fullføre på under 100ms
    expect(profile).toBe("generic_publication"); // Mer enn 4 sifre foran år ignoreres
  });
});

describe("Init CLI generator", () => {
  const mockSourcesMap = new Map<string, Source>([
    [
      "sfk-1963",
      {
        id: "sfk-1963",
        title: "SFK 1963",
        sourceType: "annual_report" as const,
        parentSourceId: "sunnmore-fotballkrets-arsrapporter",
        year: 1963,
        providers: [],
      },
    ],
    [
      "sfk-1964",
      {
        id: "sfk-1964",
        title: "SFK 1964",
        sourceType: "annual_report" as const,
        parentSourceId: "sunnmore-fotballkrets-arsrapporter",
        year: 1964,
        providers: [],
      },
    ],
    [
      "sfk-1965",
      {
        id: "sfk-1965",
        title: "SFK 1965",
        sourceType: "annual_report" as const,
        parentSourceId: "sunnmore-fotballkrets-arsrapporter",
        year: 1965,
        providers: [],
      },
    ],
  ]);

  const mockExtractionsMap = new Map<string, PublicationExtraction>([
    [
      "sfk-1963",
      {
        sourceId: "sfk-1963",
        pagesExpected: 20,
        pagesProcessed: 20,
        pagesFailed: [],
        candidates: [],
        resolvedRoles: [],
        resolvedLineups: [],
      },
    ],
    [
      "sfk-1964",
      {
        sourceId: "sfk-1964",
        pagesExpected: 22,
        pagesProcessed: 22,
        pagesFailed: [],
        candidates: [],
        resolvedRoles: [],
        resolvedLineups: [],
      },
    ],
    [
      "sfk-1965",
      {
        sourceId: "sfk-1965",
        pagesExpected: 24,
        pagesProcessed: 24,
        pagesFailed: [],
        candidates: [],
        resolvedRoles: [],
        resolvedLineups: [],
      },
    ],
  ]);

  const mockContext = { sourcesMap: mockSourcesMap, extractionsMap: mockExtractionsMap };

  it("genererer gyldig manifest med frosset inventar og required passes", async () => {
    const { manifest } = await generateHarvestBatchManifest(
      {
        profile: "annual_report",
        sources: [],
        parentSourceId: "sunnmore-fotballkrets-arsrapporter",
        yearFrom: 1963,
        yearTo: 1965,
        mode: "initial",
      },
      undefined,
      mockContext,
    );

    expect(manifest.version).toBe(1);
    expect(manifest.profile).toBe("annual_report");
    expect(manifest.mode).toBe("initial");
    expect(manifest.status).toBe("discovered");
    expect(manifest.sourceInventory.length).toBe(3);
    expect(manifest.passes.facsimile_review).toBeDefined();
    expect(manifest.passes.facsimile_review?.status).toBe("pending");
  });

  it("feiler dersom eksplisitt oppgitt sourceId ikke finnes", async () => {
    await expect(
      generateHarvestBatchManifest(
        {
          profile: "yearbook",
          sources: ["ikke-eksisterende-kilde-12345"],
          mode: "initial",
        },
        undefined,
        mockContext,
      ),
    ).rejects.toThrow(/Eksplisitt oppgitt kilde «ikke-eksisterende-kilde-12345» finnes ikke/);
  });

  it("feiler dersom filter gir 0 matchende kilder", async () => {
    await expect(
      generateHarvestBatchManifest(
        {
          parentSourceId: "nff-yearbooks",
          yearFrom: 1800,
          yearTo: 1810,
          mode: "initial",
        },
        undefined,
        mockContext,
      ),
    ).rejects.toThrow(/Ingen kilder funnet for det oppgitte scopet/);
  });
});
