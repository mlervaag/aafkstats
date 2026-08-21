/**
 * Måling av bruk — hva som telles, og hva som aldri gjør det.
 *
 * Arkivet er et åpent prosjekt uten innlogging og uten noe å selge. Det eneste
 * målingen skal svare på er om portalen virker: finner folk fram til innholdet,
 * gir spørrefunksjonen svar, og kommer frivillige gjennom bidrags- og
 * verifiseringsløypene? Alt annet er unødvendig å samle inn.
 *
 * Derfor er to ting bestemt her, ikke i komponentene:
 *
 *   1. Ingen fritekst, URL eller innholds-ID legges i egendefinerte hendelser.
 *      Spørsmål, bidrag og kildehenvisninger telles bare som grove hendelser —
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
  "ask-submitted": { source: "form" | "suggestion" | "followup" };
  /** Spørsmålet er ferdig besvart — eller feilet. Sier om funksjonen holder. */
  "ask-answered": { status: "ok" | "error"; seconds: number };
  /** Noen klikket seg inn på en kamp fra direktesøket. Målet på om søket traff. */
  "match-opened": { position: number };
  /** Noen åpnet en person fra direktesøket. Friteksten lagres fortsatt aldri. */
  "person-opened": { position: number };
  /** Noen åpnet en historisk kilde fra direktesøket. */
  "source-opened": { position: number };
  /** Modellen foreslo ett konkret neste arkivoppslag. */
  "followup-shown": Record<string, never>;
  /** Brukeren fortsatte med forslaget. */
  "followup-yes": Record<string, never>;
  /** Brukeren avsluttet forslaget lokalt. */
  "followup-no": Record<string, never>;
  /** Synlig svartekst ble kopiert. */
  "answer-copied": Record<string, never>;
  /** Noen begynte å dokumentere én av de manuelle kontrollsakene. */
  "verification-started": {
    category: "role" | "identity" | "match" | "source_reading" | "club";
  };
  /** En oppgitt kilde ble åpnet fra kontrollsaken. Ingen kilde-ID eller URL sendes. */
  "verification-source-opened": {
    category: "role" | "identity" | "match" | "source_reading" | "club";
  };
  /** Kontrollsaken ble hoppet over lokalt. */
  "verification-skipped": {
    category: "role" | "identity" | "match" | "source_reading" | "club";
  };
  /** Et dokumentert svar ble sendt, eller forsøket feilet. */
  "verification-submitted": {
    category: "role" | "identity" | "match" | "source_reading" | "club";
    evidence: "listed_source" | "new_url" | "bibliographic";
    status: "ok" | "error";
    seconds: number;
  };
  "newspaper-verification-open-source": {
    category: "match";
    year: number;
    discovery_status: "confirmed" | "probable" | "ambiguous" | "conflict" | "not_found";
  };
  "newspaper-verification-shown": {
    category: "match";
    year: number;
    discovery_status: "confirmed" | "probable" | "ambiguous" | "conflict" | "not_found";
  };
  "newspaper-verification-answer": {
    category: "match";
    answer: "yes" | "no" | "inconclusive";
    year: number;
    discovery_status: "confirmed" | "probable" | "ambiguous" | "conflict" | "not_found";
    seconds: number;
  };
  "newspaper-verification-submitted": {
    category: "match";
    answer: "yes" | "no" | "inconclusive";
    year: number;
    discovery_status: "confirmed" | "probable" | "ambiguous" | "conflict" | "not_found";
    seconds: number;
    submission_status: "ok" | "error";
  };
  "newspaper-verification-skipped": {
    category: "match";
    year: number;
    discovery_status: "confirmed" | "probable" | "ambiguous" | "conflict" | "not_found";
    seconds: number;
  };
  /** Det innebygde skjemaet for minner og observasjoner ble åpnet. */
  "contribution-opened": { scope: "match" | "season" | "person" };
  /** Et bidrag ble sendt, eller forsøket feilet. Innhold og mål-ID sendes aldri. */
  "contribution-submitted": {
    scope: "match" | "season" | "person";
    status: "ok" | "error";
    has_source: boolean;
  };
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
