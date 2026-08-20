# Evalueringsrapport: Kontrollert Sibling-Pilot (10 grupper)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: 10 stratifiserte sibling-grupper (totalt 26 kamphypoteser) i perioden 1945–1964.  
Modus: `--resolve-siblings` (eksisterende opt-in allokeringsalgoritme uten modifikasjoner).  
Manuell fasit: `packages/ingest/test/fixtures/nb-newspaper-sibling-pilot.yaml`  
Rådata: `.cache/ingest/nb-newspaper-discovery/sibling-pilot-10.yaml`

---

## 1. Nøkkeltall og Målinger

Målingene skiller strengt mellom **hva allokeringsmotoren produserte** (allocator-output) og **hva som faktisk stemmer mot uavhengig historisk fasit** (validert kvalitet).

### A. Allokator-output (Rå oppførsel fra motoren)

| Parameter | Måleverdi | Forklaring |
| :--- | :---: | :--- |
| **Totalt antall hypoteser (`totalHypotheses`)** | **26** | Fordelt på de 10 stratifiserte pilotgruppene |
| **Hypoteser med tildeling (`hypothesesAssigned`)** | **26** (100 %) | Algoritmen tvang gjennom en tildeling for samtlige hypoteser |
| **Hypoteser uten tildeling (`hypothesesUnassigned`)** | **0** (0 %) | Ingen saker ble avvist (mangler avvisningsterskel) |
| **Allokeringer etter tildelt confidence:** | | |
| – High confidence | **26** (100 %) | Samtlige tildelinger ble feilaktig stemplet som high confidence |
| – Medium confidence | **0** | |
| – Low confidence | **0** | |
| **Grupper hvor alle hypoteser fikk tildeling** | **10** (100 %) | |
| **Kandidatutgaver funnet (`candidateIssuesFound`)** | **1 077** | |
| **Utgaver beriket (`issuesEnriched`)** | **220** | |
| **NB API-kall (`nbRequests`)** | **643** | 24.73 API-kall per hypotese |

### B. Validert kvalitet mot manuell fasit

Manuell fasit inneholder 19 avgjorte hypoteser (`exact` eller `unresolved`) og 7 hypoteser merket `unverified` (som krever videre kildegransking og holdes utenfor presisjonsnevneren).

