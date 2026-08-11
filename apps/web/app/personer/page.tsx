import type { Metadata } from "next";
import { PeopleDirectory } from "@/components/people/PeopleDirectory";
import { getPeople, getPersonRoles } from "@/lib/people";
import styles from "./People.module.css";

export const metadata: Metadata = {
  title: "Personer",
  description: "Søk i spillere, trenere, ledere, styremedlemmer og æresmedlemmer i AaFK-arkivet.",
};

export default function PeoplePage() {
  const people = getPeople();
  const roles = getPersonRoles();
  const players = people.filter((person) => person.appearances > 0 || person.position !== null).length;
  const organization = new Set(roles.filter((role) => role.category !== "player").map((role) => role.person_id)).size;

  return (
    <article>
      <header className={`page-header ${styles.header}`}>
        <div>
          <p className="eyebrow">Menneskene i arkivet</p>
          <h1>Personer</h1>
          <p className="lead">
            Spillere, trenere og menneskene som har bygget klubben utenfor banen.
            Hver rolle er knyttet til perioden og publikasjonen som dokumenterer den.
          </p>
        </div>
        <dl className={styles.summary}>
          <div><dt>Personer</dt><dd>{people.length}</dd></div>
          <div><dt>Med kampdata</dt><dd>{players}</dd></div>
          <div><dt>I organisasjonen</dt><dd>{organization}</dd></div>
        </dl>
      </header>

      <nav className={styles.contextNav} aria-label="Person- og organisasjonsarkiv">
        <span aria-current="page">Personer</span>
        <a href="/organisasjon">Organisasjon og styrer →</a>
      </nav>

      <PeopleDirectory people={people} />
    </article>
  );
}

