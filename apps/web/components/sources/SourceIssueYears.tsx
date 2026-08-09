import { Fragment } from "react";
import Link from "next/link";
import type { Source } from "@/lib/sources";
import styles from "./SourceIssueYears.module.css";

/**
 * Utgavene i en serie, gruppert etter år.
 *
 * Et periodikum har et naturlig hierarki — år, så nummer, så dokument — og
 * seriesiden viste i stedet alle 87 utgavene som ett generisk kortrutenett. Da er
 * «medlemsbladet fra sommeren 1972» noe man må lete seg fram til.
 *
 * Rekkefølgen kommer fra spørringen (`getSourceChildren`), ikke herfra.
 */
export function SourceIssueYears({ issues }: { issues: Source[] }) {
  const years: { year: number | null; volume: string | null; items: Source[] }[] = [];
  for (const issue of issues) {
    const last = years.at(-1);
    if (last && last.year === issue.year) {
      last.items.push(issue);
      // Årgangen står bare når hele året er enige om den. Ett blad kan være
      // katalogført med feil årgang, og da skal ingen av tallene stå der.
      if (last.volume !== issue.volume) last.volume = null;
      continue;
    }
    years.push({ year: issue.year, volume: issue.volume, items: [issue] });
  }

  return (
    <ol className={styles.years}>
      {years.map((group, index) => {
        const heading = group.year === null ? "Uten år" : String(group.year);
        const gap = gapBefore(years[index - 1] ?? null, group);
        return (
          <Fragment key={heading}>
            {gap && (
              /*
               * Lista rendrer bare år som har utgaver, og hoppet dermed rett fra
               * 2003 til 1980 uten å si at det ligger 22 år imellom. Den rimelige
               * slutningen for en leser er at bladet ble lagt ned og gjenopplivet.
               *
               * Formuleringen sier hva arkivet mangler, ikke hva bladet gjorde.
               * Vi vet ikke om det sluttet å komme ut i 1981 eller om årgangene
               * bare ikke er digitalisert, og da skal teksten ikke velge.
               */
              <li className={styles.gap}>
                Arkivet har ingen utgaver {gap.from === gap.to ? `fra ${gap.from}` : `fra ${gap.from} til ${gap.to}`}
                <span className={styles.gapCount}>
                  {gap.count === 1 ? "1 år" : `${gap.count} år`}
                </span>
              </li>
            )}
          <li className={styles.year}>
            <h3 className={styles.yearLabel}>
              {heading}
              {group.volume && <span className={styles.volume}>Årgang {group.volume}</span>}
            </h3>
            <ul className={styles.issues} aria-label={`Utgaver fra ${heading}`}>
              {group.items.map((issue) => (
                <li key={issue.id}>
                  <Link className={styles.issue} href={`/kilder/${issue.id}`}>
                    {/* Nummeret er det leseren peker på. Hele tittelen sier
                        «Medlemsblad for Aalesunds fotballklubb…» 87 ganger, og
                        skjermleseren trenger den likevel — derfor står den her. */}
                    <span aria-hidden="true">{issue.issue ?? "Utgave"}</span>
                    <span className="sr-only">{issue.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

type YearGroup = { year: number | null; volume: string | null; items: Source[] };

/**
 * Årene mellom to grupper som ikke har en eneste utgave.
 *
 * Rekkefølgen på lista kommer fra spørringen og er nyest først, men den kan snus
 * uten at dette skal slutte å virke — derfor regnes avstanden begge veier.
 * Gruppa «Uten år» har ingen plass på tidslinja og avbryter tellingen.
 */
function gapBefore(
  previous: YearGroup | null,
  current: YearGroup,
): { from: number; to: number; count: number } | null {
  if (!previous || previous.year === null || current.year === null) return null;

  const high = Math.max(previous.year, current.year);
  const low = Math.min(previous.year, current.year);
  const count = high - low - 1;
  if (count < 1) return null;

  return { from: low + 1, to: high - 1, count };
}
