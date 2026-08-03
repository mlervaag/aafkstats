"use client";

import { useEffect, useMemo, useState } from "react";
import { thinkingWords } from "@/lib/thinking";

/**
 * Linja ved prikken mens modellen jobber.
 *
 * Den gjør to ting samtidig, og de to må ikke blandes sammen:
 *
 * - **Tenkeordet** er stemning. Det ruller uavhengig av hva som faktisk skjer,
 *   og skal aldri leses som en statusmelding.
 * - **Verktøynavnet** er sannhet. Kjører modellen et oppslag, står navnet på
 *   det der, uendret og ikke oppdiktet.
 *
 * Derfor står de i samme linje, men typografisk atskilt: tenkeordet i vanlig
 * tekst, verktøyet dempet bak en skilletegn. Et tenkeord som lot som det
 * beskrev arbeidet ville vært et lite løgnaktig grensesnitt — det ser ut som
 * framdriftsinformasjon uten å være det.
 */

const ROTATE_MS = 2400;

export function ThinkingLine({ activeTool }: { activeTool: string | null }) {
  // Stokket per økt, ikke per visning: to påfølgende ord blir aldri det samme,
  // og to spørsmål på rad starter ikke likt.
  const words = useMemo(() => shuffle(thinkingWords), []);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length <= 1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [words.length]);

  const word = words[index] ?? "Leiter";

  return (
    <p className="thinking">
      <span className="dot" aria-hidden="true" />
      {/* key gjør at spanet monteres på nytt for hvert ord, så CSS-animasjonen
          spilles av igjen. Uten den ville bare teksten byttes, uten overgang. */}
      <span key={index} className="thinking-word">
        {word} …
      </span>
      {activeTool && (
        <span className="small muted thinking-tool"> · {activeTool}</span>
      )}
    </p>
  );
}

function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
