import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonById, getPersonIds, getPersonRoles, getPersonSeasons, getSourceTitles } from "@/lib/people";
import type { PersonConflict, PersonMention, PersonRole, PersonRoleSource } from "@/lib/people";
import styles from "../People.module.css";

const POSITION_LABELS: Record<string, string> = { keeper: "Keeper", forsvar: "Forsvar", midtbane: "Midtbane", angrep: "Angrep" };

const PROVIDER_LABELS: Record<string, string> = {
  "aafk-no": "aafk.no",
  nasjonalbiblioteket: "Nasjonalbiblioteket",
  wikipedia: "Wikipedia",
  contribution: "Bidrag",
};

const MONTHS = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];

/**
 * Datoer slik kildene oppgir dem, skrevet ut.
 *
 * Rollene har ulik oppløsning med vilje: styreåret 1962 er alt kilden sier om
 * de fleste verv, mens æresmedlemskapet har en eksakt dato. Skrevet som
 * `1915-12-11` ved siden av `1914–1915` ser det ut som en inkonsekvens i
 * arkivet i stedet for i kildene.
 */
function when(from: string, to: string | null): string {
  const day = (value: string): string => {
    const [year, month, date] = value.split("-");
    if (!month || !date) return year!;
    return `${Number(date)}. ${MONTHS[Number(month) - 1]} ${year}`;
  };
  if (to === null || to === from) return day(from);
  if (from.length === 4 && to.length === 4) return `${from}–${to}`;
  return `${day(from)} – ${day(to)}`;
}

/**
 * Kildene til én rolle, uten dublett — målt på det leseren ser.
 *
 * Samme publikasjon og side kan komme inn to ganger, én gang fra en håndlesning
 * og én fra en maskinell. Verre: arkivet har to kilde-ID-er med identisk tittel,
 * som `medlemsblad-…-1974-6d28` og `…-1974-ab1b`, fordi samme utgave er
 * registrert to ganger hos Nasjonalbiblioteket. To brikker med nøyaktig samme
 * tekst ser ut som en feil uansett hvor ærlig forskjellen er, så de slås sammen
 * på etiketten og ikke på ID-en.
 */
function distinctSources(sources: PersonRoleSource[], titles: Map<string, string>): CitedSource[] {
  const seen = new Map<string, CitedSource>();
  for (const source of sources) {
    const title = titles.get(source.sourceId) ?? source.sourceId;
    const current = seen.get(title);
    if (!current) {
      seen.set(title, { sourceId: source.sourceId, title, pages: source.page ? [source.page] : [] });
      continue;
    }
    // Samme publikasjon sitert pa flere sider blir en lenke med sidetallene
    // etter hverandre. Tre brikker med identisk tittel og hvert sitt sidetall
    // fyller en halv skjerm og sier ikke mer enn en med tre tall.
    if (source.page && !current.pages.includes(source.page)) current.pages.push(source.page);
  }
  return [...seen.values()];
}

/** En publikasjon som belegger noe, med sidene den er sitert pa. */
interface CitedSource {
  sourceId: string;
  title: string;
  pages: string[];
}

function pages(source: CitedSource): string {
  if (source.pages.length === 0) return "";
  const sorted = [...source.pages].sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  return `, s. ${sorted.join(", ")}`;
}

