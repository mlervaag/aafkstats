/**
 * `note`-feltet i et kilderesultat, lest som søkehjelp.
 *
 * ## Hva notatene sier
 *
 * Klubbens egne sesongoppstillinger fører konteksten i fri tekst: «Cupen»,
 * «2. divisjon», «bortekamp», «Omkamp», «Ekstraomganger», «Sunnmørs-cupen».
 * Det er opplysninger søket kan bruke — hvilken konkurranse, hvilken bane.
 *
 * ## Hvorfor de aldri blir krav
 *
 * Lista i 1965-bladet er retrospektiv, satt sammen i ettertid, og vi har alt
 * funnet en resultatkonflikt mellom den og samtidige aviser. Da kan også
 * konkurransen eller hjemme/borte være feil ført. Hintene løfter derfor
 * kandidater som stemmer, men utelukker ingen som ikke gjør det. Et hint som
 * brukes som filter er en antakelse forkledd som et faktum.
 */

export type HomeAwayHint = "home" | "away";

export interface NoteHints {
  competitionHint?: string;
  homeAwayHint?: HomeAwayHint;
  replay?: boolean;
  extraTime?: boolean;
  /** Ord fra notatet som gjenkjennes i avisteksten, som «cupkamp» eller «Nørve». */
  keywords: string[];
}

interface CompetitionRule {
  pattern: RegExp;
  hint: string;
  /** Ord avisa bruker om den samme konkurransen. */
  keywords: string[];
}

const COMPETITIONS: CompetitionRule[] = [
  { pattern: /\bcupen\b|\bnm\b|norgesmesterskap/iu, hint: "cup", keywords: ["cup", "cupkamp", "cupen", "norgesmesterskapet"] },
  { pattern: /sunnmørs-?cup/iu, hint: "sunnmørscupen", keywords: ["sunnmørscupen", "kretscup"] },
  { pattern: /sommer-?cup/iu, hint: "sommercupen", keywords: ["sommercupen"] },
  { pattern: /tippe-?cup/iu, hint: "tippecupen", keywords: ["tippecupen"] },
  { pattern: /kval\.?-?kamp|kvalifiser/iu, hint: "kvalifisering", keywords: ["kvalifisering", "kvalik", "kvalifiseringskamp"] },
  { pattern: /landsdelsserie/iu, hint: "landsdelsserien", keywords: ["landsdelsserien", "landsdelsseriekampen"] },
  { pattern: /(\d)\.?\s?divisjon/iu, hint: "divisjon", keywords: ["divisjon", "serien", "seriekamp"] },
  { pattern: /seriekamp|\bserien\b/iu, hint: "serie", keywords: ["serien", "seriekamp"] },
  { pattern: /privatkamp|treningskamp|vennskapskamp/iu, hint: "privatkamp", keywords: ["privatkamp", "treningskamp"] },
  { pattern: /distriktsmesterskap|\bdm\b/iu, hint: "distriktsmesterskap", keywords: ["distriktsmesterskapet"] },
];

export function parseNote(note: string | undefined): NoteHints {
  if (!note) return { keywords: [] };

  const hints: NoteHints = { keywords: [] };

  for (const rule of COMPETITIONS) {
    const found = rule.pattern.exec(note);
    if (!found) continue;
    // «2. divisjon» beholder tallet: det skiller nivåene fra hverandre.
    hints.competitionHint = rule.hint === "divisjon" && found[1] ? `${found[1]}. divisjon` : rule.hint;
    hints.keywords = [...new Set([...hints.keywords, ...rule.keywords])];
    break;
  }

  if (/\bbortekamp\b|\bborte\b/iu.test(note)) hints.homeAwayHint = "away";
  else if (/\bhjemmekamp\b|\bhjemme\b/iu.test(note)) hints.homeAwayHint = "home";

  if (/\bomkamp\b/iu.test(note)) {
    hints.replay = true;
    hints.keywords.push("omkamp");
  }
  if (/ekstraomgang|e\.\s?o\./iu.test(note)) {
    hints.extraTime = true;
    hints.keywords.push("ekstraomganger");
  }
  if (/\bfinale\b/iu.test(note)) hints.keywords.push("finale");

  return hints;
}

/**
 * Kampen ble spilt borte, sett fra AaFK, ut fra hvordan avisa skriver den.
 *
 * Avisa fører alltid hjemmelaget først: «Raufoss—ÅFK» er bortekamp, «ÅFK-HØDD»
 * er hjemmekamp. Rekkefølgen er derfor et selvstendig belegg — og et sted den
 * retrospektive lista kan tas i å ta feil.
 */
export function homeAwayFromOrder(firstTeamIsAafk: boolean): HomeAwayHint {
  return firstTeamIsAafk ? "home" : "away";
}
