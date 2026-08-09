import type { ArchiveMatch } from "@/lib/archive";
import { formatWeekdayDate, nowInOslo } from "@/lib/date";

/**
 * Neste kamp på terminlista.
 *
 * De femten kampene som ikke er spilt ennå har ligget i arkivet uten å bli vist
 * noe sted. For den som følger klubben er dette det ene spørsmålet som stilles
 * oftest mellom kampene, og svaret lå der hele tiden.
 *
 * Ukedagen står bare her. Ellers på siden er datoen nok, men en kamp som kommer
 * planlegges etter hvilken dag i uka den er.
 *
 * ## Kampdagen
 *
 * Kortet sto og lovet «Neste kamp» klokka 17:42 om en kamp med avspark 17:00.
 * Terminlista er ikke gal — arkivet venter bare på neste innhøsting — men
 * ordvalget påsto noe som var blitt usant mens siden lå der. Teksten sier nå hva
 * arkivet faktisk vet: i dag spilles den, og resultatet er ikke registrert ennå.
 *
 * Forsiden bygges på nytt hver time, så «avsparket er passert» kan henge inntil
 * en time etter. Derfor er det bare den setningen som avhenger av klokka;
 * «Dagens kamp» er sant hele dagen uansett når siden ble bygget.
 */
export function NextMatch({ match }: { match: ArchiveMatch | undefined }) {
  if (!match) return null;

  const now = nowInOslo();
  const isToday = match.date === now.date;
  const kickedOff = isToday && match.kickoff !== null && now.time >= match.kickoff;

  return (
    <a className="next-match" href={match.url}>
      <span className="eyebrow">{isToday ? "Dagens kamp" : "Neste kamp"}</span>
      <strong className="next-match-teams">
        {match.isHome ? "AaFK – " : ""}{match.opponent}{match.isHome ? "" : " – AaFK"}
      </strong>
      <span className="next-match-when">
        {kickedOff ? "Resultatet er ikke registrert ennå" : formatWeekdayDate(match.date)}
        {!kickedOff && match.kickoff ? ` kl. ${match.kickoff}` : ""}
      </span>
      <span className="next-match-where muted small">
        {match.isHome ? "Hjemme" : "Borte"} · {match.competition}
      </span>
    </a>
  );
}
