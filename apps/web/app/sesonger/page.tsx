import type { Metadata } from "next";
import { loadSeasonYears } from "@/lib/archive";

export const metadata: Metadata = {
  title: "Sesonger",
  description: "AaFKs sesonger med resultater, målforskjell og alle kamper.",
};
export const dynamic = "force-dynamic";

export default function SeasonsPage() {
  const years = loadSeasonYears();
  const oldest = years.at(-1)?.year;
  const newest = years[0]?.year;

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Sesong for sesong</p>
        <h1>Sesonger</h1>
        <p className="lede">
          {years.length} sesonger fra {oldest} til {newest}. Velg et år for alle kamper og
          sesongtall.
        </p>
      </header>

      <div className="season-grid">
        {years.map(({ year, primary, others, totalMatches }) => (
          <a className="archive-card" href={primary.url} key={year}>
            {/* Kortet viser serien når den finnes. Et cupexit på én kamp skal ikke
                se ut som en hel sesong, så øvrige konkurranser står som en egen,
                dempet linje i stedet for å bli slått sammen med tabelltallene. */}
            <span className="card-kicker">{primary.competition}</span>
            <strong className="card-title num">{year}</strong>
            <span className="record-line num">
              {primary.wins} S · {primary.draws} U · {primary.losses} T
            </span>
            <span className="card-meta num">
              {primary.goalsFor}–{primary.goalsAgainst} mål · {primary.played}{" "}
              {primary.played === 1 ? "kamp" : "kamper"}
            </span>
            {others.length > 0 && (
              <span className="card-extra muted">
                + {others.map((o) => `${o.played} i ${o.competition}`).join(", ")}
              </span>
            )}
            {others.length > 0 && (
              <span className="sr-only">{totalMatches} kamper totalt dette året</span>
            )}
          </a>
        ))}
      </div>

      <p className="notice prose">
        Serie og cup er hentet inn. Europacupkampene mangler, og treningskamper finnes bare
        for inneværende sesong. Se <a href="/om">kilder og forbehold</a>.
      </p>
    </>
  );
}
