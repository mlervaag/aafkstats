import { formatDate } from "@/lib/date";
import type { NewspaperReport } from "@/lib/newspaper-articles";
import styles from "./MatchNewspaperArticles.module.css";

export function MatchNewspaperArticles({ articles }: { articles: NewspaperReport[] }) {
  if (articles.length === 0) return null;

  return (
    <section className={styles.section} id="avisartikler" aria-labelledby="avisartikler-tittel">
      <div className={styles.intro}>
        <p>Fra avisarkivet</p>
        <h2 id="avisartikler-tittel">
          {articles.length === 1 ? "Les om kampen i Sunnmørsposten" : "Artikler om kampen i Sunnmørsposten"}
        </h2>
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
