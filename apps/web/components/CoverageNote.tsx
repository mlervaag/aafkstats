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

/**
 * Kamper per konkurranse, som en liste.
 *
 * Sto som en setning med sju ledd i, og da leses den ikke — den hoppes over.
 * Rader kan skummes, og de kan sammenlignes med øyet.
 */
export function CompetitionTable() {
  const c = loadCoverage();
  if (c.byCompetition.length === 0) return null;
  const total = c.byCompetition.reduce((sum, row) => sum + row.matches, 0);

  return (
    <ul className="breakdown">
      {c.byCompetition.map((row) => (
        <li key={row.competition}>
          <span>{row.competition}</span>
          {/* Andelen tegnes, ikke skrives. Med sju rader er forholdet mellom dem
              poenget, og et prosenttall per rad ville vært sju tall å veie mot
              hverandre i hodet. */}
          <span className="breakdown-bar" aria-hidden="true">
            <span style={{ width: `${Math.round((row.matches / total) * 100)}%` }} />
          </span>
          <strong className="num">{row.matches}</strong>
        </li>
      ))}
    </ul>
  );
}

/**
 * Hva som mangler, regnet ut fra hva som finnes.
 *
 * AaFK ble stiftet i 1914, så alt mellom stiftelsen og arkivets første sesong er
 * et hull. Setningen sto tidligere som «før 2011» i to sider og ble gal i samme
 * øyeblikk som den første eldre sesongen ble hentet.
 */
const FOUNDED = 1914;

export function GapNote() {
  const c = loadCoverage();
  if (!c.firstSeason) return null;
  const gap = c.firstSeason - FOUNDED;

  return (
    <p className="prose">
      {gap > 0 ? (
        <>
          Arkivet mangler fortsatt årene fra {FOUNDED} til {c.firstSeason - 1} — {gap} sesonger,
          fra klubben ble stiftet og fram til der dekningen begynner.{" "}
        </>
      ) : null}
      Europacupkampene mangler helt
      {c.withReport === 0 ? ", og ingen kamper har kampreferat ennå" : ""}.{" "}
      <a href="/bidra">Bidrag</a> monner mest der.
    </p>
  );
}

/**
 * Hva arkivet har, og hvor dypt.
 *
 * Var én lang setning med sju konkurranser, to andeler og et forbehold i seg.
 * Den sa alt og ble lest av ingen. Nå er det tre tall og én setning om hullet;
 * fordelingen per konkurranse hører hjemme på `/data`, der den kan ta plassen
 * den trenger.
 */
export function CoverageNote({ heading = true }: { heading?: boolean }) {
  const c = loadCoverage();
  const detailShare = c.matches === 0 ? 0 : Math.round((c.withEvents / c.matches) * 100);

  return (
    <div className="notice prose">
      {heading && <strong>Slik ser arkivet ut nå: </strong>}
      {coverageSentence(c)}.{" "}
      {c.withEvents > 0
        ? `${c.withEvents} av dem (${detailShare} %) har hendelser som mål og kort, og ${c.withAttendance} har tilskuertall.`
        : "Ingen av dem har hendelsesdata ennå."}{" "}
      {c.withReport === 0 ? (
        <>
          Kampreferat mangler helt — det er der{" "}
          <a href="/bidra">et bidrag monner mest</a>.
        </>
      ) : (
        <>{c.withReport} har kampreferat.</>
      )}
    </div>
  );
}
