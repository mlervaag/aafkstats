import type { NbCommunityResearchSubmission, NbCommunityResearchTask } from "@aafkstats/schema";

export function validateResearchSubmission(
  task: NbCommunityResearchTask,
  research: NbCommunityResearchSubmission | undefined,
): string | undefined {
  if (!research || research.category !== task.category) return "Research-svaret passer ikke til denne saken.";
  if (!task.expectedAnswerShape.includes(research.answer)) return "Svaralternativet hører ikke til denne saken.";
  const needsSelection = research.answer === "matched_source_result" || research.answer === "matched_other_source_result";
  if (needsSelection && !research.selectedSourceResult) return "Velg hvilken kildedokumentert oppføring svaret gjelder.";
  if (research.selectedSourceResult && !task.candidateOptions.some((option) =>
    option.sourceId === research.selectedSourceResult?.sourceId && option.no === research.selectedSourceResult?.no)) {
    return "Den valgte oppføringen hører ikke til denne saken.";
  }
  if (research.answer === "exact_date" && !research.structuredFindings?.date) return "Oppgi den eksakte kampdatoen.";
  if (research.answer === "period_only" && !research.structuredFindings?.period) return "Oppgi måneden eller perioden.";
  if (["score_conflict", "competition_conflict", "source_reconciliation"].includes(research.category) && (research.evidenceNote?.length ?? 0) < 3) {
    return "Beskriv kort hva som avgjør vurderingen.";
  }
  return undefined;
}
