/**
 * Måling av bruk — hva som telles, og hva som aldri gjør det.
 *
 * Arkivet er et åpent prosjekt uten innlogging og uten noe å selge. Det eneste
 * målingen skal svare på er om portalen virker: finner folk fram til kampene,
 * og gir spørrefunksjonen svar eller feiler den? Alt annet er unødvendig å
 * samle inn.
 *
 * Derfor er to ting bestemt her, ikke i komponentene:
 *
 *   1. Ingen fritekst forlater nettleseren. Spørsmålet brukeren skriver er det
 *      mest personlige på hele nettstedet, og det telles bare som en hendelse —
 *      aldri med innholdet. Egenskapene under er en lukket liste, så det ikke
 *      kan skje ved et uhell senere.
 *   2. Nettleserens eget signal respekteres. Sier den «ikke spor meg», sendes
 *      ingenting — heller ikke sidevisninger. Det koster noen prosent i
 *      tallene, og er billig for et prosjekt som ellers ber om tillit.
 *
 * Vercel Web Analytics og Speed Insights setter ingen informasjonskapsler og
 * lagrer ingen IP-adresse, så vi trenger ikke samtykkebanner for dem.
 */

import { track } from "@vercel/analytics";

/**
 * Hendelsene vi teller, med de eneste egenskapene hver av dem kan ha.
 *
 * Verdiene er bevisst grovkornede: «forslag» eller «skjema», ikke hvilket
 * spørsmål. Et tall må være en måling (sekunder, plassering), ikke en id.
 */
interface EventProperties {
  /** Noen sendte inn et spørsmål til AI-en. */
  "ask-submitted": { source: "form" | "suggestion" };
  /** Spørsmålet er ferdig besvart — eller feilet. Sier om funksjonen holder. */
  "ask-answered": { status: "ok" | "error"; seconds: number };
  /** Noen klikket seg inn på en kamp fra direktesøket. Målet på om søket traff. */
  "match-opened": { position: number };
}

/** Sant når nettleseren ikke har bedt om å slippe sporing. */
function trackingAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const signals = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack !== "1" && signals.globalPrivacyControl !== true;
}

/**
 * Filteret alle hendelser passerer før de sendes, sidevisninger inkludert.
 *
 * Nettstedet legger ikke søketekst i URL-en i dag, men det er én rute unna å
 * gjøre det. Spørrestrengen strippes derfor her, slik at et framtidig
 * `?q=…` ikke stille begynner å havne i statistikken.
 */
export function redactEvent<T extends { url: string }>(event: T): T | null {
  if (!trackingAllowed()) return null;
  try {
    const url = new URL(event.url);
    url.search = "";
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}

/** Teller en hendelse. Gjør ingenting utenfor nettleseren eller uten samtykke. */
export function trackEvent<Name extends keyof EventProperties>(
  name: Name,
  properties: EventProperties[Name],
): void {
  if (!trackingAllowed()) return;
  track(name, properties);
}

/**
 * Valgfri tredjepart ved siden av Vercel, satt med miljøvariabler.
 *
 * Vercel Web Analytics er nok til daglig, men på Hobby-planen tar den vare på
 * de siste 30 dagene. Et arkiv som dette er interessant over sesonger, ikke
 * uker. Står variablene tomt skjer ingenting — da kjører vi bare på Vercel.
 *
 * `NEXT_PUBLIC_PLAUSIBLE_SRC` finnes for selvhostet Plausible eller Umami,
 * som lastes på samme måte fra et eget domene.
 */
export const externalAnalytics = {
  domain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "",
  src: process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js",
} as const;
