# Innhøstings- og reconciliation-metode for AaFK Medlemsblad (1950–1979)

Dette dokumentet fastsetter arkivets standardmetode for innhøsting, strukturering og avstemming av *Medlemsblad for Aalesunds Fotballklubb*. Metoden er etablert og forankret gjennom piloteringen av 1962-årgangen (PR #153) og gjelder for alle årganger i medlemsbladserien.

---

## 1. Hovedprinsipp: Full sidegjennomgang er ikke sluttpunktet

En visuell side-for-side-kontroll av faksimilene er et nødvendig første steg, men en årgang er **ikke ferdig innhøstet** før det er gjennomført et eget avsluttende **Reconciliation Pass**.

Forskjellige sider i samme årgang dokumenterer ofte uavhengige felter for samme kamp:
- **Terminlisten** gir planlagt dato, hjemme/borte, konkurranse og rekkefølge.
- **Resultatlisten/våroppsummeringen** gir bekreftelse på at kampen ble spilt og sluttresultatet.
- **Kampreferater** gir spillested (bane), pause og målscorere.
- **Bildeundertekster og lagoppstillinger** gir spilleridentiteter.
- **Sesongoppsummering og publikumsoversikt** gir tilskuertall og sammenlagte tall.

Målet med reconciliation er å samkjøre disse ufullstendige observasjonene til sikker, dokumentert kampidentitet.

---

## 2. Terminlister er en egen førsteklasses kandidatklasse

Terminlister skal ikke behandles som kampresultater (`match_result`), men som egne strukturerte objekter (`fixture_list`).

Terminlister dokumenterer:
- planlagt dato
- motstander
- hjemme/borte
- konkurranse
- runde / rekkefølge i serien

De dokumenterer normalt **ikke alene** at kampen faktisk ble spilt.

### Proveniensregel

Terminliste og resultat skal holdes separat i kampens feltbaserte proveniens:

```yaml
sources:
  - sourceId: medlemsblad-for-aalesunds-fotb-1962-5664
    page: "27"
    fields:
      - date
      - competition
      - home.clubId
      - away.clubId
    note: "Vårterminlisten (s. 27) oppgir Hødd mot AaFK 6. mai 1962."

  - sourceId: medlemsblad-for-aalesunds-fotb-1962-5664
    page: "48"
    fields:
      - status
      - home.score
      - away.score
    note: "Våroppsummeringen (s. 48) dokumenterer Hødd mot AaFK 0–1."
```

---

## 3. Kriterier for når terminliste + resultat gir kanonisk kamp

Terminlistedato kan brukes som sikker kampdato når koblingen mellom terminlisten og en dokumentert spilt kamp er entydig.

Følgende sjekkpunkter skal kontrolleres:
1. **Samme motstander**
2. **Samme hjemme/borte-fordeling**
3. **Samme sesonghalvdel (vår / høst)**
4. **Samme konkurranse**
5. **Riktig rekkefølge i terminlisten**
6. **Resultatet er dokumentert separat** i samme årgang eller i annen kilde
7. **Ingen annen kamp mot samme motstander kan forveksles**
8. **Ingen kilde dokumenterer flytting, omberamming eller utsettelse**
9. **Ingen ekstern kilde motsier datoen**

Jo flere uavhengige identitetsmarkører som stemmer, desto sikrere er koblingen.

---

## 4. Kildekritisk regel: Terminlistedato er ikke absolutt sannhet

- En terminliste betyr **planlagt kampdato**.
- Hvis et kampreferat, en dagsavis, en NFF-protokoll eller en annen samtidig kilde viser at kampen faktisk ble spilt på en annen dato, er det **den faktiske spilledatoen som skal brukes**.
- Terminlistedatoen kan bevares som en historisk kildepåstand dersom modellen støtter det.
- Kampresultater skal aldri tvinges inn på en terminlistedato dersom kildene viser at kampen ble flyttet.

---

## 5. Sjekkliste for Reconciliation Pass etter hvert år

For hvert medlemsbladår skal reviewloggen inneholde en eksplisitt seksjon for **Reconciliation** med følgende kontroller:

### 1. Terminliste → Resultater
- Finnes det resultater for alle planlagte A-lagskamper?
- Kan dato kobles sikkert til de dokumenterte resultatene?
- Finnes det tegn til utsatte, avlyste eller flyttede kamper?

### 2. Resultater → Terminliste
- Finnes det resultater uten dato som kan kobles til terminlisten?
- Er hjemme/borte-forholdet konsistent mellom listene?

### 3. Resultater → Tabell og sesongoppsummering
- Gir enkeltkampene riktig totalt kampantall for sesongen?
- Stemmer antall seire, uavgjorte og tap (V / U / T)?
- Stemmer summen av scorede og innslupne mål (målforskjell)?
- Stemmer poengsummen i tabellen?

### 4. Kampreferater og artikler → Resultater
- Kan løpende kampreferater, notiser eller bilder tilføre:
  - eksakt dato
  - spillested (stadion / bane)
  - pauseresultat
  - tilskuertall (`attendance`)
  - lagoppstilling (`lineups`)
  - målscorere / hendelser (`events`)
  - ekstraomganger / straffesparkkonkurranse

### 5. Source-results → Kanonisk arkiv
- For hver oppføring i `data/source-results/`:
  - Finnes det allerede en kanonisk kamp i `data/seasons/<år>/matches/`?
  - Kan oppføringen nå kobles (`matchId`)?
  - Kan flere uavhengige kilder sammen gi fullverdig og sikker kampidentitet?

Dette reconciliation-passet utføres som det faste, avsluttende steget i enhver medlemsbladinnhøsting før en årgang anses som ferdigbehandlet.
