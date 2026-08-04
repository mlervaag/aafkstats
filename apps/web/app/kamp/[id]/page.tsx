import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { one, open } from "@aafkstats/db";
import { formatDate, formatDateShort } from "@/lib/date";
import { loadMatchIndex } from "@/lib/archive";
import { matchDescription, matchTitle, pageMetadata } from "@/lib/metadata";
import { hasBeenPlayed, statusNote } from "@/lib/status";

/**
 * Alle kampsidene forhåndsgenereres.
 *
 * Dataene endrer seg bare ved utrulling, så en side som bygges per forespørsel
 * gjør det samme arbeidet om og om igjen for et svar som ikke kan bli et annet.
 * Nye kampfiler kommer med automatisk: lista under leses fra arkivet ved bygging.
 */
export function generateStaticParams(): { id: string }[] {
  return loadMatchIndex().map((match) => ({ id: match.matchId }));
}

interface EventRow {
  minute: number;
  stoppage?: number;
  type: string;
  team: "home" | "away";
  player?: string;
  assist?: string;
  playerOff?: string;
}

interface Lineup {
  formation?: string;
  starters: string[];
  subs: string[];
  coach?: string;
}

interface TeamStats {
  possession?: number;
  shots?: number;
  shotsOnTarget?: number;
  corners?: number;
  fouls?: number;
  offsides?: number;
  xg?: number;
}

interface SourceRef {
  sourceId: string;
  url?: string;
  retrievedAt?: string;
  fields: string[];
}

interface MatchDetail {
  id: string;
  season: number;
  opponent_club_id: string;
  opponent_name: string;
  is_home: number;
  match_date: string;
  kickoff: string | null;
  status: string;
  competition_name: string;
  round: number | null;
  home_name: string;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  home_ht_score: number | null;
  away_ht_score: number | null;
  venue_name: string | null;
  attendance: number | null;
  referee: string | null;
  events: string;
  lineups: string | null;
  stats: string | null;
  sources: string;
  conflicts: string;
  confidence: string;
  stage: string | null;
  home_et_score: number | null;
  away_et_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  note: string | null;
}

/** Sluttspillstadium skrevet ut. Cupkamper viser dette i stedet for et rundenummer. */
const stageNames: Record<string, string> = {
  group: "Gruppespill",
  qualifying: "Kvalifisering",
  round_of_32: "16-delsfinale",
  round_of_16: "Åttedelsfinale",
  quarter_final: "Kvartfinale",
  semi_final: "Semifinale",
  third_place: "Bronsefinale",
  final: "Finale",
  promotion_playoff: "Kvalifisering til opprykk",
  relegation_playoff: "Nedrykkskvalifisering",
  friendly: "Treningskamp",
};

function loadMatch(id: string): MatchDetail | undefined {
  const db = open();
  try {
    return one<MatchDetail>(
      db,
      `SELECT m.id, m.season, m.opponent_club_id, m.opponent_name, m.is_home,
              m.match_date, m.kickoff, m.status, m.competition_name, m.round, m.stage,
              h.name AS home_name, a.name AS away_name, m.home_score, m.away_score,
              m.home_ht_score, m.away_ht_score, m.home_et_score, m.away_et_score,
              m.home_pens, m.away_pens,
              m.venue_name, m.attendance, m.referee, m.note,
              m.events, m.lineups, m.stats, m.sources, m.conflicts, m.confidence
       FROM core_matches m
       JOIN core_clubs h ON h.id = m.home_club_id
       JOIN core_clubs a ON a.id = m.away_club_id
       WHERE m.id = ?`,
      id,
    );
  } finally {
    db.close();
  }
}

const getMatch = cache(loadMatch);

interface ConflictValue {
  value: string | number | null;
  sourceId: string;
  note?: string;
}

interface ConflictRow {
  field: string;
  values: ConflictValue[];
  resolved: boolean;
  chosen?: string | number | null;
  chosenSourceId?: string;
  decision: string;
  decidedAt?: string;
  reason?: string;
  locked: boolean;
  note?: string;
}

interface Neighbour {
  id: string;
  match_date: string;
  opponent_name: string;
}

/**
 * Kampen før og etter, i samme sesong og samme konkurranse.
 *
 * Kampsiden var en blindvei: eneste vei videre var tilbakeknappen. Serien leses
 * som en rekkefølge, og det er den rekkefølgen som skal kunne følges.
 */
