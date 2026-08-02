import { connect } from "@aafkstats/db";
import { AskBox } from "@/components/AskBox";

export const dynamic = "force-dynamic";

interface RecentMatch {
  match_id: string;
  date: string;
  competition: string;
  is_home: boolean;
  opponent: string;
  aafk_score: number | null;
  opponent_score: number | null;
  result: "S" | "U" | "T" | null;
  url: string;
}

async function loadOverview() {
  const sql = connect();
  try {
    const recent = await sql<RecentMatch[]>`
      SELECT match_id, date, competition, is_home, opponent,
             aafk_score, opponent_score, result, url
      FROM public_api.matches
      WHERE status = 'played'
      ORDER BY date DESC
      LIMIT 5
    `;
    const next = await sql<RecentMatch[]>`
      SELECT match_id, date, competition, is_home, opponent,
             aafk_score, opponent_score, result, url
      FROM public_api.matches
      WHERE status = 'scheduled'
      ORDER BY date ASC
      LIMIT 1
    `;
    const [totals] = await sql<{ matches: string; seasons: string; first: string | null }[]>`
      SELECT count(*)::text AS matches,
             count(DISTINCT season)::text AS seasons,
             min(date)::text AS first
      FROM public_api.matches
    `;
    return { recent, next: next[0] ?? null, totals };
  } finally {
    await sql.end();
  }
}

function MatchRow({ m }: { m: RecentMatch }) {
  const score =
    m.aafk_score === null || m.opponent_score === null
      ? "–"
      : m.is_home
        ? `${m.aafk_score}–${m.opponent_score}`
        : `${m.opponent_score}–${m.aafk_score}`;

  return (
    <tr>
      <td className="num">{m.date}</td>
      <td>
        {m.result && (
          <span className={`result-badge result-${m.result}`} title={
            m.result === "S" ? "Seier" : m.result === "U" ? "Uavgjort" : "Tap"
          }>
            {m.result}
          </span>
        )}
      </td>
      <td>{m.is_home ? "H" : "B"}</td>
      <td>
        <a href={m.url}>{m.opponent}</a>
      </td>
      <td className="score">{score}</td>
      <td className="muted">{m.competition}</td>
    </tr>
  );
}

export default async function Home() {
  let data: Awaited<ReturnType<typeof loadOverview>> | null = null;
  let dbError: string | null = null;
  try {
    data = await loadOverview();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <AskBox />

      {dbError && (
        <div className="notice notice-error" style={{ marginTop: "2rem" }}>
          Fikk ikke kontakt med databasen. Kjør <code>pnpm db:migrate</code> og{" "}
          <code>pnpm db:sync</code>, og sjekk <code>DATABASE_URL</code>.
        </div>
      )}

      {data && (
        <>
          {data.next && (
            <section style={{ marginTop: "3rem" }}>
              <h2>Neste kamp</h2>
              <p className="prose">
                <strong>{data.next.date}</strong> — {data.next.is_home ? "hjemme mot" : "borte mot"}{" "}
                <a href={data.next.url}>{data.next.opponent}</a>{" "}
                <span className="muted">({data.next.competition})</span>
              </p>
            </section>
          )}

          <section style={{ marginTop: "2.5rem" }}>
            <h2>Siste kamper</h2>
            <div className="table-scroll">
              <table>
                <caption className="small muted" style={{ textAlign: "left", paddingBottom: "0.5rem" }}>
                  Resultat vist fra AaFKs side. H = hjemme, B = borte.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Dato</th>
                    <th scope="col">
                      <span aria-label="Resultat">Res.</span>
                    </th>
                    <th scope="col">H/B</th>
                    <th scope="col">Motstander</th>
                    <th scope="col">Stilling</th>
                    <th scope="col">Konkurranse</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((m) => (
                    <MatchRow key={m.match_id} m={m} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: "0.9rem" }}>
              Arkivet inneholder {data.totals?.matches ?? 0} kamper fordelt på{" "}
              {data.totals?.seasons ?? 0} sesonger
              {data.totals?.first ? `, tilbake til ${data.totals.first}` : ""}.{" "}
              <a href="/data">Se hvordan datasettet er bygget opp</a>.
            </p>
          </section>
        </>
      )}
    </>
  );
}
