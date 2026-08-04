# Datamodellen

Feltreferanse for YAML-filene i [`data/`](../data). Skjemaet som håndhever alt dette ligger i
[`packages/schema`](../packages/schema/README.md), og `pnpm validate` er fasiten — står det
noe her som ikke stemmer med skjemaet, er skjemaet riktig.

- [Katalogstruktur](#katalogstruktur)
- [Fellesregler](#fellesregler)
- [Kamp](#kamp)
- [Sesong](#sesong)
- [Klubb](#klubb)
- [Stadion](#stadion)
- [Konkurranse](#konkurranse)
- [Kilde](#kilde)
- [Fra YAML til database](#fra-yaml-til-database)

## Katalogstruktur

```
data/
├── clubs/          <klubb-id>.yaml          AaFK og alle motstandere
├── venues/         <stadion-id>.yaml        Stadion og baner
├── competitions/   <konkurranse-id>.yaml    Serie, cup, europa, trening
├── sources/        <kilde-id>.yaml          Kildekatalog med rettighetsstatus
├── observations/
│   └── rsssf/      <ekstern-id>.yaml        Hva kilden sa, før normalisering
└── seasons/
    └── 2019/
        ├── season.yaml                      Sesongmeta
        └── matches/
            └── 2019-06-19-aalesunds-fk-molde-fk.yaml
```

Tre regler valideringen håndhever på strukturen:

- **Filnavnet er ID-en.** `data/clubs/molde-fk.yaml` må ha `id: molde-fk`, og en kampfil må
  hete `<id>.yaml`.
- **Mappenavnet er sesongen.** En kamp i `seasons/2019/` må ha `competition.season: 2019`, og
  `season.yaml` må ha `year: 2019`.
- **Kamp-ID-en starter med datoen.** `2019-06-19-…` for en kamp 19. juni 2019.

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
| `conflicts[]` utledes av observasjonene med `findConflicts`, ikke skrives for hånd | Svaret kan ikke bli gammelt |

De 1039 kampene som lå i arkivet da laget kom til får ingen observasjon. Råverdiene deres
finnes ikke lenger, og å rekonstruere dem ville vært å finne på hva kilden sa. Observasjoner
skrives fra og med neste innhøsting.

Dette er ikke et fullt råpayload-arkiv. Feltene adapteren leste lagres, ikke hele JSON-svaret
eller HTML-sida. Å speile kildene i sin helhet er et rettighetsspørsmål vi ikke har svart på.

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

## Klubb

`data/clubs/<id>.yaml`

```yaml
id: aalesunds-fk
name: Aalesunds FK
shortName: AaFK
names:
  - { name: Aalesunds Fotballklub, from: null, to: "1927-12-31" }
  - { name: Aalesunds FK, from: "1928-01-01", to: null }
country: NO
city: Ålesund
founded: 1914
aliases:
  fotmob: 8404
  wikidata: Q214992
  rsssf: aalesunds
```

`country` er tobokstavs landkode, standard `NO`. `founded` kan gå tilbake til 1800 — flere
motstandere er eldre enn AaFK.

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
```

`closed` settes bare når banen faktisk er lagt ned. Valgfrie felt utelates — de skal ikke
skrives som `null`.

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

`data/sources/<id>.yaml`

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

## Fra YAML til database

Byggesteget regner ut noen felt som ikke finnes i YAML-en. De er avledet, aldri redigert:

| Kolonne i `matches` | Utledes av |
|---|---|
| `is_home`, `opponent`, `aafk_score`, `opponent_score`, `goal_difference`, `result` | `toAafkPerspective()` — hvilken side AaFK spilte på |
| `after_extra_time`, `decided_on_penalties`, `won_on_penalties` | `extraTime` og `penaltyShootout` |
| `competition`, `opponent`, `venue` (navnene) | `nameAt()` mot `names` og kampdatoen |
| `completeness`, `missing_fields` | Hvor mye av kampen som er fylt ut |
| `has_conflicts` | Om `conflicts` er tom |

Kolonnereferansen for det ferdige datasettet — alle views, alle kolonner, med forbehold —
står på [`/data`](https://aafkstats.vercel.app/data) og i
[`packages/query/src/dataset.ts`](../packages/query/src/dataset.ts).
