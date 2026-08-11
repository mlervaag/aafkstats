import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import Link from "next/link";
import { getPersonRoles, getSourceTitles, mergeRoleSpells, type PersonRole } from "@/lib/people";
import { ArchiveTabs } from "@/components/ArchiveTabs";
import { SectionIndex } from "@/components/SectionIndex";
import { SourceChips } from "@/components/SourceChips";
import { contributionIssueUrl } from "@/lib/contribution-links";
import styles from "./Organization.module.css";

export const metadata: Metadata = pageMetadata(
  "Organisasjon",
  "Kildeført oversikt over styrer, ledere, administrasjon og hedersroller i Aalesunds Fotballklubb.",
  "/organisasjon",
  "website",
);

/**
 * Er tittelen klubbens øverste verv?
 *
 * Ordet har skiftet: kildene fra 1914 og framover sier «Formann», klubbens egne
 * sider i dag sier «Styreleder», og bøkene bruker begge om hverandre — Asbjørn
 * Korsnes står som styreleder i 1979 og Peder Puck like ens. Lista het «Formenn»
 * og spurte etter det ene ordet, så de tre falt ut av klubbens egen lederrekke.
 */
function isChair(title: string): boolean {
  const value = title.toLowerCase();
  return value === "formann" || value === "styreleder";
}

const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

/**
 * Perioden i årstall.
 *
 * Lista er årstallsordnet og tidsspalta er åtte tegn bred, så «4. september
 * 2008 – 26. november 2012» hører hjemme på persondetaljsida, ikke her. Den
 * eksakte datoen ligger i `title` for den som holder musa i ro.
 */
function range(role: PersonRole): string {
  const from = role.from_date.slice(0, 4);
  const to = role.to_date?.slice(0, 4);
  return to && to !== from ? `${from}–${to}` : from;
}

function day(value: string): string {
  const [year, month, date] = value.split("-");
  return month && date ? `${Number(date)}. ${MONTHS[Number(month) - 1]} ${year}` : year!;
}

/** Den eksakte perioden, når kilden oppgir en dag og ikke bare et år. */
function exact(role: PersonRole): string | undefined {
  if (role.from_date.length === 4 && (role.to_date ?? "").length <= 4) return undefined;
  // Stiftelsesdagen er én dag, ikke en periode: «25. juni 1914», ikke
  // «25. juni 1914 – 25. juni 1914».
  if (!role.to_date || role.to_date === role.from_date) return day(role.from_date);
  return `${day(role.from_date)} – ${day(role.to_date)}`;
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
          <time title={exact(role)}>{range(role)}</time>
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
  const registered = getPersonRoles();
  // Sammenslåingen gjelder visningen. Kildedekninga teller fortsatt registrerte
  // roller, ikke rader på skjermen — det er arkivets størrelse, ikke sidas.
  const roles = mergeRoleSpells(registered);
  const sourceTitles = getSourceTitles();
  const chairs = roles.filter((role) => role.category === "board" && isChair(role.title));
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
          <p>{registered.length} kildeførte roller · {new Set(registered.map((role) => role.person_id)).size} personer</p>
        </div>
      </header>

      <ArchiveTabs current="/organisasjon" />

      <SectionIndex
        label="Seksjoner på organisasjonssida"
        sections={[
          { id: "formenn", label: "Formenn", count: chairs.length },
          { id: "stifterne", label: "Stifterne", count: founders.length },
          { id: "administrasjon", label: "Administrasjon", count: administration.length },
          { id: "heder", label: "Heder", count: honorary.length },
          { id: "trenere", label: "Trenere", count: sporting.length },
        ]}
      />

      <section className={styles.introGrid} id="formenn">
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
        <section className={styles.sportSection} id="stifterne">
          <p className="eyebrow">25. juni 1914</p>
          <h2>Stifterne</h2>
          <p className={styles.sectionLead}>Personene som undertegnet protokollen ved klubbens konstituerende generalforsamling.</p>
          <RoleList roles={founders} sourceTitles={sourceTitles} />
        </section>
      ) : null}

      <div className={styles.columns}>
        <section id="administrasjon">
          <p className="eyebrow">Driften av klubben</p>
          <h2>Administrasjon, anlegg og øvrige verv</h2>
          {administration.length > 0 ? <RoleList roles={administration} sourceTitles={sourceTitles} /> : <p className="muted">Ingen roller registrert ennå.</p>}
        </section>
        <section id="heder">
          <p className="eyebrow">Klubbens heder</p>
          <h2>Heder og utmerkelser</h2>
          {honorary.length > 0 ? <RoleList roles={honorary} sourceTitles={sourceTitles} /> : <p className="muted">Ingen roller registrert ennå.</p>}
        </section>
      </div>

      <section className={styles.sportSection} id="trenere">
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
        <a className="button-link" href={contributionIssueUrl("datafeil", "Organisasjon")}>
          Meld feil eller manglende verv
        </a>
      </aside>
    </article>
  );
}
