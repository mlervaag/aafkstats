import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import {
  nbCommunityResearchManifest,
  flattenSourceResults,
  type NbCommunityResearchItem,
  type NbCommunityResearchManifest,
  type NbResearchCategory,
  type NbResearchSourceResult,
} from "@aafkstats/schema";
import { loadArchive, repoRoot } from "@aafkstats/schema/load";
import { extractActualVisualSource } from "../cli/nb-visual-canonicalization-1945-1984.js";

interface VisualCase {
  hypothesisId: string;
  season: number;
  reviewStatus: string;
  claimResolution: string;
  canonicalEligibility: string;
  sourceResults: Array<{ sourceId: string; no: number; opponent: string; expectedScore: { aafk: number; opponent: number } }>;
  matchedSourceResult?: { sourceId: string; no: number };
  reviewedCandidates?: Array<{
    newspaper?: { title: string; issueDate: string; page: string | number; pageUrl: string };
    visualEvidenceSummary?: string;
    observed?: {
      opponent?: { name?: string; clubId?: string };
      score?: { aafk: number; opponent: number };
      matchDate?: { value?: string };
      homeAway?: "home" | "away" | "neutral" | "unknown";
      competition?: { value?: string; competitionId?: string | null };
    };
  }>;
}

interface CanonicalManifest {
  generatedAt: string;
  communityRestQueue: {
    summary: Record<string, number>;
    candidateCount: number;
  };
  items: Array<{
    hypothesisId: string;
    action: string;
    conflictReason?: string;
  }>;
}

function categoryFor(item: VisualCase): NbResearchCategory | null {
  if (item.reviewStatus !== "visually_reviewed_pilot") return null;
  if (item.claimResolution === "non_senior" || item.canonicalEligibility === "non_senior") return null;
  if (item.claimResolution === "different_event") return null;
  if (item.canonicalEligibility === "score_conflict" || item.claimResolution === "same_event_score_conflict") return "score_conflict";
  if (item.canonicalEligibility === "competition_conflict") return "competition_conflict";
  if (item.canonicalEligibility === "date_uncertain") return "date_research";
  if (item.claimResolution === "sibling_group_only" || item.canonicalEligibility === "insufficient") return "sibling_resolution";
  return null;
}

function competitionLabel(value: { competitionId: string | null; note?: string } , names: Map<string, string>): string | undefined {
  if (value.competitionId) return names.get(value.competitionId) ?? value.competitionId;
  const hint = value.note?.split(/\.\s*(?:trykt|$)/i)[0]?.trim();
  if (!hint || /^trykt\b/i.test(hint) || /[0-9]\s*[-–—]\s*[0-9]/.test(hint)) return undefined;
  return hint;
}

function sourceResultLabel(value: Omit<NbResearchSourceResult, "label">): string {
  const competition = value.competition ? ` – registrert som ${value.competition}` : "";
  return `${value.expectedScore.aafk}–${value.expectedScore.opponent} mot ${value.opponent}${competition}`;
}

function answerShape(category: NbResearchCategory): string[] {
  if (category === "sibling_resolution") return ["matched_source_result", "none_of_these", "inconclusive"];
  if (category === "date_research") return ["exact_date", "period_only", "inconclusive"];
  if (category === "score_conflict") return ["newspaper_score", "source_result_score", "different_events", "inconclusive"];
  if (category === "competition_conflict") return ["league", "nm", "friendly", "other", "different_events", "inconclusive"];
  return ["matched_other_source_result", "missing_source_result", "irrelevant", "inconclusive"];
}

