import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonById, getPersonIds, getPersonRoles, getPersonSeasons, getSourceTitles } from "@/lib/people";
import styles from "../People.module.css";

const POSITION_LABELS: Record<string, string> = { keeper: "Keeper", forsvar: "Forsvar", midtbane: "Midtbane", angrep: "Angrep" };

function range(from: string, to: string | null): string {
  if (to === null || to === from) return from;
  return `${from}–${to}`;
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
          {roles.length > 0 ? (
            <section className={styles.section}>
              <h2>Roller og verv</h2>
              <ol className={styles.timeline}>
                {roles.map((role) => (
                  <li key={role.role_id}>
                    <time>{range(role.from_date, role.to_date)}</time>
                    <div>
                      <h3>{role.title}</h3>
                      {role.body ? <p>{role.body}</p> : null}
                      {role.note ? <p>{role.note}</p> : null}
                      <div className={styles.sources}>
                        {role.sources.map((source) => (
                          <Link key={`${role.role_id}-${source.sourceId}-${source.page ?? ""}`} href={`/kilder/${source.sourceId}`}>
                            {sourceTitles.get(source.sourceId) ?? "Kilde"}{source.page ? `, s. ${source.page}` : ""}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
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
        </div>

        <aside className={styles.asideCard}>
          <h2>Registrert i arkivet</h2>
          <dl>
            <div><dt>Kamptropper</dt><dd>{person.appearances}</dd></div>
            <div><dt>Starter</dt><dd>{person.starts}</dd></div>
            <div><dt>Kildeførte roller</dt><dd>{person.role_count}</dd></div>
          </dl>
          {person.wikidata ? <p className="small"><a href={`https://www.wikidata.org/wiki/${person.wikidata}`}>Åpne Wikidata →</a></p> : null}
          {person.note ? <p className="small muted">{person.note}</p> : null}
        </aside>
      </div>
    </article>
  );
}
