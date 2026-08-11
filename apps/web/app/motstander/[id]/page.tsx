import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MatchList } from "@/components/MatchList";
import { loadOpponent, loadOpponents } from "@/lib/archive";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { opponentDescription, opponentTitle, pageMetadata } from "@/lib/metadata";

export function generateStaticParams(): { id: string }[] {
  return loadOpponents().map((opponent) => ({ id: opponent.id }));
}
type Props = { params: Promise<{ id: string }> };
const getOpponent = cache(loadOpponent);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = getOpponent(id);
  if (!data) return { title: "Motstander" };
  return pageMetadata(
    opponentTitle(data.summary),
    opponentDescription(data.summary),
    `/motstander/${id}`,
  );
}

export default async function OpponentPage({ params }: Props) {
  const { id } = await params;
  const data = getOpponent(id);
  if (!data) notFound();
  const { summary, matches } = data;
  const upcoming = matches.filter((match) => match.status === "scheduled");
  const played = matches.filter((match) => match.status !== "scheduled");
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Motstandere", path: "/motstandere" },
          { name: summary.opponent, path: `/motstander/${id}` },
        ])}
      />
      <p className="breadcrumb"><a href="/motstandere">Motstandere</a> / {summary.opponent}</p>
      <header className="page-intro compact">
        <p className="eyebrow">Innbyrdes oppgjør</p>
        <h1>AaFK mot {summary.opponent}</h1>
        {/* Sto tidligere som «registrerte ligakamper», mens lista også hadde cup
            og treningskamper i seg. Konkurransen står på hver rad; å ramse dem
            opp her ville vært å si det samme to ganger. */}
        <p className="lede">
          {summary.played} registrerte {summary.played === 1 ? "kamp" : "kamper"} fra{" "}
          {summary.firstMeeting.slice(0, 4)} til {summary.lastMeeting?.slice(0, 4) ?? "nå"}.
        </p>
      </header>
      <div className="stat-strip" aria-label="Innbyrdes statistikk">
        <Stat value={summary.played} label="Kamper" />
        <Stat value={summary.wins} label="Seire" />
        <Stat value={summary.draws} label="Uavgjort" />
        <Stat value={summary.losses} label="Tap" />
        <Stat value={`${summary.goalsFor}–${summary.goalsAgainst}`} label="Mål" />
      </div>

      {upcoming.length > 0 && (
        <section className="content-section">
          <h2>Står igjen</h2>
          <MatchList matches={upcoming} />
        </section>
      )}
      <section className="content-section"><h2>Alle kamper</h2><MatchList matches={played} /></section>
    </>
  );
}


function Stat({ value, label }: { value: number | string; label: string }) {
  return <div><strong className="num">{value}</strong><span>{label}</span></div>;
}
