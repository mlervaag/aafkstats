import { formatDate } from "@/lib/date";
import type { NewspaperReport } from "@/lib/newspaper-articles";
import styles from "./MatchNewspaperArticles.module.css";

/**
 * Overskriften navnga Sunnmørsposten. Faksimilene fra før 1927 står under det
 * gamle navnet Søndmørsposten, og arkivet skal få flere aviser — så navnet
 * hentes fra kampen, og faller tilbake på det generelle når de er flere.
 */
function heading(articles: NewspaperReport[]): string {
  const publishers = [...new Set(articles.map((article) => article.publisher))];
  const where = publishers.length === 1 ? ` i ${publishers[0]}` : "";
  return articles.length === 1 ? `Les om kampen${where}` : `Artikler om kampen${where}`;
}

export function MatchNewspaperArticles({ articles }: { articles: NewspaperReport[] }) {
  if (articles.length === 0) return null;

  return (
    <section className={styles.section} id="avisartikler" aria-labelledby="avisartikler-tittel">
      <div className={styles.intro}>
        <p>Fra avisarkivet</p>
        <h2 id="avisartikler-tittel">{heading(articles)}</h2>
        <span>
          Faksimilen åpnes hos Nasjonalbiblioteket. Artikkelen er knyttet til
          kampen etter kildekontroll.
        </span>
      </div>
      <ol className={styles.list}>
        {articles.map((article, index) => (
          <li key={`${article.url ?? article.title ?? article.date ?? "artikkel"}-${index}`}>
            <div>
              <span className={styles.meta}>
                {article.publisher}{article.date ? ` · ${formatDate(article.date)}` : ""}
              </span>
              <strong>{article.title ?? "Avisartikkel om kampen"}</strong>
            </div>
            {article.url ? (
              <a href={article.url} target="_blank" rel="noreferrer">
                Åpne faksimilen <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className={styles.unavailable}>Ingen direktelenke</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
