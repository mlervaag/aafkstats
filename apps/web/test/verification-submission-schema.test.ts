import { describe, expect, it } from "vitest";
import { nbCommunityResearchSubmission } from "@aafkstats/schema";
import {
  mcpResearchFindingSchema,
  researchSubmissionSchema,
  verificationSubmissionSchema,
} from "../lib/verification-submission-schema.js";

const validResearch = {
  verificationSubmissionVersion: 2 as const,
  category: "sibling_resolution" as const,
  answer: "matched_source_result",
  selectedSourceResult: { sourceId: "aafk-90-ar-1914-2004", no: 4 },
  structuredFindings: { date: "1955-05-08", homeAway: "home" as const },
};

describe("felles verifiseringskontrakt", () => {
  it("holder MCP-speilet likt det kanoniske researchskjemaet", () => {
    const samples = [
      validResearch,
      { ...validResearch, verificationSubmissionVersion: 1 },
      { ...validResearch, selectedSourceResult: { sourceId: "UGYLDIG ID", no: 0 } },
      { ...validResearch, structuredFindings: { date: "1955-99-99" } },
    ];
    for (const sample of samples) {
      expect(researchSubmissionSchema.safeParse(sample).success).toBe(
        nbCommunityResearchSubmission.safeParse(sample).success,
      );
    }
  });

  it("utleder den smale MCP-inngangen fra browserkontrakten", () => {
    const common = {
      caseId: "fixture-nb-research-sibling",
      revision: `sha256:${"a".repeat(64)}`,
      answer: "yes" as const,
      evidence: { kind: "new_url" as const, url: "https://example.com/kilde" },
      finding: "Kilden oppgir riktig dato.",
      researchSubmission: validResearch,
      clientSubmissionId: "da5e52d8-4c91-4b53-bb56-f83688b9db2a",
    };
    expect(verificationSubmissionSchema.safeParse(common).success).toBe(true);
    expect(mcpResearchFindingSchema.safeParse(common).success).toBe(true);
    expect(mcpResearchFindingSchema.safeParse({ ...common, evidence: { kind: "new_url", url: "ftp://example.com/kilde" } }).success).toBe(false);
  });
});
