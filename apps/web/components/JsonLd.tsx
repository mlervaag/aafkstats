import type { JsonLdObject } from "@/lib/jsonld";

/**
 * Strukturerte data som et `<script type="application/ld+json">`.
 *
 * `<` escapes fordi en verdi som inneholder `</script` ellers ville avsluttet
 * skriptelementet midt i JSON-en. Ingen kilde i arkivet gjør det i dag, men det
 * er en HTML-injeksjon som venter på den ene kildetittelen som gjør det, og
 * escapingen koster ingenting.
 *
 * Innholdspolicyen i `next.config.mjs` tillater innebygde skript, så elementet
 * her går gjennom. `type` er dessuten ikke kjørbar JavaScript — nettleseren
 * parser det som data.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
