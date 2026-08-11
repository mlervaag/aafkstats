import type { Metadata } from "next";
import Link from "next/link";
import { getPersonRoles, getSourceTitles, type PersonRole } from "@/lib/people";
import { ArchiveTabs } from "@/components/ArchiveTabs";
import { SourceChips } from "@/components/SourceChips";
import styles from "./Organization.module.css";

export const metadata: Metadata = {
  title: "Organisasjon",
  description: "Kildeført oversikt over styrer, ledere, administrasjon og hedersroller i Aalesunds Fotballklubb.",
};

function range(role: PersonRole): string {
  return role.to_date && role.to_date !== role.from_date ? `${role.from_date}–${role.to_date}` : role.from_date;
}

/**
 * En liste med verv.
 *
 * `showTitle` er av i seksjoner der tittelen alt står i overskriften: under
 * «Formenn» sto «Formann · Hovedstyret» på hver eneste rad, 41 ganger, uten å
 * skille en rad fra en annen.
 */
function RoleList({ roles, sourceTitles, showTitle = true }: {
  roles: PersonRole[];
  sourceTitles: Map<string, string>;
  showTitle?: boolean;
}) {
  return (
    <ol className={styles.roleList}>
      {roles.map((role) => (
        <li key={`${role.person_id}-${role.role_id}`}>
          <time>{range(role)}</time>
          <div>
            <h3><Link href={`/personer/${role.person_id}`}>{role.name}</Link></h3>
            {showTitle || role.body ? (
              <p>{[showTitle ? role.title : null, role.body].filter(Boolean).join(" · ")}</p>
            ) : null}
            <SourceChips refs={role.sources} titles={sourceTitles} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function OrganizationPage() {
  const roles = getPersonRoles();
  const sourceTitles = getSourceTitles();
  const chairs = roles.filter((role) => role.category === "board" && role.title === "Formann");
  const administration = roles.filter((role) => ["administration", "sporting_staff", "project"].includes(role.category));
  const sporting = roles.filter((role) => ["coach", "sporting_staff"].includes(role.category));
  const honorary = roles.filter((role) => role.category === "honorary");
  const founders = roles.filter((role) => role.category === "founder");
  const firstYear = chairs[0]?.from_date.slice(0, 4) ?? "–";
  const lastYear = chairs.at(-1)?.to_date?.slice(0, 4) ?? chairs.at(-1)?.from_date.slice(0, 4) ?? "–";

  return (
    <article>
      <header className={`page-header ${styles.header}`}>
        <div>
          <p className="eyebrow">Klubben utenfor banen</p>
          <h1>Organisasjon</h1>
          <p className={styles.lead}>
            En tidslinje over ledelse, administrasjon og heder. Oversikten viser bare verv
            som er funnet i en navngitt kilde – tomme år betyr ukjent, ikke at vervet sto tomt.
          </p>
        </div>
        <div className={styles.coverage}>
          <span>Kildedekning</span>
          <strong>{firstYear}–{lastYear}</strong>
          <p>{roles.length} kildeførte roller · {new Set(roles.map((role) => role.person_id)).size} personer</p>
        </div>
      </header>

      <ArchiveTabs current="/organisasjon" />

      <section className={styles.introGrid}>
        <div>
          <p className="eyebrow">Historisk ledelse</p>
          <h2>Formenn</h2>
          <p>År for år fra jubileumsskriftene og klubbens offisielle historiske lederliste.</p>
        </div>
        <div className={styles.legend}>
          <span><i className={styles.confirmed} /> Kildeført periode</span>
          <span><i className={styles.gap} /> Ikke ferdig kartlagt</span>
        </div>
      </section>

      <section className={styles.timelineSection}>
        <RoleList roles={chairs} sourceTitles={sourceTitles} showTitle={false} />
      </section>

      {founders.length > 0 ? (
        <section className={styles.sportSection}>
          <p className="eyebrow">25. juni 1914</p>
          <h2>Stifterne</h2>
          <p className={styles.sectionLead}>Personene som undertegnet protokollen ved klubbens konstituerende generalforsamling.</p>
          <RoleList roles={founders} sourceTitles={sourceTitles} />
        </section>
      ) : null}

      <div className={styles.columns}>
        <section>
          <p className="eyebrow">Driften av klubben</p>
          <h2>Administrasjon, anlegg og øvrige verv</h2>
          {administration.length > 0 ? <RoleList roles={administration} sourceTitles={sourceTitles} /> : <p className="muted">Ingen roller registrert ennå.</p>}
        </section>
        <section>
          <p className="eyebrow">Klubbens heder</p>
          <h2>Heder og utmerkelser</h2>
          {honorary.length > 0 ? <RoleList roles={honorary} sourceTitles={sourceTitles} /> : <p className="muted">Ingen roller registrert ennå.</p>}
        </section>
      </div>

      <section className={styles.sportSection}>
        <p className="eyebrow">Sportslig ledelse</p>
        <h2>Trenere og sportslig apparat</h2>
        <p className={styles.sectionLead}>Oppgitte trenerperioder suppleres av kamp-for-kamp-data fra 2010.</p>
        <RoleList roles={sporting} sourceTitles={sourceTitles} />
      </section>

      <aside className={styles.pilotNote}>
        <div><p className="eyebrow">Kildekritisk arkiv</p><h2>Fra dokument til struktur</h2></div>
        <p>
          Oversikten kombinerer jubileumsskrifter med AaFKs egne historiske sider.
          Roller og årstall lagres som fakta med kilde, mens den opprinnelige brødteksten
          blir hos utgiveren. Uenige perioder beholdes som kildeavvik.
        </p>
      </aside>
    </article>
  );
}