| Parameter | Måleverdi | Forklaring / Sammenligning mot fasit |
| :--- | :---: | :--- |
| **Verifiserte hypoteser i fasit (`verifiedHypotheses`)** | **19** | 12 med fasit `exact`, 7 med fasit `unresolved` |
| **Ikke-avgjorte hypoteser (`unverifiedHypotheses`)** | **7** | Holdes utenfor presisjonsberegningen |
| **Eksakt korrekte allokeringer (`exactCorrectAllocations`)** | **11** | 57.9 % av verifiserte (f.eks. Herd 1962, Åndalsnes 1964, Skarbøvik 1959 #12/#25/#28) |
| **Feilaktige allokeringer (`incorrectAllocations`)** | **8** | 42.1 % av verifiserte (herunder Raufoss 1963, Sarpsborg 1948, Kvik 1963) |
| **Korrekt avviste allokeringer (`correctlyRejectedAllocations`)** | **0** | Svakhet: 0 av 7 saker som skulle vært avvist ble avvist |
| **Falske high-confidence allokeringer** | **8** | Alle de 8 feilallokerte/uavviste fikk likevel `confidence: high` |
| **Allokeringer av uverifiserte hypoteser (`unverifiedAllocations`)** | **7** | |
| **Gruppekvalitet (10 grupper totalt):** | | |
| – Fullt korrekte grupper (`fullyCorrectGroups`) | **4** | `1960|langevag`, `1959|skarbovik`, `1964|andalsnes`, `1962|herd` |
| – Delvis korrekte grupper (`partiallyCorrectGroups`) | **2** | `1963|clausenengen`, `1959|aksla` |
| – Feilede grupper (`failedGroups`) | **3** | `1963|raufoss-il`, `1948|sarpsborg`, `1963|kvik` |
| – Uverifiserte grupper (`unverifiedGroups`) | **1** | `1961|molde-fk` (3 uverifiserte hypoteser) |

### C. Dato- og scoretreff samt kildedivergenser

- **Eksakt dato- OG scoretreff:** **3** saker (Aksla 1959 #7 [3–0], Herd 1962 #5 [1–0], Herd 1962 #9 [2–0]).
- **Eksakt datotreff med kildekonflikt:** **1** sak (Åndalsnes 1964 #16; datert til 1964-05-24, men kilden oppgir 4–0 mens avisen dokumenterer 6–1). Dette er korrekt hendelsesallokering, men en resultatkonflikt.
- **Kategorisering etter arkivstatus (samme definisjon som singleton):**
  - **Confirmed (bekreftet):** **2** (Aksla 1959 #7, Herd 1962 #5). Trygge for automatisk skriving.
  - **Conflict (kildekonflikt):** **3** (Herd 1962 #9, Kvik 1963 #28, Åndalsnes 1964 #16). Korrekt identifisert som avvikende kilder; må behandles som kildekonflikt og ikke blindt overskrive arkivet.
  - **Løste saker samlet (`confirmed` + `conflict`):** **5 av 26** (19.2 %).
  - **Krever fortsatt manuell vurdering (`probable` / `ambiguous`):** **21 av 26** (80.8 %).

---

## 2. Gruppe-for-gruppe Gjennomgang mot Manuell Fasit

### 1. `1963|raufoss-il` (Kontrollgruppe) – **FAILED**
- **Fasit:** 2. divisjon 1963. Bortekamp på Raufoss 1963-06-09 (tap 0–1 / 1–0), hjemmekamp på Kråmyra 1963-10-06 (tap 0–2).
- **Allokering:**
  - `1963 #27` (1–0): Allokert til `event:1963-09-21` (low confidence dato) med high confidence allokering (margin 160).
  - `1963 #30` (0–2): Allokert til `event:1963-08-17` med high confidence allokering (margin 160).
- **Vurdering:** **FEIL ALLOKERING (Brudd på kontroll)**. De tildelte hendelsene er feilaktige høstoppgjør i stedet for de faktiske kampene i juni og oktober.

### 2. `1948|sarpsborg` (Kontroll for sikker failure mode) – **FAILED**
- **Fasit:** Mangler entydig verifisert samtidig avisdekning for 1–0 resultatet; skal forbli uallokert / avvist.
- **Allokering:** Tvangstildelt til `event:1948-10-17` med `confidence: high` (margin 78).
- **Vurdering:** **FEIL ALLOKERING (Brudd på kontroll)**. Algoritmen tvang gjennom en tildeling til en svak kandidat og stemplet den som high confidence.

### 3. `1960|langevag` (5 hypoteser, to like scores: 4–1) – **FULLY CORRECT** (av verifiserte)
- **Fasit:** #3 (3–3, 1960-07-06) og #14 (5–4, 1960-05-01) er verifiserte enkelthendelser. De to 4–1 (#1 og #10) og 2–4 (#26) er `unverified`.
- **Allokering:** Både #3 og #14 traff eksakt korrekt dato.

### 4. `1959|skarbovik` (4 hypoteser, distinkte scores) – **FULLY CORRECT** (av verifiserte)
- **Fasit:** #12 (6–1, 1959-07-15), #25 (1–1, 1959-04-16), #28 (1–0 cup, 1959-05-18) er verifiserte. #3 (3–1) er `unverified`.
- **Allokering:** Samtlige 3 verifiserte hypoteser ble allokert til eksakt riktig dato.

### 5. `1961|molde-fk` (3 hypoteser, trenings- og seriekamper) – **UNVERIFIED**
- **Fasit:** Alle 3 hypoteser holdes som `unverified` i påvente av ytterligere avisgransking.

### 6. `1963|kvik` (3 hypoteser, to like scores: 1–1) – **FAILED**
- **Fasit:** De to 1–1 (#19 og #21) mangler differensierende kildebevis og skal forbli `unresolved`. #28 (2–0) har kildeavvik og skal avvises.
- **Allokering:** Tildelte hendelser og ga samtlige `confidence: high`.

### 7. `1963|clausenengen` (2 hypoteser, to like scores: 5–1) – **PARTIALLY CORRECT**
- **Fasit:** #17 (NM 1. runde, 1963-05-30) er verifisert. #5 (treningskamp 5–1) mangler dato og skal avvises.
- **Allokering:** #17 traff eksakt 1963-05-30. #5 ble tvangstildelt 1963-06-03.

### 8. `1959|aksla` (2 hypoteser, to like scores: 3–0) – **PARTIALLY CORRECT**
- **Fasit:** #7 (1959-04-13) er verifisert. #9 (3–0) mangler differensierende kildehints og skal avvises.
- **Allokering:** #7 traff eksakt 1959-04-13. #9 ble tvangstildelt 1959-07-21.

### 9. `1964|andalsnes` (2 seriekamper, distinkte scores) – **FULLY CORRECT**
- **Fasit:** #16 (1964-05-24, kildekonflikt 4–0 vs 6–1) og #23 (1964-09-13, 1–0) er begge verifiserte.
- **Allokering:** Begge hypoteser ble allokert til eksakt riktig dato.

### 10. `1962|herd` (2 treningskamper, distinkte scores) – **FULLY CORRECT**
- **Fasit:** #5 (1962-04-25, 1–0) og #9 (1962-06-20, 2–0) er begge verifiserte.
- **Allokering:** Begge hypoteser ble allokert til eksakt riktig dato.

---

## 3. Beslutningsport

### Beslutningsstatus: **`NEEDS_TARGETED_SIBLING_FIX`**

**Begrunnelse:**
1. **Raufoss-kontrollen feiler:** Tildelte feil datoer (september og august) med `high` confidence i stedet for å identifisere de historiske kampene i juni og oktober.
2. **Sarpsborg failure-mode-kontrollen feiler:** Tvang gjennom tildeling (`event:1948-10-17`) med `high` confidence på et kilderesultat som skulle forbli uavklart.
3. **Tvungen tildeling mangler rejection threshold:** 0 av 7 hypoteser med fasit `unresolved` ble avvist; alle ble tvunget inn i tildelinger.
4. **Kunstig oppblåst confidence:** 26 av 26 allokeringer (100 %) fikk `confidence: "high"`. Dette skyldes at `runnerUp` i `allocateEvents` ofte er den tomme tildelingen med totalscore 0, noe som gir en kunstig margin på $80\text{–}300+$ poeng.
5. **Over-allokering av identiske scores:** Hypoteser med like scores tildeles vilkårlig uten differensierende bevis.

**Konklusjon:** Sibling-allokering forblir **strikt opt-in (`--resolve-siblings`)**. Default v1-policy med manuell ruting av siblings opprettholdes. Piloten skal **ikke** utvides til 20–30 grupper før en målrettet retting er implementert og validert.

---

## 4. Veikart for Neste PR (Etter at #184 er Merget)

I neste PR (ikke i denne) skal det implementeres en smal og målrettet retting av allokeringsmotoren:

1. **Absolutt minimumsterskel per kant:** En hypotese skal bare kunne kobles til en hendelse dersom kant-scoren oppfyller en streng minimumskvalitet.
2. **Krav om tidskausalt bevis for high confidence:** Ingen allokering kan oppnå `high` confidence uten at den underliggende hendelsen har eksplisitt tidsbevis.
3. **Reell runner-up beregning:** Runner-up margin må beregnes mot reelle alternative ikke-tomme tildelinger, ikke mot 0.
4. **Symmetrihåndtering / sikker avvisning:** Identiske scores uten differensierende dato/kildehints må forbli `unresolved`.
5. **Deterministiske tester:** Etablere tester for Raufoss, Sarpsborg og symmetriske scores.
6. **Re-evaluering:** Kjøre nøyaktig de samme 10 pilotgruppene på nytt og bekrefte at Raufoss og Sarpsborg håndteres trygt, og at det er 0 falske high-confidence allokeringer.
