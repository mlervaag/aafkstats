/**
 * Jugendornamenter, hentet fra byen selv.
 *
 * Ålesund ble gjenreist i jugendstil etter brannen i 1904, og har over 320 slike
 * bygg stående. Formspråket er organisk: bølgende linjer, spiraler og symmetrisk
 * rankeverk, ofte med et drag av drakestil.
 *
 * Det er også et formspråk som lett tar overhånd. Et arkiv skal være lett å lese,
 * og ornamentikk som ligger over hele flaten gjør tallene vanskeligere å se.
 * Derfor brukes dette sparsomt og alltid som en **linje**, ikke som en flate:
 * én skillelinje mot bunnteksten, ett lite merke ved navnetrekket. Ornamentet
 * skal kjennes igjen når man ser etter det, og ellers bare gjøre siden rolig.
 *
 * ## Hvorfor spiralene er tegnet med buer og ikke bézier
 *
 * En spiral av frihånds-bézierkurver ser riktig ut i redigeringsvinduet og blir
 * til en ulesbar krusedull når den skaleres ned til en skillelinje på 250 px.
 * `A`-kommandoen med avtakende radius gir en ekte spiral som holder formen i
 * enhver størrelse: tre halvsirkler med radius 8, 6 og 3,5 rundt samme senter.
 *
 * Størrelsen er også et bevisst valg. Detaljer under ~4 px forsvinner i
 * antialiasing, så ornamentet er tegnet stort nok til at hver vinding leses —
 * heller ett tydelig motiv enn tre utydelige.
 *
 * Alt er inline SVG med `currentColor`, så det følger tekstfargen i lys og mørk
 * modus uten egne varianter, og det finnes ingen filer å laste.
 */

/**
 * Skillelinje: en hårstrek som åpner seg i to speilvendte spiraler rundt et blad.
 *
 * Brukes mellom hovedinnholdet og bunnteksten, der et vanlig `<hr>` ville vært
 * for stumt og ren luft for utflytende.
 */
export function JugendRule({ className }: { className?: string }) {
  return (
    <svg
      className={`jugend-rule ${className ?? ""}`}
      viewBox="0 0 160 28"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        {/* Hårstreken inn fra hver side. */}
        <path d="M0 14H50" />
        <path d="M160 14H110" />

        {/* Spiralene. Radius 8 over, 6 under, 3,5 over — halvsirkler som strammer
            seg innover mot samme senter. */}
        <path d="M50 14a8 8 0 0 1 16 0a6 6 0 0 1-12 0a3.5 3.5 0 0 1 7 0" />
        <path d="M110 14a8 8 0 0 0-16 0a6 6 0 0 0 12 0a3.5 3.5 0 0 0-7 0" />

        {/* Streken føres videre inn til bladet, så motivet henger sammen. */}
        <path d="M66 14H74" />
        <path d="M94 14H86" />

        {/* Bladet i midten. */}
        <path d="M80 4c6 5 6 15 0 20c-6-5-6-15 0-20Z" />
      </g>
    </svg>
  );
}

/**
 * Lite merke: en volutt med stilk. Står ved navnetrekket i bunnteksten.
 *
 * Bevisst asymmetrisk — jugend er sjelden helt speilvendt, og et symmetrisk
 * merke i denne størrelsen leser mer som en logo enn som ornament.
 */
export function JugendMark({ className }: { className?: string }) {
  return (
    <svg
      className={`jugend-mark ${className ?? ""}`}
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        {/* Stilken opp mot volutten. */}
        <path d="M4 21C4 12 9 5 17 5" />
        {/* Volutten: en ytre vinding som ruller inn i en indre. */}
        <path d="M17 5a5.5 5.5 0 1 1-5.5 5.5a3 3 0 1 0 3-3" />
      </g>
    </svg>
  );
}
