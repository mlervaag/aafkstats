import type { ArchiveMatch } from "@/lib/archive";

const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTHS = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];

/**
 * Neste kamp på terminlista.
 *
 * De femten kampene som ikke er spilt ennå har ligget i arkivet uten å bli vist
 * noe sted. For den som følger klubben er dette det ene spørsmålet som stilles
 * oftest mellom kampene, og svaret lå der hele tiden.
 *
 * Datoen skrives ut fordi «2026-08-09» ikke er slik noen sier det. Kampdatoene
 * ellers i arkivet står på ISO-form med vilje — de skal kunne sammenlignes og
 * sorteres av øyet — men denne ene skal leses.
 */
export function NextMatch({ match }: { match: ArchiveMatch | undefined }) {
  if (!match) return null;
  const [year, month, day] = match.date.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));

  return (
    <a className="next-match" href={match.url}>
      <span className="eyebrow">Neste kamp</span>
      <strong className="next-match-teams">
        {match.isHome ? "AaFK – " : ""}{match.opponent}{match.isHome ? "" : " – AaFK"}
      </strong>
      <span className="next-match-when">
        {WEEKDAYS[date.getUTCDay()]} {day}. {MONTHS[month! - 1]}
        {match.kickoff ? ` kl. ${match.kickoff}` : ""}
      </span>
      <span className="next-match-where muted small">
        {match.isHome ? "Hjemme" : "Borte"} · {match.competition}
      </span>
    </a>
  );
}
