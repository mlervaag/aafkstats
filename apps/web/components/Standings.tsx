import type { ProgressionPoint, StandingsRow } from "@/lib/archive";

/**
 * Hva en plassering førte til, som en kort merkelapp.
 *
 * Bare det som endret divisjon. Kilden skriver også europacupplasser, og de
 * står i `note` på raden — de er en opplysning, men ikke en tabellskjebne.
 */
const OUTCOMES: Record<string, string> = {
  promoted: "Opprykk",
  relegated: "Nedrykk",
  promotion_playoff: "Opprykkskval.",
  relegation_playoff: "Nedrykkskval.",
  playoff: "Kvalifisering",
};

/**
 * Sluttabellen for sesongen.
 *
 * Lagnavnet er kildens eget. Radene for lag arkivet kjenner blir lenker; resten
 * står som tekst, og det er en normal tilstand — AaFK har ikke møtt alle lagene
 * i hver divisjon de har spilt i.
 */
export function StandingsTable({ rows, season }: { rows: StandingsRow[]; season: number }) {
  if (rows.length === 0) return null;

  return (
    <div className="table-scroll">
      <table className="standings-table">
        <caption className="sr-only">Sluttabell for {season}</caption>
        <thead>
          <tr>
            <th scope="col" className="col-pos">#</th>
            <th scope="col">Lag</th>
            <th scope="col" className="num">K</th>
            <th scope="col" className="num">S</th>
            <th scope="col" className="num">U</th>
            <th scope="col" className="num">T</th>
            <th scope="col" className="num">Mål</th>
            <th scope="col" className="num">±</th>
            <th scope="col" className="num">P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.position} className={row.clubId === "aalesunds-fk" ? "is-aafk" : undefined}>
              <td className="num col-pos">{row.position}</td>
              <th scope="row">
                {row.url ? <a href={row.url}>{row.team}</a> : row.team}
                {OUTCOMES[row.outcome] && (
                  <span className={`outcome outcome-${row.outcome}`}> {OUTCOMES[row.outcome]}</span>
                )}
              </th>
              <td className="num">{row.played}</td>
              <td className="num">{row.wins}</td>
              <td className="num">{row.draws}</td>
              <td className="num">{row.losses}</td>
              <td className="num">{row.goalsFor}–{row.goalsAgainst}</td>
              {/* Fortegnet skrives ut. «5» og «-5» ved siden av hverandre i en
                  kolonne uten fortegn leses feil av alle som skummer. */}
              <td className="num">{row.goalDifference > 0 ? "+" : ""}{row.goalDifference}</td>
              <td className="num"><strong>{row.points}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Plasseringen runde for runde.
 *
 * Tegnet som en linje med 1. plass øverst, fordi det er slik en tabell leses.
 * En graf med lav plassering høyt oppe ville vært riktig på aksen og feil for
 * øyet.
 *
 * Diskré med vilje: ingen akser, ingen rutenett, ingen forklaring. Formen er
 * poenget — om sesongen gikk oppover eller nedover — og de eksakte tallene står
 * i tabellen rett under.
 */
export function ProgressionChart({
  points,
  teams,
  season,
}: {
  points: ProgressionPoint[];
  teams: number;
  season: number;
}) {
  if (points.length < 3 || teams < 2) return null;

  const width = 100;
  const height = 28;
  // Luft over og under, slik at en sesong på topp eller bunn ikke tegnes langs
  // kanten av flata. En linje som ligger på rammen ser ut som en feil.
  const pad = 2.5;
  const lastRound = points.at(-1)!.round;
  const x = (round: number) => ((round - 1) / Math.max(1, lastRound - 1)) * width;
  // 1. plass mot toppen. Bunnen av flata er siste plass, ikke null.
  const y = (position: number) =>
    pad + ((position - 1) / Math.max(1, teams - 1)) * (height - pad * 2);

  const line = points.map((p) => `${x(p.round).toFixed(2)},${y(p.position).toFixed(2)}`).join(" ");
  const best = Math.min(...points.map((p) => p.position));
  const worst = Math.max(...points.map((p) => p.position));
  const final = points.at(-1)!;

  return (
    <figure className="progression">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          `Plassering gjennom ${season}: best ${best}. plass, dårligst ${worst}. plass, `
          + `sluttet som nummer ${final.position} av ${teams} etter ${lastRound} runder.`
        }
      >
        {/* Én referanselinje: der nedrykksstreken går. Uten den er det ikke mulig
            å se om en kurve som faller er dramatisk eller udramatisk. */}
        <line
          x1="0" x2={width}
          y1={y(teams - 1.5)} y2={y(teams - 1.5)}
          className="progression-danger"
          vectorEffect="non-scaling-stroke"
        />
        {/* Ingen punktmarkør på enden. Flata strekkes for å holde seg lav, og en
            sirkel i et strukket koordinatsystem blir en ellipse — et lite,
            skjevt element som ser ut som en feil. Sluttplassen står i tallene
            over og i tabellen under. */}
        <polyline points={line} className="progression-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="small muted">
        Plassering runde for runde, best {best}. og dårligst {worst}. Regnet ut av
        rundene hos kilden, ikke av kampene i arkivet.
      </figcaption>
    </figure>
  );
}
