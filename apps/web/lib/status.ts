/**
 * Hva kampens status betyr for den som leser.
 *
 * De seks statusene ser like ut i dataene og betyr helt ulike ting. Kampsiden
 * behandlet dem som én: en kamp som ikke var spilt fikk nøyaktig samme side som
 * en spilt kamp, med en tankestrek der tallet skulle vært og «Ingen hendelser
 * registrert» under. Den leses som en kamp arkivet mangler opplysninger om, ikke
 * som en kamp som ikke har funnet sted.
 */

export interface StatusNote {
  label: string;
  note: string;
}

const NOTES: Record<string, StatusNote> = {
  scheduled: {
    label: "Kampen er ikke spilt",
    note: "Resultat, hendelser og lagoppstilling kommer når kampen er spilt.",
  },
  postponed: {
    label: "Kampen er utsatt",
    note: "Ny dato er ikke satt i arkivet.",
  },
  cancelled: {
    label: "Kampen ble avlyst",
    note: "Den ble aldri spilt, og teller ikke i statistikken.",
  },
  abandoned: {
    label: "Kampen ble avbrutt",
    note: "Den har ingen sluttstilling, og teller ikke i statistikken.",
  },
};

/**
 * Statuslinja, eller undefined for en kamp som gikk som den skulle.
 *
 * 'played' og 'awarded' får ingen linje. Resultatet står der allerede, og en
 * setning om at kampen ble spilt sier ikke noe leseren ikke ser.
 */
export function statusNote(status: string): StatusNote | undefined {
  return NOTES[status];
}

/**
 * Om kampen har funnet sted.
 *
 * Samme regel som `core_played` i SQL og `PLAYED_SQL` i spørringene: en kamp
 * avgjort på grønt bord har et resultat og ligger bak oss, en avbrutt kamp har
 * ingen sluttstilling.
 */
export function hasBeenPlayed(status: string): boolean {
  return status === "played" || status === "awarded";
}
