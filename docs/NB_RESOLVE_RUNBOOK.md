# Runbook: full NB-kjøring med korreksjon og resolve

Denne beskriver én kjøring fra ende til annen: rett opp koblingene fra første
masseuttrekk, les publikasjonene på nytt med spaltene i behold, og løft det som
er sikkert inn i personregisteret.

Den er skrevet for å kunne kjøres av noen som ikke var med på å lage den.

## Hvorfor det trengs en andre gjennomgang

`nb-extract` leste ALTO som en strøm av `<TextLine>` og vurderte hver linje for
seg. På en fler-spaltet boksside er den linja ikke en setning: den er to
spalter limt sammen. Side 76 i 50-årsboka gir

```
OCR-linje:  «En mente det var et sterkt behov mann, Einar Helseth, sekretær, Carl»
             └── venstre spalte ──────────────┘ └── høyre spalte ─────────────┘
```

Leses høyre spalte for seg, står det `Formann, Øivind Haagensen, nestformann,
Einar Helseth, sekretær, Carl Gaaseide, kasserer, Elias Roald, styremedlem,
Jørgen Hollevik.` Kandidatlaget fra første gjennomgang sier `sekretær: Einar
Helseth`. Siden sier nestformann. Feilen er systematisk, ikke tilfeldig: navnet
følger etter rolleordet, så hvert verv forskyves ett hakk når spaltene blandes.

Det samme gjelder resultatene. `matchCandidates` godtok et speilvendt siffer som
«entydig treff», og ni kampfiler fikk en kildehenvisning for et resultat kilden
skriver motsatt vei — blant dem 2013-09-13 mot Molde, der målhendelsene i samme
fil viser 1-3 mens boka har 3-1.

## Rekkefølge

Stegene er avhengige av hverandre. Kjør dem i denne rekkefølgen.

### 0. Forutsetninger

- `pnpm install`
- `pnpm validate` skal være grønn før du begynner. Er den ikke det, stopper
  alle CLI-ene selv.
- **`.cache/nb-extract` bør ligge på maskinen.** Den er ~555 MB med 3 201
  ALTO-filer og er ignorert av Git. Finnes den, går hele kjøringen uten et
  eneste nettkall. Finnes den ikke, hentes sidene på nytt fra NB — regn omtrent
  et kvarter med standard pause på 250 ms.

### 1. Vent på #78

`nb-resolve --apply` løfter bare roller som peker på en person arkivet alt har.
Publikasjonene handler om folk fra klubbens første femti år, og de finnes stort
sett ikke i registeret ennå — det er fylt av spillere fra Wikipedias stallmal.

Målt på 50-årsboka alene: av 30 navn resolveren finner, finnes **0** i main i
dag og **7** etter at #78 (aafk.no-høstingen, 226 personfiler) er merget. Kjører
du før #78, blir utbyttet omtrent null, og du må kjøre om igjen etterpå.

### 2. Første gjennomgang på nytt, med den rettede koblingsregelen

```bash
pnpm --filter @aafkstats/ingest nb-extract --write --apply
```

Regelen krever nå samme rekkefølge på sifrene. De ni feilkoblingene er allerede
fjernet fra kampfilene i denne PR-en; denne kjøringen skriver kandidatlaget på
nytt slik at `matchIds` stemmer med regelen.

Forventet: 98 publikasjoner, 3 211 ALTO-sider, 0 sidefeil. Antall kampfiler som
kobles skal nå være **lavere** enn 84 — det er poenget.

### 3. Andre gjennomgang

De 96 publikasjonene med ALTO leses spaltevis. De to uten ALTO —
jubileumsskriftet fra 1939 og 35-årsboka fra 1950 — leses gjennom
fulltekstsøket i stedet, med rolleordene *og* alle navn i personregisteret som
søkeord. Det skjer automatisk; `--no-names` slår av navnesøkene hvis du bare vil
ha rolleordene.

```bash
# Se hva den finner uten å skrive noe
pnpm --filter @aafkstats/ingest nb-resolve

# Skriv resolusjonene inn i data/extractions/*.yaml
pnpm --filter @aafkstats/ingest nb-resolve --write
```

Uten `--all-pages` leses bare sider kandidatlaget alt har markert — 1 720 av
3 211. Resten inneholder pr. definisjon ingen rolleord.

Valg:

| Flagg | Virkning |
|---|---|
| `--source <id>` | bare én publikasjon |
| `--all-pages` | les alle sider, ikke bare arbeidskøen |
| `--refresh` | hent på nytt fra NB selv om cachen har sida |
| `--delay <ms>` | pause foran hver nettforespørsel, standard 250 |
| `--no-names` | søk bare på rolleord i bøkene uten ALTO, ikke på personnavn |
| `--write` | skriv `resolvedRoles` i uttrekksfilene |
| `--apply` | krever `--write`; løfter de sikre rollene inn i personfilene |

