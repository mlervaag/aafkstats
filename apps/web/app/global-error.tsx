"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Siste skanse: feil i selve rotoppsettet.
 *
 * `error.tsx` rendres inni oppsettet og kan derfor ikke fange en feil i det.
 * Denne erstatter hele dokumentet, og må ha sine egne `html` og `body`. Den er
 * bevisst liten og bruker ingen av komponentene fra oppsettet — de er det som
 * nettopp sviktet.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="nb">
      <body>
        <main className="wrap">
          <section className="empty-state">
            <p className="eyebrow">Noe gikk galt</p>
            <h1>AaFK-arkivet kunne ikke vises</h1>
            <p>Feilen ligger hos oss, ikke hos deg. Prøv en gang til om litt.</p>
            <button className="button-link" type="button" onClick={reset}>Prøv igjen</button>
          </section>
        </main>
      </body>
    </html>
  );
}