function copyFor(category: NbResearchCategory, opponent: string, season: number) {
  if (category === "sibling_resolution") return {
    question: `Hvilket av de registrerte møtene mot ${opponent} omtaler avisen?`,
    context: `AaFK møtte ${opponent} flere ganger i ${season}. Avisen dokumenterer én konkret kamp, men opplysningene kan ikke knyttes sikkert til den riktige kildedokumenterte oppføringen.`,
    whyItMatters: "Riktig kobling gjør at dato og avisreferanse kan vurderes uten å blande sammen flere møter.",
  };
  if (category === "date_research") return {
    question: `Kan kampdatoen mot ${opponent} fastslås?`,
    context: `Lagpar og resultat er identifisert, men den eksakte kampdatoen er fortsatt usikker.`,
    whyItMatters: "En dokumentert dato er nødvendig før kampen kan kobles sikkert til resten av arkivet.",
  };
  if (category === "score_conflict") return {
    question: `Hvilket resultat mot ${opponent} kan kildene samlet sett støtte?`,
    context: "Den kildedokumenterte oppføringen og avisobservasjonen oppgir ulike resultater for det som kan være samme kamp.",
    whyItMatters: "Konflikten må forstås før en kildepåstand kan knyttes til en konkret kamp.",
  };
  if (category === "competition_conflict") return {
    question: `Hvilken konkurransetype gjelder denne kampen mot ${opponent}?`,
    context: "Den kildedokumenterte oppføringen og avisobservasjonen beskriver konkurransen ulikt.",
    whyItMatters: "Riktig konkurransetype skiller serie-, cup- og treningskamper som ellers kan se like ut.",
  };
  return {
    question: "Hvilken kamp gjelder denne avisartikkelen egentlig?",
    context: "Kildedokumentert oppføring og avisobservasjon beskriver tydelig forskjellige hendelser. Finn ut om avisen hører til en annen oppføring eller en kamp som mangler.",
    whyItMatters: "Avisreferansen må ikke kobles til feil kamp, men kan fortsatt dokumentere en annen historisk hendelse.",
  };
}

function priority(category: NbResearchCategory, options: number): number {
  if (category === "sibling_resolution") return Math.max(80, 96 - options);
  if (category === "date_research") return 88;
  if (category === "source_reconciliation") return 84;
  if (category === "score_conflict") return 80;
  return 76;
}

