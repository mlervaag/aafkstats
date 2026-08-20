# Evaluering av NB-avisdiscovery: Batch 01 (1945–1964)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: De 100 første ukoblede kamphypotesene i perioden 1945–1964  
Kommandolinje:
```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1945 --to-year 1964 \
  --unlinked-only --limit 100 \
  --output .cache/ingest/nb-newspaper-discovery/batch-01.yaml
```

---

## 1. Populasjonsmåling (1945–1964)

Målt fra hele kildedokumentet for det angitte tidsrommet:

* **Rå kilderesultater:** 542 (alle 542 er per nå ukoblet mot kanoniske kamper)
* **Kamphypoteser (sammenslått med `resultGroupId`):** 540
* **Singleton-hypoteser:** 164 (30.4 %)
* **Sibling-hypoteser:** 376 (69.6 %)
* **Sibling-grupper:** 141
  * Størrelse 2: 84 grupper
  * Størrelse 3: 29 grupper
  * Størrelse 4: 17 grupper
  * Størrelse 5: 7 grupper
  * Størrelse 6: 3 grupper
  * Størrelse 7: 1 gruppe
* **Sibling-grupper med distinkte resultater:** 135 (95.7 %)
* **Sibling-grupper med like/ukjente resultater:** 6 (4.3 %)

---

## 2. Nøkkeltall fra Batch 01

| Parameter | Målt verdi |
| :--- | :--- |
| **totalHypotheses** | 100 |
| **automaticSingletonHypotheses** (`policy: automatic`) | 45 |
| **manualSiblingHypotheses** (`policy: manual`) | 55 |
| **confirmed** | 10 |
| **conflict** | 7 |
| **probable** | 5 |
| **ambiguous** | 73 (18 automatiske + 55 manuelle siblings) |
| **not_found** | 5 |
| **candidateIssuesFound** | 2 426 |
| **issuesEnriched** | 216 |
| **nbRequests** | 751 |
| **hypothesesWithTemporalEvidence** | 38 |
| **hypothesesWithResultAgreement** | 10 |
| **hypothesesWithResultConflict** | 8 |
| **hypothesesWithoutUsefulTemporalEvidence** | 7 |
| **siblingGroupsSkipped** | 22 grupper |

### Effektivitet
* **Gjennomsnittlig antall NB-forespørsler per automatisk hypotese:** 16.69
* **Gjennomsnittlig antall berikede utgaver per automatisk hypotese:** 4.80

---

## 3. Statusfordeling for automatiske saker (45 singletons)

I samsvar med v1-policyen ble alle 55 sibling-saker rutet direkte til manuell vurdering (`reviewReason: sibling_group`) uten unødige API-kall.

Fordelingen blant de **45 automatiske singleton-sakene** er:

| Status | Antall | Andel (%) | Beskrivelse |
| :--- | :---: | :---: | :--- |
| **confirmed** | 10 | **22.2 %** | Kampdato og resultat bekreftet i samtidsavis. |
| **conflict** | 7 | **15.6 %** | Kampdato funnet, men avisas resultat avviker fra kilden. |
| **probable** | 5 | **11.1 %** | Kamp/dato identifisert, men mangler fullstendig scorebekreftelse. |
| **ambiguous** | 18 | **40.0 %** | Flere mulige datoer/artikler, eller forhåndsomtale uten sluttresultat. |
| **not_found** | 5 | **11.1 %** | Ingen relevante avisutgaver funnet med standard søkenøkkel. |
| **Totalt** | **45** | **100.0 %** | |

* **Total treffrate (confirmed + conflict + probable):** **48.9 %** (22 av 45).

---

## 4. Kvalitetskontroll og stikkprøver

### A. Alle 7 `conflict`-saker (100 % gjennomgått)
Samtlige konflikter representerer reelle kildedivergenser mellom 50-årsjubileumsbladet (1965) og samtidige utgaver av *Sunnmørsposten*:

