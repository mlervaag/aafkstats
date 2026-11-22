"use client";

import { useEffect } from "react";

/**
 * Feilsiden for alt under rotoppsettet.
 *
 * Uten denne falt en feil under rendering gjennom til rammeverkets egen side:
 * hvit, på engelsk, og uten topp, søk eller en vei videre. Arkivet ligger der
 * fortsatt — det er denne ene siden som sviktet — så de samme inngangene som på
 * 404-siden står her, sammen med et nytt forsøk.
 *
 * Feilen logges i konsollen og ikke noe annet sted: meldingen kan inneholde det
 * leseren skrev, og analysen vår tar aldri imot fritekst.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="empty-state">
      <p className="eyebrow">Noe gikk galt</p>
      <h1>Siden kunne ikke vises</h1>
      <p>Feilen ligger hos oss, ikke hos deg. Prøv en gang til, eller gå videre i arkivet:</p>
      <p>
        <a href="/sesonger">Sesonger</a> · <a href="/motstandere">Motstandere</a> ·{" "}
        <a href="/personer">Personer</a> · <a href="/kilder">Kilder</a>
      </p>
      <button className="button-link" type="button" onClick={reset}>Prøv igjen</button>
    </section>
  );
}
