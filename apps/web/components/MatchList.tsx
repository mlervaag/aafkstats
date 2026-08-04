import type { ArchiveMatch } from "@/lib/archive";
import { formatDateShort } from "@/lib/date";
import { readableScore } from "@/lib/score";

export function MatchList({ matches }: { matches: ArchiveMatch[] }) {
  return (
    <ol className="archive-match-list">
      {matches.map((match) => {
        const { score, qualifier, label } = readableScore(match);
        const upcoming = match.status === "scheduled";
        return (
          <li key={match.matchId} className={upcoming ? "is-upcoming" : undefined}>
            <a href={match.url}>
              <span className="match-date num">{formatDateShort(match.date)}</span>
              <span className="match-opponent">
                {/* Merket bærer resultatet for spilte kamper. En kamp som ikke er
                    spilt får ikke et tomt merke i stedet — da ville raden sett ut
                    som en kamp vi mangler noe om. */}
                {match.result
                  ? <span className={`result-badge result-${match.result}`}>{match.result}</span>
                  : upcoming
                    ? <span className="result-badge result-upcoming" aria-hidden="true">·</span>
                    : null}
                <span>{match.isHome ? "AaFK – " : ""}{match.opponent}{match.isHome ? "" : " – AaFK"}</span>
              </span>
              <strong className="match-score score" title={label}>
                {score}
                {qualifier && <span className="score-qualifier"> {qualifier}</span>}
              </strong>
              <span className="match-meta muted">
                {upcoming ? "Ikke spilt · " : ""}
                {match.isHome ? "Hjemme" : "Borte"} · {match.competition}
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
