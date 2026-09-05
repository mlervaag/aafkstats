import { readFile } from "node:fs/promises";
import { parseArchiveYaml as parseYaml } from "../src/yaml.js";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../src/load.js";

interface LedgerEntry {
  sourceClaimId: string;
  outcome: "existing_match_candidate" | "datoevidens_funnet" | "kandidatliste" | "ingen_treff" | "ikke_digitalisert";
  existingMatchId?: string;
  shortlist: unknown[];
}

interface Ledger {
  contract: string;
  totals: { checked: number };
  queues: {
    existingMatchReview: string[];
    dateEvidenceReview: string[];
    candidateReview: string[];
    exhausted: string[];
  };
  entries: LedgerEntry[];
}

const files = [
  "nb-dateless-local-reconciliation-1915-1974.yaml",
  "nb-dateless-discovery-1955-1959.yaml",
  "nb-dateless-discovery-1960-1964.yaml",
  "nb-dateless-discovery-1965-1974.yaml",
];

describe("datoløs NB-discovery", () => {
  it("publiserer bare aktive sourceClaimId-er og ingen OCR-sitater", async () => {
    const closure = parseYaml(
      await readFile(`${repoRoot()}/data/discovery/discovery-closure-status.yaml`, "utf8"),
      { schema: "core" },
    ) as { closureQueue: { needsVisualReview: string[]; requiresRevalidation: string[] } };
    const active = new Set([...closure.closureQueue.needsVisualReview, ...closure.closureQueue.requiresRevalidation]);

    for (const file of files) {
      const raw = await readFile(`${repoRoot()}/data/discovery/${file}`, "utf8");
      expect(raw).not.toMatch(/^\s+quote:/mu);
      const ledger = parseYaml(raw) as Ledger;
      expect(ledger.contract).toBe("nb-dateless-discovery@1");
      expect(ledger.totals.checked).toBe(ledger.entries.length);
      expect(new Set(ledger.entries.map((entry) => entry.sourceClaimId)).size).toBe(ledger.entries.length);
      expect(ledger.entries.every((entry) => active.has(entry.sourceClaimId))).toBe(true);
    }
  });

  it("holder reviewkøene i samsvar med utfallene", async () => {
    for (const file of files) {
      const ledger = parseYaml(
        await readFile(`${repoRoot()}/data/discovery/${file}`, "utf8"),
        { schema: "core" },
      ) as Ledger;
      const ids = (outcomes: LedgerEntry["outcome"][]) => ledger.entries
        .filter((entry) => outcomes.includes(entry.outcome))
        .map((entry) => entry.sourceClaimId);
      expect(ledger.queues.existingMatchReview).toEqual(ids(["existing_match_candidate"]));
      expect(ledger.queues.dateEvidenceReview).toEqual(ids(["datoevidens_funnet"]));
      expect(ledger.queues.candidateReview).toEqual(ids(["kandidatliste"]));
      expect(ledger.queues.exhausted).toEqual(ids(["ingen_treff", "ikke_digitalisert"]));
    }
  });

  it("peker lokale treff på eksisterende canonical matches", async () => {
    const ledger = parseYaml(
      await readFile(`${repoRoot()}/data/discovery/${files[0]}`, "utf8"),
      { schema: "core" },
    ) as Ledger;
    const knownMatches = new Set<string>();
    const statusRaw = await readFile(`${repoRoot()}/data/discovery/newspaper-enrichment-status.yaml`, "utf8");
    const status = parseYaml(statusRaw) as { entries: Array<{ matchId: string }> };
    for (const entry of status.entries) knownMatches.add(entry.matchId);

    expect(ledger.entries).not.toHaveLength(0);
    expect(ledger.entries.every((entry) => entry.existingMatchId && knownMatches.has(entry.existingMatchId))).toBe(true);
  });
});