export async function buildNbCommunityResearchManifest(root = repoRoot()): Promise<NbCommunityResearchManifest> {
  const [canonicalRaw, visualRaw, archive] = await Promise.all([
    readFile(`${root}/data/discovery/nb-source-result-canonicalization-1945-1984.yaml`, "utf8"),
    readFile(`${root}/data/discovery/nb-source-result-visual-review-1945-1984.yaml`, "utf8"),
    loadArchive(`${root}/data`),
  ]);
  const canonical = parse(canonicalRaw, { schema: "core" }) as CanonicalManifest;
  const visual = parse(visualRaw, { schema: "core" }) as { cases: VisualCase[] };
  const visualById = new Map(visual.cases.map((item) => [item.hypothesisId, item]));
  const competitionNames = new Map(archive.competitions.map((item) => [item.id, item.name]));
  const sourceRows = archive.sourceResults.flatMap(flattenSourceResults);
  const sourceIndex = new Map(sourceRows.map((item) => [`${item.sourceId}|${item.season}|${item.id.slice(-3)}`, item]));

  const candidates: Array<{ visual: VisualCase; category: NbResearchCategory }> = visual.cases
    .filter((item) => item.canonicalEligibility !== "ready")
    .flatMap((item) => {
      const category = categoryFor(item);
      return category ? [{ visual: item, category }] : [];
    });

  for (const invalid of canonical.items.filter((item) => item.action === "invalid_input")) {
    const item = visualById.get(invalid.hypothesisId);
    if (item) candidates.push({ visual: item, category: "source_reconciliation" });
  }

  const items: NbCommunityResearchItem[] = candidates.map(({ visual: item, category }): NbCommunityResearchItem => {
    const reviewed = item.reviewedCandidates?.[0];
    if (!reviewed?.newspaper) throw new Error(`Research-saken ${item.hypothesisId} mangler visuelt kontrollert avisside.`);
    const actualVisualSource = extractActualVisualSource(reviewed);
    const refs = item.sourceResults.map((ref) => {
      const raw = sourceIndex.get(`${ref.sourceId}|${item.season}|${String(ref.no).padStart(3, "0")}`);
      const base = {
        sourceId: ref.sourceId,
        year: item.season,
        no: ref.no,
        opponent: ref.opponent,
        expectedScore: ref.expectedScore,
        ...(raw ? {
          ...(competitionLabel(raw, competitionNames) ? { competition: competitionLabel(raw, competitionNames) } : {}),
        } : {}),
      };
      return { ...base, label: sourceResultLabel(base) };
    });
    const lead = refs[0]!;
    const observed = reviewed.observed;
    const leadRaw = sourceIndex.get(`${lead.sourceId}|${item.season}|${String(lead.no).padStart(3, "0")}`);
    const opponentClubId = leadRaw?.opponentClubId;
    const optionOpponentClubId = category === "source_reconciliation"
      ? observed?.opponent?.clubId
      : opponentClubId;
    const siblingRows = optionOpponentClubId && (category === "sibling_resolution" || category === "source_reconciliation")
      ? sourceRows.filter((row) => row.season === item.season && row.opponentClubId === optionOpponentClubId && row.aafkGoals !== null && row.opponentGoals !== null && (category === "source_reconciliation" || row.sourceId === lead.sourceId))
      : [];
    const candidateOptions = siblingRows.map((row) => {
      const base = {
        sourceId: row.sourceId,
        year: row.season,
        no: Number(row.id.slice(-3)),
        opponent: row.opponent ?? lead.opponent,
        expectedScore: { aafk: row.aafkGoals!, opponent: row.opponentGoals! },
        ...(competitionLabel(row, competitionNames) ? { competition: competitionLabel(row, competitionNames) } : {}),
      };
      return { ...base, label: sourceResultLabel(base) };
    });
    if (category === "sibling_resolution") for (const ref of refs) {
      if (!candidateOptions.some((option) => option.sourceId === ref.sourceId && option.no === ref.no)) candidateOptions.push(ref);
    }
    candidateOptions.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.no - b.no);
    const description = reviewed.visualEvidenceSummary ?? "Den visuelle kontrollen fant en relevant kampomtale, men koblingen er fortsatt uavklart.";
    const copy = copyFor(category, lead.opponent, item.season);
    const id = `nb-research-${lead.sourceId}-${item.season}-${lead.no}-${category.replaceAll("_", "-")}`;
    return {
      id,
      hypothesisId: item.hypothesisId,
      season: item.season,
      category,
      status: "open" as const,
      ...copy,
      sourceResults: refs,
      observedEvent: {
        ...(observed?.opponent?.name ? { opponent: observed.opponent.name } : {}),
        ...(observed?.matchDate?.value ? { matchDate: observed.matchDate.value } : {}),
        ...(observed?.homeAway ? { homeAway: observed.homeAway } : {}),
        ...(observed?.score ? { score: { aafk: observed.score.aafk, opponent: observed.score.opponent } } : {}),
        ...(observed?.competition?.value ? { competition: observed.competition.value } : observed?.competition?.competitionId ? { competition: competitionNames.get(observed.competition.competitionId) ?? observed.competition.competitionId } : {}),
        description,
      },
      actualVisualSource,
      candidateOptions,
      instructions: [
        "Åpne avissiden og finn kampomtalen som den visuelle kildekontrollen beskriver.",
        "Se etter dato, konkurranse og hjemme/borte som skiller møtene.",
        "Velg bare et alternativ når kilden faktisk skiller det fra de andre.",
      ],
      expectedAnswerShape: answerShape(category),
      priority: priority(category, candidateOptions.length),
      published: true,
      publishedAt: canonical.generatedAt,
      resolution: null,
    };
  }).sort((a, b) => b.priority - a.priority || a.season - b.season || a.id.localeCompare(b.id));

  const summary = {
    sibling_resolution: items.filter((item) => item.category === "sibling_resolution").length,
    date_research: items.filter((item) => item.category === "date_research").length,
    score_conflict: items.filter((item) => item.category === "score_conflict").length,
    competition_conflict: items.filter((item) => item.category === "competition_conflict").length,
    source_reconciliation: items.filter((item) => item.category === "source_reconciliation").length,
    total: items.length,
  };
  const expected = canonical.communityRestQueue;
  if (summary.total !== expected.candidateCount || Object.entries(summary).some(([key, value]) => key !== "total" && value !== expected.summary[key])) {
    throw new Error(`Generert research-kø stemmer ikke med PR200: ${JSON.stringify(summary)} mot ${JSON.stringify(expected)}`);
  }
  return nbCommunityResearchManifest.parse({
    contract: "nb-community-research-wave@1",
    generatedFrom: {
      canonicalizationManifest: "data/discovery/nb-source-result-canonicalization-1945-1984.yaml",
      visualReviewManifest: "data/discovery/nb-source-result-visual-review-1945-1984.yaml",
    },
    generatedAt: canonical.generatedAt,
    summary,
    items,
  });
}

export function compareCommunityResearchManifests(
  previous: NbCommunityResearchManifest | undefined,
  next: NbCommunityResearchManifest,
): { created: number; updated: number; unchanged: number; skipped: number; manualProtected: number } {
  const before = new Map(previous?.items.map((item) => [item.id, item]) ?? []);
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const item of next.items) {
    const old = before.get(item.id);
    if (!old) created += 1;
    else if (JSON.stringify(old) === JSON.stringify(item)) unchanged += 1;
    else updated += 1;
  }
  return { created, updated, unchanged, skipped: 0, manualProtected: 0 };
}