export function generateStaticParams(): { id: string }[] {
  return getPersonIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const person = getPersonById(id);
  return person ? {
    title: person.name,
    description: `Roller og registrert kamphistorikk for ${person.name} i AaFK-arkivet.`,
  } : { title: "Person ikke funnet" };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = getPersonById(id);
  if (!person) notFound();

  const roles = [...getPersonRoles(id)].reverse();
  const seasons = getPersonSeasons(id);
  const sourceTitles = getSourceTitles();
  const initials = person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
  const played = person.appearances > 0;

  return (
    <article>
      <Link href="/personer" className={styles.backLink}>← Tilbake til personer</Link>
      <header className={`page-header ${styles.detailHeader}`}>
        <div className={styles.detailMonogram} aria-hidden="true">{initials}</div>
        <div>
          <p className="eyebrow">Person i AaFK-arkivet</p>
          <h1>{person.name}</h1>
          <div className={styles.detailMeta}>
            {person.position ? <span>{POSITION_LABELS[person.position] ?? person.position}</span> : null}
            {person.nationality ? <span>{person.nationality}</span> : null}
            {person.first_season ? <span>Kamper {person.first_season}–{person.last_season}</span> : null}
            {person.first_role_year ? <span>Roller {person.first_role_year}–{person.last_role_year}</span> : null}
          </div>
        </div>
      </header>

      <div className={styles.detailGrid}>
        <div>
          {person.conflicts.length > 0 ? <Conflicts conflicts={person.conflicts} titles={sourceTitles} /> : null}

          {roles.length > 0 ? (
            <section className={styles.section}>
              <h2>Roller og verv</h2>
              <ol className={styles.timeline}>
                {roles.map((role) => <Role key={role.role_id} role={role} titles={sourceTitles} />)}
              </ol>
            </section>
          ) : null}

          {seasons.length > 0 ? (
            <section className={styles.section}>
              <h2>Registrerte sesonger</h2>
              <div className="table-scroll">
                <table className={styles.seasonTable}>
                  <thead><tr><th>Sesong</th><th>Nr.</th><th>Kamptropper</th><th>Starter</th><th>Mål</th></tr></thead>
                  <tbody>
                    {seasons.map((season) => (
                      <tr key={season.season}>
                        <td><Link href={`/sesong/${season.season}`}>{season.season}</Link></td>
                        <td>{season.number ?? "–"}</td><td>{season.appearances}</td><td>{season.starts}</td><td>{season.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {person.mentions.length > 0 ? <Mentions mentions={person.mentions} titles={sourceTitles} /> : null}
        </div>

        <aside className={styles.asideCard}>
          <h2>Registrert i arkivet</h2>
          <dl>
            {played ? (
              <>
                <div><dt>Kamptropper</dt><dd>{person.appearances}</dd></div>
                <div><dt>Starter</dt><dd>{person.starts}</dd></div>
              </>
            ) : null}
            {person.role_count > 0 ? <div><dt>Kildeførte roller</dt><dd>{person.role_count}</dd></div> : null}
            {person.mentions.length > 0 ? (
              <div><dt>Omtalt i</dt><dd>{person.mentions.length} {person.mentions.length === 1 ? "publikasjon" : "publikasjoner"}</dd></div>
            ) : null}
            {person.conflicts.length > 0 ? (
              <div><dt>Uavklarte verv</dt><dd>{person.conflicts.length}</dd></div>
            ) : null}
          </dl>
          {person.wikidata ? <p className="small"><a href={`https://www.wikidata.org/wiki/${person.wikidata}`}>Åpne Wikidata →</a></p> : null}
          {person.note ? <p className="small muted">{person.note}</p> : null}
        </aside>
      </div>
    </article>
  );
}

function Role({ role, titles }: { role: PersonRole; titles: Map<string, string> }) {
  return (
    <li>
      <time>{when(role.from_date, role.to_date)}</time>
      <div>
        <h3>{role.title}</h3>
        {role.body ? <p className={styles.roleBody}>{role.body}</p> : null}
        {role.note ? <p className="small muted">{role.note}</p> : null}
        <ul className={styles.sources}>
          {distinctSources(role.sources, titles).map((source) => (
            <li key={source.title}>
              <Link href={`/kilder/${source.sourceId}`}>
                {source.title}<span className="num">{pages(source)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/**
 * Verv der kildene oppgir ulike navn.
 *
 * Står øverst med vilje. En leser som ser «Formann 1968» lenger nede skal vite
 * at en annen kilde sier noe annet før hen tar tallet med seg videre.
 */
function Conflicts({ conflicts, titles }: { conflicts: PersonConflict[]; titles: Map<string, string> }) {
  /**
   * Merknaden bærer kilde-ID-en fra innhøstingen, som er en intern nøkkel.
   * Leseren skal se publikasjonen den peker på.
   */
  const readable = (note: string): string => {
    const id = /^([a-z0-9-]+)/.exec(note)?.[1];
    const title = id ? titles.get(id) : undefined;
    return title ? note.replace(id!, title) : note;
  };

  return (
    <section className={`${styles.section} ${styles.conflicts}`}>
      <h2>Kildene er uenige</h2>
      <p className="small muted">
        Arkivet velger ikke mellom dem. Vet du hvilken som stemmer, kan du{" "}
        <Link href="/bidra">sende inn en rettelse</Link>.
      </p>
      <ul className={styles.conflictList}>
        {conflicts.map((conflict) => {
          const [office, year] = conflict.field.split(".");
          return (
            <li key={conflict.field}>
              <p className={styles.conflictField}>
                <span className={styles.conflictOffice}>{office ? office[0]!.toUpperCase() + office.slice(1) : conflict.field}</span>
                {year ? <span className="num">{year}</span> : null}
              </p>
              <ul>
                {conflict.values.map((value) => (
                  <li key={`${value.providerId}-${String(value.value)}`}>
                    <strong>{String(value.value)}</strong>
                    <span className="small muted">
                      {PROVIDER_LABELS[value.providerId] ?? value.providerId}
                      {value.note ? ` · ${readable(value.note)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Publikasjonene som omtaler personen.
 *
 * Ikke en påstand om hva de sier — bare at navnet står der, gjenkjent mot
 * registeret. For flere av de eldre er dette hele sporet arkivet har etter dem.
 */
function Mentions({ mentions, titles }: { mentions: PersonMention[]; titles: Map<string, string> }) {
  const shown = distinctSources(mentions, titles);
  return (
    <section className={styles.section}>
      <h2>Omtalt i</h2>
      <p className="small muted">
        {shown.length} {shown.length === 1 ? "publikasjon nevner" : "publikasjoner nevner"} navnet.
        Sidetallet er første treff i hver.
      </p>
      <ul className={styles.mentionList}>
        {[...shown]
          .sort((a, b) => a.title.localeCompare(b.title, "nb"))
          .map((mention) => (
            <li key={mention.title}>
              <Link href={`/kilder/${mention.sourceId}`}>
                {mention.title}<span className="num">{pages(mention)}</span>
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}
