"use client";

import { useEffect, useMemo, useState } from "react";
import type { Interlude } from "@/lib/interludes";

/**
 * Ruller gjennom kortstoff mens spørrefunksjonen tenker.
 *
 * Ventetiden er noen sekunder, og de sekundene brukes til noe. Ikke som
 * underholdning for underholdningens skyld, men fordi et arkiv har noe å fortelle
 * i en pause — og fordi en tom stripe med prikker gjør ventingen lengre enn den er.
 *
 * Tre valg som betyr noe:
 *
 * - **Startpunktet er tilfeldig**, ellers ville alle sett den samme første linja
 *   hver gang og lært seg den utenat på tre spørsmål.
 * - **Rekkefølgen er stokket per økt**, ikke per visning, så to påfølgende linjer
 *   aldri er den samme.
 * - **Kilden vises.** Det er samme regel som for kampene: en påstand uten opphav
 *   hører ikke hjemme i dette arkivet, heller ikke når den er pynt.
 *
 * `prefers-reduced-motion` slår av rotasjonen helt — da står den første linja i ro.
 */

const INTERVAL_MS = 6500;

export function InterludeRotator({
  items,
  trivia,
}: {
  items: Interlude[];
  /** Linjer utledet av arkivet. Kan ikke bli utdaterte, så de veier tyngst. */
  trivia: string[];
}) {
  const pool = useMemo<Interlude[]>(() => {
    const fromArchive: Interlude[] = trivia.map((text) => ({
      text,
      attribution: "Fra arkivet",
      kind: "arkivet" as const,
    }));
    return shuffle([...items, ...fromArchive]);
  }, [items, trivia]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (pool.length <= 1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % pool.length);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pool.length]);

  const current = pool[index];
  if (!current) return null;

  return (
    // aria-hidden: svaret annonseres av aria-live lenger ute. Uten dette ville
    // skjermleseren lest opp et nytt sitat hvert sjette sekund midt i ventingen.
    <figure className="interlude" aria-hidden="true">
      <blockquote key={index} className="interlude-text">
        {current.text}
      </blockquote>
      {(current.attribution || current.matchUrl) && (
        <figcaption className="interlude-source">
          {current.source ? (
            <a href={current.source} rel="noreferrer">{current.attribution}</a>
          ) : (
            current.attribution
          )}
          {/* Når opplysningen har en kamp i arkivet, skal den kunne åpnes. Det er
              hele poenget med å ha kampene: en påstand du kan gå etter i sømmene. */}
          {current.matchUrl && (
            <>
              {" · "}
              <a href={current.matchUrl}>se kampen</a>
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Fisher–Yates. Kopierer først, siden lista kommer fra en `useMemo`-avhengighet
 * og ikke skal endres på plass.
 */
function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
