import Link from "next/link";
import type { CoachSpell, SeasonTransfer, SquadPlayer } from "@/lib/archive";
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
export function SquadList({ players, transfers, season }: {
  players: SquadPlayer[];
  transfers: SeasonTransfer[];
  season: number;
}) {
  // Oppstillingene finnes fra 2010, men overgangene kan være eldre: medlemsbladene
  // dokumenterer overganger fra 1950. En sesong uten stall skal derfor fortsatt
  // vise bevegelsene, uten en tom tabell over dem.
  if (players.length === 0) {
    return transfers.length > 0
      ? (
        <section className="content-section">
          <h2 className="section-heading">
            <span className="section-heading-title">Inn og ut</span>
            <span className="muted section-count">{movementCount(transfers)}</span>
          </h2>
          <SquadMovements transfers={transfers} season={season} />
          <p className="small muted prose">
            Arkivet har ingen lagoppstillinger for {season}, så stallen er ikke
            kjent. Overgangene over er kildeført hver for seg, og er ikke en
            fullstendig liste over hvem som kom og gikk.
          </p>
        </section>
      )
      : null;
  }
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
                  {/* «Ny» sier bare at spilleren ikke var med i fjor. Finnes det
                      en kildeført overgang, vet arkivet mer enn det, og da skal
                      det stå. Uten overgang står merkelappen som før. */}
                  {player.isNew && (
                    player.arrivedFrom
                      ? <span className="squad-new"> hentet fra {player.arrivedFrom}</span>
                      : <span className="squad-new"> ny</span>
                  )}
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

      <SquadMovements transfers={transfers} season={season} />

      <p className="small muted prose">
        «I kamptropp», «fra start» og mål er utledet av lagoppstillingene, som
        arkivet har fra 2010. Å stå i troppen er ikke det samme som å ha spilt:
        benken teller med, fordi kilden ikke skiller mellom en som satt der og
        en som kom inn. «Ny» betyr
        at spilleren ikke var med i fjor, ikke at han ble hentet.
        {withRegister > 0 && (
          <> Draktnummer og posisjon står for {withRegister} av dem, fra Wikipedias stallmal.</>
        )}
        {transfers.length > 0 && (
          <> Der en kilde dokumenterer overgangen, står klubben i stedet for «ny».</>
        )}
      </p>
    </section>
  );
}

/** Merkelappene for overgangstypene. `transfer` er standard og trenger ingen. */
const TRANSFER_KIND_LABELS: Record<string, string> = {
  loan: "lån",
  loan_return: "tilbake fra lån",
  free: "kontraktløs",
  academy: "egen ungdom",
  released: "kontrakt utløpt",
  retired: "la opp",
};

/** «3 inn, 2 ut» — det leseren vil vite før seksjonen åpnes. */
function movementCount(transfers: SeasonTransfer[]): string {
  const inbound = transfers.filter((entry) => entry.direction === "in").length;
  const outbound = transfers.length - inbound;
  return [inbound > 0 ? `${inbound} inn` : null, outbound > 0 ? `${outbound} ut` : null]
    .filter(Boolean)
    .join(", ");
}

/**
 * Spillere inn og ut i løpet av sesongen.
 *
 * Står under stallen fordi det er samme spørsmål sett fra en annen kant: hvem
 * laget besto av, og hvordan det ble slik. Lista er kildeført én overgang om
 * gangen og er sjelden fullstendig — et tomt felt betyr manglende kilde, ikke
 * en sesong uten bevegelser. Derfor er det ingen totalsum her som kan leses som
 * «så mange kom og gikk det året».
 */
export function SquadMovements({ transfers, season }: { transfers: SeasonTransfer[]; season: number }) {
  if (transfers.length === 0) return null;
  const inbound = transfers.filter((entry) => entry.direction === "in");
  const outbound = transfers.filter((entry) => entry.direction === "out");

  return (
    <div className="squad-movements">
      <Movements title={`Inn i ${season}`} entries={inbound} empty="Ingen overganger inn er kildeført for sesongen." />
      <Movements title={`Ut av ${season}`} entries={outbound} empty="Ingen overganger ut er kildeført for sesongen." />
    </div>
  );
}

function Movements({ title, entries, empty }: { title: string; entries: SeasonTransfer[]; empty: string }) {
  return (
    <div>
      <h3 className="subsection-heading">{title}</h3>
      {entries.length === 0 ? (
        <p className="small muted">{empty}</p>
      ) : (
        <ul className="movement-list">
          {entries.map((entry) => (
            <li key={`${entry.personId}-${entry.date}-${entry.club ?? ""}`}>
              <Link href={`/personer/${entry.personId}`}>{entry.name}</Link>
              {/* Klubben lenkes bare når den finnes i arkivet. Klubbkatalogen er
                  motstandere, og de fleste overganger går til en klubb AaFK
                  aldri har møtt — da står kildens skrivemåte som ren tekst. */}
              {entry.club && (
                <span className="muted">
                  {" · "}
                  {entry.clubId
                    ? <Link href={`/motstander/${entry.clubId}`}>{entry.club}</Link>
                    : entry.club}
                </span>
              )}
              {entry.kind !== "transfer" && TRANSFER_KIND_LABELS[entry.kind] && (
                <span className="squad-new"> {TRANSFER_KIND_LABELS[entry.kind]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
