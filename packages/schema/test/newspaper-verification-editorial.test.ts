import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  formatNewspaperVerificationIssuePayload,
  newspaperVerificationIssuePayload,
  parseNewspaperVerificationIssue,
  prepareNewspaperVerificationReview,
  type NewspaperVerificationIssuePayload,
} from "../src/newspaper-verification-editorial.js";
import { loadArchive, type Archive } from "../src/load.js";
import { verificationCaseInput, verificationRevision, type VerificationCase } from "../src/verification-case.js";

let archive: Archive;
let item: VerificationCase;

beforeAll(async () => {
  const loaded = await loadArchive(resolve(import.meta.dirname, "../../../fixtures/data"));
  const template = loaded.verificationCases.find((entry) => entry.newspaper && entry.status === "open")!;
  const { revision: _revision, file: _file, ...raw } = template;
  const input = verificationCaseInput.parse({
    ...raw,
    id: "nb-avis-redaksjonell-test",
    target: { type: "source", id: "aafk-90-ar-1914-2004", field: "seasons.1914.results.1.matchIdentity" },
    newspaper: {
      ...template.newspaper!,
      candidateId: "fixture-redaksjonell-test",
      sourceResult: {
        sourceId: "aafk-90-ar-1914-2004",
        year: 1914,
        no: 1,
        opponent: "Molde",
        expectedScore: { aafk: 2, opponent: 1 },
        homeAway: "home",
        competition: "NM",
      },
      hypothesis: { id: "fixture-redaksjonell-hypotese", discoveryStatus: "probable" },
    },
  });
  item = { ...input, revision: verificationRevision(input), file: "fixture-generated" };
  archive = { ...loaded, verificationCases: [item] };
});

function payload(answer: "yes" | "no" | "inconclusive", finding: Partial<NewspaperVerificationIssuePayload["communityFinding"]> = {}) {
  return newspaperVerificationIssuePayload.parse({
    verificationCaseId: item.id,
    revision: item.revision,
    answer,
    candidate: { candidateId: item.newspaper!.candidateId },
    sourceResult: item.newspaper!.sourceResult,
    hypothesis: item.newspaper!.hypothesis,
    newspaper: item.newspaper!.newspaper,
    communityFinding: { answer, ...finding },
  });
}

const options = { issueUrl: "https://github.com/mlervaag/aafkstats/issues/999", resolvedAt: "2026-08-21" };

describe("redaksjonell behandling av avisverifisering", () => {
  it("parser den markerte issue-payloaden deterministisk", () => {
    const value = payload("no", { reason: "Siden viser en annen kamp." });
    expect(parseNewspaperVerificationIssue(`Innledning\n\n${formatNewspaperVerificationIssuePayload(value)}\n\nFritekst.`)).toEqual(value);
  });

  it("fører NEI og KAN IKKE BESTEMMES til reviewhistorikk uten canonical endring", () => {
    for (const answer of ["no", "inconclusive"] as const) {
      const result = prepareNewspaperVerificationReview(payload(answer), archive, options);
      expect(result.canonicalAction).toBe("none");
      expect(result.disposition).toBe(answer === "no" ? "reviewed_no" : "reviewed_inconclusive");
      expect(result.verificationCase).toMatchObject({ status: "resolved", resolution: { answer, issueUrl: options.issueUrl } });
    }
  });

  it("stopper JA fra canonical behandling når eksakt dato mangler", () => {
    const result = prepareNewspaperVerificationReview(payload("yes", { scoreConfirmed: true, homeAway: "home" }), archive, options);
    expect(result.canonicalAction).toBe("none");
    expect(result.canonicalBlockers).toContain("eksakt kampdato mangler");
  });

  it("gjør et komplett JA klart for en vanlig redaksjonell data-PR", () => {
    const result = prepareNewspaperVerificationReview(payload("yes", {
      scoreConfirmed: true,
      matchDate: "1914-05-03",
      homeAway: "home",
      competition: "NM",
      comment: "Dato og lagpar er kontrollert på siden.",
    }), archive, options);
    expect(result.canonicalAction).toBe("editorial_candidate");
    expect(result.canonicalBlockers).toEqual([]);
    expect(result.sourceResult).toMatchObject({ opponentClubId: "molde-fk", competitionId: "nm", matchId: null });
    expect(result.verificationCase.resolution?.answer).toBe("yes");
  });

  it("blokkerer en gammel revisjon", () => {
    const stale = { ...payload("yes"), revision: `sha256:${"0".repeat(64)}` };
    expect(() => prepareNewspaperVerificationReview(stale, archive, options)).toThrow("STALE_REVISION");
  });
});