Kjøringen rapporterer `fraCache` og `fraNett`. Er `fraNett` høyt og du trodde du
hadde cachen, peker `.cache/nb-extract` et annet sted enn du tror.

### 4. Løft det som er sikkert

```bash
pnpm --filter @aafkstats/ingest nb-resolve --write --apply
```

`--apply` slipper gjennom **bare** roller som er `high`, har et årstall, og
peker på en person som finnes fra før. Alt annet blir liggende i
`resolvedRoles`, søkbart, med sin egen confidence.

Finnes vervet på personen fra før — fra piloten, fra aafk.no, eller fra en
tidligere kjøring — legges publikasjonen til som **kilde på den rollen**. Det
blir ikke en rolle nummer to. Det er den regelen som gjør at kjøringen kan
gjentas uten å gro duplikater.

### 5. Omtalene

```bash
pnpm --filter @aafkstats/ingest nb-mentions --write
```

Fører hver publikasjon som omtaler en person som kilde på personen. OCR-støy
kan ikke skape et nytt faktum her: en `person_mention` med høy sikkerhet bærer
en `personId` som alt er slått opp mot registeret, så enten kjente vi navnet fra
før, eller så ble det ingen kobling.

Men et navnetreff skiller ikke to personer som heter det samme. Arne Hansen
spilte i 1986; medlemsbladene fra 1961 til 1976 omtaler en annen Arne Hansen.
Uten en prøve på tid ble alle seksten ført på ham, og en tredjedel av
koblingene i første forsøk var slike. Derfor forkastes en publikasjon som er
mer enn fem år eldre enn det tidligste året arkivet kjenner personen fra.
Prøven er ensidig: en jubileumsbok fra 2013 omtaler selvsagt spillere fra
1920-tallet, og skal få lov.

Kjøringen rapporterer hvor mange den forkastet. Er det tallet null, er noe galt
— navnekollisjoner finnes i dette materialet.

Kjøringen leser bare `data/extractions/` — den trenger verken cache eller nett,
og er uavhengig av resolve.

Omtalene aggregeres til én henvisning per publikasjon, med den første siden
personen står på. Lauritz Giske er nevnt på 283 sider; én henvisning per side
ville gjort personfila ulesbar uten å si mer enn at bladene skrev om ham.

### 6. Kontroll

```bash
pnpm validate
AAFK_DATA_DIR=fixtures/data pnpm validate
pnpm db:build
pnpm typecheck && pnpm lint && pnpm test
AAFK_DATA_DIR=fixtures/data pnpm build && pnpm smoke
```

`--apply` kjører selv `loadArchive` + `crossValidate` etterpå og feiler hvis den
har skrevet noe arkivet ikke godtar.

## Vaktene i `--apply`

Tre ting stoppes fordi de ville gjort arkivet selvmotsigende. Alle telles som
`selvmotsigende` i rapporten, ingen forsvinner stille:

1. **To personer i samme klubbverv samme år.** Kjøringen fant to formenn i 1948
   og to i 1968. Begge kan ikke stemme, og maskinen kan ikke avgjøre hvem — så
   ingen av dem skrives. Gjelder bare verv uten `body`: to gruppeformenn samme
   år er helt normalt.
2. **Et mindre presist verv oppå et mer presist.** «Formann» ved siden av
   «Formann i banekomiteen» samme år er nesten alltid den samme opplysningen,
   lest uten leddet som forklarer den.
3. **Samme verv med to navn.** «Styreleder» og «Formann» er ett verv. Uten det
   sto Arnstein Johansen med begge for 1998.

## Hva som skal etterkontrolleres

Kjøringen er ikke ferdig når den er grønn. Se over dette før PR:

1. **Nye roller.** `git diff data/people` — hver ny rolle har merknaden «Lest
   maskinelt fra publikasjonen, spaltevis». Slå opp sidetallet på nb.no for et
   utvalg og se at tittelen stemmer. Det er her forskyvningen ville dukket opp
   igjen hvis en regel er feil.
2. **Årstallet.** For setningsregelen tas året som følger rett etter vervet —
   «ble valgt til sekretær i 1915» — og bare når ingen følger, letes det inntil
   160 tegn bakover. Retningen er ikke en detalj: med bare baklengs søk ga
   «spilte som aktiv fra 1914 til 1919. Nils Jangaard ble valgt til sekretær i
   1915» ham vervet i 1919, fire år feil. Det bakoverskuende fallet er fortsatt
   en heuristikk. På side 76 gir den 1964 fordi setningen
   nevner «neste årsmøte i 1964» — riktig for det styret, men kontroller den på
   noen roller før du stoler på den i mengde.
3. **Kjør kontrollene i `scripts/`-avsnittet under.** Tre ganger har feil blitt
   funnet av en kontroll mot data som alt var skrevet — speilvendte siffer,
   anakronismer, «A A A A» i en oppstilling — og ingen av dem av resolveren
   eller testene. Kontrollene er billige og fanger klassen av feil som overlever
   enhetstester.
