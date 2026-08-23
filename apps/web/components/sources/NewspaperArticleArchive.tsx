"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { formatDate } from "@/lib/date";
import type { NewspaperArticle } from "@/lib/newspaper-articles";
import styles from "./NewspaperArticleArchive.module.css";

/** Hvor mange artikler som vises før «vis flere». */
const PAGE = 40;

function matchLabel(article: NewspaperArticle): string {
  const aafk = article.aafkScore ?? "–";
  const opponent = article.opponentScore ?? "–";
  return article.isHome
    ? `AaFK–${article.opponent} ${aafk}–${opponent}`
    : `${article.opponent}–AaFK ${opponent}–${aafk}`;
}

/** Datoen artikkelen skal sorteres og grupperes på. */
function articleDate(article: NewspaperArticle): string {
  return article.articleDate ?? article.matchDate;
}

function year(article: NewspaperArticle): number {
  return Number(articleDate(article).slice(0, 4));
}

function decadeOf(article: NewspaperArticle): number {
  return Math.floor(year(article) / 10) * 10;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("nb-NO");
}

/**
 * Alt et søk skal kunne treffe på i én artikkel.
 *
 * Leseren leter etter en motstander, et årstall eller en dato — ikke etter
 * overskriften, som ofte er den samme sportsvignetten år etter år. Både den
 * norske og den ISO-formaterte datoen er med, slik at «1947-05», «mai 1947» og
 * «1947» alle finner de samme sidene.
 */
function haystack(article: NewspaperArticle): string {
  const iso = articleDate(article);
  return normalize(
    [
      article.title ?? "",
      article.opponent,
      matchLabel(article),
      iso,
      formatDate(iso),
      String(article.season),
      article.isHome ? "hjemme" : "borte",
    ].join(" "),
  );
}

function byYear(articles: NewspaperArticle[]): [number, NewspaperArticle[]][] {
  const groups = new Map<number, NewspaperArticle[]>();
  for (const article of articles) {
    groups.set(year(article), [...(groups.get(year(article)) ?? []), article]);
  }
  return [...groups.entries()].sort(([a], [b]) => b - a);
}

/**
 * Avisarkivet som et søkbart register.
 *
 * Lista var gruppert på tiår i hver sin `<details>`, og var lesbar så lenge
 * arkivet hadde noen titalls sider. Berikelsen har gjort tiårene ulike: 1970-
 * tallet har over femti sider, 1920-tallet fem. Da er en sammenklappet
 * tiårsbolk feil verktøy — den skjuler halve arkivet bak ett klikk og gir
 * likevel en liste ingen skanner ferdig. Registeret filtrerer i stedet på tiår,
 * søker på motstander og dato, og viser førti sider om gangen gruppert på år.
 */
export function NewspaperArticleArchive({ articles }: { articles: NewspaperArticle[] }) {
  const [query, setQuery] = useState("");
  const [decade, setDecade] = useState<number | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const deferredQuery = useDeferredValue(query);

  const decades = useMemo(() => {
    const counts = new Map<number, number>();
    for (const article of articles) {
      counts.set(decadeOf(article), (counts.get(decadeOf(article)) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a - b);
  }, [articles]);

  const matching = useMemo(() => {
    const needle = normalize(deferredQuery.trim());
    return articles.filter((article) => {
      if (decade !== "all" && decadeOf(article) !== decade) return false;
      return needle === "" || haystack(article).includes(needle);
    });
  }, [articles, decade, deferredQuery]);

  if (articles.length === 0) return null;

  const shown = matching.slice(0, limit);
  const years = byYear(shown);
  const matchCount = new Set(articles.map((article) => article.matchId)).size;
  const filtered = query.trim() !== "" || decade !== "all";

  // Et nytt søk eller filter skal starte på toppen av trefflista, ikke arve
  // vinduet fra forrige søk.
  const reset = (): void => setLimit(PAGE);

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

      <div className={styles.controls}>
        <label className={styles.search}>
          <span>Søk i avisarkivet</span>
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); reset(); }}
            placeholder="For eksempel Molde, 1947 eller mai 1955"
          />
        </label>
        <div className={styles.filters} aria-label="Filtrer avisarkivet på tiår">
          <button
            type="button"
            aria-pressed={decade === "all"}
            onClick={() => { setDecade("all"); reset(); }}
          >
            Alle tiår<span>{articles.length}</span>
          </button>
          {decades.map(([value, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={decade === value}
              onClick={() => { setDecade(value); reset(); }}
            >
              {value}<span>{count}</span>
            </button>
          ))}
        </div>
      </div>

      <p className={styles.resultCount} aria-live="polite">
        {shown.length < matching.length
          ? `Viser ${shown.length} av ${matching.length} artikler`
          : `${matching.length} ${matching.length === 1 ? "artikkel" : "artikler"}${filtered ? " med valgte filtre" : ""}`}
      </p>

      {matching.length > 0 ? (
        <div className={styles.years}>
          {years.map(([value, items]) => (
            <section key={value} className={styles.year} aria-labelledby={`avisarkiv-${value}`}>
              <div className={styles.yearHeading}>
                <h3 id={`avisarkiv-${value}`}>{value}</h3>
                <span>{items.length} {items.length === 1 ? "artikkel" : "artikler"}</span>
              </div>
              <ol>
                {items.map((article, articleIndex) => (
                  <li key={`${article.matchId}-${article.url ?? articleDate(article)}-${articleIndex}`}>
                    <time dateTime={articleDate(article)}>{formatDate(articleDate(article))}</time>
                    <div>
                      {/* Kampen står først, ikke overskriften: de aller fleste sidene er
                          registrert uten egen tittel, og «Sunnmørsposten om kampen» på
                          hver rad sier ingenting om hvilken kamp raden gjelder. */}
                      <Link href={`/kamp/${article.matchId}`}>{matchLabel(article)}</Link>
                      {article.title ? <span>{article.title}</span> : null}
                    </div>
                    {article.url ? (
                      <a className={styles.facsimile} href={article.url} target="_blank" rel="noreferrer">
                        Faksimile <span aria-hidden="true">↗</span>
                      </a>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p><strong>Ingen treff</strong></p>
          <p>Prøv en annen motstander, et annet årstall eller velg alle tiår.</p>
        </div>
      )}

      {shown.length < matching.length ? (
        <button type="button" className={styles.more} onClick={() => setLimit((current) => current + PAGE)}>
          Vis {Math.min(PAGE, matching.length - shown.length)} til
        </button>
      ) : null}
    </section>
  );
}
