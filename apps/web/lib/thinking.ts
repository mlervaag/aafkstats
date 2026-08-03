/**
 * Tenkeord: det som står ved prikken mens spørrefunksjonen jobber.
 *
 * «Tolker spørsmålet …» sa sant, men sa det på samme måte hver gang, og etter
 * tredje spørsmål leser man det ikke lenger. Disse gjør samme jobb, men med
 * arbeidsspråket fra byen de handler om.
 *
 * ## Hvor ordene kommer fra, og hvor de ikke kommer fra
 *
 * Ønsket var å hente dem fra «Fole kaule! Ord og uttrykk frå Ålesund og bygdene
 * rundt» (1999), som ligger digitalisert hos Nasjonalbiblioteket. Den boka lar
 * seg ikke lese: katalogposten oppgir `isPublicDomain: false` og
 * `viewability: NONE`, altså ingen sidevisning, verken for oss eller for en
 * innlogget bruker uten lisens. Da er den ikke en kilde vi kan bruke, og å dikte
 * opp dialektord og påstå at de er ålesundske ville vært verre enn å la være.
 *
 * Ordene under er derfor slått opp ett for ett i Nynorskordboka, som er åpen:
 * https://ord.uib.no. Både betydningen og presensformen er hentet derfra, ikke
 * fra hukommelsen. Det er en reell forskjell: seks av formene i første utkast
 * var gale. «Flekkjar» skal være *flekkjer*, «sløyar» skal være *sløyer*,
 * «røkter» skal være *røktar*, «fyrar» skal være *fyrer*, «grundar» skal være
 * *grunnar*, og «malar» skal være *mel*. Alt det ville en lokal leser sett med
 * en gang.
 *
 * Dette er altså normert nynorsk med Ålesunds arbeidsvokabular, ikke transkribert
 * bydialekt. Skillet er verdt å være ærlig om: bydialekten har e-infinitiv og
 * egne former som ikke står i noen ordbok, og dem har vi ikke dekning for.
 *
 * ## Hvorfor akkurat disse bildene
 *
 * Ålesund er fiskeriby og klippfiskby. Derfor snurpenot og line, sløying og
 * flekking, salting og vending på berget, lodding av dybde og stamping i motsjø,
 * og sjauing på kaia. To av dem bærer overført betydning i ordboka selv, og de
 * er de beste i lista: *lodde* er «å danne seg eit inntrykk av noko ein ikkje kan
 * observere direkte», og *nøste* er «å finne ut av, få klart». Det er nøyaktig
 * det som skjer mens man venter.
 *
 * De er med vilje **arbeidsord og ikke resultatord**. Ingen av dem lover et svar,
 * de sier bare at noen står og drar. Det er så mye som er sant mens modellen
 * tenker.
 */

export const thinkingWords: string[] = [
  // Maskineriet, som var det ordet ønsket tok utgangspunkt i. Presens av «male»
  // er «mel», som i at kverna mel.
  "Maskineriet mel",

  // Fiske og redskap.
  "Halar inn nota",
  "Snurpar saman",
  "Egnar krokane",
  "Røktar garna",
  "Dorgar etter svar",
  "Trålar gjennom åra",
  "Set line over arkivet",

  // Klippfisk: sløye, flekke, salte, vende på berget.
  "Sløyer tala",
  "Flekkjer og saltar",
  "Vender fisken på berget",

  // Sjømannskap. «Loddar djupna» står i ordboka både bokstavelig og overført.
  "Loddar djupna",
  "Stampar i motsjø",
  "Held stø kurs",
  "Tøffar innover fjorden",
  "Lensar for tal",
  "Auser opp av arkivet",
  "Klappar til kai",

  // Slit. «Sjaue» er kaiordet: å arbeide hardt.
  "Sjauar på",
  "Staukar i vei",
  "Balar med statistikken",
  "Kavar seg gjennom tiåra",
  "Strevar med tala",
  "Traskar gjennom sesongane",

  // Leiting og grubling. «Nøstar opp» står i ordboka som «finne ut av, få klart».
  "Leitar i protokollen",
  "Nøstar opp",
  "Grunnar på det",
  "Rotar i kjellaren",
  "Fyrer opp under kjelen",
  "Blar i gamle kampbøker",
];
