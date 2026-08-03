# Hva FotMob faktisk kan levere

Kartlagt 3. august 2026 ved å spørre endepunktene direkte. Dette dokumentet svarer på ett
spørsmål: *hvor går grensen for hva arkivet kan hente fra FotMob?* Svaret avgjør hvilke
deler av AaFKs historie som må komme fra en annen kilde, og det er verdt å ha skrevet ned
før noen bruker en dag på å lete etter data som ikke finnes.

## Kort svar

FotMob er en moderne kilde. Gulvet er **2010**, og 2010 er halvt. Alt før det, og alle
europakampene, må komme et annet sted fra.

| Kamptype | Periode | Status | Merknad |
|---|---|---|---|
| Serie (Eliteserien / 1. divisjon) | 2011–2026 | ✅ hentet | Komplette sesonger med detaljer |
| Serie | 2010 | ✅ hentet, delvis | Bare runde 15–30. 16 av 30 kamper, merket i sesongfilen |
| Norgesmesterskapet | 2011–2025 | ✅ hentet | 51 kamper, inkludert 2021/2022 og 2022/2023 |
| Treningskamper | inneværende sesong | ✅ hentet | 8 kamper. Kun nåtid — se under |
| Serie og cup | før 2010 | ❌ finnes ikke | Se «Det stille tilbakefallet» |
| Europacup | alle år | ❌ finnes ikke | Se «Europakampene» |

Status per 3. august 2026: **555 kamper, 17 sesonger, 2010–2026**, hvorav 523 har
hendelsesdata.

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

Treningskampene har samme problem uten samme løsning: turnering 489 svarer alltid med
inneværende sesong uansett hva man ber om. Derfor kan bare årets treningskamper hentes, og
eldre må komme fra en annen kilde.

## Europakampene

AaFK har spilt kvalifisering til Europaligaen, men aldri nådd gruppespillet. FotMobs
Europaliga-payload inneholder bare gruppespill (runde 1–6) og utslagsrunder (1/16 og
utover):

```
leagues?id=73&season=2010/2011  →  205 kamper, AaFK 0, runder: 1–6, 1/16…final
leagues?id=73&season=2012/2013  →  205 kamper, AaFK 0, runder: 1–6, 1/16…final
```

Kvalifiseringsrundene finnes ikke som egen turnering i `allLeagues` heller. Konklusjonen er
at **FotMob ikke kan levere AaFKs europakamper i det hele tatt** — ikke at vi ikke har lett
godt nok.

[Kildekartet](../research/KILDEKART_OG_INNHENTINGSSTRATEGI.md) oppgir 14 AaFK-kamper i
europacupsammenheng, og peker på UEFA som den offisielle og detaljerte kilden. Det er dit
neste forsøk bør gå. Antallet er lite nok til at manuell registrering med kildehenvisning
er fullt forsvarlig.

## Hva som gjenstår å hente herfra

Alt som lot seg hente innenfor taket, er hentet. Det som står igjen er løpende arbeid:

1. **Inneværende sesong** må hentes på nytt etter hvert som den spilles. Per i dag er 15 av
   30 kamper i 2026 ferdigspilt.
2. **NM 2026** når cupen kommer i gang.
3. **Nye treningskamper** gjennom sesongen.

Dette er den eneste delen av innhøstingen som bør gjentas jevnlig. Resten er historikk og
endrer seg ikke.

## Hva som må komme fra andre kilder

Alt før 2010 — altså 1914 til 2009, som er størstedelen av klubbens historie. Det er ikke
en mangel ved innhøstingen; det er en egenskap ved kilden. Rekkefølgen i
[planen](../PLAN_FRA_PILOT_TIL_ARKIV.md) står ved lag: en kanonisk kampryggrad må bygges
fra NIFS/NTB, NFF, klubbens eget historiske arkiv og avisarkivene, og FotMob forblir en
moderne sekundærkilde.

Inntil da er [bidragssiden](https://github.com/mlervaag/aafkstats) veien inn for eldre
kamper, og de ferdige AI-promptene der er laget nettopp for den jobben.
