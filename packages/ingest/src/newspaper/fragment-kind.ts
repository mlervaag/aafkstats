/**
 * Hva slags avisstoff et tekstvindu er.
 *
 * ## Hvorfor sjangeren må avgjøres før innholdet vektes
 *
 * «Raufoss—ÅFK 1—2» kan stå fire steder i samme avis: i kampreferatet, i
 * resultatbørsen, på terminlista for neste helg, og i tippekupongen. De ser like
 * ut for et regex-uttrykk, men de er ikke like mye verdt. Et referat sier at
 * kampen ble spilt og hvordan den endte. En tippekupong sier at noen skal spille
 * en gang i framtida, og en tabell sier bare hvor lagene står.
 *
 * Uten dette skillet vinner tippekupongen ofte over referatet, rett og slett
 * fordi kupongen nevner begge lagene tettere.
 *
 * ## Hvordan de kjennes igjen
 *
 * På formen, ikke på ordene. Tabeller og kuponger er tallrekker med få ord
 * imellom; terminlister er lagpar uten resultat; referatet er løpende tekst med
 * verb. Det er robust mot OCR fordi det ikke krever at et bestemt ord er lest
 * riktig.
 */

export type FragmentKind =
  /** Kampreferat eller kampomtale: løpende tekst om en kamp. */
  | "article"
  /** Resultatbørs: rekke av kamper med resultat. */
  | "result_list"
  /** Terminliste eller oppsett: lagpar uten resultat. */
  | "fixture_list"
  /** Serietabell: lag med poengkolonner. */
  | "standings"
  /** Tippekupong. */
  | "coupon"
  | "unknown";

/**
 * Hvor mye sjangeren er verdt som belegg for at kampen ble spilt.
 *
 * Rekkefølgen er den samme som en kildekritisk leser ville brukt: referatet
 * først, kupongen sist. Tallene brukes som tillegg og fradrag i rangeringen.
 */
export const KIND_WEIGHT: Record<FragmentKind, number> = {
  article: 15,
  result_list: 5,
  fixture_list: -20,
  standings: -20,
  coupon: -20,
  unknown: 0,
};

const COUPON_WORDS = /\b(tipping|tippekupong|kupong|tippetips|rekke[rn]?\b.{0,12}\btipp)/iu;
const STANDINGS_WORDS = /\b(tabell|poeng|målforskjell|serietabell)\b/iu;
/**
 * Ordene som skiller løpende tekst fra oppstilte tall.
 *
 * Norsk setter sammen ord, og avisa skriver «landsdelsseriekampen» og «Seiren».
 * Krever man ordgrense rundt «kampen», faller referatet ut fordi ordet står inne
 * i et lengre ord. Derfor matches stammene, ikke de hele ordene.
 */
const ARTICLE_VERBS = /(vant|tapte|\bslo\b|scoret|spilte|møtte|kjempet|ledet|utlikn|reduser|seir|kamp(en|ane|ene)|omgang|referat|tilskuere|dommer)/iu;
const FIXTURE_WORDS = /\b(terminliste|kampoppsett|spilles|programmet|kampprogram|neste runde)\b/iu;

export function classifyFragment(text: string): FragmentKind {
  const tokens = text.split(/\s+/u).filter((token) => token !== "");
  if (tokens.length === 0) return "unknown";

  const numeric = tokens.filter((token) => /^[\dOoIl]{1,3}$/u.test(token)).length;
  const numberShare = numeric / tokens.length;
  const scorePairs = (text.match(/[\dOoIl]{1,2} ?[-–—−:] ?[\dOoIl]{1,2}/gu) ?? []).length;

  if (COUPON_WORDS.test(text)) return "coupon";

  // Tabeller er nesten bare tall: lag, kamper, seire, uavgjort, tap, mål, poeng.
  // Terskelen er satt der serietabellene i Sunnmørsposten faktisk ligger.
  if (numberShare >= 0.4 && STANDINGS_WORDS.test(text)) return "standings";
  if (numberShare >= 0.5) return "standings";

  // Flere resultatpar er resultatbørsen. Ett par med mye tekst rundt er et
  // referat som nevner stillingen. Tallandelen duger ikke som tilleggskrav her:
  // «Bryn—Rollon 2—1 Hødd—Ørsta 0—0» har ingen frittstående tall i det hele
  // tatt, alt henger sammen med bindestreker.
  if (scorePairs >= 3) return "result_list";

  if (ARTICLE_VERBS.test(text)) return "article";
  if (FIXTURE_WORDS.test(text) || (scorePairs === 0 && tokens.length < 40)) return "fixture_list";

  return "unknown";
}
