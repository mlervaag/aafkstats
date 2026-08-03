import { loadCoverage } from "@/lib/archive";
import type { ArchiveCoverage } from "@/lib/archive";

/**
 * Setningen som beskriver hva arkivet inneholder, regnet ut fra arkivet selv.
 *
 * Tallene sto tidligere som tekst i seks sider og var gale dagen etter hver
 * innhøsting. Her finnes de ett sted, og de kan ikke bli utdaterte uten at
 * dataene faktisk endrer seg.
 */
export function coverageSentence(c: ArchiveCoverage): string {
  const span =
    c.firstSeason && c.lastSeason
      ? c.firstSeason === c.lastSeason
        ? ` fra ${c.firstSeason}`
        : ` fra ${c.firstSeason} til ${c.lastSeason}`
      : "";
  return `${c.matches} kamper${span}`;
}

/** «300 seriekamper, 150 førstedivisjonskamper og 44 cupkamper» */
export function competitionBreakdown(c: ArchiveCoverage): string {
  const parts = c.byCompetition.map((row) => `${row.matches} i ${row.competition}`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} og ${parts.at(-1)}`;
}

export function CoverageNote({ heading = true }: { heading?: boolean }) {
  const c = loadCoverage();
  const detailShare = c.matches === 0 ? 0 : Math.round((c.withEvents / c.matches) * 100);

  return (
    <div className="notice prose">
      {heading && <strong>Slik ser arkivet ut nå: </strong>}
      {coverageSentence(c)} — {competitionBreakdown(c)}.{" "}
      {c.withEvents > 0 ? (
        <>
          {c.withEvents} av dem ({detailShare} %) har hendelser som mål og kort
          {c.withAttendance > 0 ? `, og ${c.withAttendance} har tilskuertall` : ""}.
        </>
      ) : (
        <>Ingen av dem har hendelsesdata ennå.</>
      )}{" "}
      {c.withReport === 0 ? (
        <>
          Ingen kamper har kampreferat ennå — det er der{" "}
          <a href="/bidra">et bidrag monner mest</a>.
        </>
      ) : (
        <>{c.withReport} har kampreferat.</>
      )}
    </div>
  );
}