4. **Kampkoblinger.** Skal være færre enn før. Blir de flere, er
   rekkefølgekravet i `matchCandidates` gått tapt.
4. **Sidetallet i de to søkbare bøkene.** Fulltekstsøket oppgir skann-nummeret,
   ikke det trykte sidetallet, og de to spriker med fire i 1939-boka. Kjøringen
   oversetter gjennom manifestets `label`, men kontroller et par henvisninger
   mot nb.no: formannsrekka skal ligge på trykt side 18.

## Bøkene uten ALTO

`aalesunds-fotballklub-gjennem-1939-ec28` (119 sider) og
`aalesunds-fotballklubb-35-ar-e-1950-2e6c` (20 sider) har ingen ALTO i
IIIF-manifestet. De kan ikke leses side for side, men fulltekstsøket gir treff
med teksten før og etter, og de vinduene overlapper hverandre når flere søkeord
treffer i samme avsnitt. Satt sammen på overlappet gjenoppstår avsnittet, og
formannsrekka på trykt side 18 kan leses hel:

```
Formenn: Sverre Mogstad 1925 og 1926 Rolf Mittet 1927 Georg Haller 1914 og 1915 …
```

Det er den lista piloten i #73 leste for hånd. Maskinen gjenskaper elleve av
vervene piloten førte, og finner sytten til.

To fallgruver er innebygd i behandlingen, og begge er verdt å kjenne igjen hvis
noe skal endres:

- **Vinduer skal ikke slås sammen per side, bare på faktisk overlapp.** Side 18
  har «Formenn:» og «Opmenn:» rett etter hverandre. Limes alle vinduene på siden
  sammen, havner hvert navn innenfor rekkevidde av begge overskriftene, og
  halvparten av rollene blir dubletter med feil tittel.
- **En rekke slutter ved neste overskrift.** Ikke etter et fast antall tegn.

## Lagoppstillinger

`nb-resolve` skriver også `resolvedLineups`: navnene i en oppregning etter
«laget bestod av», «seierslaget bestod av» og lignende, slått opp mot
registeret.

De **løftes ikke inn**, og det er ikke forsiktighet — det er at de ikke kan.
En oppstilling må høre til en kamp for å bety noe, og det står nesten aldri på
samme sted: «Seierslaget bestod fra mål til ytre venstre av: …» sier hvem som
spilte, men ikke mot hvem eller når. Å gjette kampen ut fra nærmeste årstall
ville knyttet elleve navn til feil kamp, og en feil oppstilling er verre enn
ingen, fordi den ser like riktig ut som en rett.

`season` settes når et årstall står nær. Det er en pekepinn for den som skal
finne kampen, ikke en påstand om når laget spilte.

Dette er samtidig det ene stedet materialet kan gi arkivet noe *nytt*.
Oppstillinger fra mellomkrigstiden finnes ikke fra noen annen kilde — hverken
RSSSF eller FotMob rekker dit.

## Verv som ikke er klubbens

Publikasjonene omtaler også verv i andre organisasjoner og i klubbens egne
underutvalg: «Som formann i «Frigg»», «formann i Sunnmøre Fotballkrets»,
«formann i banekomiteen». Setningsregelen hopper over et verv der rolleordet
følges av «i» eller «for» og noe annet enn et årstall, nettopp for at slike ikke
skal bli formannsverv i AaFK.

Organet står ofte i en annen spalte enn vervet. Side 76 i 50-årsboka innleder
stykket om *Eldres gruppe* i venstre spalte og lister styret deres i høyre, så
`body` letes både i spalten og i sidas helhet.

Kan siden ikke tilordne organet — den nevner flere, som side 76 gjør med både
Eldres gruppe og Arbeidsutvalget — settes ingen `body`, og rollen **senkes fra
`high` til `medium`**. Da kan den ikke løftes automatisk. Et verv siden ikke
plasserer, er ikke et verv vi kan si var klubbens.

## Det denne kjøringen ikke gjør

- **Lagoppstillinger og sesongfakta.** Kandidatlaget har 108 og 74 av dem.
  Resolveren tar bare roller.

- **Nye personer.** Ingen personfil opprettes. 616 av navnene i kandidatlaget
  finnes ikke i registeret, og 16 % av dem er OCR-fragmenter som «AAFK-lag.
  Klubbens». Skal de inn, må navnene kontrolleres først.

## Rettigheter

Uendret fra første gjennomgang, og grensen går samme sted:

- Rå ALTO, OCR-tekst og søkefragmenter ligger **bare** i `.cache/nb-extract`,
  som er ignorert av Git.
- Det som committes er navn, tittel, årstall, sidetall, ID-er og innholdshasher.
  `resolvedRoles` inneholder aldri løpende tekst fra publikasjonen.
- Vercel Blob er offentlig og skal ikke brukes til rettighetsbelagt råtekst.
