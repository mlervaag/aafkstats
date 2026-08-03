/**
 * Siste sikring mot tankestrek i AI-svarene.
 *
 * Systemprompten ber modellen la være. Det holder som regel, men «som regel» er
 * ikke det samme som «aldri», og tankestrek som dramatisk pause er det enkleste
 * kjennetegnet på maskinskrevet tekst som finnes. Derfor står det også en
 * mekanisk sperre på utgangen.
 *
 * ## Hva som ikke fjernes
 *
 * Tankestreken er **riktig** mellom tall, og der skal den stå: resultatet 2–1,
 * årsspennet 1917–2026, datoene 16.–18. mai. Et filter som tok den også, ville
 * gjort alle resultater i arkivet feil. Dette er hele grunnen til at funksjonen
 * ser på konteksten i stedet for å søke og erstatte.
 *
 * ## Hva som ikke er dekket her
 *
 * Bindestrek (`-`) røres ikke. Den er listemarkør i markdown og orddel i
 * «AaFK-arkivet», så et filter på den ville ødelagt mer enn det reddet.
 * Fraseregisteret — «det er verdt å merke seg», «alt i alt», «håper dette
 * hjelper» — står bare i systemprompten. Det lar seg ikke sperre mekanisk uten å
 * skrive om modellens setninger, og et filter som omskriver innhold er verre enn
 * frasen det fjerner.
 */

/** Em, en, sifferstrek, vannrett strek. Bindestrek og minus er med vilje ikke med. */
const DASHES = "—–‒―";

/**
 * Hvor mange tegn på hver side som avgjør om en strek står mellom tall.
 * Tre rekker til «16.–18.» og «2 – 1».
 */
const CONTEXT = 3;

/**
 * Under strømming er de siste tegnene ennå ikke ferdige. Står det en strek der,
 * vet vi ikke om neste tegn er et siffer, og en forhastet erstatning ville blinke
 * «2, » på skjermen i et bilde før teksten rakk å bli «2–1».
 */
const TAIL = CONTEXT + 1;

/**
 * Er streken på plass `index` en tallstrek? Da skal den stå.
 *
 * Krever siffer på begge sider innenfor `CONTEXT` tegn, med bare punktum og
 * mellomrom imellom. Det dekker 2–1, 1917–2026 og 16.–18. mai, og utelukker
 * «Molde – en gammel kjenning».
 */
function isNumberRange(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - CONTEXT), index);
  const after = text.slice(index + 1, index + 1 + CONTEXT);
  return /\d[.\s]{0,2}$/.test(before) && /^[.\s]{0,2}\d/.test(after);
}

/**
 * Fjerner tankestrek brukt som tegnsetting, og lar tallstrek stå.
 *
 * @param text     Svaret slik modellen skrev det.
 * @param streaming Sant mens svaret fortsatt strømmer inn. Da holdes de siste
 *                  tegnene urørt til det finnes nok kontekst til å bedømme dem.
 */
export function stripProseDashes(text: string, streaming = false): string {
  // Ingen strek i teksten er det vanlige tilfellet. Da er dette et enkelt søk.
  if (![...DASHES].some((dash) => text.includes(dash))) return text;

  const limit = streaming ? Math.max(0, text.length - TAIL) : text.length;
  let out = "";
  let i = 0;

  while (i < text.length) {
    const char = text[i]!;

    if (i >= limit || !DASHES.includes(char)) {
      out += char;
      i += 1;
      continue;
    }

    if (isNumberRange(text, i)) {
      // Normaliser samtidig formen: alltid tankestrek uten mellomrom mellom tall,
      // slik resultater skrives ellers i arkivet.
      out = out.replace(/[ \t]+$/, "");
      out += "–";
      i += 1;
      while (i < text.length && (text[i] === " " || text[i] === "\t")) i += 1;
      continue;
    }

    // Streken skal bort. Mellomrommet foran skal bort med den, ellers blir det
    // « , » igjen der streken sto.
    const trimmed = out.replace(/[ \t]+$/, "");
    const previous = trimmed.slice(-1);
    i += 1;
    while (i < text.length && (text[i] === " " || text[i] === "\t")) i += 1;

    if (previous === "" || previous === "\n") {
      // Streken innleder linja. Sannsynligvis et forsøk på en punktliste, og et
      // komma foran første ord ville vært verre enn ingenting.
      out = trimmed;
      continue;
    }

    if (i >= text.length || text[i] === "\n") {
      // Streken avslutter linja. Ingenting å skille fra.
      out = trimmed;
      continue;
    }

    // Sto det allerede tegnsetting foran, holder den. Ellers blir streken komma.
    out = ",.:;!?".includes(previous) ? `${trimmed} ` : `${trimmed}, `;
  }

  return out;
}
