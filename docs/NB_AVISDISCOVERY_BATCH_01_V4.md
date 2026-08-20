# Evaluering av NB-avisdiscovery: Batch 01 V4 (Konservativ hjemme/borte-inferens)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: De 100 første ukoblede kamphypotesene i perioden 1945–1964  
Kodeversjon: Konservativ `homeAway`-inferens (ingen antagelse om hjemmebane fra seierssifre, fjerning av `AWAY_CITIES`)  
Kommandolinje:
```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1945 --to-year 1964 \
  --unlinked-only --limit 100 \
  --output .cache/ingest/nb-newspaper-discovery/batch-01-v4.yaml
```

---

## 1. Nøkkeltall: Sammenligning mot tidligere versjoner

| Parameter | Batch 01 V2 (hendelseskoherent) | Batch 01 V3 (hintvalidert) | Batch 01 V4 (konservativ) | Endring fra V3 |
| :--- | :---: | :---: | :---: | :--- |
| **totalHypotheses** | 100 | 100 | **100** | Identisk populasjonsutvalg |
| **automaticSingletonHypotheses** | 45 | 45 | **45** | 100 % automatisk behandlet |
| **manualSiblingHypotheses** | 55 | 55 | **55** | Rutet direkte til review (`sibling_group`) |
| **confirmed** | 5 | 4 | **6** | **+2**: Aksla 1948 #2 og Nordlandet 1948 #15 bekreftes uten falsk konflikt |
| **conflict** | 6 | 3 | **3** | Uendret |
| **probable** | 3 | 3 | **3** | Uendret |
| **ambiguous** | 81 (26 auto + 55 man) | 85 (30 auto + 55 man) | **83 (28 auto + 55 man)** | **-2**: Løftet til confirmed |
| **not_found** | 5 | 5 | **5** | Uendret |
| **candidateIssuesFound** | 2 426 | 2 426 | **2 426** | Uendret |
| **issuesEnriched** | 216 | 216 | **216** | Uendret |
| **nbRequests** | 751 | 751 | **751** | 16.69 NB-kall per automatisk sak |
| **hypothesesWithTemporalEvidence** | 38 | 38 | **38** | Uendret |
| **hypothesesWithResultAgreement** | 5 | 5 | **6** | 6 confirmed |
| **hypothesesWithResultConflict** | 6 | 6 | **6** | Målt i råtreff (3 endelige konflikter) |
| **Ambiguous-kø inkl. siblings** | 81 / 100 | 85 / 100 | **83 / 100** | 83.0 % av utvalget |
| **Reell manuell kø (inkl. probable & not_found)** | 89 / 100 | 93 / 100 | **91 / 100** | 91.0 % av utvalget |

---

## 2. Manuell kontroll av Confirmed (6) og Conflict (3) i V4

### A. Alle 6 `confirmed`-saker

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Kildehints og observasjon |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1946 #15` Ranheim** | 2–2 | `1946-06-16` (**low**) | 2–2 | **80** | [Sunnmørsposten 17.06.1946 s. 2](https://www.nb.no/items/af8f813e3c216326b9ee3e0de58ae934?page=2) | Referat mandag, uavgjort 2–2 |
| **`1948 #2` Aksla** | 4–0 | `1948-09-12` (**low**) | 4–0 | **80** | [Sunnmørsposten 13.09.1948 s. 2](https://www.nb.no/items/cbe628172c918375fcfa15f5d3ff2ce0?page=2) | Referat mandag «i går», 4–0 seier |
| **`1948 #13` Langevåg** | 2–5 | `1948-05-15` (**low**) | 2–5 | **78** | [Sunnmørsposten 18.05.1948 s. 3](https://www.nb.no/items/7296eeedf43258308f8872c3ab3b4fda?page=3) | Referat tirsdag fra pinselørdag, bortekamp |
| **`1948 #15` Nordlandet** | 6–1 | `1948-05-06` (**high**) | 6–1 | **92** | [Sunnmørsposten 07.05.1948 s. 2](https://www.nb.no/items/9183a6509f6e6ec13c907b22a0a2df36?page=2) | Referat fredag fra Kr.sund «i går» (Kr. Himmelfartsdag), 6–1 |
| **`1949 #2` Herd** | 2–4 | `1949-06-12` (**low**) | 4–2 (rev) | **87** | [Sunnmørsposten 17.06.1949 s. 3](https://www.nb.no/items/be1c570e6e541ed3e0e225d039799bc1?page=3) | Referat fredag om søndagskampen, tap 2–4 |
| **`1949 #5` Øvre Telemark Kretslag** | 0–1 | `1949-07-10` (**high**) | 0–1 | **80** | [Sunnmørsposten 11.07.1949 s. 2](https://www.nb.no/items/ccc608592b713b4338a54a48a2822378?page=2) | Referat mandag «i går», tap 0–1 på Rjukan |

*Vurdering:* Samtlige 6 saker (100 %) er fullstendig fri for kildeavvik eller allokeringsfeil.

### B. Alle 3 `conflict`-saker

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Kildekritisk observasjon |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1945 #3` Herd** | 5–1 | `1945-07-08` (**high**) | 2–0 | **67** | [Sunnmørsposten 09.07.1945 s. 2](https://www.nb.no/items/996171a08ad98118ad1097f4f42254ab?page=2) | Avisa oppgir 2–0, kilden 5–1. Entydig enkeltkamp. |
| **`1947 #8` Skarbøvik** | 1–0 | `1947-06-01` (**high**) | 4–1 | **67** | [Sunnmørsposten 02.06.1947 s. 3](https://www.nb.no/items/a30220bab7b19402a6aaaf84544c5fa1?page=3) | Avisa oppgir 4–1, kilden 1–0. Entydig enkeltkamp. |
| **`1948 #4` Ørsta** | 2–4 | `1948-05-30` (**high**) | 3–1 | **67** | [Sunnmørsposten 31.05.1948 s. 3](https://www.nb.no/items/72b8ec34ebd51bf2fd363c894e2c23a0?page=3) | Avisa oppgir 3–1, kilden 2–4. Entydig enkeltkamp. |

---

## 3. Endringer fra V3 til V4
- **Nordlandet 1948 #15:** Kilden oppga bortekamp, men avisen omtalte seieren 6–1 uten eksplisitte ord som «på Kråmyra» eller «bortekamp». I V3 ble `homeAway: home` feilaktig utledet fra sifferrekkefølgen 6–1, som ga en falsk konflikt. I V4 forblir `homeAway: unknown`, og saken bekreftes trygt.
- **Aksla 1948 #2:** Omtalen i avisen bekrefter seier 4–0 og dato 1948-09-12 uten konflikt.
