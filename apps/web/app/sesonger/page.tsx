import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/components/JsonLd";
import { collectionJsonLd } from "@/lib/jsonld";
import { CompetitionSpread, CoverageStrip, CoverageSummary, CoverageTag, SeasonCoverageTag } from "@/components/Coverage";
import { loadSeasonYears } from "@/lib/archive";
import type { SeasonSummary, SeasonYear } from "@/lib/archive";

export const metadata: Metadata = pageMetadata(
  "Sesonger",
  "AaFKs sesonger med resultater, målforskjell og alle kamper.",
  "/sesonger",
  "website",
);

export default function SeasonsPage() {
  const years = loadSeasonYears();
  const decades = byDecade(years);
  const oldest = years.at(-1)?.year;
  const newest = years[0]?.year;

  return (
    <>
      <JsonLd
        data={collectionJsonLd({
          name: "Sesonger",
          description: "AaFKs sesonger med resultater, målforskjell og alle kamper.",
          path: "/sesonger",
          size: years.length,
        })}
      />
      <header className="page-intro">
        <p className="eyebrow">Sesong for sesong</p>
        <h1>Sesonger</h1>
        <p className="lede">
          Velg et år for kamper, tabell, resultater og kilder. Arkivet har materiale fra
          {" "}{oldest} til {newest}.
        </p>
      </header>

      <CoverageStrip years={years} />

      <details className="coverage-explanation">
        <summary>Les mer om dekningen</summary>
        <CoverageSummary years={years} />
        <p className="small muted">
          «Historisk resultatliste» betyr resultater med en historisk kilde, men uten nok
          opplysninger til å knytte dem sikkert til en full kampoppføring.
        </p>
      </details>

      <nav className="decade-jumps" aria-label="Hopp til tiår">
        {decades.map(([decade]) => (
          <a className="num" href={`#tiar-${decade}`} key={decade}>
            {decade}
          </a>
        ))}
      </nav>

      {/* Delt i tiår. Uten inndelingen er dette 85 kort på rad, og en leser som
          skal til 1970-tallet må rulle på gefühl. Tiåret er også den enheten folk
          faktisk husker fotball i. */}
      {decades.map(([decade, entries]) => (
        <section className="decade" id={`tiar-${decade}`} key={decade}>
          <h2 className="decade-heading">
            <span className="num">{decade}-tallet</span>
            <span className="muted small">{decadeSummary(entries)}</span>
          </h2>
          <div className="season-grid">
            {entries.map((entry) => <SeasonCard entry={entry} key={entry.year} />)}
          </div>
        </section>
      ))}

      <CompetitionSpread />
    </>
  );
}

/**
 * Kortet for ett år.
 *
 * Et år uten seriesesong får ikke tabelltall. Å vise «0 S · 0 U · 1 T» for et
 * cupexit gir en enkeltkamp samme vekt som en hel sesong, og det var nettopp den
 * forskjellen sida ikke klarte å vise.
 */
function SeasonCard({ entry }: { entry: SeasonYear }) {
  const { year, primary, others, totalMatches } = entry;
  if (!primary) {
    return (
      <a className="archive-card card-fragment" href={`/sesong/${year}`}>
        <span className="card-kicker">Historisk resultatliste</span>
        <strong className="card-title num">{year}</strong>
        <span className="card-meta">{entry.documentedResults} kildedokumenterte resultater</span>
        <span className="coverage-tag coverage-isolated">Dato og hjemme/borte mangler</span>
      </a>
    );
  }
  const isLeague = primary.competitionType === "league";

  if (!isLeague) {
    return (
      <a className="archive-card card-fragment" href={primary.url}>
        <strong className="card-title num">{year}</strong>
        <span className="card-meta">
          {totalMatches} {totalMatches === 1 ? "kamp" : "kamper"} i{" "}
          {[primary, ...others].map((s) => s.competition).join(" og ")}
        </span>
        <CoverageTag season={primary} />
      </a>
    );
  }

  return (
    <a className="archive-card" href={primary.url}>
      <span className="card-kicker">{primary.competition}</span>
      <strong className="card-title num">{year}</strong>
      <span className="record-line num">
        {primary.wins} S · {primary.draws} U · {primary.losses} T
      </span>
      <span className="card-meta num">
        {primary.goalsFor}–{primary.goalsAgainst} mål · {primary.played}{" "}
        {primary.played === 1 ? "kamp" : "kamper"}
      </span>
      {/* Sesongmerket først: det gjelder året, som er det kortet handler om.
          Konkurransemerket under sier hva serien har. */}
      <SeasonCoverageTag coverage={entry.coverage} />
      <CoverageTag season={primary} />
      {others.length > 0 && (
        <span className="card-extra muted">+ {extras(others)}</span>
      )}
      {entry.documentedResults > 0 && (
        <span className="card-extra muted">Historisk liste · {entry.documentedResults} resultater</span>
      )}
      {others.length > 0 && (
        <span className="sr-only">{totalMatches} kamper totalt dette året</span>
      )}
    </a>
  );
}

/**
 * «5 i Norgesmesterskapet, 8 treningskamper»
 *
 * Konkurransenavnet er et egennavn og bøyes ikke, men «8 i Treningskamp» er ikke
 * norsk. Treningskamper er den ene konkurransen som heter noe som også er et
 * vanlig ord, så den får sin egen form.
 */
function extras(others: SeasonSummary[]): string {
  return others
    .map((o) =>
      o.competitionType === "friendly"
        ? `${o.played} ${o.played === 1 ? "treningskamp" : "treningskamper"}`
        : `${o.played} i ${o.competition}`,
    )
    .join(", ");
}

function byDecade(years: SeasonYear[]): [number, SeasonYear[]][] {
  const groups = new Map<number, SeasonYear[]>();
  for (const entry of years) {
    const decade = Math.floor(entry.year / 10) * 10;
    groups.set(decade, [...(groups.get(decade) ?? []), entry]);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

/** «8 år · 4 seriesesonger» — nok til å se om tiåret er tykt eller tynt. */
function decadeSummary(entries: SeasonYear[]): string {
  const leagues = entries.filter((e) => e.primary?.competitionType === "league").length;
  const years = `${entries.length} ${entries.length === 1 ? "år" : "år"}`;
  if (leagues === 0) return `${years} · ingen seriesesong`;
  return `${years} · ${leagues} ${leagues === 1 ? "seriesesong" : "seriesesonger"}`;
}
