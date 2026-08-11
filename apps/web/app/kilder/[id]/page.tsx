import { notFound } from "next/navigation";
import { SourceTypeBadge, SOURCE_TYPE_LABELS } from "@/components/sources/SourceTypeBadge";
import { SourceCard } from "@/components/sources/SourceCard";
import { SourceCover } from "@/components/sources/SourceCover";
import { SourceIssueYears } from "@/components/sources/SourceIssueYears";
import { ContributionCallToAction } from "@/components/ContributionCallToAction";
import {
  getProviderNames,
  getSourceById,
  getSourceChildren,
  getSourceIds,
  getParentSource,
  getSourceUsages,
  getSourceRoleUsages,
  getSourceSeasonUsages,
  getSourceResultUsages,
} from "@/lib/sources";
import { pageMetadata, sourceDescription } from "@/lib/metadata";
import { formatDateShort } from "@/lib/date";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import styles from "./SourceDetail.module.css";

/**
 * Alle kildesidene forhåndsgenereres.
 *
 * Kildene ligger i det samme bygde SQLite-arkivet som kampene og sesongene, og de
 * sidene har vært forhåndsgenerert hele tiden. Kildesidene sto igjen som
 * `force-dynamic` og gjorde det samme oppslaget på nytt for hver forespørsel, for
 * et svar som ikke kan bli et annet før neste utrulling.
 *
 * Forsidebildene hentes fortsatt gjennom `/api/nb-image` ved kjøring. Den ruten er
 * en API-rute og berøres ikke av at siden rundt er statisk.
 */
