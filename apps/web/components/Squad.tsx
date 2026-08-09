import type { CoachSpell, SquadPlayer } from "@/lib/archive";
import { formatDayMonth } from "@/lib/date";

/**
 * Trenerne som hadde laget i løpet av sesongen.
 *
 * Trenerdataene har ligget i `lineups.coach` på 498 kamper uten å bli vist noe
 * sted. Perioden er utledet av kampene, ikke av ansettelsesdatoer vi ikke har,
 * så et trenerbytte midt i sesongen kommer fram av seg selv: 2023 har tre.
 */
export function SeasonCoaches({
  coaches,
  declared,
  season,
}: {
  coaches: CoachSpell[];
  declared: { name: string; fromSeason: number; toSeason: number | null }[];
  season: number;
}) {
  // Faller tilbake på det kilden oppgir når kampene ikke rekker. Den er grovere
  // — bare årstall, og uten vikarene — så den brukes bare når det ikke finnes
  // noe utledet for året.
  if (coaches.length === 0 && declared.length > 0) {
    return (
      <p className="season-coach small muted">
        {declared.length === 1 ? "Trener" : "Trenere"}:{" "}
        {declared.map((spell, index) => (
          <span key={spell.name}>
            {index > 0 && ", "}
            <strong>{spell.name}</strong>
          </span>
        ))}{" "}
        <span className="coach-declared">oppgitt, ikke utledet av kampene</span>
      </p>
    );
  }
  if (coaches.length === 0) return null;

  const inSeason = (spell: CoachSpell) => {
    // Bare kampene i denne sesongen teller i teksten. En periode som strekker
    // seg over tre år ville ellers stått med 92 kamper på et enkelt år.
    const startsHere = spell.fromSeason === season;
    const endsHere = spell.toSeason === season;
    if (startsHere && endsHere) return `${spell.matches} kamper`;
    if (startsHere) return `fra ${formatDayMonth(spell.fromDate)}`;
    if (endsHere) return `til ${formatDayMonth(spell.toDate)}`;
    return "hele sesongen";
  };

  return (
    <p className="season-coach small muted">
      {coaches.length === 1 ? "Trener" : "Trenere"}:{" "}
      {coaches.map((spell, index) => (
        <span key={`${spell.name}-${spell.fromDate}`}>
          {index > 0 && ", "}
          <strong>{spell.name}</strong>
          {coaches.length > 1 && <> ({inSeason(spell)})</>}
        </span>
      ))}
    </p>
  );
}

/**
 * Stallen for sesongen.
 *
 * Sortert på antall kamper, ikke alfabetisk: den som spilte mest er den som
 * bar sesongen, og det er den opplysningen lista finnes for.
 *
 * «Ny» betyr at spilleren ikke var med sesongen før. Det er ikke det samme som
 * hentet — en som var skadet hele fjoråret ser like ny ut — og merkelappen sier
 * derfor det den vet, ikke det den kunne gjettet.
 */
export function SquadList({ players }: { players: SquadPlayer[] }) {
  if (players.length === 0) return null;
  const newcomers = players.filter((player) => player.isNew).length;
  const withRegister = players.filter((player) => player.number !== null || player.position !== null).length;

  return (
    <section className="content-section">
      <h2 className="section-heading">
        <span className="section-heading-title">Stallen</span>
        <span className="muted section-count">
          {players.length} spillere
          {newcomers > 0 && `, ${newcomers} nye`}
        </span>
      </h2>

      <div className="table-scroll">
        <table className="squad-table">
          <thead>
            <tr>
              <th scope="col" className="num col-number">#</th>
              <th scope="col">Spiller</th>
              <th scope="col">Posisjon</th>
              {/* «Kamper» leses som spilte kamper, og tallet er noe annet: ganger
                  spilleren sto i den oppsatte troppen, benken medregnet.
                  Forklaringen under tabellen sto der allerede, men da har
                  leseren rukket å lære feil tall først. */}
              <th scope="col" className="num">I kamptropp</th>
              <th scope="col" className="num">Fra start</th>
              <th scope="col" className="num">Mål</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.personKey}>
                {/* Draktnummer og posisjon kommer fra personregisteret, som
                    dekker en del av stallen. Tom celle er riktig svar for dem
                    som ikke står der. */}
                <td className="num col-number muted">{player.number ?? ""}</td>
                <th scope="row">
                  {player.name}
                  {player.isNew && <span className="squad-new"> ny</span>}
                </th>
                <td className="muted small">{player.position ?? ""}</td>
                <td className="num">{player.appearances}</td>
                <td className="num">{player.starts}</td>
                {/* Null mål er en opplysning for en spiss og ingen for en
                    keeper. Streken sier «ingen», tallet sier «så mange». */}
                <td className="num">{player.goals > 0 ? player.goals : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="small muted prose">
        «I kamptropp», «fra start» og mål er utledet av lagoppstillingene, som
        arkivet har fra 2010. Å stå i troppen er ikke det samme som å ha spilt:
        benken teller med, fordi kilden ikke skiller mellom en som satt der og
        en som kom inn. «Ny» betyr
        at spilleren ikke var med i fjor, ikke at han ble hentet.
        {withRegister > 0 && (
          <> Draktnummer og posisjon står for {withRegister} av dem, fra Wikipedias stallmal.</>
        )}
      </p>
    </section>
  );
}
