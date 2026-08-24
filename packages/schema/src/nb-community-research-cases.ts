import type { NbCommunityResearchManifest } from "./nb-community-research.js";
import { verificationCaseInput, type VerificationCaseInput } from "./verification-case.js";

export interface NbCommunityCaseGeneration {
  cases: VerificationCaseInput[];
  manualProtected: string[];
}

export function generateNbCommunityResearchCases(
  manifest: NbCommunityResearchManifest,
  existing: VerificationCaseInput[] = [],
): NbCommunityCaseGeneration {
  const manualIds = new Set(existing.map((item) => item.id));
  const manualTasks = new Set(existing.flatMap((item) => item.researchTask
    ? [`${item.researchTask.hypothesisId}|${item.researchTask.category}`]
    : []));
  const manualTargets = new Set(existing.map((item) => `${item.target.type}|${item.target.id}|${item.target.field}`));
  const manualProtected: string[] = [];
  const cases: VerificationCaseInput[] = [];

  for (const item of manifest.items) {
    // Pensjonerte oppgaver skal ikke lenger vises til frivillige.
    if (item.retirement) continue;
    const lead = item.sourceResults[0]!;
    const target = {
      type: "source" as const,
      id: lead.sourceId,
      field: `research.${item.category}.${item.season}.${lead.no}`,
    };
    if (
      manualIds.has(item.id)
      || manualTasks.has(`${item.hypothesisId}|${item.category}`)
      || manualTargets.has(`${target.type}|${target.id}|${target.field}`)
    ) {
      manualProtected.push(item.id);
      continue;
    }
    const task = {
      contract: "nb-community-research-task@1" as const,
      hypothesisId: item.hypothesisId,
      season: item.season,
      category: item.category,
      sourceResults: item.sourceResults,
      observedEvent: item.observedEvent,
      actualVisualSource: item.actualVisualSource,
      candidateOptions: item.candidateOptions,
      expectedAnswerShape: item.expectedAnswerShape,
    };
    cases.push(verificationCaseInput.parse({
      id: item.id,
      status: item.status,
      category: "match",
      claim: `Arkivets kildedokumenterte oppføring sier ${lead.expectedScore.aafk}–${lead.expectedScore.opponent} mot ${lead.opponent} i ${item.season}.`,
      question: item.question,
      context: item.context,
      whyItMatters: item.whyItMatters,
      yesMeaning: "Researchen støtter en konkret kobling eller opplysning.",
      noMeaning: "Researchen viser at koblingen eller opplysningen ikke gjelder.",
      inconclusiveMeaning: "Kilden er undersøkt, men er ikke tilstrekkelig til å avgjøre saken.",
      instructions: item.instructions,
      target,
      sources: [{
        providerId: "nasjonalbiblioteket",
        page: item.actualVisualSource.printedPage,
        role: "context",
        note: `${item.actualVisualSource.title} ${item.actualVisualSource.issueDate}, trykt side ${item.actualVisualSource.printedPage}.`,
      }],
      estimatedMinutes: item.category === "sibling_resolution" ? 4 : 5,
      priority: item.priority,
      ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
      researchTask: task,
    }));
  }
  return { cases, manualProtected };
}
