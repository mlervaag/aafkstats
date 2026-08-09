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
      {years.map((group) => {
        const heading = group.year === null ? "Uten år" : String(group.year);
        return (
          <li className={styles.year} key={heading}>
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
        );
      })}
    </ol>
  );
}
