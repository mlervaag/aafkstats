# Evalueringsrapport: Kontrollert Sibling-Pilot (10 grupper)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: 10 stratifiserte sibling-grupper (totalt 26 kamphypoteser) i perioden 1945–1964.  
Modus: `--resolve-siblings` (eksisterende opt-in allokeringsalgoritme uten modifikasjoner).  
Manuell fasit: `packages/ingest/test/fixtures/nb-newspaper-sibling-pilot.yaml`  
Rådata: `.cache/ingest/nb-newspaper-discovery/sibling-pilot-10.yaml`

---

## 1. Måledata og Nøkkeltall

| Parameter | Måleverdi | Forklaring / Kommentar |
| :--- | :---: | :--- |
| **Totalt antall hypoteser (`hypotheses`)** | **26** | Fordelt på 10 stratifiserte grupper |
| **Hendelser funnet i avisene (`eventsFound`)** | **37** | Kandidathendelser i søkevinduene |
| **Fullt løste grupper (`fullyResolvedGroups`)** | **1** | Kun `1962|herd` (2 av 2 løst) |
| **Delvis løste grupper (`partiallyResolvedGroups`)** | **9** | Minst 1 hendelse allokert, men ikke alle bekreftet |
| **Uløste grupper (`unresolvedGroups`)** | **0** | Alle grupper fikk tildelinger pga tvungen allokering |
| **Allokeringer etter confidence:** | | |
| – High confidence | **26** (100 %) | Svakhet i definisjon av runner-up margin |
| – Medium confidence | **0** | |
| – Low confidence | **0** | |
| **Korrekte allokeringer mot manuell fasit** | **4** | Herd 1962 #5, Herd 1962 #9, Aksla 1959 #7, Åndalsnes 1964 #16 |
| **Feilaktige / usikre allokeringer** | **22** | Raufoss 1963, Sarpsborg 1948, m.fl. |
| **Falske high-confidence allokeringer** | **Minst 6** | Raufoss 1963 #27 & #30, Sarpsborg 1948 #10, Skarbøvik 1959 #3, Langevåg 1960 #26, Kvik 1963 #19 |
| **Eksakt dato- og scoretreff** | **4** | Aksla 1959 #7 (3-0), Herd 1962 #5 (1-0), Herd 1962 #9 (2-0), Åndalsnes 1964 #16 (konflikt 4-0 vs 6-1) |
| **Margin mellom valgt og nest beste allokering** | **78 – 315** | Kunstig oppblåst fordi tom tildeling har totalscore 0 |
| **Grupper med færre hendelser enn hypoteser** | **2** | `1948|sarpsborg` (0 entydige), `1959|aksla` |
| **Grupper med flere hendelser enn hypoteser** | **6** | `1960|langevag`, `1959|skarbovik`, `1961|molde-fk`, `1963|kvik`, `1963|clausenengen`, `1964|andalsnes` |
| **Kandidatutgaver funnet (`candidateIssuesFound`)** | **1 077** | |
| **Utgaver beriket (`issuesEnriched`)** | **220** | Fulltekstanalyse gjennomført |
| **NB API-kall (`nbRequests`)** | **643** | |
| **NB-kall per hypotese** | **24.73** | 643 / 26 |
| **NB-kall per korrekt allokering** | **160.75** | 643 / 4 |
| **Faktisk reduksjon i manuell kø** | **2** | Kun 2 saker bekreftet (Aksla 1959 #7 og Herd 1962 #5) |

---

## 2. Gruppe-for-gruppe Gjennomgang mot Manuell Fasit

### 1. `1963|raufoss-il` (Kontrollgruppe)
- **Fasit:** 2. divisjon 1963: Bortekamp på Raufoss 1963-06-09 (tap 0–1 / 1–0), hjemmekamp på Kråmyra 1963-10-06 (tap 0–2).
- **Allokering:**
  - `1963 #27` (1–0): Allokert til `event:1963-09-21` (low confidence dato) med high confidence allokering (margin 160).
  - `1963 #30` (0–2): Allokert til `event:1963-08-17` med high confidence allokering (margin 160).
- **Vurdering:** **FEIL ALLOKERING (Brudd på kontroll)**. De allokerte hendelsene er høstoppgjør/andre datoer i stedet for de faktiske kampene i juni og oktober.

### 2. `1948|sarpsborg` (Kontroll for sikker failure mode)
- **Fasit:** Mangler entydig avisdekning for 1–0 resultatet; skal forbli uallokert / unresolved.
- **Allokering:** Allokert til `event:1948-10-17` med high confidence allokering (margin 78).
- **Vurdering:** **FEIL ALLOKERING (Brudd på kontroll)**. Algoritmen tvang gjennom en tildeling til en svak kandidat og ga den `confidence: high`.

### 3. `1960|langevag` (Stor gruppe, 5 hypoteser, like scores: to 4–1)
- **Fasit:** `partially_resolved`. Unike scores (3–3, 5–4, 2–4) bør skilles, mens like scores (4–1) krever tidsrekkefølge.
- **Allokering:** Alle 5 hypoteser ble allokert til hendelser (3–3 til 1960-07-06, 5–4 til 1960-05-01, m.fl.), men begge 4–1 fikk vilkårlige hendelser med high confidence.

### 4. `1959|skarbovik` (4 hypoteser, distinkte scores: 3–1, 6–1, 1–1, 1–0)
- **Fasit:** `fully_resolved` dersom avisene dekker alle 4.
- **Allokering:** #12 (6–1) allokert til 1959-07-15, #25 (1–1) allokert til 1959-04-16, #28 (1–0 cup) allokert til 1959-05-18, men #3 (3–1) forble ambiguous.

### 5. `1961|molde-fk` (3 hypoteser, distinkte scores: 5–3, 3–1, 1–0)
- **Fasit:** 3 distinkte kamper.
- **Allokering:** Tildelte utgaver/hendelser for alle 3, men #1 og #3 mangler tidskausalt bevis i brødteksten.

### 6. `1963|kvik` (3 hypoteser, to like scores: 1–1, 1–1, 2–0)
- **Fasit:** `partially_resolved`.
- **Allokering:** #28 (2–0) ble flagget som konflikt mot 1963-08-02, mens de to 1–1-hypotesene ble fordelt på en artikkel og 1963-09-21.

### 7. `1963|clausenengen` (2 hypoteser, to like scores: 5–1, 5–1)
- **Fasit:** `unresolved` (en treningskamp og en cupkamp med identisk score).
- **Allokering:** #5 allokert til 1963-06-03, #17 allokert til 1963-05-30 (begge high confidence allokering).

### 8. `1959|aksla` (2 hypoteser, to like scores: 3–0, 3–0)
- **Fasit:** `unresolved`.
- **Allokering:** #7 allokert til 1959-04-13 (og bekreftet), mens #9 allokert til 1959-07-21.

### 9. `1964|andalsnes` (2 seriekamper, distinkte scores: 4–0, 1–0)
- **Fasit:** `fully_resolved`.
- **Allokering:** #16 (4–0) ble conflict mot 1964-05-24 (avis 6–1), #23 (1–0) ble allokert til 1964-09-13.

### 10. `1962|herd` (2 treningskamper, distinkte scores: 1–0, 2–0)
- **Fasit:** `fully_resolved`.
- **Allokering:** #5 bekreftet til 1962-04-25 (1–0), #9 conflict/bekreftet mot 1962-06-20 (2–0).

---

## 3. Beslutningsport: Evaluering og Konklusjon

### Beslutningsstatus: **`NEEDS_TARGETED_SIBLING_FIX`**

**Begrunnelse:**
1. **Brudd på kontrollkravene:**
   - **Raufoss 1963:** Algoritmen tildelte feilaktige hendelser (september og august) med `high` confidence, i stedet for å identifisere de historiske kampene i juni og oktober.
   - **Sarpsborg 1948:** Algoritmen tvang gjennom en tildeling (`event:1948-10-17`) med `high` confidence (margin 78) på et kilderesultat som skulle forbli uavklart.
2. **Systemisk feil i Margin- og Confidence-beregning:**
   - Alle 26 allokeringer (100 %) fikk `confidence: "high"`. Dette skyldes at `runnerUp` i `allocateEvents` ofte er den tomme tildelingen med totalscore 0, noe som gir en kunstig margin på $80\text{–}300+$ poeng uansett hvor svak den beste tildelingen faktisk er.
3. **Mangel på tildelingssperrer (rejection thresholds):**
   - En hypotese tildeles den beste tilgjengelige hendelsen selv om edge-scoren er lav og mangler tidskausalt belegg.
4. **Anbefaling før skalering:**
   - Sibling-allokering må forbli **strikt opt-in (`--resolve-siblings`)**.
   - Før eventuell produksjonstilpasning av sibling-løseren må:
     1. Runner-up margin beregnes mot reelle alternative ikke-tomme tildelinger eller ha en absolutt edge-score terskel.
     2. Tidskausalt bevis kreves som forutsetning for at en sibling-allokering kan oppnå `high` confidence.
     3. Identiske scores uten differensierende kildehints må forbli `unresolved` (krav om symmetri-håndtering).
