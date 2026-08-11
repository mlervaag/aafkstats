/**
 * Adressen nettstedet ligger på.
 *
 * Domenet sto skrevet inn tre steder — rotoppsettet, `robots.ts` og `sitemap.ts`
 * — pluss én gang til i svarlenkene fra spørrefunksjonen. Da arkivet flyttet til
 * aafkarkivet.no, fulgte ingen av dem med, og det er nettopp de fire stedene som
 * bestemmer hva en søkemotor tror nettstedet heter: kanonisk adresse, sitemap,
 * robots og delte lenker. Fire kopier av samme opplysning er én kopi for mye.
 *
 * At verdien kan settes med miljøvariabel er ikke bare ryddighet. Dette er et
 * åpent repo som er ment å forkes, og en fork som ikke kan si hvor den ligger,
 * ville sendt sine egne lesere og søkemotorer hit i stedet — sitemapet ville
 * listet adresser på et domene forken ikke eier, og hver side ville pekt kanonisk
 * hit. Standardverdien er dette arkivets domene, men den er bare en standard.
 */

/**
 * `www`, ikke apex, og det er ikke en smakssak.
 *
 * `aafkarkivet.no` svarer 308 videre til `www.aafkarkivet.no`, som er den som
 * faktisk serverer arkivet. Sto apex her, ville hver kanonisk adresse pekt på en
 * adresse som omdirigerer, og sitemapet listet nesten to tusen slike. Da sier
 * sida «jeg er apex» mens apex svarer «nei, gå til www» — to signaler som
 * motsier hverandre, og Search Console fører dem opp som «Side med omdirigering».
 *
 * Snus det om i Vercel, slik at apex serverer og www omdirigerer, er det denne
 * ene linja som skal endres.
 */
const FALLBACK_ORIGIN = "https://www.aafkarkivet.no";

/** Tåler både «example.com» og «https://example.com/» og gir origin uten skråstrek. */
function toOrigin(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).origin;
  } catch {
    return null;
  }
}

/** Origin uten avsluttende skråstrek, f.eks. `https://www.aafkarkivet.no`. */
export const SITE_ORIGIN = toOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? FALLBACK_ORIGIN;

/** Absolutt adresse til en sti i arkivet. `path` skal begynne med skråstrek. */
export function siteUrl(path = "/"): string {
  return path === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`;
}

/** Navnet nettstedet omtales med i metadata og strukturerte data. */
export const SITE_NAME = "AaFK-arkivet";
