import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { getPeople, getPersonRoles } from "@/lib/people";
import { getHomeVenues } from "@/lib/venues";
import styles from "./Club.module.css";

export const metadata: Metadata = pageMetadata(
  "Klubben",
  "Personer, organisasjon og hjemmebaner i Aalesunds Fotballklubbs historie.",
  "/klubben",
  "website",
);

export default function ClubPage() {
  const people = getPeople();
  const roles = getPersonRoles();
  const venues = getHomeVenues();
  const milestones = venues.reduce((sum, venue) => sum + venue.events.length, 0);

  return (
    <article>
      <header className="page-intro">
        <p className="eyebrow">Menneskene og institusjonen</p>
        <h1>Klubben</h1>
        <p className="lede">
          Gå inn i personregisteret, følg ledelse og verv gjennom historien, eller se banene
          klubben har kalt hjemme. Hver opplysning viser til kilden den bygger på.
        </p>
      </header>

      <nav className={styles.grid} aria-label="Utforsk klubben">
        <Link className={styles.entry} href="/personer">
          <span className={styles.index}>01</span>
          <h2>Personer</h2>
          <p>Spillere, trenere, ledere, styremedlemmer, stiftere og æresmedlemmer.</p>
          <dl><div><dt>Registrert</dt><dd>{people.length}</dd></div></dl>
        </Link>
        <Link className={styles.entry} href="/organisasjon">
          <span className={styles.index}>02</span>
          <h2>Organisasjon</h2>
          <p>Klubbens øverste ledere, styreverv, drift, sportslig apparat og heder – organisert etter hva du vil følge.</p>
          <dl><div><dt>Kildeførte verv</dt><dd>{roles.length}</dd></div></dl>
        </Link>
        <Link className={styles.entry} href="/hjemmebaner">
          <span className={styles.index}>03</span>
          <h2>Hjemmebaner</h2>
          <p>Nørvebana, Aksla, Kråmyra og Color Line med perioder, dekke og milepæler.</p>
          <dl><div><dt>Kildeførte milepæler</dt><dd>{milestones}</dd></div></dl>
        </Link>
      </nav>

      <p className={`${styles.note} muted`}>
        Tomme perioder betyr at arkivet mangler en kilde, ikke at klubben manglet en person,
        et verv eller en hjemmebane.
      </p>
    </article>
  );
}
