# Evaluering av NB-avisdiscovery: Batch 01 V2 (Hendelseskoherent re-kjøring)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: De 100 første ukoblede kamphypotesene i perioden 1945–1964  
Kodeversjon: PR #176 (hendelseskoherent reconcile)  
Kommandolinje:
```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1945 --to-year 1964 \
  --unlinked-only --limit 100 \
  --output .cache/ingest/nb-newspaper-discovery/batch-01-v2.yaml
```

---

## 1. Nøkkeltall: Batch 01 (opprinnelig) mot Batch 01 V2 (hendelseskoherent)

| Parameter | Batch 01 (historisk) | Batch 01 V2 (korrigert) | Endring / Merknad |
| :--- | :---: | :---: | :--- |
| **totalHypotheses** | 100 | 100 | Identisk populasjonsutvalg |
| **automaticSingletonHypotheses** | 45 | 45 | Alle singletons behandlet automatisk |
| **manualSiblingHypotheses** | 55 | 55 | Rutet til manuell vurdering (`sibling_group`) |
| **confirmed** | 10 | **5** | **-5**: Ukoherente sammenblandinger eliminert |
| **conflict** | 7 | **6** | **-1**: 1 sak med sprikende datoer ble `ambiguous` |
| **probable** | 5 | **3** | **-2**: 2 saker med konkurrerende dateringer ble `ambiguous` |
| **ambiguous** | 73 (18 auto + 55 man) | **81 (26 auto + 55 man)** | **+8**: Usikre/sprikende saker trygt henvist til ambiguous |
| **not_found** | 5 | **5** | Uendret |
| **candidateIssuesFound** | 2 426 | 2 426 | Uendret |
| **issuesEnriched** | 216 | 216 | Uendret |
| **nbRequests** | 751 | 751 | Uendret (16.69 NB-kall per automatisk sak) |
| **hypothesesWithTemporalEvidence** | 38 | 38 | Uendret |
| **hypothesesWithResultAgreement** | 10 | **5** | Måler nå kun **hendelseskoherent** resultat-samsvar |
| **hypothesesWithResultConflict** | 8 | **6** | Måler nå kun **hendelseskoherent** resultat-konflikt |
| **hypothesesWithoutUsefulTemporalEvidence** | 7 | 7 | Uendret |
| **siblingGroupsSkipped** | 22 grupper | 22 grupper | Uendret |

---

## 2. Statusendringer fra Batch 01 til Batch 01 V2

### A. Hva skjedde med de 10 opprinnelige `confirmed`-sakene?
* **5 saker forblir `confirmed` (100 % hendelseskoherente):**
  1. `1946 #15` vs Ranheim (2–2): Korrekt datert til `1946-06-16` (tidligere feilaktig koblet med 9. juli-datoen).
  2. `1948 #13` vs Langevåg (2–5): Korrekt datert til `1948-05-15`.
  3. `1948 #15` vs Nordlandet (6–1): Korrekt datert til `1948-05-06`.
  4. `1949 #2` vs Herd (2–4): Korrekt datert til `1949-06-12` med score 4–2 reversert (tidligere feilaktig koblet med august-datoen).
  5. `1949 #5` vs Øvre Telemark Kretslag (0–1): Korrekt datert til `1949-07-10`.
* **5 saker ble korrekt nedgradert fra `confirmed` til `ambiguous`:**
  * `1946 #24` Clausenengen (3–0): Ingen entydig sammenhengende artikkel med både dato og score 3–0 i samme hendelse.
  * `1947 #3` Freidig (0–1): Manglet fullstendig scorebekreftelse i samme avisartikkel.
  * `1947 #17` Aksla (2–4): Bevis spriker over mange ulike kampdatoer i sesongen.
  * `1948 #1` Skarbøvik (1–0): Bevis spriker over flere datoer.
  * `1948 #2` Aksla (4–0): Bevis spriker over flere datoer.

### B. Hva skjedde med de 7 opprinnelige `conflict`-sakene?
* **6 saker forblir `conflict`:** Alle har entydig, sammenhengende avisomtale for én spesifikk kampdato der avisa oppgir et annet resultat enn kilden.
* **1 sak ble `ambiguous`:** `1946 #23` vs Herd (3–2) pekte mot 7 ulike datoer i sesongen uten entydig isolert hendelse, og ble korrekt klassifisert som `ambiguous`.

---

## 3. Manuell kontroll av alle `confirmed` (5) og `conflict` (6) i V2

Alle 11 saker ble manuelt kontrollert mot følgende 6 kvalitetskriterier:
1. Dato og resultat tilhører **samme** `NewspaperEvent`.
2. Hendelsen handler faktisk om **AaFK og forventet motstander**.
3. Scorebeviset kommer fra **`article` eller `result_list`** i samme fragment.
4. Tabellstoff har **ikke** opphevet en reell konflikt.
5. Valgt hendelse alene forsvarer statusen.
6. `combinedConfidence` inkluderer **ikke** bevis fra andre kamper.

### A. Alle 5 `confirmed`-saker

