export type VerificationAnswer = "yes" | "no" | "inconclusive";
export type VerificationEvidenceKind = "listed_source" | "new_url" | "bibliographic";

export interface VerificationDraft {
  answer: VerificationAnswer | null;
  evidenceKind: VerificationEvidenceKind;
  sourceKey: string;
  url: string;
  reference: string;
  finding: string;
  comment: string;
  contributor: string;
  scoreAgreement: "" | "yes" | "no" | "uncertain";
  matchDate: string;
  dateReadable: "" | "yes" | "no" | "uncertain";
  homeAway: "" | "home" | "away" | "neutral" | "uncertain";
  competition: string;
  reasons: string[];
  researchAnswer: string;
  selectedSourceResultKey: string;
  researchPeriod: string;
  scoreAafk: string;
  scoreOpponent: string;
  clientSubmissionId: string;
}

export const EMPTY_VERIFICATION_DRAFT: VerificationDraft = {
  answer: null,
  evidenceKind: "listed_source",
  sourceKey: "",
  url: "",
  reference: "",
  finding: "",
  comment: "",
  contributor: "",
  scoreAgreement: "",
  matchDate: "",
  dateReadable: "",
  homeAway: "",
  competition: "",
  reasons: [],
  researchAnswer: "",
  selectedSourceResultKey: "",
  researchPeriod: "",
  scoreAafk: "",
  scoreOpponent: "",
  clientSubmissionId: "",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function restoreVerificationDraft(
  saved: string | null,
  firstSourceKey: string,
  hasListedSources: boolean,
  createSubmissionId: () => string = () => crypto.randomUUID(),
): VerificationDraft {
  let stored: Partial<VerificationDraft> = {};
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        stored = parsed as Partial<VerificationDraft>;
      }
    } catch {
      // Et skadet lokalt utkast skal starte på nytt, ikke blokkere saken.
    }
  }

  return {
    ...EMPTY_VERIFICATION_DRAFT,
    sourceKey: firstSourceKey,
    evidenceKind: hasListedSources ? "listed_source" : "new_url",
    ...stored,
    clientSubmissionId: typeof stored.clientSubmissionId === "string" && UUID_PATTERN.test(stored.clientSubmissionId)
      ? stored.clientSubmissionId
      : createSubmissionId(),
  };
}
