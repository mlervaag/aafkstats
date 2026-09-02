# Datamodellen

Feltreferanse for YAML-filene i [`data/`](../data). Skjemaet som håndhever alt dette ligger i
[`packages/schema`](../packages/schema/README.md), og `pnpm validate` er fasiten — står det
noe her som ikke stemmer med skjemaet, er skjemaet riktig.

## Kildedokumenterte resultater og resultatgrupper

`data/source-results/<kilde>.yaml` bevarer resultatlister som oppgir år, motstander og
sluttresultat, men ikke nok til en kanonisk kampfil. Resultatet lagres alltid som
`[AaFK, motstander]`; hjemme/borte skal ikke gjettes. Bare uttrykkelig navngitte
konkurranser settes, og en walkover får ingen oppdiktet målscore.

Dersom kilden uttrykkelig dokumenterer en eksakt kampdato, bevares denne i det valgfrie
`date`-feltet på formen `YYYY-MM-DD`. `source-result.date` betyr: *«Datoen denne kilden dokumenterer for oppgjøret.»*
Den betyr **ikke** at kampen er fullstendig identifisert som en kanonisk kamp.

Et konkret eksempel er Sunnmøre Fotballkrets' årsrapport 1958, som dokumenterer datoene
for Åpningscupen (15., 17. og 19. april 1958), men der vi ikke har nok opplysninger (hjemme/borte,
stadion, fullstendig kampkontekst) til å opprette kanoniske kampfiler.

Arkivet opererer med **fem adskilte nivåer** for kildedata og kampidentiteter som aldri skal blandes sammen:

1. **Stabil claim-identitet (`claimId`):** Permanent, globalt unik identifikator (`srcclaim-...`) som tildeles hver enkelt historisk kildepåstand. Den forblir uendret selv om kildens sidetall, sesong eller rekkefølgenummer korrigeres. Se [`docs/SOURCE_CLAIM_STABLE_IDENTITY.md`](SOURCE_CLAIM_STABLE_IDENTITY.md) og [`data/migrations/source-claim-lineage.yaml`](../data/migrations/source-claim-lineage.yaml).
2. **Kildetekst (`opponent` og eventuell `date`):** Nøyaktig hva kilden dokumenterte (f.eks. `"Brått"`, `"K. F. K."`, `"C. F. K."`, `"S.K. Rollon"`, samt eventuell dato som `1958-04-15`). Original kildepåstand skal alltid bevares uendret.
3. **Identifisert klubb (`opponentClubId`):** Arkivets kanoniske klubb-ID (f.eks. `"braatt"`, `"kfk"`, `"clausenengen"`, `"rollon"`). Gjør at alternative skrivemåter samles under samme motstanderidentitet uten å miste kildens egen tekst.
4. **Samme uavklarte oppgjør (`resultGroupId`):** En redaksjonelt tildelt ID som samler flere kildepåstander om samme historiske oppgjør før dato og detaljer er fullt avklart (f.eks. `"nm-1919-braatt-runde-2"`).
5. **Kanonisk kamp (`matchId`):** Sikker kobling til en komplett kampfil i `seasons/<år>/matches/` (f.eks. `"1917-08-26-aalesunds-fk-sk-brann"`). Når et kilderesultat (eller en hel resultatgruppe) har fått `matchId`, ekskluderes det automatisk fra listen over uavklarte resultater på sesongsiden.

Progresjonen i datamodellen er:

```
source-result (med eller uten dato)
    ↓
eventuelt resultGroupId
    ↓
eventuelt matchId
```

Et kilderesultat kan stoppe på første nivå selv om datoen er eksakt.

### Redaksjonell regel: «Navnelikhet er et kandidatgrunnlag, ikke bevis»

- **Samme normaliserte navn** er ikke bevis for samme klubb (KFK og KBK er regresjonseksempelet).
- **Samme klubb** er ikke bevis for samme kamp (AaFK møtte ofte samme klubb flere ganger i samme sesong).
- **Samme score** er ikke bevis for samme kamp.
- **Kjent dato** er ikke bevis for en kanonisk kamp.

Verken `opponentClubId`, `resultGroupId` eller `matchId` skal settes automatisk på gjetning. Rapportverktøyene (`pnpm opponents:unresolved` og `pnpm duplicates`) finner og synliggjør kandidater, mens en redaktør alltid utfører kildekontroll før koblingen lagres i YAML.

Bygget eksponerer radene i `source_results`. De vises på sesongsidene under «Resultater uten full kampkobling», men holdes
utenfor `matches`, `seasons` og alle statistiske summer til dato og hjemme/borte er
avklart.

## Maskinelt løste kandidater

`data/extractions/*.yaml` inneholder også `resolvedRoles` og `resolvedLineups` fra den
andre maskinelle gjennomgangen av publikasjonene. Databasen eksponerer dem som
`resolved_roles` og `resolved_lineups`, med publikasjon, side og sikkerhetsnivå.

Dette er et søkbart kandidatlag, ikke kanoniske fakta. En rolle blir først kontrollert
arkivdata når den er ført i personfilens `roles`. En spillerliste blir først en
kampoppstilling når den er knyttet til en bestemt kamp. Kandidatene skal derfor alltid
vises med kilde og sikkerhet, og må ikke inngå i statistiske summer.

