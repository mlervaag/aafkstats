import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { loadSeason } from "@/lib/archive";
import type { ArchiveMatch } from "@/lib/archive";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  return { title: `Sesongen ${year}`, description: `Kamper og statistikk for AaFKs ${year}-sesong.` };
}

export default async function SeasonPage({ params }: Props) {
  const { year: rawYear } = await params;
  const year = Number(rawYear);
  if (!Number.isInteger(year)) notFound();
  const data = loadSeason(year);
  if (!data) notFound();
  const { summary, matches } = data;

  return (
    <>
      <p className="breadcrumb"><a href="/sesonger">Sesonger</a> / {year}</p>
      <header className="page-intro compact">
        <p className="eyebrow">{summary.competition} · nivå {summary.competitionTier ?? "–"}</p>
        <h1>Sesongen {year}</h1>
      </header>
      <div className="stat-strip" aria-label={`Tabellsesong i ${summary.competition}`}>
        <Stat value={summary.played} label="Kamper" />
        <Stat value={summary.wins} label="Seire" />
        <Stat value={summary.draws} label="Uavgjort" />
        <Stat value={summary.losses} label="Tap" />
        <Stat value={`${summary.goalsFor}–${summary.goalsAgainst}`} label="Mål" />
      </div>
      <p className="small muted stat-strip-note">
        Tallene over gjelder {summary.competition}. Cup- og treningskamper står for seg under.
      </p>
      {summary.note && (
        <div className="notice prose" style={{ marginTop: "1rem" }}>
          <strong>Forbehold:</strong> {summary.note}
        </div>
      )}

      {groupByCompetition(matches).map(([competition, group]) => (
        <section className="content-section" key={competition}>
          <h2>
            {competition} <span className="muted section-count">{group.length} kamper</span>
          </h2>
          <MatchList matches={group} />
        </section>
      ))}
    </>
  );
}

/**
 * Grupperer sesongens kamper etter konkurranse, med den største gruppa først.
 *
 * Uten dette havnet cupkampene midt inne i serielista, under en overskrift som
 * sa «Alle seriekamper», mens tallene over bare gjaldt serien. Lista sa altså én
 * ting og statistikken en annen.
 */
function groupByCompetition(matches: ArchiveMatch[]): [string, ArchiveMatch[]][] {
  const groups = new Map<string, ArchiveMatch[]>();
  for (const match of matches) {
    const list = groups.get(match.competition);
    if (list) list.push(match);
    else groups.set(match.competition, [match]);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return <div><strong className="num">{value}</strong><span>{label}</span></div>;
}
