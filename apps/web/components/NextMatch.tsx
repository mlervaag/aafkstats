import type { ArchiveMatch } from "@/lib/archive";
import { formatWeekdayDate } from "@/lib/date";

/**
 * Neste kamp på terminlista.
 *
 * De femten kampene som ikke er spilt ennå har ligget i arkivet uten å bli vist
 * noe sted. For den som følger klubben er dette det ene spørsmålet som stilles
 * oftest mellom kampene, og svaret lå der hele tiden.
 *
 * Ukedagen står bare her. Ellers på siden er datoen nok, men en kamp som kommer
 * planlegges etter hvilken dag i uka den er.
 */
export function NextMatch({ match }: { match: ArchiveMatch | undefined }) {
  if (!match) return null;

  return (
    <a className="next-match" href={match.url}>
      <span className="eyebrow">Neste kamp</span>
      <strong className="next-match-teams">
        {match.isHome ? "AaFK – " : ""}{match.opponent}{match.isHome ? "" : " – AaFK"}
      </strong>
      <span className="next-match-when">
        {formatWeekdayDate(match.date)}
        {match.kickoff ? ` kl. ${match.kickoff}` : ""}
      </span>
      <span className="next-match-where muted small">
        {match.isHome ? "Hjemme" : "Borte"} · {match.competition}
      </span>
    </a>
  );
}
