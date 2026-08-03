/**
 * Tekst som vises mens spørrefunksjonen tenker.
 *
 * Ventetiden er noen sekunder. Den kan enten være en tom stripe med prikker, eller
 * den kan brukes til å fortelle noe om klubben og byen. Vi gjør det siste.
 *
 * Hver linje bærer sin egen kilde, av samme grunn som kampene gjør det: et arkiv
 * som ber folk stole på seg, må kunne vise hvor ting kommer fra. Det gjelder også
 * pynten.
 *
 * ## Hva som ikke står her
 *
 * **Ingen supportersanger.** Sangtekster er opphavsrettsbeskyttet, og AaFKs
 * supportersanger er intet unntak. Et søk ga riktignok en «kampsang» i fire
 * verselinjer, men den kom fra en stadionkatalog uten primærkilde, og norsken var
 * skjev nok til å lukte maskinskrevet fyll. Å trykke en oppdiktet supportersang på
 * klubbens eget arkiv ville vært verre enn å ikke ha noen — så den er ikke med.
 *
 * **Ingen moderne lyrikk.** Samme grunn. Diktet under er av Ivar Aasen, som døde i
 * 1896 og dermed er falt i det fri for lenge siden. Han var fra Ørsta på Sunnmøre,
 * så koblingen er heller ikke tilfeldig.
 *
 * Resten er enten etterprøvbare fakta eller tekst skrevet for dette arkivet.
 */

export interface Interlude {
  /** Selve linja. Kort — den vises i noen sekunder. */
  text: string;
  /** Hvem som sa det, eller hva slags opplysning det er. */
  attribution?: string;
  /** Hvor det kan kontrolleres. */
  source?: string;
  /** Kamp i arkivet som hører til opplysningen, når det finnes en. */
  matchUrl?: string;
  kind: "dikt" | "historie" | "klubb" | "by" | "arkivet" | "spiller";
}

