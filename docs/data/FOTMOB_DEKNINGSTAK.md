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
| Serie (Eliteserien / 1. divisjon) | 2011–2025 | ✅ hentet | 450 kamper, komplette sesonger |
| Norgesmesterskapet | 2011–2025 | ✅ hentet | 44 kamper. 2021 og 2022 mangler, se under |
| Serie | 2010 | ⚠️ delvis | Bare runde 15–30. 16 av 30 kamper |
| Treningskamper | inneværende sesong | ⚠️ kun nåtid | Sesongparameteren ignoreres |
| Serie og cup | før 2010 | ❌ finnes ikke | Se «Den stille tilbakefallet» |
| Europacup | alle år | ❌ finnes ikke | Se «Europakampene» |

## Den stille tilbakefallet

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

**Konsekvens:** NM 2021 og 2022 kan trolig hentes ved å sende `2021/2022` og `2022/2023`
som sesong. CLI-en tar i dag bare heltall, så det krever en liten endring.

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

Fortsatt mulig innenfor FotMobs tak:

1. **Serien 2010**, runde 15–30. Sesongen blir ufullstendig og bør merkes som det, ikke
   presenteres som en hel sesong.
2. **Treningskamper for inneværende sesong**, åtte kamper. Ny kamptype for arkivet.
3. **Inneværende seriesesong**, som må hentes på nytt jevnlig etter hvert som den spilles.
4. **NM 2021 og 2022**, hvis CLI-en får støtte for kryssårssesonger.

## Hva som må komme fra andre kilder

Alt før 2010 — altså 1914 til 2009, som er størstedelen av klubbens historie. Det er ikke
en mangel ved innhøstingen; det er en egenskap ved kilden. Rekkefølgen i
[planen](../PLAN_FRA_PILOT_TIL_ARKIV.md) står ved lag: en kanonisk kampryggrad må bygges
fra NIFS/NTB, NFF, klubbens eget historiske arkiv og avisarkivene, og FotMob forblir en
moderne sekundærkilde.

Inntil da er [bidragssiden](https://github.com/mlervaag/aafkstats) veien inn for eldre
kamper, og de ferdige AI-promptene der er laget nettopp for den jobben.
