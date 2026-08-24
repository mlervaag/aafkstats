/**
 * Hva Nasjonalbiblioteket selv sier om tilgangen til én avisutgave.
 *
 * ## Hvorfor dette må være data og ikke en antakelse
 *
 * «Gamle aviser er åpne» er nesten sant, og nesten sant er den farligste
 * varianten. NB fører rettighetene per utgave, og for Sunnmørsposten går skillet
 * skarpt ved 1936 — kontrollert mot API-et:
 *
 * | Årgang      | viewability | tilgang fra | lisens      |
 * |-------------|-------------|-------------|-------------|
 * | 1914–1935   | ALL         | EVERYWHERE  | CC BY-NC-ND |
 * | 1936–i dag  | NONE        | NB          | copyrighted |
 *
 * Årgangene til og med 1935 kan altså leses av hvem som helst og gjenbrukes med
 * kreditering, uten kommersiell bruk og uten bearbeiding. Fra 1936 er utgavene
 * bare tilgjengelige i Nasjonalbibliotekets lokaler eller med innlogging — «4
 * lisenser for Feide-brukere ved norske universitet og høyskoler», som NB
 * skriver selv.
 *
 * Begge deler er verdt å ta vare på. Den åpne halvparten er der arkivet er
 * tynnest — 1915–1939 har over tre hundre kildeførte resultater uten dato — og
 * der kan hele artikkelen lagres og gjengis. Den lukkede halvparten kan
 * fremdeles gi alle fakta, sitat av rimelig omfang, egne referat, og en lenke
 * rett til siden hos NB der leseren kan logge inn.
 *
 * Poenget med å lagre `legalDepositLoginText` er nettopp det siste: en leser som
 * møter en stengt dør skal få vite hvilken nøkkel som finnes.
 */

export interface NbAccessInfo {
  viewability?: string;
  accessAllowedFrom?: string;
  license?: string;
  isPublicDomain?: boolean;
  isDigital?: boolean;
  legalDepositLoginText?: string;
}

export interface NewspaperAccess {
  /** Hvem som kan se utgaven: alle, eller bare i NB / på bibliotek. */
  viewability: string;
  accessAllowedFrom?: string;
  license?: string;
  isPublicDomain: boolean;
  /** NBs egen tekst om hvordan man får tilgang. Vises til leseren. */
  loginText?: string;
  /**
   * Om hele teksten kan lagres og gjengis i arkivet. Sann bare når NB slipper
   * alle inn — da er gjenbruk et spørsmål om kreditering, ikke om tilgang.
   */
  mayStoreFullText: boolean;
  /** Kreditering som må følge med gjengivelsen. */
  attribution: string;
}

const OPEN_VIEWABILITY = "ALL";
const OPEN_FROM = "EVERYWHERE";

export function readAccess(info: NbAccessInfo | undefined, newspaper: string, issued: string | undefined): NewspaperAccess {
  const viewability = info?.viewability ?? "UKJENT";
  const open = viewability === OPEN_VIEWABILITY && (info?.accessAllowedFrom ?? OPEN_FROM) === OPEN_FROM;

  return {
    viewability,
    ...(info?.accessAllowedFrom ? { accessAllowedFrom: info.accessAllowedFrom } : {}),
    ...(info?.license ? { license: info.license } : {}),
    isPublicDomain: info?.isPublicDomain ?? false,
    ...(info?.legalDepositLoginText ? { loginText: info.legalDepositLoginText } : {}),
    // `unknown` er aldri et ja. Mangler opplysningen, lagres ikke teksten.
    mayStoreFullText: open,
    attribution: attributionFor(newspaper, issued, info?.license),
  };
}

function attributionFor(newspaper: string, issued: string | undefined, license: string | undefined): string {
  const date = issued && /^\d{8}$/.test(issued)
    ? `${issued.slice(6, 8)}.${issued.slice(4, 6)}.${issued.slice(0, 4)}`
    : issued ?? "ukjent dato";
  const licenseName = license ? ` (${licenseLabel(license)})` : "";
  return `${newspaper} ${date}, Nasjonalbiblioteket${licenseName}`;
}

function licenseLabel(license: string): string {
  const labels: Record<string, string> = {
    ccbyncnd: "CC BY-NC-ND",
    ccbync: "CC BY-NC",
    ccby: "CC BY",
    cc0: "CC0",
    publicdomain: "offentlig eiendom",
    copyrighted: "opphavsrettsbeskyttet",
  };
  return labels[license.toLowerCase()] ?? license;
}

/**
 * Lenke rett til siden i utgaven hos NB.
 *
 * Sidetallet er hele forskjellen mellom «her er avisa, let selv gjennom tjue
 * sider» og «her er kampreferatet». For en utgave som krever innlogging er dette
 * dessuten det eneste vi kan gi leseren — og da bør det være presist.
 */
export function newspaperPageUrl(itemId: string, page?: string): string {
  const base = `https://www.nb.no/items/${itemId}`;
  const number = page === undefined ? undefined : Number(page);
  // OCR-feltet er trykt sidenummer, mens dokumentviseren bruker nullbasert
  // sideindeks. Direkte bruk av sidetallet åpner derfor neste side.
  return number !== undefined && Number.isInteger(number) && number > 0 ? `${base}?page=${number - 1}` : base;
}

/** Hva leseren skal få vite om tilgangen, på norsk. */
export function accessNote(access: NewspaperAccess): string {
  if (access.mayStoreFullText) return `Fritt tilgjengelig hos Nasjonalbiblioteket. ${access.attribution}`;
  const login = access.loginText ? ` ${access.loginText}` : "";
  return `Krever innlogging eller besøk hos Nasjonalbiblioteket.${login} ${access.attribution}`;
}
