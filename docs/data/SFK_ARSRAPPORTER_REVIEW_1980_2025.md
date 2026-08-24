# Visuell kontroll av SFK-årsrapportene 1980–2025

Denne rapporten dokumenterer første normaliseringspass for AaFKs senior A-lag i
Sunnmøre Fotballkrets' 46 årsrapporter fra 1980 til 2025. Arbeidet fullfører
førstepasset som tidligere dekket 1952–1979.

OCR og PDF-tekst er brukt som arbeidsindeks. Hver side som ligger til grunn for
strukturerte writes er kontrollert visuelt i original-PDF-en. Rå PDF-er og
OCR-tekst er ikke lagret i git. Reserve-, junior-, aldersbestemte lag, AaFK 2 og
AaFK Fortuna er holdt utenfor herrelagets canonical data.

## Resultat

- 46 av 46 årsrapporter er teknisk analysert og triagert.
- 23 skannede rapporter ble OCR-behandlet: 1980–2001 og 2008.
- OCR-passet dekket 1 593 sider uten feilsider og fant 191 kandidatsider.
- 23 rapporter med brukbart tekstlag ga 275 kandidatsider.
- 128 senior-NM-resultater er lagret som kildepåstander i 41 source-result-filer.
- 109 påstander er entydig koblet til eksisterende canonical kamper; 19 er
  bevart uten `matchId` fordi rapporten ikke gir en sikker canonical kobling.
- De 109 koblede kampene fikk side- og feltproveniens fra årsrapporten.
- 24 sesongfiler og 7 sluttabeller fikk eksplisitt SFK-proveniens.
- Tre kildeførte observasjoner ble lagt til: første Tippeliga-opprykk i 2002,
  åpningen av Color Line Stadion i 2005 og cupseieren i 2009.
- Ingen nye personer eller kamper ble opprettet, og ingen rå OCR-prosa ble lagret.

## Produksjon per periode

| Periode | Rapporter | Metode | Resultatpåstander | Koblet | Uten kampkobling |
|---|---:|---|---:|---:|---:|
| 1980–1990 | 11 | OCR + visuell sidekontroll | 33 | 19 | 14 |
| 1991–2001 | 11 | OCR + visuell sidekontroll | 23 | 22 | 1 |
| 2002–2009 | 8 | PDF-tekst/OCR + visuell sidekontroll | 30 | 29 | 1 |
| 2010–2017 | 8 | PDF-tekst + visuell sidekontroll | 31 | 28 | 3 |
| 2018–2025 | 8 | PDF-tekst + visuell sidekontroll | 11 | 11 | 0 |
| **Totalt** | **46** |  | **128** | **109** | **19** |

År uten en source-result-fil kan likevel ha gitt sesongproveniens eller en
historisk observasjon. Dette gjelder blant annet 2002, 2019 og 2022. I 2018 og
2020 ga standardpasset ingen nye, entydige seniorresultater; treff på AaFK 2,
Fortuna og aldersbestemte lag ble bevisst avvist.

## Kildekritiske avgrensninger

- `scorePerspective: aafk` betyr alltid `[AaFK, motstander]`, også når AaFK står
  som bortelag i den trykte tabellen. En samlet QA avdekket og rettet et
  hjemme/borte-perspektivproblem før ferdigstilling.
- Resultater etter straffesparkkonkurranse er bevart slik rapporten oppgir dem,
  med merknad der canonical kamp skiller ordinær/ekstraomgangsscore fra straffer.
- En kildepåstand får bare `matchId` når år, motstander, kamp, konkurranse og
  resultat gir en entydig eksisterende kamp. Resten står i source-results.
- Sluttplassering og ligastørrelse er bare skrevet når en visuelt kontrollert
  sluttabell eller en eksplisitt sesongoppsummering dokumenterer verdien.
- 2017-rapporten ble skrevet før sesongutfallet var avgjort og er derfor ikke
  brukt til å dokumentere sluttplassering eller nedrykk.
- 2018-tabellen som nevner AaFK gjelder et lavere lag og er ikke brukt som
  A-lagsdata.

## Reproduserbar arbeidsindeks

De committede OCR-rapportene lagrer bare dekning, confidence, temasignaler og
sidepekere:

- `docs/data/SFK_ARSRAPPORTER_OCR_1980_2001.md`
- `docs/data/SFK_ARSRAPPORTER_OCR_2008.md`

Rapportene med tekstlag bruker kandidatindeksen i
`docs/data/SFK_ARSRAPPORTER_KANDIDATER.md`. Detaljert proveniens ligger i de
enkelte source-result-, kamp-, sesong-, tabell- og observasjonsfilene, slik at
reviewrapporten ikke dupliserer kampdata eller beskyttet PDF-tekst.

## Kontrollresultat

Alle 128 nye claim-ID-er er unike og inngår i den globale
source-claim-integritetskontrollen. Koblede påstander er kontrollert mot
canonical hjemme/borte, motstander og AaFK-perspektiv. Arbeidet er additivt med
unntak av eksplisitte rettelser der årsrapportens sluttabell dokumenterte en
tidligere feilklassifisert sesong.
