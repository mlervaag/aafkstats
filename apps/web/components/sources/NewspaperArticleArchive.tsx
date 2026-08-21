import Link from "next/link";
import { formatDate } from "@/lib/date";
import type { NewspaperArticle } from "@/lib/newspaper-articles";
import styles from "./NewspaperArticleArchive.module.css";

function matchLabel(article: NewspaperArticle): string {
  const aafk = article.aafkScore ?? "–";
  const opponent = article.opponentScore ?? "–";
  return article.isHome
    ? `AaFK–${article.opponent} ${aafk}–${opponent}`
    : `${article.opponent}–AaFK ${opponent}–${aafk}`;
}

function byDecade(articles: NewspaperArticle[]): [number, NewspaperArticle[]][] {
  const groups = new Map<number, NewspaperArticle[]>();
  for (const article of articles) {
    const decade = Math.floor(Number((article.articleDate ?? article.matchDate).slice(0, 4)) / 10) * 10;
    groups.set(decade, [...(groups.get(decade) ?? []), article]);
  }
  return [...groups.entries()].sort(([a], [b]) => b - a);
}

export function NewspaperArticleArchive({ articles }: { articles: NewspaperArticle[] }) {
  if (articles.length === 0) return null;
  const decades = byDecade(articles);
  const matchCount = new Set(articles.map((article) => article.matchId)).size;

  return (
    <section className={styles.section} aria-labelledby="avisarkiv-tittel">
      <div className={styles.heading}>
        <div>
          <p>Avisarkiv</p>
          <h2 id="avisarkiv-tittel">Sunnmørsposten om AaFK-kamper</h2>
        </div>
        <span>{articles.length} artikler · {matchCount} kamper</span>
      </div>
      <p className={styles.lede}>
        Disse avissidene er koblet til konkrete kamper etter kildekontroll. Gå til
        kampen for sammenhengen, eller åpne originalen hos Nasjonalbiblioteket.
      </p>
      <div className={styles.decades}>
        {decades.map(([decade, items], index) => (
          <details key={decade} open={index === 0}>
            <summary>
              <strong>{decade}-tallet</strong>
              <span>{items.length} {items.length === 1 ? "artikkel" : "artikler"}</span>
            </summary>
            <ol>
              {items.map((article, articleIndex) => (
                <li key={`${article.matchId}-${article.url ?? article.articleDate ?? articleIndex}`}>
                  <time dateTime={article.articleDate ?? article.matchDate}>
                    {formatDate(article.articleDate ?? article.matchDate)}
                  </time>
                  <div>
                    <strong>{article.title ?? `${article.publisher} om kampen`}</strong>
                    <Link href={`/kamp/${article.matchId}`}>{matchLabel(article)}</Link>
                  </div>
                  {article.url ? (
                    <a className={styles.facsimile} href={article.url} target="_blank" rel="noreferrer">
                      Faksimile <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
