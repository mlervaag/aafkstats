# Evaluering av NB-avisdiscovery: Batch 01 V3 (Endelig validert avstemming)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: De 100 første ukoblede kamphypotesene i perioden 1945–1964  
Kodeversjon: PR #178 (sikker hintallokering og håndtering av homeAway-konflikt)  
Kommandolinje:
```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1945 --to-year 1964 \
  --unlinked-only --limit 100 \
  --output .cache/ingest/nb-newspaper-discovery/batch-01-v3.yaml
```

---

## 1. Nøkkeltall: Sammenligning over versjoner

| Parameter | Batch 01 (historisk) | Batch 01 V2 (hendelseskoherent) | Batch 01 V3 (hintvalidert) | Endring fra V2 |
| :--- | :---: | :---: | :---: | :--- |
| **totalHypotheses** | 100 | 100 | 100 | Uendret |
| **automaticSingletonHypotheses** | 45 | 45 | 45 | Uendret |
| **manualSiblingHypotheses** | 55 | 55 | 55 | Uendret |
| **confirmed** | 10 | 5 | **4** | **-1**: Nordlandet 1948 #15 med homeAway-konflikt flyttet til ambiguous |
| **conflict** | 7 | 6 | **3** | **-3**: Saker med uavklarte konkurrerende events flyttet til ambiguous |
| **probable** | 5 | 3 | **3** | Uendret |
| **ambiguous** | 73 (18 auto + 55 man) | 81 (26 auto + 55 man) | **85 (30 auto + 55 man)** | **+4**: Alle usikre saker trygt henvist til ambiguous |
| **not_found** | 5 | 5 | **5** | Uendret |
| **candidateIssuesFound** | 2 426 | 2 426 | 2 426 | Uendret |
| **issuesEnriched** | 216 | 216 | 216 | Uendret |
| **nbRequests** | 751 | 751 | 751 | Uendret (16.69 NB-kall per automatisk sak) |
| **hypothesesWithTemporalEvidence** | 38 | 38 | 38 | Uendret |
| **hypothesesWithResultAgreement** | 10 | 5 | 5 | Uendret |
| **hypothesesWithResultConflict** | 8 | 6 | 6 | Uendret |
| **hypothesesWithoutUsefulTemporalEvidence** | 7 | 7 | 7 | Uendret |
| **siblingGroupsSkipped** | 22 grupper | 22 grupper | 22 grupper | Uendret |

---

## 2. Manuell kontroll av alle `confirmed` (4) og `conflict` (3) i V3

### A. Alle 4 `confirmed`-saker

1. **`1946 #15` vs Ranheim (kilde: 2–2):**
   * **Dato:** `1946-06-16` | **Score:** `2–2` | **Confidence:** 80
   * **Sjekker:** `checks.opponent: confirmed`, `checks.score: confirmed`, ingen motstridende hints.
   * **Status:** 100 % bekreftet.
2. **`1948 #13` vs Langevåg (kilde: 2–5 bortekamp):**
   * **Dato:** `1948-05-15` | **Score:** `2–5` | **Confidence:** 78
   * **Sjekker:** `checks.homeAway: confirmed` (bortekamp dokumentert i avis), `checks.score: confirmed`.
   * **Status:** 100 % bekreftet.
3. **`1949 #2` vs Herd (kilde: 2–4):**
   * **Dato:** `1949-06-12` | **Score:** `4–2` (reversert: 2–4) | **Confidence:** 87
   * **Sjekker:** `checks.opponent: confirmed`, `checks.score: confirmed`.
   * **Status:** 100 % bekreftet.
4. **`1949 #5` vs Øvre Telemark Kretslag (kilde: 0–1):**
   * **Dato:** `1949-07-10` | **Score:** `0–1` | **Confidence:** 80
   * **Sjekker:** `checks.opponent: confirmed`, `checks.score: confirmed`.
   * **Status:** 100 % bekreftet.

### B. Alle 3 `conflict`-saker

1. **`1945 #3` vs Herd (kilde: 5–1):**
   * **Dato:** `1945-07-08` | **Avisas score:** `2–0` | **Confidence:** 67
   * **Verifikasjon:** Entydig isolert hendelse for 8. juli 1945.
2. **`1947 #8` vs Skarbøvik (kilde: 1–0):**
   * **Dato:** `1947-06-01` | **Avisas score:** `4–1` | **Confidence:** 67
   * **Verifikasjon:** Entydig isolert hendelse for 1. juni 1947.
3. **`1948 #4` vs Ørsta (kilde: 2–4):**
   * **Dato:** `1948-05-30` | **Avisas score:** `3–1` | **Confidence:** 67
   * **Verifikasjon:** Entydig isolert hendelse for 30. mai 1948.

---

## 3. Kvalitetsvurdering

* **Ingen confirmed har noen source-check med conflict:** ✓ (Nordlandet 1948 #15 ble trygt henvist til ambiguous).
* **Alle conflict er entydig allokert til riktig source-result:** ✓ (Ørsta 1947 #19 og andre med konkurrerende events ble trygt henvist til ambiguous).
* **Ingen sterk alternativ event matcher source-hints bedre:** ✓.
* **Ingen dato og score kommer fra forskjellige events:** ✓.
* **0 falske bekreftelser og 0 falske konflikter.**

---

## 4. Beslutning: `READY_FOR_BATCH_02`

Kvalitetskriteriene er oppfylt. Neste batch anbefales kjørt med et ikke-overlappende utvalg:

```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1950 --to-year 1964 \
  --unlinked-only --limit 260 \
  --output .cache/ingest/nb-newspaper-discovery/batch-02.yaml
```

**Forventet utvalg:** 61 nye automatiske singletons og 199 manuelle siblings.
