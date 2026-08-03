import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MatchList } from "@/components/MatchList";
import { loadOpponent } from "@/lib/archive";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const getOpponent = cache(loadOpponent);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = getOpponent(id);
  return data
    ? { title: `AaFK mot ${data.summary.opponent}`, description: `Alle registrerte ligakamper mellom AaFK og ${data.summary.opponent}.` }
    : { title: "Motstander" };
}

export default async function OpponentPage({ params }: Props) {
  const { id } = await params;
  const data = getOpponent(id);
  if (!data) notFound();
  const { summary, matches } = data;
  return (
    <>
      <p className="breadcrumb"><a href="/motstandere">Motstandere</a> / {summary.opponent}</p>
      <header className="page-intro compact">
        <p className="eyebrow">Innbyrdes oppgjør</p>
        <h1>AaFK mot {summary.opponent}</h1>
        <p className="lede">Registrerte ligakamper fra {summary.firstMeeting.slice(0, 4)} til {summary.lastMeeting?.slice(0, 4) ?? "nå"}.</p>
      </header>
      <div className="stat-strip" aria-label="Innbyrdes statistikk">
        <Stat value={summary.played} label="Kamper" />
        <Stat value={summary.wins} label="Seire" />
        <Stat value={summary.draws} label="Uavgjort" />
        <Stat value={summary.losses} label="Tap" />
        <Stat value={`${summary.goalsFor}–${summary.goalsAgainst}`} label="Mål" />
      </div>
      <section className="content-section"><h2>Alle kamper</h2><MatchList matches={matches} /></section>
    </>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return <div><strong className="num">{value}</strong><span>{label}</span></div>;
}
