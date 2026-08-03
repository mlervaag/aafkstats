import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { loadSeason } from "@/lib/archive";

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
      <div className="stat-strip" aria-label="Sesongstatistikk">
        <Stat value={summary.played} label="Kamper" />
        <Stat value={summary.wins} label="Seire" />
        <Stat value={summary.draws} label="Uavgjort" />
        <Stat value={summary.losses} label="Tap" />
        <Stat value={`${summary.goalsFor}–${summary.goalsAgainst}`} label="Mål" />
      </div>
      <section className="content-section">
        <h2>Alle seriekamper</h2>
        <MatchList matches={matches} />
      </section>
    </>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return <div><strong className="num">{value}</strong><span>{label}</span></div>;
}
