# Hva FotMob faktisk kan levere

Kartlagt 3. august og korrigert 9. august 2026 ved å spørre endepunktene direkte. Dette dokumentet svarer på ett
spørsmål: *hvor går grensen for hva arkivet kan hente fra FotMob?* Svaret avgjør hvilke
deler av AaFKs historie som må komme fra en annen kilde, og det er verdt å ha skrevet ned
før noen bruker en dag på å lete etter data som ikke finnes.

## Kort svar

FotMob er en moderne kilde. Den paginerte klubbhistorikken går tilbake til **4. juli 2010**.
Den inneholder serie, cup, europakvalifisering og historiske treningskamper i én tidslinje.
Det gamle ligasesong-endepunktet viste bare deler av dette bildet.

| Kamptype | Periode | Status | Merknad |
|---|---|---|---|
| Serie (Eliteserien / 1. divisjon) | 2011–2026 | ✅ hentet | Kampdetaljer er hentet, men statistikkfeltene varierer med sesong |
| Serie | 2010 | ✅ hentet, delvis | Bare runde 15–30. 16 av 30 kamper, merket i sesongfilen |
| Norgesmesterskapet | 2011–2025 | ✅ hentet | 51 kamper, inkludert 2021/2022 og 2022/2023 |
| Treningskamper | 2011–2026 | 🟡 delvis hentet | Historikk finnes fra 27. januar 2011; sikre kandidater importeres eksplisitt |
| Serie og cup | før 2010 | ❌ finnes ikke | Se «Det stille tilbakefallet» |
| Europacup | 2010–2012 | ✅ hentet | Alle 14 kvalifiseringskampene er importert og kontrollert mot UEFAs kampantall |

Status per 9. august 2026: **574 kamper, 17 sesonger, 2010–2026**, hvorav 542 har
hendelsesdata. Av alle 1 351 kampene i arkivet har 276 de fire grunnfeltene
ballbesittelse, skudd, skudd på mål og cornere. 138 har fouls og offsider, og 105 har xG.

Statistikkdekningen følger ikke kampdekningen. FotMobs kampdetaljer for 2018 og 2019
leverer ingen av de sju feltene. I 2021 har 17 kamper de fire grunnfeltene. I 2024 og
2025 leverer kilden vanligvis de samme fire feltene, men ikke fouls, offsider eller xG.
Kampen AaFK–Stabæk 1. april 2024 er holdt utenfor statistikkutvalget fordi den nåværende
responsen oppgir 32 cornere. Dette er kontrollert mot en ny respons, ikke en gammel cache.

## Det stille tilbakefallet

Dette er den viktigste enkeltobservasjonen, og grunnen til at CLI-en har en vaktpost.

Ber du om en sesong FotMob ikke har, får du **ikke** en feilmelding eller en tom liste. Du
får inneværende sesong, med full HTTP 200 og en payload som ser helt normal ut:

```
leagues?id=59&season=2009  →  svarte 2026 | 240 kamper | AaFK 30
leagues?id=59&season=2005  →  svarte 2026 | 240 kamper | AaFK 30
leagues?id=59&season=2000  →  svarte 2026 | 240 kamper | AaFK 30
```

En innhøster som stoler på at svaret gjelder det den spurte om, ville skrevet 2026-kampene
inn som sesongen 2000 — med riktige lagnavn, riktige resultater og feil årstall. Feilen
ville sett troverdig ut i alle ledd.

Derfor sammenligner adapteren `details.selectedSeason` med den forespurte sesongen og
avviser avviket som en `season`-failure. Det er samme vaktpost som stoppet NM 2021 og 2022:
de sesongene ligger hos FotMob under kryssårsformen `2021/2022`, og på det rene årstallet
faller kilden tilbake til inneværende sesong.

**Løst:** `--season` godtar nå både `2025` og `2021/2022`. Kryssårssesongen sendes videre
til kilden som den er, mens kampene arkiveres under det første årstallet — det er den
utgaven av turneringen de tilhører. NM 2021/2022 og 2022/2023 er hentet.

Treningskampturneringen har samme tilbakefall når den spørres som ligasesong. Løsningen er
ikke å stole på det svaret, men å bruke klubbens avgrensede, paginerte kamphistorikk.
Discovery-kommandoen krever fra-/tildato og har sidetak; den importerer aldri automatisk.

## Europakampene

AaFK har spilt kvalifisering til Europaligaen, men aldri nådd gruppespillet. FotMobs
Europaliga-payload inneholder bare gruppespill (runde 1–6) og utslagsrunder (1/16 og
utover):

```
leagues?id=73&season=2010/2011  →  205 kamper, AaFK 0, runder: 1–6, 1/16…final
leagues?id=73&season=2012/2013  →  205 kamper, AaFK 0, runder: 1–6, 1/16…final
```

Denne konklusjonen var feil fordi undersøkelsen bare fulgte ligaendepunktet. Klubbhistorikken
klassifiserer kampene med stabil turnerings-ID **10613** (`Europa League Qualification`) og
har alle oppgjørene mot Motherwell, Neath Athletic, Ferencváros, Elfsborg, AZ Alkmaar,
KF Tirana og APOEL.

[UEFAs klubbhistorikk](https://www.uefa.com/uefaeuropaleague/history/clubs/82819--aalesund/)
oppgir samme total: 2 kamper i 2010/11, 8 i 2011/12 og 4 i 2012/13. De 14 kampene er nå
importert med FotMob-ID, URL, hentedato og rå observasjon. UEFA brukes som uavhengig kontroll,
mens FotMob er feltkilden.

## Hva som gjenstår å hente herfra

Discovery-rapporten i [`artifacts/fotmob-gap.md`](../../artifacts/fotmob-gap.md) viser både
det som finnes, det som mangler og tvetydige treff. Etter denne innhøstingen gjenstår 19
historiske treningskampkandidater fra 2011–2013. De er bevisst ikke masseimportert før en
uavhengig kilde har bekreftet dem.

Det løpende arbeidet er:

1. **Inneværende sesong** må hentes på nytt etter hvert som den spilles. Per i dag er 15 av
   30 kamper i 2026 ferdigspilt.
2. **NM 2026** når cupen kommer i gang.
3. **Nye treningskamper** gjennom sesongen og kontroll av de 19 historiske kandidatene.

Dette er den eneste delen av innhøstingen som bør gjentas jevnlig. Resten er historikk og
endrer seg ikke.

## Hva som må komme fra andre kilder

Alt før 2010. Det er ikke en mangel ved innhøstingen; det er en egenskap ved kilden.

Hullet er siden fylt et godt stykke av **RSSSF Norway**, som har rene tekstsider tilbake
til 1902 — se [RSSSF-dekningen](RSSSF_DEKNING.md). FotMob er dermed ikke lenger arkivets
eneste kilde, og er det den bør være: den moderne, detaljrike kilden fra 2010 og framover.

For de eldste sesongene og de gjenstående treningskampene står rekkefølgen i
[planen](../PLAN_FRA_PILOT_TIL_ARKIV.md) fortsatt ved lag: NIFS/NTB, NFF, klubbens eget
historiske arkiv og avisarkivene.

Inntil da er [bidragssiden](https://github.com/mlervaag/aafkstats) veien inn for eldre
kamper, og de ferdige AI-promptene der er laget nettopp for den jobben.
