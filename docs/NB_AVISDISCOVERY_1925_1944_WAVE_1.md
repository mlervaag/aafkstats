# NB-avisdiscovery for 1925–1944 (Bølge 1)

## 1. Bakgrunn og formål

Denne rapporten dokumenterer den første nye produksjonsbølgen for historisk avisdiscovery mot Nasjonalbiblioteket etter fullført kalibrering og validering i PR #186, #187, #188 og #189.

Beslutningsporten fra PR #189 var **`READY_FOR_NEW_NB_DISCOVERY`**, med følgende ufravikelige premisser:
1. **Beslutningsstøtte, ikke automatisk sannhetsmaskin:** Ingen pipeline-status (`confirmed`, `probable` e.l.) fører direkte til kanoniske data uten manuell/visuell kontroll mot faktisk avisfaksimile.
2. **Høsteagent-rolle:** Oppdraget utføres som historisk innhøsting og validering, uten å endre kildekoden til discovery-motoren i `packages/ingest/src/`.
3. **Målperiode:** 1925–1944 (hvor 1941–1944 var preget av idrettsstreiken med null ordinære A-kamper).

---

## 2. Kilderesultat-inventar for perioden 1925–1944

Før kjøring ble alle eksisterende kildedokumenterte resultater for 1925–1944 inventert og kartlagt på tvers av arkivets kilder.

### 2.1 Kildesammendrag (1925–1944)

| Kilde-ID | Periode | Rader totalt (1925–44) | Allerede koblet | Ukoblede rader | Singletons | Sibling-grupper (rader) |
|---|---|---|---|---|---|---|
| `aalesunds-fotballklub-gjennem-1939-ec28` | 1925–1939 | 298 | 20 | 278 | 91 | 77 grupper (199 rader) |
| `medlemsblad-for-aalesunds-fotb-1965-a2c9` | 1925–1944 | 308 | 18 | 290 | 97 | 80 grupper (205 rader) |
| `1950-083e` (Jubileumsberetning 1950) | 1925–1944 | 6 | 0 | 6 | 6 | 0 grupper (0 rader) |
| `1950-3b73` (Årsmelding 1950) | 1925–1944 | 5 | 0 | 5 | 5 | 0 grupper (0 rader) |
| `1954-192b` (Jubileumsskrift 1954) | 1925–1944 | 12 | 4 | 8 | 8 | 0 grupper (0 rader) |
| `1954-cd1c` (Medlemsblad 1954) | 1925–1944 | 12 | 4 | 8 | 8 | 0 grupper (0 rader) |
| **Sum råoppføringer** | | **641** | **46** | **595** | | |

### 2.2 Unifisert kamphypotese-populasjon (1925–1944)

Når like påstander på tvers av kilder grupperes (etter sesong, motstander, resultat og kontekst):
- **Kamphypoteser totalt:** 363 (317 ukoblede, 46 allerede koblet)
- **Automatiske singleton-hypoteser:** **105 totalt (100 ukoblede)**
- **Sibling-hypoteser i manuell kø:** **258 totalt (217 ukoblede)** fordelt på 100 sibling-grupper (86 ukoblede grupper)

### 2.3 Kvalitet på kildenes metadata
- **Resultater (score):** 99.4 % av oppføringene har eksplisitt målscore.
- **Konkurranse-hint:** Cupkamper er ofte eksplisitt merket «Cupen.» eller «NM», mens kretskamper/treningskamper primært skilles gjennom kildenes kapittelinndeling («Privatkamper», «Seriekamper»).
- **Hjemme/borte-angivelse:** Noen oppføringer angir motstander med bynavn («Gjøa, Kristiania», «Brage, Trondhjem», «Hardy, Bergen»), men eksplisitt kamparena er sjelden oppgitt i tabelloversiktene og må hentes fra avisreferatene.

---

## 3. NB-discovery kjøring (Bølge 1)

Discovery ble kjørt for alle 105 automatiske singletons i perioden 1925–1944 mot Nasjonalbibliotekets avis-API. Sibling-oppføringer ble holdt tilbake i tråd med fastsatt sibling-policy.

### 3.1 Kjøringsstatistikk

| Metrikk | Verdi |
|---|---|
| Hypoteser prosessert | 363 |
| Singletons kjørt mot NB | 105 |
| Sibling-oppføringer sendt til manuell kø | 258 |
| Status `confirmed` | 1 |
| Status `probable` | 32 |
| Status `ambiguous` | 307 (258 siblings + 49 singletons) |
| Status `not_found` | 23 |
| Avisutgaver funnet i søk | 4 334 |
| Utgaver beriket med fulltekst/snippets | 453 |
| NB API HTTP-forespørsler | 1 751 |

---

## 4. Visuell faksimilekontroll & Ground-Truth klassifisering

Alle saker med status `confirmed`, samtlige relevante saker i `probable`-utvalget og utvalgte `ambiguous`-tilfeller ble visuelt kontrollert mot faktiske avissider i Sunnmørsposten via Nasjonalbiblioteket.

