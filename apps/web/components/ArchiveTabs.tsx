import Link from "next/link";
import styles from "./ArchiveTabs.module.css";

/**
 * Fanene mellom de tre sidene som deler personarkivet.
 *
 * ## Hvorfor fane og ikke bare lenker
 *
 * De tre sidene er søsken: samme datasett sett fra hver sin kant — menneskene,
 * vervene deres, og banene de spilte på. Sidene hadde allerede hver sin
 * kontekstlenke til den andre, men de var formulert ulikt («Organisasjon og
 * styrer →» på den ene, «← Personer» på den andre), så det så ut som to
 * forskjellige mekanismer i stedet for én.
 *
 * Tre er innenfor det en fanerad tåler. Blir det flere, er en meny riktigere —
 * en fanerad som brekker over to linjer har sluttet å være en fanerad.
 */
const TABS = [
  { href: "/personer", label: "Personer" },
  { href: "/organisasjon", label: "Organisasjon" },
  { href: "/hjemmebaner", label: "Hjemmebaner" },
] as const;

export function ArchiveTabs({ current }: { current: typeof TABS[number]["href"] }) {
  return (
    <nav className={styles.tabs} aria-label="Personarkivet">
      {TABS.map((tab) => (
        tab.href === current
          ? <span key={tab.href} aria-current="page">{tab.label}</span>
          : <Link key={tab.href} href={tab.href}>{tab.label}</Link>
      ))}
    </nav>
  );
}
