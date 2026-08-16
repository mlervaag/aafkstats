import { describe, it, expect } from "vitest";
import {
  harvestBatchManifest,
  harvestFindingSchema,
  historicalDispositionEnum,
  TARGET_REQUIRED_DISPOSITIONS,
  ZERO_TARGET_DISPOSITIONS,
  SOURCE_PROFILES,
  inferSourceProfile,
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
    expect(inferSourceProfile({ title: "Aalesunds Fotballklubb 50 år" })).toBe("anniversary_book");
    expect(inferSourceProfile({ sourceType: "match_program" })).toBe("match_program");
    expect(inferSourceProfile({ sourceType: "other", title: "Ukjent hefte" })).toBe("generic_publication");
    expect(inferSourceProfile()).toBe("generic_publication");
  });
});

describe("Init CLI generator", () => {
  it("genererer gyldig manifest med frosset inventar og required passes", async () => {
    const { manifest } = await generateHarvestBatchManifest({
      profile: "yearbook",
      sources: [],
      parentSourceId: "nff-yearbooks",
      yearFrom: 1921,
      yearTo: 1925,
      mode: "initial",
    });

    expect(manifest.version).toBe(1);
    expect(manifest.profile).toBe("yearbook");
    expect(manifest.mode).toBe("initial");
    expect(manifest.status).toBe("discovered");
    expect(manifest.passes.facsimile_review).toBeDefined();
    expect(manifest.passes.facsimile_review?.status).toBe("pending");
  }, 20000);
});