function loadNeighbours(match: MatchDetail): { previous?: Neighbour; next?: Neighbour } {
  const db = open();
  try {
    const sql = (direction: "<" | ">") =>
      `SELECT id, match_date, opponent_name FROM core_matches
        WHERE season = ? AND competition_id = (SELECT competition_id FROM core_matches WHERE id = ?)
          AND match_date ${direction} ?
        ORDER BY match_date ${direction === "<" ? "DESC" : "ASC"} LIMIT 1`;
    return {
      previous: one<Neighbour>(db, sql("<"), match.season, match.id, match.match_date),
      next: one<Neighbour>(db, sql(">"), match.season, match.id, match.match_date),
    };
  } finally {
    db.close();
  }
}

function json<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

const eventNames: Record<string, string> = {
  goal: "Mål",
  own_goal: "Selvmål",
  penalty_goal: "Straffemål",
  missed_penalty: "Straffebom",
  yellow_card: "Gult kort",
  second_yellow_card: "Andre gule",
  red_card: "Rødt kort",
  substitution: "Bytte",
  var_decision: "VAR",
};

/**
 * Metadata per kamp.
 *
 * Alle kampsidene delte tittelen «AaFK-arkivet» og prosjektbeskrivelsen fra
 * rotoppsettet. Delte noen en kamp, fikk mottakeren ingenting om kampen, og en
 * søkemotor så tusen identiske sider.
 *
 * Kampen slås opp én gang per forespørsel: `cache` gjør at `generateMetadata` og
 * selve siden deler resultatet i stedet for å åpne databasen to ganger.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) return { title: "Kamp" };

  const meta = {
    homeName: match.home_name,
    awayName: match.away_name,
    homeScore: match.home_score === null ? null : match.home_score + (match.home_et_score ?? 0),
    awayScore: match.away_score === null ? null : match.away_score + (match.away_et_score ?? 0),
    date: match.match_date,
    status: match.status,
    competition: match.competition_name,
    venue: match.venue_name,
    attendance: match.attendance,
  };
  return pageMetadata(matchTitle(meta), matchDescription(meta), `/kamp/${id}`);
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) notFound();
  const { previous, next } = loadNeighbours(match);

  const events = json<EventRow[]>(match.events, []);
  const lineups = json<{ home?: Lineup; away?: Lineup }>(match.lineups, {});
  const stats = json<{ home?: TeamStats; away?: TeamStats }>(match.stats, {});
  const sources = json<SourceRef[]>(match.sources, []);
  const conflicts = json<ConflictRow[]>(match.conflicts, []);
  // Overskriftsresultatet er sluttresultatet. home_score er stillingen etter
  // ordinær tid, så ekstraomgangsmålene må legges til — ellers står en cupkamp
  // som endte 2-1 på overtid oppført som 1-1.
  const hasScore = match.home_score !== null && match.away_score !== null;
  const homeFull = hasScore ? match.home_score! + (match.home_et_score ?? 0) : null;
  const awayFull = hasScore ? match.away_score! + (match.away_et_score ?? 0) : null;
  const score = homeFull === null || awayFull === null ? "–" : `${homeFull}–${awayFull}`;

  const afterExtraTime = match.home_et_score !== null || match.away_et_score !== null;
  const extraTimeGoals = (match.home_et_score ?? 0) > 0 || (match.away_et_score ?? 0) > 0;
  const shootout = match.home_pens !== null && match.away_pens !== null;
  const stageLabel = match.stage && match.stage !== "regular_season"
    ? stageNames[match.stage] ?? null
    : null;
  const played = hasBeenPlayed(match.status);
  const status = statusNote(match.status);

  return (
    <article className="match-page">
      {/* Brødsmulen sa «Forsiden / Kamp» — to ledd som ikke plasserte kampen i
          noe. Sesongen og motstanderen er de to sammenhengene kampen hører til,
          og begge har en side å gå til. */}
      <p className="breadcrumb">
        <a href="/sesonger">Sesonger</a> / <a href={`/sesong/${match.season}`}>{match.season}</a> /{" "}
        <a href={`/motstander/${match.opponent_club_id}`}>{match.opponent_name}</a>
      </p>
      <header className="match-header">
        <p className="small muted num">
          {formatDate(match.match_date)}{match.kickoff ? ` kl. ${match.kickoff}` : ""} · {match.competition_name}
          {stageLabel ? ` · ${stageLabel}` : match.round ? ` · Runde ${match.round}` : ""}
        </p>
        <div className="scoreboard">
          <h1>{match.home_name}</h1>
          {/* Avsparket står der resultatet ellers ville stått. En tankestrek her
              leses som et tall vi mangler. */}
          <strong className={played ? "scoreline" : "scoreline scoreline-upcoming"}>
            {played ? score : match.kickoff ?? "mot"}
          </strong>
          <h1>{match.away_name}</h1>
        </div>
        {status && (
          <p className={`match-status match-status-${match.status}`}>
            <strong>{status.label}.</strong> {status.note}
          </p>
        )}
        {(afterExtraTime || shootout) && (
          <p className="small muted">
            {shootout
              ? `Avgjort på straffespark ${match.home_pens}–${match.away_pens}`
              : "Etter ekstraomganger"}
            {/* Bare når ekstraomgangene faktisk ga mål. Er extraTime 0-0, er
                ordinærresultatet identisk med sluttresultatet i tallene våre — og
                for kilder som bare oppgir sluttresultatet vet vi ikke stillingen
                etter 90. Da ville linja påstått noe kilden ikke dekker. */}
            {extraTimeGoals && hasScore
              ? ` · ${match.home_score}–${match.away_score} etter ordinær tid`
              : ""}
          </p>
        )}
        {match.home_ht_score !== null && match.away_ht_score !== null && (
          <p className="small muted">Pause {match.home_ht_score}–{match.away_ht_score}</p>
        )}
        {/* Forbehold som hører til kampen selv. Typisk fra eldre kilder som bare
            oppgir sluttresultatet. Lagres det uten å vises, er det like borte. */}
        {match.note && <p className="small muted match-note">{match.note}</p>}
      </header>

      <dl className="facts">
        {match.venue_name && <><dt>Stadion</dt><dd>{match.venue_name}</dd></>}
        {match.attendance !== null && <><dt>Tilskuere</dt><dd className="num">{match.attendance.toLocaleString("nb-NO")}</dd></>}
        {match.referee && <><dt>Dommer</dt><dd>{match.referee}</dd></>}
      </dl>

      {/* Hendelser, oppstilling og statistikk finnes ikke før kampen er spilt.
          «Ingen hendelser registrert» under en kamp som er tre uker unna er ikke
          en opplysning, det er en tom seksjon som ser ut som et hull. */}
      {played && (
      <section>
        <h2>Kamphendelser</h2>
        {events.length === 0 ? <p className="muted">Ingen hendelser registrert.</p> : (
          <ol className="timeline">
            {events.map((event, index) => (
              <li key={`${event.minute}-${event.stoppage ?? 0}-${event.type}-${index}`}>
                <span className="event-time num">{event.minute}{event.stoppage ? `+${event.stoppage}` : ""}′</span>
                <span>
                  <strong>{eventNames[event.type] ?? event.type}</strong>{" "}
                  {event.player ?? "Ukjent spiller"}
                  {event.playerOff ? ` for ${event.playerOff}` : ""}
                  {event.assist ? <span className="muted"> · {event.assist}</span> : null}
                  <span className="small muted"> · {event.team === "home" ? match.home_name : match.away_name}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      )}

      {played && (lineups.home || lineups.away) && (
        <section>
          <h2>Lagoppstillinger</h2>
          <div className="two-column">
            <LineupBlock name={match.home_name} lineup={lineups.home} />
            <LineupBlock name={match.away_name} lineup={lineups.away} />
          </div>
        </section>
      )}

      {played && (stats.home || stats.away) && (
        <section>
          <h2>Statistikk</h2>
          <StatsTable homeName={match.home_name} awayName={match.away_name} home={stats.home} away={stats.away} />
        </section>
      )}

      {conflicts.length > 0 && (
        <section>
          <h2>Kildene er uenige</h2>
          {/* Sto tidligere bare som et flagg i datasettet, og kampsiden viste
              ingenting. For et historisk arkiv er «Sunnmørsposten skriver 3–2,
              RSSSF skriver 3–1» en opplysning i seg selv, og den som leser skal
              kunne se hva uenigheten gjelder framfor å måtte stole på at vi
              valgte riktig. */}
          {conflicts.map((conflict) => (
            <div key={conflict.field} className="conflict">
              <h3 className="conflict-field"><code>{conflict.field}</code></h3>
              <ul className="conflict-values">
                {conflict.values.map((entry) => {
                  const chosen = conflict.resolved && entry.value === conflict.chosen;
                  return (
                    <li key={`${entry.sourceId}-${String(entry.value)}`} className={chosen ? "is-chosen" : undefined}>
                      <strong className="num">{entry.value === null ? "ingen verdi" : String(entry.value)}</strong>
                      <span className="muted"> · {entry.sourceId}</span>
                      {chosen && <span className="conflict-chosen"> arkivet bruker denne</span>}
                      {entry.note && <span className="small muted conflict-note">{entry.note}</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="small muted">
                {conflict.resolved
                  ? <>{decisionText(conflict.decision)}{conflict.decidedAt ? `, ${formatDate(conflict.decidedAt)}` : ""}. {conflict.reason}{conflict.locked ? " Verdien er låst mot ny innhøsting." : ""}</>
                  : <>Ingen har tatt stilling ennå. Begge verdiene står, og arkivet velger ikke etter kildeprioritet av seg selv.{conflict.note ? ` ${conflict.note}` : ""}</>}
              </p>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2>Kilder</h2>
        {sources.length === 0 ? <p className="muted">Ingen kilde registrert.</p> : (
          <ul>
            {sources.map((source) => (
              <li key={`${source.sourceId}-${source.url ?? ""}`}>
                {source.url ? <a href={source.url} rel="noreferrer">{source.sourceId}</a> : source.sourceId}
                {source.retrievedAt ? ` · hentet ${formatDate(source.retrievedAt)}` : ""}
                <span className="muted"> · {source.fields.length} dokumenterte felt</span>
              </li>
            ))}
          </ul>
        )}
        {/* Sikkerheten sto som en rad i faktalista, over tilskuertallet, og sa
            «Foreløpig» på nesten hver eneste kamp. Den hører til kildene: det er
            der den betyr noe, og der en leser leter etter den. */}
        <p className="small muted">{confidenceNote(match.confidence, played)}</p>
      </section>

      <nav className="match-nav" aria-label="Andre kamper i samme turnering">
        {previous
          ? <a href={`/kamp/${previous.id}`}>← {previous.opponent_name}<span className="small muted"> {formatDateShort(previous.match_date)}</span></a>
          : <span />}
        <a href={`/sesong/${match.season}`}>Hele {match.season}</a>
        {next
          ? <a href={`/kamp/${next.id}`}>{next.opponent_name} →<span className="small muted"> {formatDateShort(next.match_date)}</span></a>
          : <span />}
      </nav>
    </article>
  );
}

/** Hva slags avgjørelse som ble tatt. Grunnlaget hører til begrunnelsen. */
function decisionText(decision: string): string {
  switch (decision) {
    case "manual":
      return "Avgjort for hånd";
    case "source_priority":
      return "Avgjort etter kildeprioritet";
    case "independent_source":
      return "Avgjort mot en uavhengig kilde";
    default:
      return "Avgjort";
  }
}

function confidenceNote(confidence: string, played: boolean): string {
  // En kamp på terminlista er ikke usikker fordi den mangler resultat. Den er
  // ikke spilt, og «hentet fra én kilde» hører ikke hjemme under en dato som
  // klubben selv har publisert.
  if (!played) {
    return confidence === "confirmed"
      ? "Dato og motstander er hentet fra terminlista. Resultatet kommer når kampen er spilt."
      : "Dato og motstander er foreløpige, og kan bli endret.";
  }
  switch (confidence) {
    case "confirmed":
      return "Opplysningene er bekreftet mot kilden over.";
    case "disputed":
      return "Kildene er uenige om denne kampen. Se hva uenigheten gjelder over.";
    default:
      return "Opplysningene er foreløpige, og hentet fra én kilde.";
  }
}


function LineupBlock({ name, lineup }: { name: string; lineup?: Lineup }) {
  if (!lineup) return <div><h3>{name}</h3><p className="muted">Ikke registrert.</p></div>;
  return (
    <div>
      <h3>{name}{lineup.formation ? ` · ${lineup.formation}` : ""}</h3>
      <p>{lineup.starters.join(", ")}</p>
      {lineup.subs.length > 0 && <p className="small"><strong>Benk:</strong> {lineup.subs.join(", ")}</p>}
      {lineup.coach && <p className="small muted">Trener: {lineup.coach}</p>}
    </div>
  );
}

function StatsTable({ homeName, awayName, home, away }: {
  homeName: string;
  awayName: string;
  home?: TeamStats;
  away?: TeamStats;
}) {
  const rows: [keyof TeamStats, string][] = [
    ["possession", "Ballbesittelse (%)"], ["shots", "Skudd"], ["shotsOnTarget", "Skudd på mål"],
    ["corners", "Hjørnespark"], ["fouls", "Frispark mot"], ["offsides", "Offside"], ["xg", "xG"],
  ];
  return (
    <div className="table-scroll"><table>
      <thead><tr><th>Felt</th><th>{homeName}</th><th>{awayName}</th></tr></thead>
      <tbody>{rows.filter(([key]) => home?.[key] !== undefined || away?.[key] !== undefined).map(([key, label]) => (
        <tr key={key}><td>{label}</td><td className="num">{home?.[key] ?? "–"}</td><td className="num">{away?.[key] ?? "–"}</td></tr>
      ))}</tbody>
    </table></div>
  );
}