export const interludes: Interlude[] = [
  // ── Ivar Aasen (1813–1896), Ørsta på Sunnmøre. Falt i det fri.
  {
    text: "Mellom bakkar og berg utmed havet heve nordmannen fenge sin heim.",
    attribution: "Ivar Aasen, «Nordmannen» (1863)",
    source: "https://www.nynorsk.no/korrekt-versjon",
    kind: "dikt",
  },
  {
    text: "Han såg ut på dei steinute strender; det var ingen som der hadde bygt.",
    attribution: "Ivar Aasen, «Nordmannen» (1863)",
    source: "https://www.nynorsk.no/korrekt-versjon",
    kind: "dikt",
  },
  {
    text: "Han såg ut på det bårute havet, der var ruskut å leggja utpå.",
    attribution: "Ivar Aasen, «Nordmannen» (1863)",
    source: "https://www.nynorsk.no/korrekt-versjon",
    kind: "dikt",
  },

  // ── Byen. Alt her er kontrollerbart.
  {
    text: "Natt til 23. januar 1904 brant Ålesund. Over 850 hus gikk med, og rundt 10 000 mennesker sto uten tak over hodet.",
    attribution: "Ålesundsbrannen",
    source: "https://snl.no/%C3%85lesundsbrannen",
    kind: "historie",
  },
  {
    text: "Keiser Wilhelm II snudde skip fra Kiel med mat, tepper og byggematerialer. I Ålesund ble han en helt.",
    attribution: "Ålesundsbrannen, 1904",
    source: "https://snl.no/%C3%85lesundsbrannen",
    kind: "historie",
  },
  {
    text: "Byen ble gjenreist på tre år, i stein og jugendstil. Over 320 bygg står side om side den dag i dag.",
    attribution: "Jugendbyen Ålesund",
    source: "https://byggogbevar.no/pusse-opp/byggeskikk/jugendbyen-aalesund/",
    kind: "by",
  },
  {
    text: "En by som brant ned og reiste seg vakrere. Det er ikke det verste å ha i ryggen.",
    attribution: "Skrevet for arkivet",
    kind: "by",
  },

  // ── Klubben. Årstall og navn er kontrollert.
  {
    text: "Aalesunds Fotballklubb ble stiftet 25. juni 1914.",
    attribution: "Aalesunds FK",
    source: "https://en.wikipedia.org/wiki/Aalesunds_FK",
    kind: "klubb",
  },
  {
    text: "Tangotrøyene. De oransje og blå. Klubben har flere navn enn de fleste, og alle handler om drakta.",
    attribution: "Kallenavn",
    source: "https://en.wikipedia.org/wiki/Aalesunds_FK",
    kind: "klubb",
  },
  {
    text: "Cupgull i 2009 og 2011. To ganger på tre år bar AaFK bøtta hjem til Sunnmøre.",
    attribution: "Norgesmesterskapet",
    source: "https://en.wikipedia.org/wiki/Aalesunds_FK",
    kind: "klubb",
  },
  {
    text: "Supporterklubben heter Stormen. Det er et godt navn på Vestlandet.",
    attribution: "Stormen supporterklubb",
    source: "https://en.wikipedia.org/wiki/Aalesunds_FK",
    kind: "klubb",
  },
  {
    text: "Fra Kråmyra til Color Line Stadion i 2005. Samme klubb, ny bakke å gå opp.",
    attribution: "Skrevet for arkivet",
    kind: "klubb",
  },


  // ── Spillere.
  //
  // Alt her er slått opp, ikke husket. Å finne på en detalj om en navngitt person
  // er en annen sak enn å bomme på et årstall — det er en påstand om et menneske
  // som fortsatt lever, på et nettsted som bærer klubbens navn. Derfor står kilden
  // på hver linje, og derfor står det ingenting her jeg ikke fant.

  // Amund Skiri (f. 1978, Åndalsnes)
  {
    text: "Amund Skiri satte det avgjørende straffesparket i cupfinalen i 2009. Ballen traff stolpen og trillet inn.",
    attribution: "Amund Skiri",
    source: "https://en.wikipedia.org/wiki/Amund_Skiri",
    matchUrl: "/kamp/2009-11-08-aalesunds-fk-molde-fk",
    kind: "spiller",
  },
  {
    text: "Amund Skiri spilte for AaFK i to omganger: 113 kamper fra 2001 til 2004, og 118 til fra 2006 til 2012.",
    attribution: "Amund Skiri",
    source: "https://en.wikipedia.org/wiki/Amund_Skiri",
    kind: "spiller",
  },
  {
    text: "Det ble 23 mål på forsvarsspilleren fra Åndalsnes gjennom to perioder i AaFK. Ikke verst for en midtstopper.",
    attribution: "Amund Skiri (f. 1978)",
    source: "https://en.wikipedia.org/wiki/Amund_Skiri",
    kind: "spiller",
  },
  {
    text: "Amund Skiri er i dag trener for Kristiansund BK.",
    attribution: "Amund Skiri",
    source: "https://en.wikipedia.org/wiki/Amund_Skiri",
    kind: "spiller",
  },

  // Gustave Bahoken (f. 1979, Douala)
  {
    text: "Gustave Bahoken kom fra Douala i Kamerun til Ålesund i 2005, og ble stopper i tre sesonger: 48 kamper.",
    attribution: "Gustave Bahoken",
    source: "https://en.wikipedia.org/wiki/Gustave_Bahoken",
    kind: "spiller",
  },
  {
    text: "Før han kom til AaFK spilte Gustave Bahoken to landskamper for Kamerun, og var med i Confederations Cup i 2003.",
    attribution: "Gustave Bahoken",
    source: "https://en.wikipedia.org/wiki/Gustave_Bahoken",
    kind: "spiller",
  },
  {
    text: "Gustave Bahoken ble mester i Kamerun med Cotonsport Garoua i 1998, før veien gikk om Sion, Le Havre, Livingston og til slutt Ålesund.",
    attribution: "Gustave Bahoken",
    source: "https://en.wikipedia.org/wiki/Gustave_Bahoken",
    kind: "spiller",
  },
  {
    // Denne er både en opplysning om Bahoken og en om arkivet.
    text: "Gustave Bahoken spilte 48 kamper for AaFK, men finnes ikke i dette arkivet. Han sluttet i 2008, og detaljdataene våre begynner i 2010.",
    attribution: "Om dekningen",
    source: "https://en.wikipedia.org/wiki/Gustave_Bahoken",
    kind: "spiller",
  },

  // Magnus Sylling Olsen (f. 1983, Kongsberg)
  {
    text: "Magnus Sylling Olsen kom til Ålesund i 2010. Det ble 96 kamper og 16 mål fra venstrekanten.",
    attribution: "Magnus Sylling Olsen",
    source: "https://en.wikipedia.org/wiki/Magnus_Sylling_Olsen",
    kind: "spiller",
  },
  {
    text: "Året før han kom til AaFK var Magnus Sylling Olsen Kongsvingers toppscorer med 10 mål på 30 kamper, og skjøt laget opp i Tippeligaen.",
    attribution: "Magnus Sylling Olsen",
    source: "https://en.wikipedia.org/wiki/Magnus_Sylling_Olsen",
    kind: "spiller",
  },
  {
    text: "Magnus Sylling Olsen, født i Kongsberg i 1983, spilte som regel på venstrekanten.",
    attribution: "Magnus Sylling Olsen",
    source: "https://en.wikipedia.org/wiki/Magnus_Sylling_Olsen",
    kind: "spiller",
  },

  // ── Om arkivet selv.
  {
    text: "Alt du får svar på her, ligger som lesbare filer på GitHub. Ingenting er gjemt.",
    attribution: "Om arkivet",
    kind: "arkivet",
  },
  {
    text: "Spørringen som svarer deg vises under svaret. Du skal kunne etterprøve oss.",
    attribution: "Om arkivet",
    kind: "arkivet",
  },
];