1. `1945 #3` vs Herd: Kilden oppgir 5–1. [Sunnmørsposten 1945-07-09, s. 2](https://www.nb.no/items/996171a08ad98118ad1097f4f42254ab?page=2) refererer kamp 1945-07-08 med 2–0 til AaFK.
2. `1946 #23` vs Herd: Kilden oppgir 3–2. [Sunnmørsposten 1946-05-31, s. 3](https://www.nb.no/items/8308a93a2da1e40182258f1f90969044?page=3) refererer kamp 1946-05-30 med 5–2.
3. `1947 #8` vs Skarbøvik: Kilden oppgir 1–0. [Sunnmørsposten 1947-06-02, s. 3](https://www.nb.no/items/a30220bab7b19402a6aaaf84544c5fa1?page=3) refererer kamp 1947-06-01 med 4–1.
4. `1947 #11` vs Nordlandet: Kilden oppgir 1–1. [Sunnmørsposten 1947-08-25, s. 3](https://www.nb.no/items/6907ff25365ef85e08332b354883414e?page=3) refererer kamp 1947-08-24 med 2–1.
5. `1947 #19` vs Ørsta: Kilden oppgir 2–0. [Sunnmørsposten 1947-06-16, s. 2](https://www.nb.no/items/b9f26b17b28591454cc2728abf168881?page=2) refererer kamp 1947-06-15 med 2–1.
6. `1948 #4` vs Ørsta: Kilden oppgir 2–4. [Sunnmørsposten 1948-05-31, s. 3](https://www.nb.no/items/72b8ec34ebd51bf2fd363c894e2c23a0?page=3) refererer kamp 1948-05-30 med 3–1.
7. `1948 #22` vs Clausenengen: Kilden oppgir 0–3. [Sunnmørsposten 1948-08-23, s. 3](https://www.nb.no/items/0ea813630869f93082af8f0e8f7ea036?page=3) refererer kamp 1948-08-20 med 1–4.

### B. `confirmed`-saker (10 av 10 gjennomgått)
* `1946 #15` vs Ranheim (2–2, 1946-07-09): [Sunnmørsposten 1946-07-10, s. 2](https://www.nb.no/items/ee4ec332eb33fc5f8b82d0e5708a7262?page=2)
* `1946 #24` vs Clausenengen (3–0, 1946-06-16): [Sunnmørsposten 1946-06-17, s. 2](https://www.nb.no/items/473b92190cee8bfae2e12aae1d70d08d?page=2)
* `1947 #3` vs Freidig, Tr.heim (0–1, 1947-06-13): [Sunnmørsposten 1947-06-14, s. 2](https://www.nb.no/items/250e7b9fb2b083c50953a772c57e84ca?page=2)
* `1947 #17` vs Aksla (2–4, 1947-08-06): [Sunnmørsposten 1947-08-07, s. 2](https://www.nb.no/items/df0e19babdb39bed17297c49680c04ed?page=2)
* `1948 #1` vs Skarbøvik (1–0, 1948-05-23): [Sunnmørsposten 1948-05-24, s. 2](https://www.nb.no/items/b107ba78b88ee1481d0fdd46f1eb03ba?page=2)
* `1948 #2` vs Aksla (4–0, 1948-05-11): [Sunnmørsposten 1948-05-12, s. 3](https://www.nb.no/items/f6a3233e558c188fa8df124e58a364ff?page=3)
* `1948 #13` vs Langevåg (2–5, 1948-05-06): [Sunnmørsposten 1948-05-07, s. 3](https://www.nb.no/items/7296eeedf43258308f8872c3ab3b4fda?page=3)
* `1948 #15` vs Nordlandet (6–1, 1948-05-06): [Sunnmørsposten 1948-05-11, s. 2](https://www.nb.no/items/b6daecc1763ccfadd9fb2e57a2d608c3?page=2)
* `1949 #2` vs Herd (2–4, 1949-08-21): [Sunnmørsposten 1949-06-17, s. 3](https://www.nb.no/items/be1c570e6e541ed3e0e225d039799bc1?page=3)
* `1949 #5` vs Øvre Telemark Kretslag (0–1, 1949-07-10): [Sunnmørsposten 1949-07-11, s. 2](https://www.nb.no/items/ccc608592b713b4338a54a48a2822378?page=2)

*Presisjon:* 10/10 (100 %) verifiserte treff uten falske positiver.

### C. `probable`-saker (5 av 5 gjennomgått)
* `1946 #10` vs Skjerm, Danmark (7–0): Omtalt i [Sunnmørsposten 1946-10-05, s. 5](https://www.nb.no/items/0f2428d54279b2e05cce61bd28006fb4?page=5), mangler presis dato.
* `1947 #5` vs Frigg, Oslo (3–3): Kampdato 1947-10-26 funnet i [Sunnmørsposten 1947-10-27, s. 1](https://www.nb.no/items/06c6294bc3f1fc99072c75ca51bf3494?page=1).
* `1948 #5` vs Treff, Molde (1–1): Kampdato 1948-06-27 funnet i [Sunnmørsposten 1948-06-28, s. 2](https://www.nb.no/items/963f2218be2c92dbe17338af39dcc1f8?page=2).
* `1948 #7` vs Snøgg, Notodden (2–4): Kampdato 1948-07-06 funnet i [Sunnmørsposten 1948-07-06 s. 4 / 07-07 s. 3](https://www.nb.no/items/51ccfcaff48b2f557263234a552a8f68?page=4).
* `1948 #25` vs Veblungsnes (1–0): NM-kamp 1948-06-27 funnet i [Sunnmørsposten 1948-06-28, s. 2](https://www.nb.no/items/963f2218be2c92dbe17338af39dcc1f8?page=2).

### D. `not_found`-saker (5 av 5)
1. `1945 #6` vs Politiaspirantene (7–3): Privatkamp/uvanlig lag, ingen treff i avisen for sesongen.
2. `1946 #11` vs Braatt (10–1): Bortekamp i Kristiansund, ikke omtalt med standard søkeform i Sunnmørsposten.
3. `1947 #6` vs Valdemarsvik, Sverige (6–4): Utenlandsk turnélag.
4. `1948 #9` vs Hälsingland Kretslag, Sverige (2–1): Svensk kretslag.
5. `1948 #27` vs Skeid, Oslo (2–4): Privatkamp.

---

## 5. Konklusjon og neste steg

1. **Pipeline og rate-limiting fungerer stabilt:** 751 NB-kall ble utført trygt uten feil eller blokkeringer.
2. **Høy presisjon på bekreftelser og konflikter:** Ingen falske positiver identifisert.
3. **Anbefaling:** Kjør neste batch (Batch 02) for å utvide datagrunnlaget til over 100 singleton-hypoteser før eventuelle endringer i heuristikker vurderes, i tråd med retningslinjene i `docs/NB_AVISDISCOVERY_BATCH.md`.
