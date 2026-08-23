# Medlemsbladene: hva vi har lært om innhøstingsmetode, og hva som står igjen

**Dato:** 23. august 2026
**Forholdet til runbooken:** Dette dokumentet erstatter ingenting i
[`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](../HISTORISK_KILDEINNHOSTING_RUNBOOK.md).
Det måler hvor godt runbooken faktisk er fulgt i medlemsbladbatchene, og hva det
betyr for rekkefølgen videre.

## 1. Kort svar på metodespørsmålet

Ja — flere pass. Men den viktigste lærdommen er at «finn potensielle sider
først, verifiser etterpå» er riktig for **ett** av de to løpene og eksplisitt feil
for det andre.

| | Maskinløypa (discovery) | Innhøstingsløypa (publikasjon) |
|---|---|---|
| Korpus | Hele NBs avissamling — kan ikke leses i sin helhet | Én publikasjon med kjent sideantall |
| Metode | Kandidat først, verifiser etterpå | **Alle sider leses**, kandidatlista er bare arbeidskø |
| Verktøy | `nb-extract`, `nb-resolve`, `nb-mentions` | 21-trinns arbeidsflyt, faksimile |
| Målt utbytte | 21 kanoniske kamper av 109 kontrollerte (19 %) | Se seksjon 4 |
| Typisk feil | — | *«Å bare se på sider som har maskinelle kandidater»* (steg 3) |

Medlemsbladene hører til høyre kolonne. Der er kandidat-først ikke en metode, det
er en feilmodus runbooken navngir.

## 2. Kildehierarkiet er allerede avgjort

```
Faksimile (visuelt kontrollert originaltrykk)
  > Korrekt manuelt lest tekst
    > Maskinell OCR / ALTO-tekst
      > Adapter- eller resolver-tolkning
```

OCR er søkehjelpemiddel, kandidatgenerator og navigasjonsverktøy — aldri
arkivinnhold. Rå ALTO ligger i `.cache/nb-extract` utenfor Git.

## 3. De ti feilmodiene som er betalt for

Runbookens Lessons Ledger og NB-runbooken dokumenterer feil som allerede har
kostet arbeid. De er verdt å lese som en liste over hva som *vil* skje igjen.

**Fra maskinløypa:**

1. **Spaltesammenblanding.** `nb-extract` leste ALTO som en strøm av `<TextLine>`.
   På en flerspaltet side er linja to spalter limt sammen, og navnet følger etter
   rolleordet — så hvert verv forskyves ett hakk. Feilen er systematisk, ikke
   tilfeldig. Andre gjennomgang (`nb-resolve`) leser spaltevis. **Spalteposisjon
   må bevares.**
2. **Speilvendt score godtatt som entydig.** 9 av 84 automatiske koblinger fikk
   kildehenvisning for et resultat kilden skriver motsatt vei. Blant de 75 som
   sto igjen er 17 uavgjorte, der speilvending er usynlig per definisjon.
   **Rekkefølge, ikke sifferpar.**
3. **Navnekollisjon uten tidsprøve.** En tredjedel av de første
   personkoblingene førte medlemsblad fra 1961–1976 på en Arne Hansen som spilte
   i 1986. Prøven er nå ensidig: forkast en publikasjon mer enn fem år eldre enn
   det tidligste året arkivet kjenner personen fra, men la senere jubileumsbøker
   omtale 1920-tallet. **Rapporterer kjøringen null forkastede, er noe galt.**
4. **Kandidatlaget er tynnere enn det ser ut.** Av 4 814 kandidater er 1 628 bare
   et nøkkelord og et sidetall, 655 er et bart siffer uten år eller motstander,
   og 58 av 1 200 personroller har årstallet `personRole.from` krever.

**Fra innhøstingsløypa:**

5. **Terminliste er planlagt oppsett, ikke spilledato** (PR #153). Ni sjekkpunkter
   i runbookens kapittel 8 må passere før en terminlistedato kanoniseres.
6. **Overskriving slettet personhistorikk** (PR #155). Derfor streng
   additivitetsgaranti, manuell preservation audit og obligatoriske
   regresjonstester.
7. **Valg sent på året gjelder neste arbeidsår** (PR #156). Årsmøtene lå i
   november–desember; `role.from` settes til påfølgende sesong.
8. **Reprint ser ut som uavhengig bekreftelse** (PR #156). Merkes
   `duplicate_publication` / `reprint`.
9. **Årskontekst-lekkasje ved spalteskift** (PR #205). 54 kildepåstander i
   50-årslista lå under feil sesong. `activeYearHeading` må føres eksplisitt, og
   grensekontroll ved hvert skifte er obligatorisk.
10. **Én gjennomgått sourceId er ikke hele årgangen.** Fra 1966 er årgangene
    katalogisert hefte for hefte med fire eller flere `sourceId`-er per år.
    Source Inventory før review er obligatorisk. Og **skann-nummer er ikke trykt
    sidetall** — 1965 starter pagineringen på nytt i hvert hefte.

## 4. Målingen som avgjør rekkefølgen

Runbookens steg 5 (fixture/program pass) og steg 6 (result ↔ fixture
reconciliation) er de eneste passene i hele løypa som produserer *dato* fra
klubbens eget materiale. Batchmanifestene viser hvilke batcher som faktisk kjørte
dem:

| Batch | Status | `fixture_reconciliation` | Påstander | Med dato |
|---|---|---:|---:|---:|
| `medlemsblad-1950` | `complete` | 6 funn | 21 | 7 |
| `medlemsblad-1951` | `complete` | 5 funn | 13 | 8 |
| `medlemsblad-1962` | `audited` | *passet mangler i manifestet* | 34 | 14 |
| `medlemsblad-1953-1956` | `audited` | **0 funn** | 37 | 2 |
| `medlemsblad-1957-1960` | `audited` | **0 funn** | 85 | 2 |
| `medlemsblad-1961` | `audited` | **0 funn** | 15 | 3 |

Sammenstilt:

- Batcher der fixture-passet ga funn: **29 av 68 påstander har dato (43 %)**
- Batcher med null fixture-funn: **4 av 122 påstander har dato (3 %)**

Samme publikasjonsserie, samme type innhold, fjorten ganger så høy datorate. Den
eneste forskjellen er om steg 5 og 6 ble kjørt.

Uttrekkslaget bekrefter at materialet var der hele tiden: 1957–1960 har 164
terminliste-signaler, og 1959 alene har 39 fordelt på 20 sider. Innhøstingen
brukte side 60.

### Hvorfor det gikk slik

Runbooken ble skrevet **etter** disse batchene. Lessons Ledger fører opphavet til
PR #151–#156, og manifestene for 1953–1962 er merket «rekonstruert manifest» —
de er retrofittet på arbeid som allerede var gjort, ikke resultat av en kjøring
gjennom løypa. 1962-manifestet viser `facsimile_review: pending, 0/84` samtidig
som 1962 er det beste året i arkivet før 1982. Det er ikke en selvmotsigelse: det
er et manifest som beskriver en annen prosess enn den som faktisk ble brukt.

Konsekvensen er at **`audited` ikke betyr ferdig**. Det betyr revidert manifest.

## 5. Tre tilstander, ikke to

Medlemsbladene er ikke delt i «innhøstet» og «uinnhøstet». De er delt i tre, og
de tre krever ulikt arbeid:

| Tilstand | Årganger | Hva som gjenstår |
|---|---|---|
| **A. Kjørt gjennom løypa** | 1950, 1951 | Ingenting akutt |
| **B. Innhøstet før løypa fantes** | 1953–1962, 1965 | Steg 5 + 6 mot eksisterende faksimile. Sidene er lest; passene mangler |
| **C. Aldri innhøstet** | 1952, 1963, 1964, 1966–1980 | Full 21-trinns kjøring |

Tilstand B er billigst per kamp: kildepåstandene finnes allerede med
sidehenvisning, og jobben er å hente terminlisten fra en annen side i samme
årgang og avstemme etter de ni sjekkpunktene. Ingen ny kilde, ingen ny
faksimilelesing av hele årgangen.

## 6. Anbefalt pilot: 1959

| Kriterium | 1959 |
|---|---|
| Antall `sourceId` | 1 — ingen Source Inventory-kompleksitet |
| Sider | 84 |
| Terminliste-signaler | 39, fordelt på 20 sider |
| Lagoppstillingssignaler | 9 — flest av terminlisteårene |
| Kildepåstander i dag | 29 |
| Med dato i dag | 1 |
| Kanoniske kamper i dag | 1 |

1959 er valgt fordi delta blir utvetydig. Årgangen har allerede 29 registrerte
kildepåstander uten dato og 39 ubrukte terminliste-signaler i samme bind. Går
piloten som 1962 gikk, skal de fleste av de 29 få eksakt dato.

**Beslutningsport:** treffrate og tidsbruk per kamp måles på 1959 og avgjør om
1953–1958 og 1960 kjøres på samme måte.

De 9 lagoppstillingssignalene er en egen grunn til å velge 1959: 1949–1981 har i
dag fem kamper med lagoppstilling til sammen. En eneste trykt oppstilling fra
1959 er en større relativ forbedring av personlaget enn noe annet enkeltfunn i
den perioden.

## 7. Personlaget: hvor det stopper akkurat nå

Andre gjennomgang er kjørt. Alle 98 uttrekksfiler har `resolvedRoles` — 1 665
roller lest spaltevis. Porten i `--apply` slipper gjennom `high` med årstall og
kjent person:

```
resolvedRoles totalt                 1 665
  slipper gjennom --apply              286   (17 %)
  mangler bare personfil               504
  mangler bare årstall                 229
  mangler både år og personfil         627
```

**504 roller har årstall og er blokkert utelukkende av at personen ikke finnes i
registeret.** Det er den største enkeltblokkeringen i personlaget, og den løses
ikke av bedre OCR — den løses av personfiler. Runbookens regel gjør dette trygt å
gjenta: finnes vervet fra før, legges publikasjonen til som kilde på rollen, ikke
som en rolle nummer to.

Medlemsbladet er dessuten arkivets rikeste personkilde av en grunn som ikke har
med kamper å gjøre: spillemerker for 100/150/200/250 A-kamper, fødselsdagsomtaler
fra pionertiden og minneord med dødsdatoer. Ingen av delene krever at en eneste
kamp dateres.

## 8. Rekkefølge

1. **1959 som pilot** — steg 5 og 6 mot eksisterende faksimile. Måler treffraten.
2. **Resten av tilstand B** dersom piloten holder: 1953–1958, 1960, 1961.
3. **Én årgang fra 1966–1980** som prøve på om samtidige kvartalsblad bærer dato i
   prosa. Uttrekkslaget kan ikke svare på det, fordi kandidatskjemaet ikke
   bevarer prosa.
4. **Personpasset på det som allerede er lest** — de 504 blokkerte rollene og
   omtalene i publikasjoner som er innhøstet for kampresultater alene.

Steg 1 og 4 rører ingen ny kilde og krever ingen ny rettighetsavklaring.
