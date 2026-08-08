import { createHash } from "node:crypto";
import { z } from "zod";
import { isoDate, slug } from "./primitives.js";

/** Verdiene en kilde kan si noe med. Alt annet er en tolkning, ikke en observasjon. */
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type ObservationValue = z.infer<typeof scalar>;

/**
 * Hva én kilde faktisk sa om én kamp, før normalisering.
 *
 * ## Hvorfor dette må finnes
 *
 * Kampfila viser resultatet av normaliseringen. Den sier at motstanderen er
 * `fk-haugesund`, men ikke at RSSSF skrev «Haugesund» og FotMob «FK Haugesund».
 * Da Haugesund-dubletten skulle rettes, måtte den forskjellen rekonstrueres ved
 * å lese adapterkoden og gjette hva kilden hadde stått med. Det er ikke et
 * arkiv, det er arkeologi.
 *
 * Observasjonen er derfor det uendrede: kildens egne strenger ved siden av det
 * vi gjorde dem til. Med begge deler kan tre ting gjøres som ikke går an i dag:
 *
 * - **Se hvem som mente hva.** To kilder som er uenige om et resultat kan vises
 *   side om side i stedet for at den ene stille vinner.
 * - **Kjøre en rettet adapter på nytt uten å hente kilden igjen.** Fant vi en
 *   parsefeil, ligger råverdiene her.
 * - **Vite når en verdi er endret.** `payloadHash` sier om kilden har endret seg
 *   siden sist, uten å sammenligne felt for felt.
 *
 * ## Hva dette *ikke* er
 *
 * Ikke et fullt råpayload-arkiv. Vi lagrer feltene adapteren leste, ikke hele
 * JSON-svaret eller HTML-sida. Å speile kildene i sin helhet er et
 * rettighetsspørsmål vi ikke har svart på, og et lagringsspørsmål vi ikke
 * trenger å stille for å løse problemet over.
 *
 * ## Ingen tilbakefylling
 *
 * De 1039 kampene som allerede ligger i arkivet får ingen observasjon.
 * Råverdiene deres finnes ikke lenger — de ble normalisert bort ved
 * innhøstingen, og å rekonstruere dem ville vært å finne på hva kilden sa.
 * Observasjoner skrives fra og med neste innhøsting.
 */
export const observation = z
  .object({
    /** Kilden, som i data/providers/. */
    providerId: slug,
    /** Kildens egen ID for kampen. Sammen med providerId er dette nøkkelen. */
    externalId: z.string().min(1),
    /**
     * Kampen i arkivet observasjonen hører til.
     *
     * Satt også når kampen ble hoppet over fordi en annen kilde eide den fra før.
     * Da er observasjonen nettopp det som mangler i dag: beviset på at kilde
     * nummer to hadde noe å si om kampen, og hva den sa.
     *
     * Null bare når adapteren så en kamp reconcile ikke klarte å plassere, typisk
     * fordi et klubbnavn ikke lot seg slå opp. Verdt å beholde: det er ofte disse
     * som forklarer et hull.
     */
    matchId: z.string().nullable().default(null),
    retrievedAt: isoDate,
    /**
     * Hvilken adapter som leste kilden.
     *
     * Uten dette er en observasjon fra en adapter med en kjent parsefeil ikke
     * til å skille fra en fra den rettede.
     */
    adapter: z.string().min(1),
    /**
     * Hash av feltene adapteren leste, i normalisert rekkefølge.
     *
     * Endrer kilden seg, endrer hashen seg. Da vet neste kjøring at den må se
     * på kampen igjen, uten å sammenligne felt for felt.
     */
    payloadHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    /**
     * Kildens egne verdier, uendret. Nøklene er kildens begreper, ikke våre.
     *
     * Dette er hele poenget med fila: «Haugesund» skal fortsatt stå her etter at
     * arkivet har bestemt seg for `fk-haugesund`.
     */
    raw: z.record(scalar),
    /** Det råverdiene ble til. Nøklene er feltstier i kampskjemaet. */
    normalized: z.record(scalar),
    /** Feltene observasjonen dekker, med samme navn som i `providers[].fields`. */
    fields: z.array(z.string()).default([]),
    /** Det adapteren så, men ikke turde tolke. */
    warnings: z.array(z.string()).default([]),
  })
  .strict();

export type Observation = z.infer<typeof observation>;

/**
 * Filstien en observasjon får. Kildens eksterne ID kan inneholde hva som helst —
 * FotMob bruker tall, RSSSF en hel setning — så den vaskes til noe som tåler å
 * være et filnavn.
 *
 * Stien er en funksjon av `providerId` og `externalId` alene, og valideringen
 * krever at fila faktisk ligger der. Da kan en ny kjøring finne igjen forrige
 * observasjon uten å lete, og to kjøringer av samme kilde kan ikke ende opp som
 * to filer om samme kamp.
 */
export function observationPath(providerId: string, externalId: string): string {
  const safe = externalId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `observations/${providerId}/${safe || "uten-id"}.yaml`;
}

/**
 * Hashen av det kilden sa.
 *
 * Nøklene sorteres først, slik at hashen henger på verdiene og ikke på hvilken
 * rekkefølge adapteren tilfeldigvis leste feltene i. Uten det ville en
 * omskrevet adapter fått alle kamper til å se endret ut.
 */
export function payloadHash(raw: Record<string, ObservationValue>): string {
  const stable = Object.keys(raw)
    .sort()
    .map((key) => [key, raw[key]] as const);
  return `sha256:${createHash("sha256").update(JSON.stringify(stable)).digest("hex")}`;
}

/**
 * Felter der kildene er uenige om samme kamp.
 *
 * Regnes ut av observasjonene i stedet for å lagres, slik at svaret ikke kan bli
 * gammelt. En konflikt er interessant først når begge kildene faktisk uttalte
 * seg om feltet — at én kilde mangler tilskuertall er ikke uenighet.
 */
export function findConflicts(observations: Observation[]): {
  field: string;
  values: { providerId: string; value: ObservationValue }[];
}[] {
  const byField = new Map<string, { providerId: string; value: ObservationValue }[]>();
  for (const entry of observations) {
    for (const [field, value] of Object.entries(entry.normalized)) {
      // Taushet er ikke uenighet. En kilde som ikke oppgir tilskuertall motsier
      // ikke den som gjør det, og å telle det som konflikt ville gjort listen
      // full av kamper der ingen er uenige om noe.
      if (value === null) continue;
      byField.set(field, [...(byField.get(field) ?? []), { providerId: entry.providerId, value }]);
    }
  }

  const conflicts = [];
  for (const [field, values] of byField) {
    if (values.length < 2) continue;
    const distinct = new Set(values.map((entry) => JSON.stringify(entry.value)));
    if (distinct.size > 1) conflicts.push({ field, values });
  }
  return conflicts.sort((a, b) => a.field.localeCompare(b.field));
}
