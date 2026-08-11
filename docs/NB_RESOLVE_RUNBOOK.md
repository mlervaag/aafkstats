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

### 5. Kontroll

```bash
pnpm validate
AAFK_DATA_DIR=fixtures/data pnpm validate
pnpm db:build
pnpm typecheck && pnpm lint && pnpm test
AAFK_DATA_DIR=fixtures/data pnpm build && pnpm smoke
```

`--apply` kjører selv `loadArchive` + `crossValidate` etterpå og feiler hvis den
har skrevet noe arkivet ikke godtar.

## Hva som skal etterkontrolleres

Kjøringen er ikke ferdig når den er grønn. Se over dette før PR:

1. **Nye roller.** `git diff data/people` — hver ny rolle har merknaden «Lest
   maskinelt fra publikasjonen, spaltevis». Slå opp sidetallet på nb.no for et
   utvalg og se at tittelen stemmer. Det er her forskyvningen ville dukket opp
   igjen hvis en regel er feil.
2. **Årstallet.** `from` settes fra nærmeste årstall inntil 160 tegn foran
   treffet. Det er en heuristikk. På side 76 gir den 1964 fordi setningen
   nevner «neste årsmøte i 1964» — riktig for det styret, men kontroller den på
   noen roller før du stoler på den i mengde.
3. **Kampkoblinger.** Skal være færre enn før. Blir de flere, er
   rekkefølgekravet i `matchCandidates` gått tapt.

## Det denne kjøringen ikke gjør

- **De to bøkene uten ALTO.** `aalesunds-fotballklub-gjennem-1939-ec28` (119
  sider) og `aalesunds-fotballklubb-35-ar-e-1950-2e6c` (20 sider) har ingen
  ALTO i IIIF-manifestet, og `nb-resolve` hopper over dem. Det er de to
  viktigste bøkene for personhistorien — 1939-boka er kilden bak hele piloten i
  #73 — og de er aldri lest side for side, bare søkt i med 20 faste ord.

  Fulltekstsøket gir mer enn første gjennomgang brukte. Et søk på `formann` mot
  `contentsearch`-endepunktet returnerer treff med kontekst før og etter, og
  koordinater på riktig canvas:

  ```
  «...med Georg Haller som dens første [[formann.]] Georg Haller var straks klar over...»
  ```

  Det er rolle og navn ferdig koblet. Neste steg for de to bøkene er å søke med
  personnavnene fra registeret i tillegg til rolleordene, og kjøre `before`/
  `after` gjennom den samme `resolveRoles` som ALTO-teksten. Ikke bygget ennå.

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
