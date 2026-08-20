import { describe, it, expect } from "vitest";
import { loadArchive, dataDir } from "@aafkstats/schema/load";
import { resolve } from "path";
import { fileURLToPath } from "url";
import {
  loadSiblingPilotManifest,
  evaluateSiblingPilot,
} from "../src/newspaper/sibling-evaluator.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const MANIFEST_PATH = resolve(__dirname, "fixtures/nb-newspaper-sibling-pilot.yaml");

describe("NB Newspaper Sibling Pilot Manifest & Evaluator", () => {
  it("validerer struktur og unike ID-er i manifestet", () => {
    const manifest = loadSiblingPilotManifest(MANIFEST_PATH);
    expect(manifest.groups).toHaveLength(10);
    expect(manifest.version).toBe(1);

    const allIds = manifest.groups.flatMap((g) => g.hypotheses.map((h) => h.id));
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(26);

    for (const group of manifest.groups) {
      expect(group.groupKey).toBeDefined();
      expect(group.hypotheses.length).toBeGreaterThanOrEqual(1);
      for (const h of group.hypotheses) {
        expect(["exact", "unresolved", "unverified"]).toContain(h.expectedAllocation);
        if (h.expectedAllocation === "exact") {
          expect(h.expectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });

  it("evaluerer piloten deterministisk fra disk/cache med null falske high-confidence allokeringer", async () => {
    const archive = await loadArchive(dataDir());
    const report = await evaluateSiblingPilot(archive, MANIFEST_PATH);

    expect(report.totalGroups).toBe(10);
    expect(report.totalHypotheses).toBe(26);

    // Kritiske sikkerhetskrav
    expect(report.falseHighConfidenceAllocations).toBe(0);

    // Herd 1962 kontroll: #5 og #9
    const herdGroup = report.groups.find((g) => g.groupKey === "1962|herd");
    expect(herdGroup).toBeDefined();
    const herd5 = herdGroup!.hypotheses.find((h) => h.no === 5);
    const herd9 = herdGroup!.hypotheses.find((h) => h.no === 9);
    expect(herd5?.allocatedDate).toBe("1962-04-25");
    expect(herd5?.classification).toBe("exact_correct");
    expect(herd9?.allocatedDate).toBe("1962-06-20");
    expect(herd9?.classification).toBe("exact_correct");
    expect(herd9?.status).toBe("confirmed");

    // Kvik 1963 kontroll: #19 og #21 skal være avvist (unresolved / symmetrisk)
    const kvikGroup = report.groups.find((g) => g.groupKey === "1963|kvik");
    expect(kvikGroup).toBeDefined();
    const kvik19 = kvikGroup!.hypotheses.find((h) => h.no === 19);
    const kvik21 = kvikGroup!.hypotheses.find((h) => h.no === 21);
    expect(kvik19?.classification).toBe("correctly_rejected");
    expect(kvik21?.classification).toBe("correctly_rejected");

    // Aksla 1959 kontroll: #7 skal allokeres til 1959-04-13
    const akslaGroup = report.groups.find((g) => g.groupKey === "1959|aksla");
    expect(akslaGroup).toBeDefined();
    const aksla7 = akslaGroup!.hypotheses.find((h) => h.no === 7);
    expect(aksla7?.allocatedDate).toBe("1959-04-13");
    expect(aksla7?.classification).toBe("exact_correct");
  }, 30000);
});

