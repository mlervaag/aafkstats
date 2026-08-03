import type { Metadata } from "next";
import { loadSeasons } from "@/lib/archive";

export const metadata: Metadata = {
  title: "Sesonger",
  description: "AaFKs sesonger med resultater, målforskjell og alle kamper.",
};
export const dynamic = "force-dynamic";

export default function SeasonsPage() {
  const seasons = loadSeasons();
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Sesong for sesong</p>
        <h1>Sesonger</h1>
        <p className="lede">
          {seasons.length} sesonger samlet på ett sted, fra{" "}
          {seasons.at(-1)?.season} til {seasons[0]?.season}. Velg et år for alle kamper og
          sesongtall.
        </p>
      </header>
      <div className="season-grid">
        {seasons.map((season) => (
          <a className="archive-card" href={season.url} key={season.season}>
            <span className="card-kicker">{season.competition}</span>
            <strong className="card-title num">{season.season}</strong>
            <span className="record-line num">{season.wins} S · {season.draws} U · {season.losses} T</span>
            <span className="card-meta num">{season.goalsFor}–{season.goalsAgainst} mål · {season.played} kamper</span>
          </a>
        ))}
      </div>
      <p className="notice prose">Oversikten dekker seriespill. NM, europacup og treningskamper er ikke høstet inn ennå.</p>
    </>
  );
}
