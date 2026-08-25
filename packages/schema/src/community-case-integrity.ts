import { flattenSourceResults, type SourceResultCollection } from "./source-result.js";
import type { VerificationCase } from "./verification-case.js";

/**
 * Publiserte community-saker fryser et øyeblikksbilde av kilderesultatet de spør om.
 * Arkivet endrer seg videre — årsforskyvninger repareres, funn kanoniseres — og da
 * kan køen bli stående og be frivillige om å kontrollere påstander som ikke lenger
 * finnes. Denne kontrollen fanger avviket før listen på /mangler gjør det.
 */
export type CommunityCaseFindingKind =
  | "missing_claim"
  | "stale_snapshot"
  | "already_canonicalized"
  | "impossible_newspaper_date";

export interface CommunityCaseFinding {
  caseId: string;
  file: string;
  path: string;
  kind: CommunityCaseFindingKind;
  message: string;
}

interface ClaimSnapshot {
  sourceId: string;
  year: number;
  no: number;
  opponent: string;
  expectedScore: { aafk: number; opponent: number };
}

export interface CommunityCaseAuditInput {
  verificationCases: VerificationCase[];
  sourceResults: SourceResultCollection[];
}

function claimKey(sourceId: string, year: number, no: number): string {
  return `${sourceId}|${year}-${String(no).padStart(3, "0")}`;
}

function claimIndex(collections: SourceResultCollection[]) {
  const index = new Map<string, { opponent: string | null; aafkGoals: number | null; opponentGoals: number | null; matchId: string | null }>();
  for (const collection of collections) {
    for (const result of flattenSourceResults(collection)) {
      index.set(`${collection.sourceId}|${result.id}`, {
        opponent: result.opponent,
        aafkGoals: result.aafkGoals,
        opponentGoals: result.opponentGoals,
        matchId: result.matchId ?? null,
      });
    }
  }
  return index;
}

function scoreText(aafk: number | null, opponent: number | null): string {
  return `${aafk ?? "?"}–${opponent ?? "?"}`;
}

export function auditCommunityCases(input: CommunityCaseAuditInput): CommunityCaseFinding[] {
  const index = claimIndex(input.sourceResults);
  const findings: CommunityCaseFinding[] = [];

  for (const item of input.verificationCases) {
    // Bare saker som faktisk ligger ute til ja/nei kan sløse bort frivillig arbeid.
    if (item.status !== "open" || item.publishedAt === undefined) continue;

    const add = (path: string, kind: CommunityCaseFindingKind, message: string) =>
      findings.push({ caseId: item.id, file: item.file, path, kind, message });

    const checkClaim = (snapshot: ClaimSnapshot, path: string, options: { canonicalIsBlocking: boolean }) => {
      const current = index.get(claimKey(snapshot.sourceId, snapshot.year, snapshot.no));
      if (!current) {
        add(path, "missing_claim", `kilderesultat ${snapshot.year}-${snapshot.no} finnes ikke lenger i ${snapshot.sourceId}`);
        return;
      }
      if (
        current.opponent !== snapshot.opponent
        || current.aafkGoals !== snapshot.expectedScore.aafk
        || current.opponentGoals !== snapshot.expectedScore.opponent
      ) {
        add(
          path,
          "stale_snapshot",
          `saken viser «${snapshot.opponent} ${snapshot.expectedScore.aafk}–${snapshot.expectedScore.opponent}», arkivet fører «${current.opponent ?? "ukjent motstander"} ${scoreText(current.aafkGoals, current.opponentGoals)}» på ${snapshot.year}-${snapshot.no}`,
        );
      }
      // Et kilderesultat som allerede er koblet til en kamp gir ingen redaksjonell
      // handling: et «ja» blir blokkert av samme grunn i review-steget.
      if (options.canonicalIsBlocking && current.matchId) {
        add(path, "already_canonicalized", `kilderesultatet er allerede koblet til kampen «${current.matchId}»`);
      }
    };

    if (item.newspaper) {
      checkClaim(item.newspaper.sourceResult, "newspaper.sourceResult", { canonicalIsBlocking: true });
      const matchDate = item.newspaper.hypothesis.matchDate;
      if (matchDate && item.newspaper.newspaper.issueDate < matchDate) {
        add(
          "newspaper.newspaper.issueDate",
          "impossible_newspaper_date",
          `avisen er datert ${item.newspaper.newspaper.issueDate}, før den antatte kampdatoen ${matchDate}`,
        );
      }
    }

    if (item.researchTask) {
      for (const [position, snapshot] of item.researchTask.sourceResults.entries()) {
        checkClaim(snapshot, `researchTask.sourceResults.${position}`, { canonicalIsBlocking: true });
      }
      // Alternativene er valgmuligheter, ikke saken selv: her er det bare
      // øyeblikksbildet som må stemme, ellers velger frivillige feil rad.
      for (const [position, snapshot] of item.researchTask.candidateOptions.entries()) {
        checkClaim(snapshot, `researchTask.candidateOptions.${position}`, { canonicalIsBlocking: false });
      }
      const matchDate = item.researchTask.observedEvent.matchDate;
      if (matchDate && item.researchTask.actualVisualSource.issueDate < matchDate) {
        add(
          "researchTask.actualVisualSource.issueDate",
          "impossible_newspaper_date",
          `avisen er datert ${item.researchTask.actualVisualSource.issueDate}, før den observerte kampdatoen ${matchDate}`,
        );
      }
    }
  }

  return findings;
}