export function generateStaticParams(): { id: string }[] {
  return getSourceIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const source = getSourceById(id);
  if (!source) return { title: "Kilde ikke funnet" };

  const children = source.source_type === "series" ? getSourceChildren(id) : [];
  return pageMetadata(
    source.title,
    sourceDescription({
      title: source.title,
      description: source.description,
      year: source.year,
      publisher: source.publisher,
      issues: children.length,
      usages: getSourceUsages(id).length,
    }),
    `/kilder/${id}`,
  );
}

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const source = getSourceById(id);
  if (!source) {
    return notFound();
  }

  const children = source.source_type === 'series' ? getSourceChildren(id) : [];
  const parent = source.parent_source_id ? getParentSource(source.parent_source_id) : null;
  const usages = getSourceUsages(id);
  const roleUsages = getSourceRoleUsages(id);
  const seasonUsages = getSourceSeasonUsages(id);
  const resultUsages = getSourceResultUsages(id);
  // Visningsnavnet på en leverandør står i providerfila. Kildesiden hadde
  // «Nasjonalbiblioteket» hardkodet, og alle andre leverandører sto med sin ID.
  const providerNames = getProviderNames();
  const providerName = (providerId: string) => providerNames.get(providerId) ?? providerId;
  // Utgavene i en serie er nesten alltid periodika, og da er år → nummer den
  // rekkefølgen leseren tenker i. Serier av noe annet får rutenettet som før.
  const isPeriodical = children.length > 0 &&
    children.every((child) => child.source_type === "member_magazine" || child.source_type === "annual_report");

  return (
    <article>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Kilder", path: "/kilder" },
          ...(parent ? [{ name: parent.title, path: `/kilder/${parent.id}` }] : []),
          { name: source.title, path: `/kilder/${id}` },
        ])}
      />
      {parent && (
        <Link href={`/kilder/${parent.id}`} className={styles.backLink}>
          &larr; Tilbake til {parent.title}
        </Link>
      )}

      <header className={`page-header ${styles.header}`}>
        <SourceTypeBadge type={source.source_type} year={source.year} />
        <h1>{source.title}</h1>
        {source.issue && (
          <div className={styles.headerIssue}>
            Utgave: {source.issue}{source.volume ? `, Årgang: ${source.volume}` : ""}
          </div>
        )}
      </header>

      <div className={styles.layout}>
        <div className={styles.coverColumn}>
          <SourceCover title={source.title} coverUrl={source.cover_url} />
        </div>

        <div>
          {source.description && (
            <p className={`lead ${styles.lead}`}>{source.description}</p>
          )}

          <div className={styles.facts}>
            <h2>Fakta om kilden</h2>
            <dl className={styles.factList}>
              <dt>Kildetype</dt>
              <dd>{SOURCE_TYPE_LABELS[source.source_type] || source.source_type}</dd>

              {source.author && (
                <>
                  <dt>Forfatter</dt>
                  <dd>{source.author}</dd>
                </>
              )}

              {source.publisher && (
                <>
                  <dt>Utgiver</dt>
                  <dd>{source.publisher}</dd>
                </>
              )}

              {source.year && (
                <>
                  <dt>År</dt>
                  <dd>{source.year}</dd>
                </>
              )}

              {source.urn && (
                <>
                  {/* Adressen over kan endre seg. URN-en er det som fortsatt
                      identifiserer dokumentet når den gjør det. */}
                  <dt>URN</dt>
                  <dd className={styles.urn}><code>{source.urn}</code></dd>
                </>
              )}

              {source.providers && source.providers.length > 0 && (
                <>
                  <dt>Digitalisert hos</dt>
                  <dd>
                    {source.providers.map((p, i) => (
                      <span key={p.providerId}>
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className={styles.providerLink}>
                            {providerName(p.providerId)}
                          </a>
                        ) : (
                          providerName(p.providerId)
                        )}
                        {i < source.providers.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </div>

          {source.access_url && (
            <div className={styles.access}>
              <a
                href={source.access_url}
                target="_blank"
                rel="noopener noreferrer"
                className="button-link"
              >
                {source.providers?.[0]
                  ? `Les hos ${providerName(source.providers[0].providerId)} →`
                  : "Åpne originalkilden →"}
              </a>
            </div>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <section className={styles.section}>
          <h2>Utgivelser ({children.length})</h2>
          {isPeriodical ? (
            <SourceIssueYears issues={children} />
          ) : (
            <div className={styles.cardGrid}>
              {children.map((child) => (
                <SourceCard
                  key={child.id}
                  id={child.id}
                  title={child.title}
                  sourceType={child.source_type}
                  year={child.year}
                  publisher={child.publisher}
                  coverUrl={child.cover_url}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {usages.length > 0 && (
        <section className={styles.section}>
          {/* «Dokumenterte kamper» leses som om kilden dekker hele kampen. Som
              regel er den brukt til ett felt — et tilskuertall, en dato — og
              overskriften skal si nettopp det. Side og notat står på hver bruk. */}
          <h2>Kamper der kilden er brukt ({usages.length})</h2>
          <ol className="archive-match-list">
              {usages.map((match) => {
                const score = match.aafk_score === null || match.opponent_score === null
                  ? "–"
                  : match.is_home === 1
                    ? `${match.aafk_score}–${match.opponent_score}`
                    : `${match.opponent_score}–${match.aafk_score}`;
                return (
                  <li key={`${match.id}-${match.source_id}`}>
                    <Link href={`/kamp/${match.id}`}>
                      <span className="match-date num">{formatDateShort(match.date)}</span>
                      <span className="match-opponent">
                        {match.is_home === 1 ? `AaFK – ${match.opponent}` : `${match.opponent} – AaFK`}
                      </span>
                      <strong className="match-score score">{score}</strong>
                      <span className="match-meta muted">
                        {match.competition}
                        {source.source_type === "series" ? ` · ${match.source_title}` : ""}
                        {match.page ? ` · Side ${match.page}` : ""}
                        {match.note ? ` · ${match.note}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ol>
        </section>
      )}

      {resultUsages.length > 0 && (
        <section className={styles.section}>
          <h2>Kildedokumenterte resultater ({resultUsages.reduce((sum, row) => sum + row.results, 0)})</h2>
          <p className="prose muted">Resultatlistene mangler full kampdato og hjemme/borte, og holdes derfor adskilt fra den offisielle kampstatistikken.</p>
          <div className={styles.cardGrid}>
            {resultUsages.map((row) => (
              <Link className="archive-card card-fragment" href={`/sesong/${row.season}`} key={row.season}>
                <strong className="card-title num">{row.season}</strong>
                <span className="card-meta">{row.results} resultater · side {row.first_page}{row.last_page !== row.first_page ? `–${row.last_page}` : ""}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {seasonUsages.length > 0 && (
        <section className={styles.section}>
          <h2>Sesonger der kilden er brukt ({seasonUsages.length})</h2>
          <ol className="archive-match-list">
            {seasonUsages.map((season) => (
              <li key={`${season.season}-${season.competition}`}>
                <Link href={`/sesong/${season.season}`}>
                  <span className="match-date num">{season.season}</span>
                  <span className="match-opponent">{season.competition}</span>
                  <span className="match-meta muted">{season.page ? `Side ${season.page}` : "Sesongkilde"}{season.note ? ` · ${season.note}` : ""}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {roleUsages.length > 0 && (
        <section className={styles.section}>
          <h2>Personroller dokumentert av kilden ({roleUsages.length})</h2>
          <ol className="archive-match-list">
            {roleUsages.map((role) => (
              <li key={`${role.person_id}-${role.title}-${role.from_date}`}>
                <Link href={`/personer/${role.person_id}`}>
                  <span className="match-date num">{role.from_date}{role.to_date && role.to_date !== role.from_date ? `–${role.to_date}` : ""}</span>
                  <span className="match-opponent">{role.name}</span>
                  <span className="match-meta muted">{role.title}{role.page ? ` · Side ${role.page}` : ""}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ContributionCallToAction sourceTitle={source.title} />
    </article>
  );
}
