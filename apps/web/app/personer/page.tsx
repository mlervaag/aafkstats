import type { Metadata } from "next";
import { ArchiveTabs } from "@/components/ArchiveTabs";
import { PeopleDirectory } from "@/components/people/PeopleDirectory";
import { getPeople, getPersonRoles } from "@/lib/people";
import { contributionIssueUrl } from "@/lib/contribution-links";
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

      <ArchiveTabs current="/personer" />

      <PeopleDirectory people={people} />

      {/* Registeret hadde ingen vei inn for en person som manglet helt. Personsidene
          har «Bidra»-knapp, men den som ikke har en side, har heller ingen knapp. */}
      <section className="content-section prose-stack">
        <h2>Mangler noen?</h2>
        <p>
          En person får en oppføring her når det er noe å si om henne eller ham: et verv, en
          trenerperiode, en skrivemåte av navnet som må knyttes til riktig person, eller et
          draktnummer. En spiller som bare står som et navn i en lagoppstilling, teller
          allerede med i kampstatistikken uten å ha en oppføring.
        </p>
        <a className="button-link" href={contributionIssueUrl("manglende-person")}>
          Meld en person som mangler
        </a>
      </section>
    </article>
  );
}

