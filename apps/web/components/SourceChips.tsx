import Link from "next/link";
import styles from "./SourceChips.module.css";

/** En kildehenvisning slik den står på en rolle, en kamp eller en person. */
export interface CitedRef {
  sourceId: string;
  page?: string;
}

/** En publikasjon som belegger noe, med sidene den er sitert på. */
export interface CitedSource {
  sourceId: string;
  title: string;
  pages: string[];
}

/**
 * Kildene bak en opplysning, som klikkbare brikker.
 *
 * ## Hvorfor de er brikker og ikke bare lenker
 *
 * Organisasjonssiden satte lenkene rett etter hverandre uten skille, og med
 * publikasjonstitler som slutter på et sidetall ble resultatet ulesbart:
 * «… s. 18Medlemsblad for Aalesunds fotballklubb. 1954 Vol. 5 Nr. …».
 * Der én lenke slutter og den neste begynner må være synlig.
 *
 * ## Hvorfor de slås sammen
 *
 * Samme publikasjon kan belegge et verv fra flere sider, og arkivet har
 * dessuten kilde-ID-er med identisk tittel — samme utgave registrert to ganger
 * hos Nasjonalbiblioteket. Uten sammenslåing får leseren tre brikker med
 * nøyaktig samme tekst, som ser ut som en feil uansett hvor ærlig forskjellen
 * er. Slås sammen på tittelen, ikke på ID-en.
 */
export function collapseSources(refs: CitedRef[], titles: Map<string, string>): CitedSource[] {
  const seen = new Map<string, CitedSource>();
  for (const ref of refs) {
    const title = titles.get(ref.sourceId) ?? ref.sourceId;
    const current = seen.get(title);
    if (!current) {
      seen.set(title, { sourceId: ref.sourceId, title, pages: ref.page ? [ref.page] : [] });
      continue;
    }
    if (ref.page && !current.pages.includes(ref.page)) current.pages.push(ref.page);
  }
  return [...seen.values()];
}

/**
 * Tittelen slik den får plass i en brikke.
 *
 * Katalogtitlene fra Nasjonalbiblioteket er bibliografiske, ikke lesbare:
 * «Aalesunds fotballklubb 1914 - 50 år - 1964 : jubileum ÅFK» er 57 tegn, og
 * fire slike på rad fylte en halv skjerm per verv. Undertittelen etter kolon
 * er den delen som sjelden skiller to kilder fra hverandre, så den ryker
 * først; resten kappes ved et ordskille. Hele tittelen ligger i `title`.
 */
const MAX = 42;

export function shortTitle(title: string): string {
  const main = title.split(" : ")[0]!.replace(/\.$/, "").trim();
  if (main.length <= MAX) return main;
  const cut = main.slice(0, MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space > MAX / 2 ? cut.slice(0, space) : cut).replace(/[ ,.:;-]+$/, "")}…`;
}

export function pageList(source: CitedSource): string {
  if (source.pages.length === 0) return "";
  const sorted = [...source.pages].sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  return `, s. ${sorted.join(", ")}`;
}

export function SourceChips({ refs, titles }: { refs: CitedRef[]; titles: Map<string, string> }) {
  const sources = collapseSources(refs, titles);
  if (sources.length === 0) return null;
  return (
    <ul className={styles.chips}>
      {sources.map((source) => (
        <li key={source.title}>
          <Link href={`/kilder/${source.sourceId}`} title={`${source.title}${pageList(source)}`}>
            {shortTitle(source.title)}<span className="num">{pageList(source)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