- [Katalogstruktur](#katalogstruktur)
- [Fellesregler](#fellesregler)
- [Kamp](#kamp)
- [Sluttabell](#sluttabell)
- [Sesong](#sesong)
- [Klubb](#klubb)
- [Stadion](#stadion)
- [Konkurranse](#konkurranse)
- [Kilde](#kilde)
- [Historisk kilde](#historisk-kilde)
- [Historisk observasjon](#historisk-observasjon)
- [Person](#person)
- [Stall og trener](#stall-og-trener)
- [Fra YAML til database](#fra-yaml-til-database)

## Katalogstruktur

```
data/
├── clubs/          <klubb-id>.yaml          AaFK og alle motstandere
├── venues/         <stadion-id>.yaml        Stadion og baner
├── competitions/   <konkurranse-id>.yaml    Serie, cup, europa, trening
├── sources/        <kilde-id>.yaml          Kildekatalog med rettighetsstatus
├── observations/   <observasjon-id>.yaml    Kildeførte historiske fakta (kanoniske)
│   └── rsssf/      <ekstern-id>.yaml        Hva kilden sa, før normalisering
├── harvests/       <batch-id>.yaml          Batchmanifest for en innhøstingsrunde
├── preservation-exceptions.yaml             Godkjente unntak fra additivitetsvernet
├── people/         <person-id>.yaml         Hvem personen er, ikke når hun spilte
├── standings/
│   └── eliteserien/<år>.yaml                Sluttabell og plasseringskurve
└── seasons/
    └── 2019/
        ├── season.yaml                      Sesongmeta
        └── matches/
            └── 2019-06-19-aalesunds-fk-molde-fk.yaml
```

Fire regler valideringen håndhever på strukturen:

- **Filnavnet er ID-en.** `data/clubs/molde-fk.yaml` må ha `id: molde-fk`, og en kampfil må
  hete `<id>.yaml`.
- **Mappenavnet er sesongen.** En kamp i `seasons/2019/` må ha `competition.season: 2019`, og
  `season.yaml` må ha `year: 2019`.
- **Kamp-ID-en starter med datoen.** `2019-06-19-…` for en kamp 19. juni 2019.
- **Dybden i `observations/` avgjør modellen.** En fil rett i mappa er et kanonisk historisk
  faktum, og en fil i en undermappe er leverandørens råobservasjon om én kamp. De to har
  hvert sitt skjema, og en fil på feil nivå blir lest med feil skjema.

## Fellesregler

**Slug.** Alle ID-er er slugs: små bokstaver, tall og bindestrek. Norske tegn skrives om
(`å` → `a`, `ø` → `o`, `æ` → `ae`). `sk-brann`, `kfum`, `odds-ballklubb`.

**Datoer.** `YYYY-MM-DD`. Klokkeslett er `HH:MM`, 24-timers, lokal tid.

**Tidsavhengige navn.** Klubber, stadion og konkurranser har et `names`-felt med perioder.
`from: null` betyr «fra tidenes morgen», `to: null` betyr «fram til i dag». Ved bygging slås
navnet opp for kampdatoen, så en kamp fra 1998 viser «Tippeligaen» og en fra 2024
«Eliteserien» — samme konkurranse, riktig navn.

```yaml
names:
  - { name: Hovedserien, from: null, to: "1962-12-31" }
  - { name: 1. divisjon, from: "1963-01-01", to: "1990-12-31" }
  - { name: Tippeligaen, from: "1991-01-01", to: "2016-12-31" }
  - { name: Eliteserien, from: "2017-01-01", to: null }
```

**Aliaser.** `aliases` knytter arkivets ID til eksterne kilders ID-er, og er det som gjør
gjentatt innhøsting idempotent:

```yaml
aliases:
  fotmob: "8402"
  rsssf: bodo-glimt
```

**Ukjente felt avvises.** Alle skjemaer er `strict`. En skrivefeil i et feltnavn blir en
valideringsfeil, ikke et felt som forsvinner i stillhet.

## Kamp

`data/seasons/<år>/matches/<id>.yaml`

Bare seks felt er påkrevd: `id`, `date`, `status`, `competition`, `home.clubId` og
`away.clubId`. Alt annet er valgfritt. En kamp fra 1930 der vi bare kjenner dato og
motstander hører hjemme i arkivet med `confidence: probable`, ikke utenfor det.

### Identitet og tid

| Felt | Type | Merknad |
|---|---|---|
| `id` | slug | **Påkrevd.** Filnavnet. Må starte med `date`. |
| `date` | dato | **Påkrevd.** `YYYY-MM-DD`. |
| `dateConfidence` | `exact` · `month` · `year` | Standard `exact`. Kjenner du bare måneden, sett `date` til den 1. og `dateConfidence: month`. |
| `kickoff` | `HH:MM` | Avspark, lokal tid. |
| `status` | `played` · `scheduled` · `abandoned` · `awarded` · `cancelled` · `postponed` | **Påkrevd.** `played` krever resultat på begge lag. |

### Konkurranse

| Felt | Type | Merknad |
|---|---|---|
| `competition.id` | slug | **Påkrevd.** Må finnes i `data/competitions/`. |
| `competition.season` | år | **Påkrevd.** Må stemme med mappenavnet. |
| `competition.stage` | enum | Standard `regular_season`. Ellers `group`, `qualifying`, `round_of_32`, `round_of_16`, `quarter_final`, `semi_final`, `third_place`, `final`, `promotion_playoff`, `relegation_playoff`, `friendly`. |
| `competition.round` | heltall | Serierunde eller cuprunde. |
| `competition.leg` | 1 eller 2 | For tokampsoppgjør. |
| `competition.groupName` | tekst | Ved gruppespill. |

### Lag og resultat

| Felt | Type | Merknad |
|---|---|---|
| `home.clubId`, `away.clubId` | slug | **Påkrevd.** Nøyaktig én av dem må være `aalesunds-fk`. |
| `home.score`, `away.score` | heltall eller `null` | Sluttresultat, inkludert ekstraomganger. |
| `home.halfTimeScore`, `away.halfTimeScore` | heltall eller `null` | Pauseresultat. |
| `extraTime.home`, `extraTime.away` | heltall | Mål scoret *i* ekstraomgangene. |
| `penaltyShootout.home`, `penaltyShootout.away` | heltall | Straffesparkkonkurranse. Forutsetter uavgjort etter ordinær tid og eventuell ekstraomgang. |

### Ramme

| Felt | Type | Merknad |
|---|---|---|
| `venueId` | slug | Må finnes i `data/venues/`. |
| `neutralVenue` | boolsk | Standard `false`. |
| `attendance` | heltall | Tilskuertall. |
| `referee` | tekst | Dommer. |

### Hendelser

`events` er en liste. `team` er `home` eller `away` — databasen oversetter til
`aafk`/`opponent` i `match_events`-viewet.

```yaml
events:
  - minute: 45
    stoppage: 2          # 45+2
    type: goal
    team: home
    player: Claudio Braga
    assist: Janus Seehusen
  - minute: 60
    type: substitution
    team: home
    player: Frederik Heiselberg      # inn
    playerOff: Paul Ngongo Iversen   # ut
```

`type` er én av `goal`, `own_goal`, `penalty_goal`, `missed_penalty`, `yellow_card`,
`second_yellow_card`, `red_card`, `substitution`, `var_decision`.

### Lagoppstilling og statistikk

```yaml
lineups:
  home:
    formation: "4-3-3"
    starters: [Sten Grytebust, …]
    subs: […]
    coach: Lars Arne Nilsen
stats:
  home: { possession: 54, shots: 14, shotsOnTarget: 6, corners: 7, fouls: 11, offsides: 2, xg: 1.8 }
```

### Referat og eksterne rapporter

```yaml
report:
  summary: Én til to setninger.
  body: Lengre tekst, skrevet for dette arkivet.
  byline: Navn eller kallenavn
  writtenAt: 2026-08-03
externalReports:
  - publisher: Sunnmørsposten
    title: Overtidsdrama på Color Line
    url: https://…
    date: 2019-06-19
    quote: Kort, tydelig markert sitat.
```

**`report.body` skal alltid være egenskrevet.** Aldri kopiert fra avis eller klubbside, heller
ikke omskrevet setning for setning. Originalen lenkes fra `externalReports`. `quote` har en
teknisk grense på 300 tegn, men grensen er ikke i seg selv en juridisk tillatelse — se
[DATA_LICENSE.md](../DATA_LICENSE.md).

### Proveniens

Dette er det som skiller arkivet fra en resultatliste: hver opplysning bærer sin egen kilde.

```yaml
sources:
  - sourceId: rsssf
    url: https://www.rsssf.no/…
    retrievedAt: 2026-08-03
    fields: [date, home.score, away.score]    # punktnotasjon, som i YAML-en
    note: Runden er utledet av rekkefølgen på siden.
confidence: probable                           # confirmed | probable | disputed
conflicts:
  - field: attendance
    values:
      - { value: 4210, sourceId: rsssf }
      - { value: 4200, sourceId: nasjonalbiblioteket, note: Avisen runder trolig av. }
    resolved: false
```

| Felt | Merknad |
|---|---|
| `sources[].fields` | Hvilke felt denne kilden dekker. Tomt betyr «kampen generelt». |
| `confidence` | `probable` er ikke en feil — for kamper før ~1990 er det ofte det beste vi får. |
| `conflicts` | Minst to motstridende verdier per konflikt. `confidence: disputed` uten en konflikt avvises. |
| `manual` | Felt satt for hånd. Skal aldri overskrives av en innhøster. |
| `tags` | Frie slugs for gruppering: `derby`, `opprykk`. |
| `aliases` | Kildens egen ID for kampen. Gjør gjentatt innhøsting idempotent. |
| `note` | Forbehold som hører til denne kampen. Vises på nettstedet og tas med i AI-svar. |

### Reglene skjemaet håndhever

Ut over feltyper sjekker `pnpm validate` dette, og feiler med filnavn og feltsti:

1. `id` starter med `date`, og filnavnet er `<id>.yaml`.
2. Nøyaktig én av sidene er `aalesunds-fk`, og AaFK spiller ikke mot seg selv.
3. `status: played` krever resultat på begge lag.
4. `penaltyShootout` krever uavgjort etter ordinær tid og eventuell ekstraomgang.
5. `confidence: disputed` krever minst én oppføring i `conflicts`.
6. Alle `clubId`, `venueId`, `competition.id` og `sourceId` finnes.
7. Ingen duplikate ID-er, og ingen to kamper med samme dato og samme motstander.

### Observasjon

Kampfila viser resultatet av normaliseringen. Den sier at motstanderen er `fk-haugesund`, men
ikke at RSSSF skrev «Haugesund» og FotMob «FK Haugesund». Da Haugesund-dubletten skulle rettes,
måtte den forskjellen rekonstrueres ved å lese adapterkoden og gjette hva kilden hadde stått
med.

En observasjon er det uendrede: kildens egne strenger ved siden av det arkivet gjorde dem til.

```yaml
sourceId: rsssf
externalId: 1998-first-19-4-brann-aafk
matchId: 1998-04-19-brann-aalesunds-fk     # null når kampen ikke lot seg plassere
retrievedAt: 2026-08-04
adapter: rsssf@1                           # opp når tolkningen endres, ikke ved rene omskrivinger
payloadHash: sha256:…                      # av råverdiene, med nøklene sortert
raw:                                       # kildens begreper
  home: Brann
  homeScore: 3
normalized:                                # feltstier i kampskjemaet
  home.clubId: sk-brann
  home.score: 3
fields: [date, home.score, away.score]
warnings: []
```

| Regel | Hvorfor |
|---|---|
| Stien er `observations/<sourceId>/<vasket externalId>.yaml`, og valideringen krever den | Neste kjøring finner forrige observasjon uten å lete, og samme kilde kan ikke ende opp som to filer om samme kamp |
| Et felt kilden ikke nevnte utelates, og settes ikke til `null` | «Oppga ikke tilskuertall» og «påstår at tallet ikke finnes» er ikke det samme |
| `matchId` settes også når kampen ble hoppet over fordi en annen kilde eide den | At kilde nummer to sa noe er en opplysning, ikke støy |
| `findConflicts` kan utlede uenigheter av observasjonene | Sammenligningen er skrevet én gang, ikke per adapter |

Kampene som allerede lå i arkivet da observasjonslaget kom til får ingen observasjon.
Råverdiene deres finnes ikke lenger, og å rekonstruere dem ville vært å finne på hva kilden
sa. Observasjoner skrives fra og med innhøstingen som innførte dem.

`findConflicts` er skrevet og testet, men ingen innhøsting kaller den ennå: `reconcile`
lar `conflicts[]` stå som den er og skriver ingen nye. Konfliktene i arkivet er derfor ført
inn for hånd. Det er en ærlig tilstand så lenge det står her, og neste steg er å la
innhøstingen foreslå konflikter uten å røre dem noen allerede har avgjort — se
beslutningsfeltene på `conflict` i `packages/schema/src/primitives.ts`.

Dette er ikke et fullt råpayload-arkiv. Feltene adapteren leste lagres, ikke hele JSON-svaret
eller HTML-sida. Å speile kildene i sin helhet er et rettighetsspørsmål vi ikke har svart på.

### Sluttabell

Tabellen har ligget nederst på hver RSSSF-sesongside hele tiden. Kampparseren leste
resultatlinjene og kastet resten, så arkivet hadde 32 seriesesonger uten å vite hvor laget
endte i en eneste av dem.

```yaml
competitionId: forstedivisjon
season: 1998
table:
  - position: 1
    name: Odd Grenland          # kildens eget lagnavn
    clubId: odds-ballklubb      # null når klubben ikke finnes i arkivet
    played: 26
    wins: 16
    draws: 7
    losses: 3
    goalsFor: 55
    goalsAgainst: 18
    points: 55
    outcome: promoted           # promoted | relegated | promotion_playoff |
                                # relegation_playoff | playoff | none
    note: Champions League      # kildens merknad når den sier mer enn outcome
progression:                    # AaFKs plass etter hver runde, utregnet
  - { round: 1, position: 12, points: 0, played: 1, goalDifference: -3 }
sources:
  - { sourceId: rsssf, url: …, retrievedAt: 2026-08-04, fields: [table, progression] }
```

| Regel | Hvorfor |
|---|---|
| Lagnavnet er kildens eget, og `clubId` er valgfri | En divisjon har seksten lag, og AaFK har ikke møtt alle. Å kreve en klubbfil per rad hadde betydd rundt 40 klubber uten en eneste kamp i arkivet |
| `points` er tallet tabellen viser, ikke `wins * 3 + draws` | Poengtrekk finnes, og to poeng for seier gjaldt til 1987 |
| Plasseringene må være 1 til N uten hull | Et hull betyr at parseren har mistet en rad, og en tabell som mangler et lag ser helt normal ut |
| `progression` er utregnet, ikke hentet | En tabell etter runde 12 krever hver kamp i divisjonen. De lagres ikke; se under |

**Hvorfor kurven ikke er kamper.** En tabell underveis kan ikke regnes ut av AaFKs kamper
alene. Å lagre hele divisjonen ville gjort arkivet til noe annet: rundt 200 kamper per
sesong for lag prosjektet ikke handler om, mot dagens 26. Vi lagrer derfor det utregnede,
og lar `sources[]` peke på sida tallene kom fra.

**To kontroller står som port.** Kurven skrives bare når den lander på nøyaktig samme
plass, poengsum, kampantall og målforskjell som tabellen kilden trykte, og når lagene i
runderekka er de samme som i tabellen. Holder ikke begge, står tabellen alene og
`note` sier hvorfor. Tabellen er hentet; kurven er vår, og bare den kan være gal.

## Sesong

`data/seasons/<år>/season.yaml`

```yaml
year: 2019
competitionId: forstedivisjon
finalPosition: null      # null når plasseringen ikke er lagt inn ennå
teamsInLeague: 16
headCoach: Lars Bohinen
promoted: false
relegated: false
note: >
  Forbehold om sesongen som helhet hører hjemme her.
```

Alt utenom `year` og `competitionId` er valgfritt. De fleste sesongfilene i arkivet har
foreløpig bare det som er kjent — resten fylles inn etter hvert.

Sesongfilen gjelder **én** konkurranse — den AaFK spilte serie i det året. Cupkamper og
treningskamper samme år ligger i samme mappe, men er ikke dekket av `finalPosition` og
`teamsInLeague`. `seasons`-viewet i databasen utleder derfor konkurransene fra kampene og
låner sesongmeta bare til den raden den faktisk gjelder.

### Når er en sesong komplett?

`seasons.coverage` svarer per konkurranse, og bare serien får et svar: cup og
treningskamper står som `not_applicable` fordi de ikke har serierunder. Det er én
konkurranse, ikke ett år, og forskjellen er ikke akademisk. 2019 hadde hele serien inne
og sto som komplett mens cupkvartfinalen mot Viking ligger i arkivet som 1–1 uten
straffesparkkonkurranse — merket lovet en sesong arkivet ikke hadde.

`season_coverage` svarer for året. Det er `complete` når:

1. hver seriesesong året har er `complete` i `seasons` — sammenhengende runder og like
   mange kamper som det kjente omfanget,
2. cuprekka er spilt ferdig,
3. et eventuelt europacupeventyr er spilt ferdig, og
4. ingen kamper står igjen på terminlista.

**Hvordan vi vet at en cuprekke er ferdig.** En cup har ikke et forventet antall kamper:
den slutter når laget ryker ut, og hvilken runde AaFK gikk inn i varierte med år og
divisjon. Sluttpunktet er derimot entydig, og det er nok. Den siste spilte kampen i
turneringen er enten et tap (laget røk ut der), en finale (uansett hvordan den gikk),
eller en uavgjort avgjort på straffer. Slutter rekka på en seier som ikke er en finale,
mangler arkivet minst én kamp. Regelen kan bare ta feil i én retning, og det er den vi vil
ta feil i: den sier aldri «ferdig» om en rekke som fortsetter. At vi ikke kan se om de
*første* rundene mangler, er en begrensning i dataene — ingen kilde i arkivet sier hvilken
runde laget gikk inn i.

**Treningskamper teller ikke.** Det finnes ikke noe fasitsvar på hvor mange treningskamper
laget spilte i 1963, så et krav om dem ville gjort hver eneste sesong ufullstendig for
alltid.

**Uten seriesesong svarer viewet `unknown`, ikke `partial`.** Har arkivet ingen serierad
for året, vet vi ikke om det ble spilt en serie. Da er «komplett» en påstand om noe ingen
har sett etter, og «delvis» en påstand om et hull vi ikke kan belegge.

`has_standings` skiller det sterkeste belegget fra det nest sterkeste. Sluttabellen er
førstevalget for omfanget; uten den kan sesongfila oppgi `expectedMatches` med en note om
hvor tallet kommer fra, og året kan fortsatt være komplett — merket sier da «uten tabell».

## Klubb

`data/clubs/<id>.yaml`

```yaml
id: aalesunds-fk
name: Aalesunds FK
shortName: AaFK
identityKey: aalesunds-fk
nameVariants:
  - Aa.F.K.
  - Aalesunds FK
names:
  - { name: Aalesunds Fotballklub, from: null, to: "1927-12-31" }
  - { name: Aalesunds FK, from: "1928-01-01", to: null }
country: NO
city: Ålesund
founded: 1914
foundedDate: 1914-06-25
aliases:
  fotmob: 8404
  wikidata: Q214992
  rsssf: aalesunds
sources:
  - sourceId: aafk-historie-stiftelsen
    fields: [founded, foundedDate]
```

### Klubbnavn og identitetsfelter

| Felt | Type | Betydning |
|---|---|---|
| `name` | tekst | **Påkrevd.** Klubbens primære kanoniske navn. |
| `shortName` | tekst | Kortform, f.eks. `AaFK`, `KFK` eller `KBK`. |
| `identityKey` | slug | Valgfri eksplisitt identitetsnøkkel. Brukes når mekanisk navnenormalisering (`canonicalClubKey`) ville strippet klubbtypeord og feilaktig slått sammen to ulike klubber. |
| `nameVariants` | liste av tekst | Uformelle skrivemåter og varianter som forekommer i historiske kilder (f.eks. `K.F.K.`, `K. F. K.`), uten at det representerer formelle navnebytter. Brukes til søk og identitetsgjenkjenning. |
| `names` | liste av perioder | Formelle, tidsavhengige historiske navn klubben faktisk bar i gitte tidsrom. Slås opp ved bygging for kampdatoen. |
| `aliases` | nøkkel/verdi | Kun eksterne system- og leverandør-ID-er (f.eks. `fotmob: 8605`, `rsssf: kristiansund`, `wikidata: Q214992`). Brukes aldri til historiske skrivemåter. |

### Eksempel: Kristiansund Fotballklubb (KFK) vs. Kristiansund Ballklubb (KBK)

Kristiansund Fotballklubb (stiftet 1912) og Kristiansund Ballklubb (stiftet 2003) inneholder begge ordet «Kristiansund». En mekanisk normalisering som fjerner `FK` og `BK` ville redusert begge til `kristiansund`. Ved hjelp av `identityKey` modelleres de som to separate identiteter med fullstendig adskilt innbyrdesstatistikk:

```yaml
# data/clubs/kfk.yaml
id: kfk
name: Kristiansund Fotballklubb
shortName: KFK
identityKey: kristiansund-fk
nameVariants:
  - KFK
  - K.F.K.
  - K. F. K.
  - Kristiansunds Fotballklub
```

```yaml
# data/clubs/kristiansund.yaml
id: kristiansund
name: Kristiansund Ballklubb
shortName: KBK
identityKey: kristiansund-bk
nameVariants:
  - Kristiansund BK
  - KBK
aliases:
  fotmob: "8605"
  rsssf: kristiansund
```

`country` er tobokstavs landkode, standard `NO`. `founded` kan gå tilbake til 1800 — flere
motstandere er eldre enn AaFK. `foundedDate` brukes når hele datoen er kjent. Klubbfakta kan
ha `sources`, slik at stiftelsesdatoen ikke bare står som en løs verdi.

## Stadion

`data/venues/<id>.yaml`

```yaml
id: color-line-stadion
name: Color Line Stadion
names:
  - { name: Color Line Stadion, from: "2005-01-01", to: null }
city: Ålesund
capacity: 10778
opened: 2005
openedDate: 2005-04-16
surface: artificial_turf
surfaceHistory:
  - surface: artificial_turf
    from: "2005"
    to: null
    sources: [{ sourceId: aafk-historie-color-line-stadion, fields: [surface, from] }]
homePeriods:
  - clubId: aalesunds-fk
    from: 2005
    to: null
    sources: [{ sourceId: aafk-historie-hjemmebaner, fields: [from, to] }]
attendanceRecords:
  - attendance: 10903
    opponent: HamKam
    year: 2005
    sources: [{ sourceId: aafk-historie-hjemmebaner, fields: [attendance, opponent, year] }]
events:
  - id: apningskamp-2005
    date: 2005-04-16
    kind: opening
    title: Åpningskamp mot Odd
    attendance: 10615
    score: { homeTeam: AaFK, awayTeam: Odd, home: 2, away: 1 }
    sources: [{ sourceId: aafk-historie-color-line-stadion }]
```

`surface` er et kort sammendragsfelt: `gravel`, `grass` eller `artificial_turf`.
`surfaceHistory` brukes når dekket har endret seg og bevarer periode og kilde. `homePeriods` beskriver når en klubb
brukte banen som hjemmebane; det er noe annet enn stadionets åpnings- og stengningsår.
`attendanceRecords` bevarer motstander, eventuelt år og kontekst. Sett `approximate: true`
når kilden bruker «ca.». Alle perioder og rekorder må ha minst én historisk kilde.
`events` er tidfestede milepæler med en kort faktatittel. Åpnings- og andre kamper kan
beholde resultat, tilskuertall og navngitte deltakere også når kampen ikke passer i den
vanlige kampmodellen, for eksempel et sammensatt Aalesund/Rollon-lag.
`closed` settes bare når banen faktisk er lagt ned. Valgfrie felt utelates — de skal ikke
skrives som `null`, med unntak av åpen slutt i `homePeriods.to`.

## Konkurranse

`data/competitions/<id>.yaml`

```yaml
id: eliteserien
name: Eliteserien
type: league          # league | national_cup | european | friendly | playoff
tier: 1               # nivå i seriepyramiden, kun for league
organizer: Norges Fotballforbund
country: NO
names: [ … ]
```

`type` er en lukket enum fordi den driver navigasjonen på nettstedet. Skal arkivet få en ny
kategori, er det en kodeendring, ikke en dataendring — og det er meningen.

## Kilde

`data/providers/<id>.yaml`

```yaml
id: rsssf
name: RSSSF
url: https://www.rsssf.org
priority: 50                                # høyere tall vinner ved uenighet
automatedAccess: allowed                    # kan vi hente?
publicRedistribution: permission_required   # kan vi publisere videre?
attributionRequired: true
permissionStatus: accepted_risk             # not_needed | pending | requested | granted | accepted_risk | denied
termsCheckedAt: 2026-08-03
robotsCheckedAt: 2026-08-03
permissionNote: >
  Hvem som besluttet, når, og på hvilket grunnlag.
note: Hva kilden dekker, og hvilke forbehold som gjelder.
```

To spørsmål, to felt. At et sluttresultat er et faktum uten opphavsrett sier ingenting om
databasevernet på samlingen det ble hentet fra, og heller ikke om vilkårene kilden selv har
satt. Innhøstings-CLI-ene leser statusen før nettverkskallet: tørrkjøring krever
`automatedAccess`, `--write` krever i tillegg `publicRedistribution`. `unknown` er aldri et ja.

`accepted_risk` er ikke det samme som `granted`. Den betyr at vilkårene er lest, at bruken
ikke er uttrykkelig tillatt, og at prosjekteier likevel har besluttet å gå videre. Statusen
krever `permissionNote` — en avkrysning uten begrunnelse er ikke en beslutning.

## Historisk kilde

`data/sources/<id>.yaml`

En *provider* er stedet opplysningen kom fra, som RSSSF eller Nasjonalbiblioteket. En
*historisk kilde* er selve dokumentet: boka, medlemsbladet, jubileumsskriftet. Kampene
peker på begge, og de svarer på hvert sitt spørsmål — hvem hentet vi det fra, og hva står
det i.

```yaml
id: cupminner-2009-30c4
title: Cupminner
sourceType: book                       # se enumen under
parentSourceId: aafk-medlemsblad       # bare på en utgave i en serie
issue: "4"                             # utgavenummer, som tekst («3-4», «Jul»)
volume: "25"                           # årgang
publisher: Sunnmørsposten
year: 2009
urn: URN:NBN:no-nb_digibok_2014062605010
author: Ola Nordmann                   # forfatter eller redaktør
description: >
  Kort om hva kilden inneholder.
coverUrl: https://…
accessUrl: https://www.nb.no/items/URN:NBN:no-nb_digibok_2014062605010
providers:
  - providerId: nasjonalbiblioteket
    url: https://www.nb.no/items/URN:NBN:no-nb_digibok_2014062605010
```

`sourceType` er `book`, `anniversary_book`, `member_magazine`, `annual_report`,
`match_program`, `supporter_publication`, `local_history_book`, `newspaper_supplement`,
`series` eller `other`.

**Serier.** Et periodikum ligger som én kilde med `sourceType: series`, og hver utgave
peker på den med `parentSourceId`. Valideringen krever at forelderen finnes og faktisk er
en serie. Seriesiden grupperer utgavene etter år, så `year` og `issue` er det som gjør en
serie navigerbar — uten dem står 86 utgaver som én uleselig liste.

**Bibliografien er valgfri.** `urn`, `author` og `description` er alle valgfrie, fordi de
fleste katalogpostene ikke har dem. Et påkrevd felt ville bare invitert til å fylle inn en
gjetning.

`urn` er den stabile identifikatoren, som regel Nasjonalbibliotekets. `accessUrl` peker på
en adresse, og en adresse kan endre seg; URN-en identifiserer dokumentet uansett, og er det
en annen katalog kan slå opp på.

## Faktakandidater fra publikasjoner

`data/extractions/<sourceId>.yaml` er arbeidskøen mellom OCR og kanoniske fakta.
Hver fil dokumenterer OCR-tilgang, behandlet sidetall, innholdshash og korte
faktatokens med sidetall. `kind` skiller personomtale, personrolle, kampresultat,
lag/stall, organisasjon og sesongfakta. `personIds` og `matchIds` brukes bare når
treffet kan knyttes til en eksisterende arkividentitet.

Kandidater er ikke ferdige fakta. De må kontrolleres mot siden før nye personer,
roller, oppstillinger eller sesongfelt skrives til de ordinære modellene. Et strengt,
entydig treff på år, AaFK, motstander og resultat kan automatisk legge til en
`sourceRef` på en eksisterende kamp, men endrer aldri selve resultatet.

Rå ALTO og OCR-prosa er ikke del av modellen. Cachen ligger under
`.cache/nb-extract/`, og er ignorert av Git.

## Verifiseringssaker

`data/verification-cases/<id>.yaml` er versjonerte spørsmål til manuell kontroll. Det
valgfrie `newspaper`-feltet markerer en NB-avissak og bevarer kandidat-ID, stabil
kilderesultatnøkkel, discovery-hypotese og avisens utgavedato, side og direkte NB-lenke.
Feltet inneholder aldri OCR eller fulltekst. `inconclusiveMeaning` forklarer hva svaret
KAN IKKE BESTEMMES betyr; eldre saker bruker en felles standardtekst når feltet mangler.

Avissaken peker på kilden som eier kilderesultatet. Koblingen er arbeidsmetadata og gjør
verken kilderesultatet eller en foreslått kamp kanonisk. Community-svar går til redaksjonell
behandling og kan ikke skrive til arkivdata.

Genererte saker kommer fra `data/discovery/community-candidate-queue.yaml` og
`data/discovery/nb-community-research-wave-1.yaml`. Begge manifestene har et valgfritt
`retirement` (`reason`, `retiredAt`, `note`) som tar en oppføring ut av community-køen uten
å slette den. `pnpm validate` kontrollerer at hver åpen, publisert sak fortsatt stemmer med
kilderesultatet den spør om — se `docs/NEWSPAPER_COMMUNITY_EDITORIAL_WORKFLOW.md`.

## Historisk observasjon

`data/observations/<id>.yaml` inneholder korte, redaksjonelt kontrollerte fakta eller
hendelser som er relevante for AaFKs historie. En observasjon har alltid `title`, `text`
og minst én `sourceRef`. `date` er valgfri og skrives som år, måned eller eksakt dato med
den presisjonen kilden faktisk gir.

Relasjonene `personIds`, `seasonYears`, `matchIds`, `venueIds` og `competitionIds` er hver
for seg valgfrie. Samme observasjon kan derfor vises på både en person-, en sesong-, en
kamp- og en banevisning uten å kopieres. Alle oppgitte ID-er og kilder må finnes i arkivet.

**Minst én relasjon må ha en side å stå på.** `personIds`, `seasonYears`, `matchIds` eller
`venueIds` — minst én av dem må være satt. `competitionIds` teller ikke, fordi arkivet ikke
har noen konkurranseside: en observasjon som bare pekte dit ville blitt lagret og validert
uten å finnes noe sted for en leser. Kravet håndheves i skjemaet.

Er faktumet allerede skrevet ut i en annen fil — for eksempel som `note` på en `events`-post
under en bane — hører det hjemme her og ikke begge steder. Poenget med modellen er at en
retting skal treffe ett sted.

```yaml
id: nils-jangaard-kretsinndeling-1919
title: Deltok i behandlingen av kretsinndelingen
text: Nils Jangaard deltok i behandlingen av AaFKs skrivelse om kretsinndelingen.
date: "1919"
personIds: [nils-jangaard]
seasonYears: [1919]
sources:
  - sourceId: nff-arbok-1919
    page: "67-69"
```

De fire måtene en kilde kan si noe om en person på, betyr forskjellige ting:

- **role:** personen hadde et konkret verv, for eksempel Georg Haller som formann i AaFK.
- **mention:** personen forekommer i en publikasjon, uten at treffet alene etablerer et faktum.
- **observation:** kilden dokumenterer et konkret faktum eller en hendelse, som NFFs takk til Haller for Romsdalsturneen.
- **conflict:** to eller flere kilder gir motstridende påstander, for eksempel ulike oppmenn i 1917.

Dette er ikke en generell biografimodell. Teksten skal være en kort kildebasert parafrase,
ikke lange sitater, OCR eller en fritekstbiografi.

## Person

`data/people/<id>.yaml`

Ikke en liste over alle som har spilt. De fleste finnes bare som et navn i en
lagoppstilling, og det er nok. En fil lages når det er noe å si: en skrivemåte som må
knyttes til personen, et draktnummer, en posisjon, eller en trenerperiode fra før
kampdataene rekker.

```yaml
id: mathias-kristensen
name: Mathias Kristensen
names: [Mathias Kristensen Jr.]   # skrivemåter kildene bruker
nationality: Danmark              # slik kilden skrev den
position: midtbane                # keeper | forsvar | midtbane | angrep
wikidata: Q138807730
squadNumbers:
  - { season: 2025, number: 14 }
coachSpells:                      # bare for år kampdataene ikke rekker
  - { fromSeason: 2001, toSeason: 2005 }
roles:                            # verv og tilknytninger som kilden uttrykkelig oppgir
  - id: formann-1914-1915
    category: board               # player | coach | sporting_staff | board | administration | honorary | founder | project
    title: Formann
    organizationId: aafk          # juridisk/organisatorisk enhet; valgfri for eldre roller
    body: Hovedstyret
    from: "1914"                  # år eller eksakt dato
    to: "1915"                    # null når slutt ikke er oppgitt
    sources:
      - { sourceId: aalesunds-fotballklub-gjennem-1939-ec28, page: "18", fields: [title, from, to] }
```

| Regel | Hvorfor |
|---|---|
| To filer kan ikke dele Wikidata-ID | Q-ID-en er den eneste identiteten her som ikke er en gjetning. Deler to filer den, er de samme person |
| En skrivemåte kan bare stå på én person | Ellers vet ikke oppslaget fra oppstillingen hvem navnet gjelder |
| Ett draktnummer per sesong | To betyr at innhøstingen har lest to rader som samme mann |
| Ingen biografi | Fødselsdato og karriere ligger på Wikidata. En peker holder seg oppdatert; en kopi blir gammel uten at noen merker det |
| Alle roller har kilde og side | Organisasjonshistorikk uten proveniens blir raskt en navneliste ingen kan kontrollere |

### Roller og organisasjon

`roles` er relasjonen mellom en person og AaFK-organisasjonen. Den dekker styreverv,
administrasjon, sportslig apparat, trenerroller og heder. `category` er den stabile,
søkbare klassifiseringen; `title` og `body` beholder kildens historiske betegnelse.
Samme person kan derfor være spiller, formann og senere æresmedlem uten tre personfiler.

Organisasjonssiden utledes av disse rollene. Et manglende år betyr «ikke kartlagt», aldri
at vervet sto tomt. Roller skal ikke opprettes uten minst én `sourceId` og sidehenvisning.

### Organisasjoner og snapshots

`data/organizations/<id>.yaml` skiller klubben, driftsselskapet og stadionrelatert
virksomhet. `organizationId` på en rolle er noe annet enn `body`: førstnevnte sier
hvilken enhet rollen tilhører, mens `body` beholder avdeling eller organ slik kilden
skrev det.

`data/organization/snapshots/<dato>-<organizationId>.yaml` lagrer samtidige
organisasjonsoversikter. En person i et snapshot var dokumentert i rollen på datoen,
men datoen er verken start- eller sluttdato. Først en ansettelses-, utnevnelses- eller
avgangskilde kan etablere en eksakt periode i `roles`.

```yaml
date: "2009-09-20"
organizationId: aafk
sources: [{ sourceId: aftenposten-aafk-administrasjon-2009 }]
people:
  - personId: einar-welle
    observedTitle: Arenasjef
    category: administration
    body: Stadion
```

### Overganger

`transfers` er kildeførte overganger inn til og ut av klubben. AaFK er alltid den ene
siden, så `direction` (`in` eller `out`) og motparten er nok:

```yaml
transfers:
  - id: ut-volda-1950          # stabil innenfor personfila, som rolle-ID-ene
    direction: out             # in | out
    kind: transfer             # transfer (standard) | loan | loan_return | free | academy | released | retired
    club: Volda T. & I.L.      # kildens egen skrivemåte, alltid bevart
    clubId: volda              # arkivets klubb, bare når den finnes i data/clubs/
    date: "1950"               # ÅÅÅÅ eller ÅÅÅÅ-MM-DD. «Høsten 1950» er 1950
    sources: [{ sourceId: medlemsblad-for-aalesunds-fotb-1950-3b73, page: "12" }]
```

| Regel | Hvorfor |
|---|---|
| Minst én kilde | En overgang uten proveniens er et rykte. Samme krav som rollene har |
| `club` overskrives aldri av `clubId` | «Volda T. & I.L.» er hva medlemsbladet skrev. ID-en kommer i tillegg, ikke i stedet |
| `clubId` er valgfri | Klubbkatalogen er motstandere. En spiller går ofte til en klubb AaFK aldri har møtt, og da skal feltet stå tomt — ikke utløse en ny klubbfil |
| `retired` og `released` har ingen klubb | De betyr nettopp at kilden ikke oppgir noen. En klubb i tillegg er to påstander som motsier hverandre |
| `season` bare for vintervinduet | Standard er året i `date`. Feltet finnes fordi en spiller hentet i desember 2015 hører til stallen i 2016, og godtar bare det året eller året etter |
| Ingen overgangssum | Beløp er sjelden dokumentert, ofte et rykte, og et felt som finnes blir fylt. Oppgir en kilde en sum, står den i `note` |

**Hva en overgang ikke beviser.** Samme redaksjonelle skille som mellom kildepåstand og
kanonisk kamp gjelder her:

- **En overgang er ikke en kampsesong.** En spiller kan være hentet og aldri ha spilt. `squad`
  og `transfers` er to observasjoner, og den ene utledes aldri av den andre.
- **En manglende overgang beviser ingenting.** Et år uten rader betyr manglende kilde. Arkivet
  har fire overganger fra 1950 og ingen fra 1951; det sier noe om medlemsbladene, ikke om laget.
- **`clubId` settes ikke på navnelikhet.** Samme regel som `opponentClubId`.

Bygget eksponerer radene i viewet `transfers`. Sesongsiden viser dem som «inn og ut» under
stallen, og personsiden som en egen tidslinje.

**Hvorfor feltet ligger på personen.** En overgang uten en person er ingenting, og
personfilene lastes og valideres allerede. Prisen er at en overgang krever at personfila
finnes: en spiller som bare er kjent fra oppstillingene, kan ikke ha en overgang registrert
før noen skriver fila. Det er riktig utfall — en kildeført overgang er en sterkere grunn til
en fil enn et draktnummer er.

**Hvorfor filene finnes.** `personKey()` slår sammen skrivemåter som er samme bokstav
skrevet på to måter. Det den ikke kan, er å avgjøre om «Mathias Kristensen» og «Mathias
Christensen» er samme mann. Wikipedia svarer: begge står i samme stall, med hvert sitt
draktnummer og hver sin nasjonalitet. Med en fil per person kan arkivet påstå at de er to,
med kilde, i stedet for bare å la være å gjette.

## Stall og trener

Ingen egne filer. Stallen og trenerhistorikken utledes av `lineups` på kampene ved
bygging, i viewene `squad` og `coach_spells`. Oppstillingen ligger allerede på kampen, og en
egen fil per opptreden ville vært samme opplysning to steder.

**Personidentitet.** Kilden veksler mellom skrivemåter fra kamp til kamp: 2014-sesongen har
både «Jan Jönsson» og «Jan Joensson» som hovedtrener, og de er én mann. `personKey()` i
skjemapakka gjør dem til samme person ved å behandle en bokstav med ring, strek eller tødler
som den samme bokstaven som den utskrevne formen. Målt på hele arkivet blir 238 navnestrenger
til 227 personer, og alle elleve sammenslåingene er samme navn i to skrivemåter.

Bare mekanisk translitterasjon slås sammen. «Mathias Kristensen» og «Mathias Christensen»
står som to, fordi det kan være samme mann feilstavet og det kan være to menn.
`pnpm data:duplicates` rapporterer paret slik at et menneske kan avgjøre.

Navnet som vises er den skrevne formen når begge finnes: «Määttä», ikke «Maeaettae».

**Tre ting tallene ikke sier.** `appearances` teller oppsatte tropper, ikke spilletid, fordi
kilden ikke skiller mellom en som satt på benken og en som kom inn. «Ny» betyr at spilleren
ikke var med sesongen før, ikke at han ble hentet: en som var skadet hele fjoråret ser like
ny ut. Der en overgang er kildeført, sier stallen «hentet fra» i stedet for «ny» — da er det
ikke lenger en utledning, men noe en kilde faktisk oppgir. Og trenerperiodene starter på første kamp, ikke på dagen avtalen ble skrevet.

Oppstillingene finnes fra 2010. Eldre sesonger har tom stall, og det er en manglende kilde
og ikke et lag uten spillere.

## Brukerbidrag (Contributions)

`data/contributions/<id>.yaml`

Bidrag som har kommet inn fra brukere, gått gjennom redaksjonell kontroll og blitt plassert i arkivet.

```yaml
id: gh-1
scope: match
targetId: 2007-05-13-lyn-aalesunds-fk
category: event_detail
text: >
  Fritest om noe som skjedde.
contributor: ML
submittedAt: 2026-08-05
verification: corroborated
sourceUrl: https://...
```

| Felt | Merknad |
|---|---|
| `id` | Unik ID for bidraget. Hvis det kom via en GitHub issue, gjerne `gh-<nummer>`. |
| `scope` | `match`, `season` eller `person`. Hva bidraget gjelder. |
| `targetId` | Kamp-ID, sesongår (f.eks. `2024`) eller person-ID. |
| `category` | `memory`, `context`, `trivia` eller `event_detail`. |
| `text` | Selve bidraget. Kan være et direkte sitat. |
| `contributor` | Navn på innsender, eller `null` for anonym. |
| `verification` | `unverified`, `corroborated` eller `verified`. Hvor sikker opplysningen er. |

Når databasen bygges, opprettes `core_contributions` og et åpent view kalt `contributions`.

## Fra YAML til database

Byggesteget regner ut noen felt som ikke finnes i YAML-en. De er avledet, aldri redigert:

| Kolonne i `matches` | Utledes av |
|---|---|
| `is_home`, `opponent`, `aafk_score`, `opponent_score`, `goal_difference`, `result` | `toAafkPerspective()` — hvilken side AaFK spilte på |
| `after_extra_time`, `decided_on_penalties`, `won_on_penalties` | `extraTime` og `penaltyShootout` |
| `competition`, `opponent`, `venue` (navnene) | `nameAt()` mot `names` og kampdatoen |
| `completeness`, `missing_fields` | Hvor mye av kampen som er fylt ut |
| `providers` | Dataleverandører, hentetid og hvilke felt de dokumenterer. Holdes adskilt fra historiske `sources`. |
| `has_conflicts` | Om `conflicts` er tom |

Kolonnereferansen for det ferdige datasettet — alle views, alle kolonner, med forbehold —
står på [`/data`](https://aafkarkivet.no/data) og i
[`packages/query/src/dataset.ts`](../packages/query/src/dataset.ts).
