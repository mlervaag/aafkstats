import styles from "./SectionIndex.module.css";

export interface SectionLink {
  /** Ankeret på seksjonen, uten «#». */
  id: string;
  label: string;
  /** Antall rader i seksjonen. Null skjuler tallet. */
  count?: number;
}

/**
 * Innholdsfortegnelsen til en side som er for lang til å bla seg gjennom.
 *
 * ## Hvorfor tallene står der
 *
 * Organisasjonssiden er 23 000 piksler høy. En leser som kom inn på toppen så
 * «Formenn» og måtte scrolle i blinde for å finne ut om det fantes noe mer —
 * og det gjør det: stiftere, administrasjon, heder og trenere, i den
 * rekkefølgen. Rene hoppelenker svarer på hva som er der nede; tallene svarer
 * på hvor mye, og det er den delen som avgjør om det er verdt turen.
 *
 * Seksjoner uten innhold står ikke her. En lenke til en tom seksjon er verre
 * enn ingen lenke: den lover noe arkivet ikke har.
 */
export function SectionIndex({ sections, label }: { sections: SectionLink[]; label: string }) {
  const shown = sections.filter((section) => section.count === undefined || section.count > 0);
  if (shown.length < 2) return null;
  return (
    <nav className={styles.index} aria-label={label}>
      <span className={styles.heading}>På denne sida</span>
      <ul>
        {shown.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`}>
              {section.label}
              {section.count === undefined ? null : <span className="num">{section.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
