/**
 * Datoer skrevet slik de sies på norsk.
 *
 * Arkivet lagrer datoer på ISO-form fordi det er den formen som lar seg
 * sortere, sammenligne og slå opp. Den formen hører hjemme i datasettet, ikke i
 * teksten: «2016-04-09» er ikke slik noen forteller om en kamp, og en side full
 * av dem leses som en logg framfor et arkiv. Alt som skrives ut på siden går
 * derfor gjennom en av funksjonene her.
 *
 * ## Hvorfor to lengder
 *
 * Kampsiden har plass til hele datoen og skal leses som en setning. Kamplistene
 * har en kolonne på sju rem der «24. september 2016» ville brutt til to linjer i
 * hver eneste rad, og der datoen først og fremst skannes. Den korte formen
 * bruker Språkrådets forkortelser, som lar mars, mai, juni og juli stå uforkortet
 * fordi de er for korte til at en forkortelse sparer noe.
 *
 * ## Datoer vi ikke kan lese
 *
 * `dateConfidence` i skjemaet åpner for kamper der bare måneden eller året er
 * kjent, og eldre kilder kan oppgi datoer arkivet ennå ikke normaliserer. Faller
 * en streng utenfor `ÅÅÅÅ-MM-DD`, skrives den ut uendret. En dato vi ikke forstår
 * skal vises som den står, ikke gjettes om til en dag som aldri fantes.
 */

const MONTHS = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];

/** Språkrådets forkortelser. Mars, mai, juni og juli forkortes ikke. */
const MONTHS_SHORT = [
  "jan.", "feb.", "mars", "apr.", "mai", "juni",
  "juli", "aug.", "sep.", "okt.", "nov.", "des.",
];

const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * ISO-datoen delt i tre tall, eller null når strengen ikke er en hel dato.
 *
 * Kalenderen sjekkes, ikke bare formen: «2016-02-31» har riktig fasong og finnes
 * likevel ikke, og en visning som skrev den ut som 31. februar ville påstått noe
 * arkivet ikke kan mene.
 */
function parseIso(iso: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** «9. april 2016». Hele datoen, til overskrifter og løpende tekst. */
export function formatDate(iso: string): string {
  const parts = parseIso(iso);
  if (!parts) return iso;
  return `${parts.day}. ${MONTHS[parts.month - 1]} ${parts.year}`;
}

/** «9. apr. 2016». Til kolonner og lister der datoen skannes framfor å leses. */
export function formatDateShort(iso: string): string {
  const parts = parseIso(iso);
  if (!parts) return iso;
  return `${parts.day}. ${MONTHS_SHORT[parts.month - 1]} ${parts.year}`;
}

/** «9. april». Uten år, til tekst som allerede står i en gitt sesong. */
export function formatDayMonth(iso: string): string {
  const parts = parseIso(iso);
  if (!parts) return iso;
  return `${parts.day}. ${MONTHS[parts.month - 1]}`;
}

/**
 * «lørdag 9. april». Til datoer som ligger nær i tid.
 *
 * Ukedagen er det folk planlegger etter når kampen er rett rundt hjørnet. Året
 * er utelatt av samme grunn: en dato så nær trenger det ikke.
 */
export function formatWeekdayDate(iso: string): string {
  const parts = parseIso(iso);
  if (!parts) return iso;
  const weekday = WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
  return `${weekday} ${parts.day}. ${MONTHS[parts.month - 1]}`;
}

/**
 * Dato og klokkeslett i Ålesund akkurat nå, som «2026-08-09» og «17:42».
 *
 * Serveren står i UTC, og forskjellen er ikke akademisk: en kamp med avspark
 * 17:00 er i gang klokka 17:42 norsk tid, men først 15:42 etter serverens klokke.
 * Alle klokkeslett i arkivet er lokale, så sammenligningen må være det også.
 */
export function nowInOslo(now = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [date, time] = parts.split(" ");
  return { date: date ?? "", time: (time ?? "").slice(0, 5) };
}
