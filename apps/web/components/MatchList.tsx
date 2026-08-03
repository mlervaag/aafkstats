import type { ArchiveMatch } from "@/lib/archive";

export function MatchList({ matches }: { matches: ArchiveMatch[] }) {
  return (
    <ol className="archive-match-list">
      {matches.map((match) => {
        const score = match.aafkScore === null || match.opponentScore === null
          ? "–"
          : match.isHome
            ? `${match.aafkScore}–${match.opponentScore}`
            : `${match.opponentScore}–${match.aafkScore}`;
        return (
          <li key={match.matchId}>
            <a href={match.url}>
              <span className="match-date num">{match.date}</span>
              <span className="match-opponent">
                {match.result && <span className={`result-badge result-${match.result}`}>{match.result}</span>}
                <span>{match.isHome ? "AaFK – " : ""}{match.opponent}{match.isHome ? "" : " – AaFK"}</span>
              </span>
              <strong className="match-score score">{score}</strong>
              <span className="match-meta muted">{match.isHome ? "Hjemme" : "Borte"} · {match.competition}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
