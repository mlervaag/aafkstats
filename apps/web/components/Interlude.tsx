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
 * Fire valg som betyr noe:
 *
 * - **Startpunktet er tilfeldig**, ellers ville alle sett den samme første linja
 *   hver gang og lært seg den utenat på tre spørsmål.
 * - **Rekkefølgen er stokket per økt**, ikke per visning, så to påfølgende linjer
 *   aldri er den samme.
 * - **Linja skrives ut tegn for tegn.** Ventingen får noe som beveger seg uten å
 *   blinke, og skrivetakten gir teksten et tempo å bli lest i.
 * - **Kilden vises.** Det er samme regel som for kampene: en påstand uten opphav
 *   hører ikke hjemme i dette arkivet, heller ikke når den er pynt.
 *
 * `prefers-reduced-motion` slår av både skriving og rotasjon — da står den første
 * linja ferdig skrevet og i ro.
 */

/** Millisekund per tegn. ~45 tegn i sekundet: raskere enn lesing, tregt nok til å ses. */
const TYPE_MS = 22;

/** Hvor lenge en ferdig skrevet linje blir stående før neste begynner. */
const HOLD_MS = 4200;

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
  const [shownChars, setShownChars] = useState(0);

  const current = pool[index];
  const fullLength = current?.text.length ?? 0;

  useEffect(() => {
    if (!fullLength) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // Ferdig skrevet med én gang, og ingen rotasjon: da er det ingen bevegelse
      // igjen i denne blokka i det hele tatt.
      setShownChars(fullLength);
      return;
    }

    setShownChars(0);
    let typed = 0;
    const typer = setInterval(() => {
      typed += 1;
      setShownChars(typed);
      if (typed >= fullLength) clearInterval(typer);
    }, TYPE_MS);

    // Neste linje henger på skrivetiden, ikke på et fast intervall. Ellers ville
    // en lang linje fått kortere lesetid enn en kort.
    const advance = setTimeout(() => {
      setIndex((currentIndex) => (currentIndex + 1) % pool.length);
    }, fullLength * TYPE_MS + HOLD_MS);

    return () => {
      clearInterval(typer);
      clearTimeout(advance);
    };
  }, [index, fullLength, pool.length]);

  if (!current) return null;

  const shown = current.text.slice(0, shownChars);
  const done = shownChars >= fullLength;

  return (
    // aria-hidden: svaret annonseres av aria-live lenger ute. Uten dette ville
    // skjermleseren lest opp et nytt sitat hvert sjette sekund midt i ventingen —
    // og med skrivemaskineffekten ville den lest det tegn for tegn.
    <figure className="interlude" aria-hidden="true">
      <blockquote className="interlude-text">
        {/* Hele teksten ligger usynlig under og holder høyden fast. Uten den
            vokser blokka mens den skrives, og alt nedenfor hopper. */}
        <span className="interlude-ghost">{current.text}</span>
        <span className="interlude-typed">
          {shown}
          {!done && <span className="interlude-caret" />}
        </span>
      </blockquote>
      {/* Kilden kommer først når linja står ferdig. Å la den ligge under en
          halvskrevet setning gjør at blikket flakker mellom to ting. */}
      {done && (current.attribution || current.matchUrl) && (
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