1. **`1946 #15` vs Ranheim (kilde: 2–2):**
   * **Dato:** `1946-06-16` | **Score:** `2–2` | **Confidence:** 52
   * **Kilde:** [Sunnmørsposten 1946-06-17, s. 3](https://www.nb.no/items/a571c6ae78a101fbe025d506927bf3da?page=3)
   * **Verifikasjon:** Kampreferat omtaler søndagskampen (16. juni) mellom Ranheim og AaFK med sluttresultat 2–2.
2. **`1948 #13` vs Langevåg (kilde: 2–5):**
   * **Dato:** `1948-05-15` | **Score:** `2–5` | **Confidence:** 52
   * **Kilde:** [Sunnmørsposten 1948-05-18, s. 3](https://www.nb.no/items/69b82bbba70c29a8a72382e7b57bfca2?page=3)
   * **Verifikasjon:** Kampomtale omtaler lørdagskampen (15. mai) der Langevåg slo AaFK 5–2 (AaFK-perspektiv: 2–5).
3. **`1948 #15` vs Nordlandet (kilde: 6–1):**
   * **Dato:** `1948-05-06` | **Score:** `6–1` | **Confidence:** 77
   * **Kilde:** [Sunnmørsposten 1948-05-11, s. 3](https://www.nb.no/items/f63baaebe4fcbb3f9b23b185ec1578d8?page=3) og [1948-05-07, s. 3](https://www.nb.no/items/470870faae6bb7f51152a514d101d2fb?page=3)
   * **Verifikasjon:** Helhetlig omtale av 1. divisjonskampen torsdag 6. mai der AaFK slo Nordlandet 6–1.
4. **`1949 #2` vs Herd (kilde: 2–4):**
   * **Dato:** `1949-06-12` | **Score:** `4–2` (reversert: 2–4) | **Confidence:** 52
   * **Kilde:** [Sunnmørsposten 1949-06-17, s. 3](https://www.nb.no/items/be1c570e6e541ed3e0e225d039799bc1?page=3)
   * **Verifikasjon:** Kampomtale dokumenterer kampen søndag 12. juni der Herd slo AaFK 4–2.
5. **`1949 #5` vs Øvre Telemark Kretslag (kilde: 0–1):**
   * **Dato:** `1949-07-10` | **Score:** `0–1` | **Confidence:** 77
   * **Kilde:** [Sunnmørsposten 1949-07-11, s. 2](https://www.nb.no/items/cf2eebe7068fb21da30f785b88cefa37?page=2)
   * **Verifikasjon:** Referat fra kampen søndag 10. juli på Kråmyra der kretslaget vant 1–0 over AaFK.

### B. Alle 6 `conflict`-saker

1. **`1945 #3` vs Herd (kilde: 5–1):**
   * **Dato:** `1945-07-08` | **Avisas score:** `2–0` | **Confidence:** 77
   * **Kilde:** [Sunnmørsposten 1945-07-09, s. 2](https://www.nb.no/items/996171a08ad98118ad1097f4f42254ab?page=2)
   * **Verifikasjon:** Referat «i går» (8. juli) viser at AaFK vant 2–0, ikke 5–1.
2. **`1947 #8` vs Skarbøvik (kilde: 1–0):**
   * **Dato:** `1947-06-01` | **Avisas score:** `4–1` | **Confidence:** 77
   * **Kilde:** [Sunnmørsposten 1947-06-02, s. 3](https://www.nb.no/items/a30220bab7b19402a6aaaf84544c5fa1?page=3)
   * **Verifikasjon:** Referat «i går» (1. juni) oppgir 4–1 til AaFK.
3. **`1947 #11` vs Nordlandet (kilde: 1–1):**
   * **Dato:** `1947-05-11` | **Avisas score:** `2–1` | **Confidence:** 85
   * **Kilde:** [Sunnmørsposten 1947-05-12, s. 3](https://www.nb.no/items/87522e2872c1b5d5c9db3fe05b45e91a?page=3)
   * **Verifikasjon:** Resultatliste fra kamp 11. mai oppgir 2–1 til Nordlandet, kilden oppgir 1–1.
4. **`1947 #19` vs Ørsta (kilde: 2–0):**
   * **Dato:** `1947-08-24` | **Avisas score:** `2–1` | **Confidence:** 67
   * **Kilde:** [Sunnmørsposten 1947-08-25, s. 3](https://www.nb.no/items/6907ff25365ef85e08332b354883414e?page=3)
   * **Verifikasjon:** Referat fra 24. august oppgir 2–1 til AaFK, kilden oppgir 2–0.
5. **`1948 #4` vs Ørsta (kilde: 2–4):**
   * **Dato:** `1948-05-30` | **Avisas score:** `3–1` | **Confidence:** 67
   * **Kilde:** [Sunnmørsposten 1948-05-31, s. 3](https://www.nb.no/items/72b8ec34ebd51bf2fd363c894e2c23a0?page=3)
   * **Verifikasjon:** Referat fra 30. mai oppgir 3–1 til Ørsta (kilden oppgir 2–4).
6. **`1948 #22` vs Clausenengen (kilde: 0–3):**
   * **Dato:** `1948-06-29` | **Avisas score:** `1–4` | **Confidence:** 74
   * **Kilde:** [Sunnmørsposten 1948-06-29, s. 4](https://www.nb.no/items/9009b1bab1afdfe073e5a3d3372b8cd0?page=4)
   * **Verifikasjon:** Omtale av kamp 29. juni oppgir 1–4, kilden oppgir 0–3.

---

## 4. Konklusjon og beslutning for Batch 02

* **Sikkerhetsproblemet er løst:** Ingen `confirmed` eller `conflict` kombinerer lenger dato og resultat fra forskjellige avishendelser.
* **Presisjon:** 5 av 5 `confirmed` (100 %) og 6 av 6 `conflict` (100 %) er fullstendig hendelseskoherente.
* **Gjenværende falske bekreftelser/konflikter:** **0**.
* **Kostnadseffektivitet:** 16.69 NB-kall per automatisk singleton.

### Beslutning: `READY_FOR_BATCH_02`

Anbefaling for neste kjøring (Batch 02):
* **Kilde:** `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`
* **Årsintervall:** 1945–1964
* **Mål:** Høste inn minst 60 nye automatiske singleton-hypoteser.
* **Anbefalt `--limit`:** `250` (siden ca. 70 % av hypotesene i perioden er siblings som rutes til manuell behandling).
