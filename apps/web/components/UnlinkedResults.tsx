import type { SourceResult } from "@/lib/archive";
import { SourceChips, type CitedRef } from "./SourceChips";

export interface UnlinkedHistoricalResult {
  key: string;
  season: number;
  opponent: string | null;
  opponentClubId: string | null;
  competitionId: string | null;
  round: number | null;
  status: "played" | "walkover";
  claims: SourceResult[];
  agreement: "single_source" | "sources_agree" | "sources_disagree";
}

export function groupUnlinkedResults(results: SourceResult[]): UnlinkedHistoricalResult[] {
  const groups: UnlinkedHistoricalResult[] = [];
  const byGroupId = new Map<string, UnlinkedHistoricalResult>();

  for (const result of results) {
    if (result.matchId) continue;

    if (result.resultGroupId) {
      const existing = byGroupId.get(result.resultGroupId);
      if (existing) {
        existing.claims.push(result);
        if (!existing.opponent && result.opponent) existing.opponent = result.opponent;
        if (!existing.opponentClubId && result.opponentClubId) existing.opponentClubId = result.opponentClubId;
        if (!existing.competitionId && result.competitionId) existing.competitionId = result.competitionId;
        if (existing.round === null && result.round !== null) existing.round = result.round;
        continue;
      }

      const group: UnlinkedHistoricalResult = {
        key: result.resultGroupId,
        season: result.season,
        opponent: result.opponent,
        opponentClubId: result.opponentClubId,
        competitionId: result.competitionId,
        round: result.round,
        status: result.status,
        claims: [result],
        agreement: "single_source",
      };
      byGroupId.set(result.resultGroupId, group);
      groups.push(group);
    } else {
      groups.push({
        key: `${result.sourceId}-${result.id}`,
        season: result.season,
        opponent: result.opponent,
        opponentClubId: result.opponentClubId,
        competitionId: result.competitionId,
        round: result.round,
        status: result.status,
        claims: [result],
        agreement: "single_source",
      });
    }
  }

  for (const group of groups) {
    if (group.claims.length <= 1) {
      group.agreement = "single_source";
      continue;
    }

    const first = group.claims[0]!;
    const rounds = new Set(group.claims.map((c) => c.round).filter((r): r is number => r !== null));
    const roundDispute = rounds.size > 1;

    const allAgree =
      !roundDispute &&
      group.claims.every(
        (c) =>
          c.status === first.status &&
          c.aafkScore === first.aafkScore &&
          c.opponentScore === first.opponentScore &&
          c.replay === first.replay &&
          c.afterExtraTime === first.afterExtraTime,
      );

    group.agreement = allAgree ? "sources_agree" : "sources_disagree";
  }

  return groups;
}

function getDisputeLabel(claims: SourceResult[]): string {
  const scores = new Set(claims.map((c) => `${c.aafkScore}–${c.opponentScore}`));
  const statuses = new Set(claims.map((c) => c.status));
  const rounds = new Set(claims.map((c) => c.round).filter((r): r is number => r !== null));

  if (scores.size > 1 && rounds.size <= 1) {
    return "Kildene er uenige om resultatet:";
  }
  if (rounds.size > 1 && scores.size <= 1 && statuses.size <= 1) {
    return "Kildene er uenige om runden:";
  }
  return "Kildene er uenige om opplysningene:";
}

export function UnlinkedResults({
  results,
  year,
  titles,
  competitionNames,
}: {
  results: SourceResult[];
  year: number;
  titles: Map<string, string>;
  competitionNames?: Map<string, string>;
}) {
  const unlinked = groupUnlinkedResults(results);
  if (unlinked.length === 0) return null;

  return (
    <section className="content-section source-results">
      <h2 className="section-heading">
        <span className="section-heading-title">Resultater uten full kampkobling</span>
        <span className="muted section-count">
          {unlinked.length} {unlinked.length === 1 ? "resultat" : "resultater"}
        </span>
      </h2>
      <p className="notice prose">
        Disse resultatene er dokumentert i historiske kilder, men arkivet mangler fortsatt nok opplysninger til å
        knytte dem sikkert til en komplett kamp. De inngår derfor ikke i den ordinære kampstatistikken.
      </p>
      <ol className="source-result-list" aria-label={`Resultater uten full kampkobling fra ${year}`}>
        {unlinked.map((item) => {
          const refs: CitedRef[] = item.claims.map((claim) => ({
            sourceId: claim.sourceId,
            page: String(claim.page),
          }));

          const compName =
            item.competitionId === "nm"
              ? "NM"
              : item.competitionId
                ? (competitionNames?.get(item.competitionId) ?? item.competitionId)
                : "Kamp";

          const context = (
            <span className="source-result-context">
              {compName}
              {item.round ? ` · ${item.round}. runde` : ""}
            </span>
          );

          if (item.agreement === "sources_disagree") {
            const disputeLabel = getDisputeLabel(item.claims);
            return (
              <li key={item.key} style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "baseline" }}>
                  {context}
                  <strong>{item.opponent ?? "Motstander ikke oppgitt"}</strong>
                </div>
                <div className="notice" style={{ margin: "0.25rem 0" }}>
                  <p style={{ margin: "0 0 0.4rem", fontWeight: 600 }}>{disputeLabel}</p>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: "0.25rem" }}>
                    {item.claims.map((claim) => {
                      const scoreText = claim.status === "walkover" ? "w.o." : `${claim.aafkScore}–${claim.opponentScore}`;
                      const sourceName = titles.get(claim.sourceId) ?? claim.sourceId;
                      const meta = [
                        claim.round ? `${claim.round}. runde` : null,
                        claim.replay ? "omkamp" : null,
                        claim.afterExtraTime ? "ekstraomganger" : null,
                        claim.note,
                        `s. ${claim.page}`,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li key={`${claim.sourceId}-${claim.id}`}>
                          <strong>{scoreText}</strong> ({sourceName}, {meta})
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="source-result-notes">
                  <SourceChips refs={refs} titles={titles} />
                </div>
              </li>
            );
          }

          const primaryClaim = item.claims[0]!;
          const scoreText =
            primaryClaim.status === "walkover" ? "w.o." : `${primaryClaim.aafkScore}–${primaryClaim.opponentScore}`;
          const notes = [
            primaryClaim.replay ? "omkamp" : null,
            primaryClaim.afterExtraTime ? "ekstraomganger" : null,
            primaryClaim.note,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <li key={item.key}>
              {context}
              <strong>{item.opponent ?? "Motstander ikke oppgitt"}</strong>
              <span className="source-result-score num">{scoreText}</span>
              <div className="source-result-notes" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                {notes ? <span className="muted small">{notes}</span> : null}
                <SourceChips refs={refs} titles={titles} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