### 4.1 Gjennomgang av kontrollerte saker

| Sesong | Sak / Motstander | Kildekrav | NB Discovery Funn | Faksimile-funn (Sunnmørsposten) | Ground-Truth Klassifisering | Utfall |
|---|---|---|---|---|---|---|
| **1929** | #11 Brage | 3–4 tap | `confirmed`<br>Dato: 1929-05-14 (tirsdag)<br>Score: 4–3 | Sunnmørsposten 21.05.1929 s. 3:<br>«Jubileumskampene i pinsen. 'Brage' tok pokalen med seire over Aa.F.K. (4–3) og 'Rollon' (4–1)». Kampen ble spilt 1. pinsedag (søndag 19. mai 1929) på Aksla. | `facsimile_verified_canonicalizable`<br>*(Relasjon/kamp 100 % bekreftet; dato korrigert fra maskinell 14. mai til faktisk 19. mai)* | **Kanonisert** |
| **1925** | #10 Gjøa, Oslo | 4–0 seier | `probable`<br>Ingen dato funnet | Sunnmørsposten 03.06.1925 s. 5:<br>«2nen pinsedag [01.06.1925]. Aales. Fotballklub – Gjøa 4–0». Mål/spillere: Langva, Johannessen, Gåseide, Helseth, Frøysa. Spilt for fullsatte tribuner på Aksla. | `facsimile_verified_canonicalizable` | **Kanonisert** |
| **1927** | #17 Hardy, Bergen | 8–1 seier | `probable`<br>Dato: 1927-08-14 | Sunnmørsposten 22.08.1927 s. 5 (og 19.08.1927 s. 3):<br>«Aalesunds Fotballklub slog Hardy, Bergen 8–1. NM 2. runde søndag 21. august 1927 på Aksla/Nørve». | `facsimile_verified_canonicalizable` | **Kanonisert** |
| **1934** | #14 Brage, Trondheim | 1–1 uavgjort | `probable`<br>Dato: 1934-06-10 | Sunnmørsposten 11.06.1934 s. 3:<br>«Brage–Aalesund 1–1... spilt igår [søndag 10.06.1934] i Trondheim foran 700 tilskuere. Sperre målscorer for AaFK». | `facsimile_verified_canonicalizable` | **Kanonisert** |
| **1935** | #18 Fremad, Lillehammer | 4–1 seier | `probable`<br>Ingen dato funnet | Sunnmørsposten 06.07.1935 s. 5 (og 05.07.1935 s. 3):<br>«I en jevnspilt kamp vant igår [fredag 05.07.1935] Ålesund over Fremad med 4–1 på Nørvebana kl. 20.00». | `facsimile_verified_canonicalizable` | **Kanonisert** |
| **1935** | #25 Brage, Trondheim | 5–3 seier e.e.o. | `probable`<br>Ingen dato i sammendrag | Sunnmørsposten 19.08.1935 s. 5:<br>«Ålesund–Brage 5–3 etter ekstraomganger. NM 3. runde spilt igår [søndag 18.08.1935] på Nørve. Stillingen e.o. 3–3». | `facsimile_verified_canonicalizable` | **Kanonisert** |
| **1928** | #13 Drammens BK | 3–1 seier | `probable`<br>Ingen dato | Sunnmørsposten 25.06.1928 s. 4:<br>«Aalesunds Fotballklub begynte sin tur godt. Slog Drammens Ballklub med 3–1...». Østlandstur, spilt 24.06.1928 på Marienlyst. | `facsimile_verified_enrichable`<br>*(Holdt tilbake i kanonisering inntil Marienlyst/motstander-identitet er fullt etablert)* | Venter på neste bølge |
| **1935** | #17 Hødd | 2–4 | `probable` | Sunnmørsposten 09.09.1935 s. 5:<br>«Pokalkampen i kl. B igår... Ålesund B slo Hødd 4–3». B-kamp i annen divisjon. | `correct_abstention` / `identity_uncertain` | Ikke kanonisert (B-lag) |
| **1935** | #16 Xerxes | 4–4 | `probable` | Sunnmørsposten 29.06.1935 s. 3:<br>Omtale av Xerxes–SIF (4–2) i Stavanger under turnéen. Ikke AaFKs oppgjør. | `correct_abstention` | Ikke kanonisert |
| **1938** | #15 Treff | 3–1 | `probable` | Sunnmørsposten 30.05.1938 s. 8:<br>Resultatbørs med «Treff B slo Farstad 8–0» og separat «Aalesund vant 7–2 mot Smart». | `correct_abstention` | Ikke kanonisert |
| **1939** | #22 Roald | 3–2 | `probable` | Sunnmørsposten 09.10.1939 s. 8:<br>«Nørvekammeratene (Kløna) spilte mot Roald (8–2)». Ikke AaFKs A-lag. | `correct_abstention` | Ikke kanonisert |
| **1936** | #17 Ørsta | 2–1 | `ambiguous` | Sunnmørsposten 13.07.1936 s. 5:<br>«Aalesund–Ørsta 7–1 i C-kamp (old boys)». | `correct_abstention` | Ikke kanonisert |
| **1939** | #24 Lyn, Gjøvik | 0–3 | `ambiguous` | Sunnmørsposten 11.09.1939 s. 7:<br>Resultatbørs med AaFK–CFK 5–1 og Briskebyen–Gjøvik-Lyn 2–3. | `correct_abstention` | Ikke kanonisert |
| **1940** | #4 Spjelkavik | 5–3 | `ambiguous` | Sunnmørsposten 07.10.1940 s. 3:<br>«Sammensatt A-B-lag fra Å.F.K. vant 8–0 over Spjelkavik». Avisen rapporterer 8–0 for A/B-lag, kilden har 5–3. | `genuine_source_conflict` / `correct_abstention` | Ikke kanonisert |

