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
  const { summaries, matches } = data;
  const lead = summaries[0]!;

  return (
    <>
      <p className="breadcrumb"><a href="/sesonger">Sesonger</a> / {year}</p>
      <header className="page-intro compact">
        <p className="eyebrow">
          {lead.competition}
          {lead.competitionTier ? ` · nivå ${lead.competitionTier}` : ""}
        </p>
        <h1>Sesongen {year}</h1>
      </header>

      {/* Én seksjon per konkurranse, hver med sine egne tall over sine egne kamper.
          Tidligere sto ett tallsett øverst som bare gjaldt serien, over en liste som
          inneholdt alt — så statistikken og lista fortalte hver sin historie. */}
      {summaries.map((summary) => {
        const group = matches.filter((match) => match.competition === summary.competition);
        return (
          <section className="content-section" key={summary.competitionId}>
            <h2 className="section-heading">
              {summary.competition}{" "}
              <span className="muted section-count">
                {summary.played} {summary.played === 1 ? "kamp" : "kamper"}
              </span>
            </h2>

            <div className="stat-strip" aria-label={`Tall for ${summary.competition} ${year}`}>
              <Stat value={summary.wins} label="Seire" />
              <Stat value={summary.draws} label="Uavgjort" />
              <Stat value={summary.losses} label="Tap" />
              <Stat value={`${summary.goalsFor}–${summary.goalsAgainst}`} label="Mål" />
              {summary.finalPosition !== null && (
                <Stat value={`${summary.finalPosition}.`} label="Plass" />
              )}
            </div>

            {summary.note && (
              <div className="notice prose" style={{ marginTop: "1rem" }}>
                <strong>Forbehold:</strong> {summary.note}
              </div>
            )}

            <MatchList matches={group} />
          </section>
        );
      })}
    </>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return <div><strong className="num">{value}</strong><span>{label}</span></div>;
}
