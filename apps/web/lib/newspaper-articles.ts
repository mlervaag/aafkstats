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
 * Faksimilelenkene er knyttet direkte til kampene, ikke registrert som egne
 * publikasjoner i `core_sources`. Denne spørringen gir dem en samlet inngang i
 * kildearkivet uten å late som hver avisartikkel er en bok eller en utgave.
 */
export const getSunnmorspostenArticles = cache(function getSunnmorspostenArticles(): NewspaperArticle[] {
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
       WHERE json_extract(report.value, '$.publisher') = ?
       ORDER BY coalesce(json_extract(report.value, '$.date'), m.match_date) DESC,
                m.match_date DESC,
                m.id`,
      "Sunnmørsposten",
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