---

## 5. Kanonisering og oppdatering av arkivdata

Følgende 6 nye kamper er visuelt verifisert og kanonisert i arkivet med tilhørende observasjoner og kildekoblinger:

1. **`1925-06-01-aalesunds-fk-sk-gjoa`**: AaFK – Gjøa 4–0 (Treningskamp, 2. pinsedag 1925 i Ålesund).
2. **`1927-08-21-aalesunds-fk-sk-hardy`**: AaFK – Hardy 8–1 (NM 2. runde, 21. august 1927 på Nørve).
3. **`1929-05-19-aalesunds-fk-brage`**: AaFK – Brage 3–4 (Treningskamp / Jubileumsturnering, 1. pinsedag 1929 på Aksla).
4. **`1934-06-10-brage-aalesunds-fk`**: Brage – AaFK 1–1 (Treningskamp, 10. juni 1934 i Trondheim, 700 tilskuere).
5. **`1935-07-05-aalesunds-fk-fremad`**: AaFK – Fremad 4–1 (Treningskamp, 5. juli 1935 på Nørvebana).
6. **`1935-08-18-aalesunds-fk-brage`**: AaFK – Brage 5–3 e.e.o. (NM 3. runde, 18. august 1935 på Nørvebana, 3–3 e.o.).

### Nye klubbentiteter opprettet:
- `sk-gjoa`: Sportsklubben Gjøa (Oslo, stiftet 1914).
- `sk-hardy`: Sportsklubben Hardy (Bergen, stiftet 1915).

### Oppdaterte kilderesultater:
- 12 kilderesultatrader (6 i 1939-boka og 6 i 1965-medlemsbladet) er nå koblet med kanonisk `matchId`.
- Antall ukoblede kildedokumenterte oppføringer er redusert fra **1 582** til **1 570**.
- Antall kanoniske kamper i arkivet er økt fra **1 518** til **1 524**.
- Antall klubber er økt fra **194** til **196**.

---

## 6. Presisjonsmålinger for NB-discovery i produksjon

| Måling | Definisjon | Resultat (Bølge 1) |
|---|---|---|
| **Relation Precision (Confirmed)** | Antall `confirmed` med korrekt kamp + motstander + score / Alle `confirmed` | **100.0 %** (1/1) |
| **Full Precision (Confirmed)** | Antall `confirmed` med korrekt kamp + score + eksakt maskinell dato / Alle `confirmed` | **0.0 %** (0/1)* |
| **Falske positive kanonisert** | Ubekreftede/feilaktige oppføringer sluppet inn i kanoniske data | **0.0 %** (0) |
| **Abstention Precision** | Reell støy / B-kamper / resultatbørser korrekt holdt tilbake som `probable`/`ambiguous` | **100.0 %** |

*\* Merknad om dato-presisjon:* Pipeline identifiserte riktig avisartikkel og riktig kamp/score for 1929 Brage, men ukedagsberegningen trakk fra 7 dager basert på «Tirsdag 21. mai» i avisheaderen fremfor pinsedatoen (19. mai). Dette beviser verdien av agentur-regelen: **Visuell faksimilekontroll må alltid foretas før kanonisering.**

---

## 7. Beslutningsport

### **Beslutning: `CONTINUE_NEW_NB_DISCOVERY`**

**Begrunnelse:**
1. NB-discovery fungerer stabilt og presist som beslutningsstøtte i produksjon for perioden 1925–1944.
2. Filteret for B-lag, resultatbørser og temporale distanser holder støy unna `confirmed`.
3. Prosessen bevarer usikkerhet, fører 0 falske kanoniseringer, og kobler kilderesultater sikkert.
4. Neste trinn kan fortsette med påfølgende singleton-bølger for andre historiske tidsrom (f.eks. 1915–1924 og 1950–1965), samt forberedelse av en dedikert strategi for sibling-grupper.
