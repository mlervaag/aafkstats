import { notFound } from "next/navigation";
import { one, open } from "@aafkstats/db";

export const dynamic = "force-dynamic";

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
  confidence: string;
  stage: string | null;
  home_et_score: number | null;
  away_et_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
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
      `SELECT m.id, m.match_date, m.kickoff, m.status, m.competition_name, m.round, m.stage,
              h.name AS home_name, a.name AS away_name, m.home_score, m.away_score,
              m.home_ht_score, m.away_ht_score, m.home_et_score, m.away_et_score,
              m.home_pens, m.away_pens,
              m.venue_name, m.attendance, m.referee,
              m.events, m.lineups, m.stats, m.sources, m.confidence
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

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = loadMatch(id);
  if (!match) notFound();

  const events = json<EventRow[]>(match.events, []);
  const lineups = json<{ home?: Lineup; away?: Lineup }>(match.lineups, {});
  const stats = json<{ home?: TeamStats; away?: TeamStats }>(match.stats, {});
  const sources = json<SourceRef[]>(match.sources, []);
  // Overskriftsresultatet er sluttresultatet. home_score er stillingen etter
  // ordinær tid, så ekstraomgangsmålene må legges til — ellers står en cupkamp
  // som endte 2-1 på overtid oppført som 1-1.
  const hasScore = match.home_score !== null && match.away_score !== null;
  const homeFull = hasScore ? match.home_score! + (match.home_et_score ?? 0) : null;
  const awayFull = hasScore ? match.away_score! + (match.away_et_score ?? 0) : null;
  const score = homeFull === null || awayFull === null ? "–" : `${homeFull}–${awayFull}`;

  const afterExtraTime = match.home_et_score !== null || match.away_et_score !== null;
  const shootout = match.home_pens !== null && match.away_pens !== null;
  const stageLabel = match.stage && match.stage !== "regular_season"
    ? stageNames[match.stage] ?? null
    : null;

  return (
    <article className="match-page">
      <p className="small muted"><a href="/">Forsiden</a> / Kamp</p>
      <header className="match-header">
        <p className="small muted num">
          {match.match_date}{match.kickoff ? ` kl. ${match.kickoff}` : ""} · {match.competition_name}
          {stageLabel ? ` · ${stageLabel}` : match.round ? ` · Runde ${match.round}` : ""}
        </p>
        <div className="scoreboard">
          <h1>{match.home_name}</h1>
          <strong className="scoreline">{score}</strong>
          <h1>{match.away_name}</h1>
        </div>
        {(afterExtraTime || shootout) && (
          <p className="small muted">
            {shootout
              ? `Avgjort på straffespark ${match.home_pens}–${match.away_pens}`
              : "Etter ekstraomganger"}
            {afterExtraTime && hasScore
              ? ` · ${match.home_score}–${match.away_score} etter ordinær tid`
              : ""}
          </p>
        )}
        {match.home_ht_score !== null && match.away_ht_score !== null && (
          <p className="small muted">Pause {match.home_ht_score}–{match.away_ht_score}</p>
        )}
      </header>

      <dl className="facts">
        {match.venue_name && <><dt>Stadion</dt><dd>{match.venue_name}</dd></>}
        {match.attendance !== null && <><dt>Tilskuere</dt><dd className="num">{match.attendance.toLocaleString("nb-NO")}</dd></>}
        {match.referee && <><dt>Dommer</dt><dd>{match.referee}</dd></>}
        <dt>Sikkerhet</dt><dd>{match.confidence === "confirmed" ? "Bekreftet" : "Foreløpig"}</dd>
      </dl>

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

      {(lineups.home || lineups.away) && (
        <section>
          <h2>Lagoppstillinger</h2>
          <div className="two-column">
            <LineupBlock name={match.home_name} lineup={lineups.home} />
            <LineupBlock name={match.away_name} lineup={lineups.away} />
          </div>
        </section>
      )}

      {(stats.home || stats.away) && (
        <section>
          <h2>Statistikk</h2>
          <StatsTable homeName={match.home_name} awayName={match.away_name} home={stats.home} away={stats.away} />
        </section>
      )}

      <section>
        <h2>Kilder</h2>
        {sources.length === 0 ? <p className="muted">Ingen kilde registrert.</p> : (
          <ul>
            {sources.map((source) => (
              <li key={`${source.sourceId}-${source.url ?? ""}`}>
                {source.url ? <a href={source.url} rel="noreferrer">{source.sourceId}</a> : source.sourceId}
                {source.retrievedAt ? ` · hentet ${source.retrievedAt}` : ""}
                <span className="muted"> · {source.fields.length} dokumenterte felt</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
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
