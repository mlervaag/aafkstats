import { all, open } from "@aafkstats/db";
import { cache } from "react";

export interface NewspaperReport {
  publisher: string;
  title?: string;
  date?: string;
  url?: string;
}

export interface NewspaperArticle {
  matchId: string;
  matchDate: string;
  season: number;
  publisher: string;
  title: string | null;
  articleDate: string | null;
  url: string | null;
  opponent: string;
  isHome: boolean;
  aafkScore: number | null;
  opponentScore: number | null;
}

interface NewspaperArticleRow {
  match_id: string;
  match_date: string;
  season: number;
  publisher: string;
  title: string | null;
  article_date: string | null;
  url: string | null;
  opponent: string;
  is_home: number;
  aafk_score: number | null;
  opponent_score: number | null;
}

/**
 * Hva som gjør en ekstern rapport til en avisside.
 *
 * Avisarkivet plukket ut rapportene der utgiveren het «Sunnmørsposten». Det
 * utelot de åtte eldste faksimilene i arkivet: fram til 1920-tallet het avisa
 * Søndmørsposten, og sidene fra 1915 til 1922 lå dermed i dataene uten å vises
 * noe sted. Det er lenken til Nasjonalbiblioteket som gjør en rapport til en
 * avisside vi kan vise fram — ikke hva avisa het det året. Kriteriet holder også
 * databaseoppslag som NIFS ute av avisarkivet, uten å måtte liste opp avisnavn
 * arkivet ennå ikke har møtt.
 */
export const NEWSPAPER_FACSIMILE = "json_extract(report.value, '$.url') LIKE 'https://www.nb.no/%'";

/**
 * Faksimilelenkene er knyttet direkte til kampene, ikke registrert som egne
 * publikasjoner i `core_sources`. Denne spørringen gir dem en samlet inngang i
 * kildearkivet uten å late som hver avisartikkel er en bok eller en utgave.
 */
export const getNewspaperArticles = cache(function getNewspaperArticles(): NewspaperArticle[] {
  const db = open();
  try {
    return all<NewspaperArticleRow>(
      db,
      `SELECT
         m.id AS match_id,
         m.match_date,
         m.season,
         json_extract(report.value, '$.publisher') AS publisher,
         json_extract(report.value, '$.title') AS title,
         json_extract(report.value, '$.date') AS article_date,
         json_extract(report.value, '$.url') AS url,
         m.opponent_name AS opponent,
         m.is_home,
         m.aafk_score,
         m.opponent_score
       FROM core_matches m
       JOIN json_each(m.external_reports) report
       WHERE ${NEWSPAPER_FACSIMILE}
       ORDER BY coalesce(json_extract(report.value, '$.date'), m.match_date) DESC,
                m.match_date DESC,
                m.id`,
    ).map((row) => ({
      matchId: row.match_id,
      matchDate: row.match_date,
      season: row.season,
      publisher: row.publisher,
      title: row.title,
      articleDate: row.article_date,
      url: row.url,
      opponent: row.opponent,
      isHome: row.is_home === 1,
      aafkScore: row.aafk_score,
      opponentScore: row.opponent_score,
    }));
  } finally {
    db.close();
  }
});
