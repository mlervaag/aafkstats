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
  kind: "dikt" | "historie" | "klubb" | "by" | "arkivet";
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
