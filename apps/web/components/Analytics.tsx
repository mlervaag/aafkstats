"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { externalAnalytics, redactEvent } from "@/lib/analytics";

/**
 * All måling på nettstedet, samlet ett sted.
 *
 * To lag, med hver sin jobb:
 *
 *   • Web Analytics teller sidevisninger og de få hendelsene i `lib/analytics`.
 *   • Speed Insights måler hvor raskt sidene faktisk laster hos folk — ikke i
 *     et testverktøy. Det er den målingen som betyr noe for et nettsted som i
 *     hovedsak er tekst og tabeller.
 *
 * Ingen av dem setter informasjonskapsler. `beforeSend` er stedet der vi
 * bestemmer hva som slipper ut; se `lib/analytics.ts` for hvorfor.
 */
export function Analytics() {
  return (
    <>
      <VercelAnalytics beforeSend={redactEvent} />
      <SpeedInsights />
      <ExternalAnalytics />
    </>
  );
}

/**
 * Plausible-kompatibel måling ved siden av Vercel, hvis den er konfigurert.
 *
 * Skriptet lastes først etter at siden er interaktiv, og aldri når nettleseren
 * har bedt om å slippe sporing. Sjekken må skje etter montering — serveren vet
 * ikke hva nettleseren mener, og et skript i HTML-en fra serveren ville gitt
 * ulik utgang på de to sidene.
 */
function ExternalAnalytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const signals = navigator as Navigator & { globalPrivacyControl?: boolean };
    setAllowed(navigator.doNotTrack !== "1" && signals.globalPrivacyControl !== true);
  }, []);

  if (!allowed || externalAnalytics.domain === "") return null;

  return (
    <Script
      defer
      strategy="afterInteractive"
      data-domain={externalAnalytics.domain}
      src={externalAnalytics.src}
    />
  );
}
