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
| **conflict** | 7 | 6 | **3** | **-3**: Saker med konkurrerende/uavklarte events flyttet til ambiguous |
| **probable** | 5 | 3 | **3** | Uendret |
| **ambiguous** | 73 (18 auto + 55 man) | 81 (26 auto + 55 man) | **85 (30 auto + 55 man)** | **+4**: Alle usikre saker trygt henvist til ambiguous |
| **not_found** | 5 | 5 | **5** | Uendret |
| **candidateIssuesFound** | 2 426 | 2 426 | 2 426 | Uendret |
| **issuesEnriched** | 216 | 216 | 216 | Uendret |
| **nbRequests** | 751 | 751 | 751 | Uendret (16.69 NB-kall per automatisk sak) |
| **hypothesesWithTemporalEvidence** | 38 | 38 | 38 | Uendret |
| **hypothesesWithResultAgreement** | 10 | 5 | 5 | Uendret (Nordlandet inngår i metrikken, men gir ambiguous) |
| **hypothesesWithResultConflict** | 8 | 6 | 6 | Uendret (3 saker nedgradert til ambiguous pga. hint/allokering) |
| **hypothesesWithoutUsefulTemporalEvidence** | 7 | 7 | 7 | Uendret |
| **siblingGroupsSkipped** | 22 grupper | 22 grupper | 22 grupper | Uendret |

### Forklaring på metrikkforskjeller i V3

* **`hypothesesWithResultAgreement = 5`, men `confirmed = 4`:**  
  Nordlandet 1948 #15 har koherent resultat-enighet (6–1) og dato (1948-05-06), men kilden oppgir bortekamp mens avisen dokumenterer hjemmekamp (`checks.homeAway: conflict`). Saken telles som resultat-enighet i metrikken, men nedgraderes trygt til `ambiguous` i status.
* **`hypothesesWithResultConflict = 6`, men `conflict = 3`:**  
  Tre saker med koherent resultatavvik ble nedgradert fra `conflict` til `ambiguous` av den nye hint- og allokeringspolicyen:
  1. `1947 #11` Nordlandet (2–1 vs 1–1): Sprikende omtaler over flere datoer.
  2. `1947 #19` Ørsta (2–1 vs 2–0): Kilden angir cupkamp, og et annet sterkt event i sesongen (15. juni 1947) matcher cup-hintet bedre.
  3. `1948 #22` Clausenengen (1–4 vs 0–3): Flere andre sterke seriekamper i samme sesong gjorde allokeringen uavklart.

---

## 2. Manuell kontroll av alle `confirmed` (4) og `conflict` (3) i V3

### A. Alle 4 `confirmed`-saker

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Vurdering |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1946 #15` Ranheim** | 2–2 | `1946-06-16` (**low**) | 2–2 | **80** | [Sunnmørsposten 17.06.1946 s. 2](https://www.nb.no/items/af8f813e3c216326b9ee3e0de58ae934?page=2) | Koherent bekreftelse |
| **`1948 #13` Langevåg** | 2–5 | `1948-05-15` (**low**) | 2–5 | **78** | [Sunnmørsposten 18.05.1948 s. 3](https://www.nb.no/items/7296eeedf43258308f8872c3ab3b4fda?page=3) | Koherent bekreftelse (`homeAway: away` ✓) |
| **`1949 #2` Herd** | 2–4 | `1949-06-12` (**low**) | 4–2 (rev) | **87** | [Sunnmørsposten 17.06.1949 s. 3](https://www.nb.no/items/be1c570e6e541ed3e0e225d039799bc1?page=3) | Koherent bekreftelse |
| **`1949 #5` Øvre Telemark Kretslag** | 0–1 | `1949-07-10` (**high**) | 0–1 | **80** | [Sunnmørsposten 11.07.1949 s. 2](https://www.nb.no/items/ccc608592b713b4338a54a48a2822378?page=2) | Koherent bekreftelse |

*Merknad til dateringssikkerhet:* Tre av fire confirmed-saker har `matchDate.confidence: low` fordi datoen er utledet fra ukedagsangivelser («søndag», «lørdag») i etterfølgende avisutgaver. Dette er normalt for historisk sportsjournalistikk, men betyr at dateringen bygger på ukedagsavstemming mot sesongens kalender.

### B. Alle 3 `conflict`-saker

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Vurdering |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1945 #3` Herd** | 5–1 | `1945-07-08` (**high**) | 2–0 | **67** | [Sunnmørsposten 09.07.1945 s. 2](https://www.nb.no/items/996171a08ad98118ad1097f4f42254ab?page=2) | Entydig isolert hendelse |
| **`1947 #8` Skarbøvik** | 1–0 | `1947-06-01` (**high**) | 4–1 | **67** | [Sunnmørsposten 02.06.1947 s. 3](https://www.nb.no/items/a30220bab7b19402a6aaaf84544c5fa1?page=3) | Entydig isolert hendelse |
| **`1948 #4` Ørsta** | 2–4 | `1948-05-30` (**high**) | 3–1 | **67** | [Sunnmørsposten 31.05.1948 s. 3](https://www.nb.no/items/72b8ec34ebd51bf2fd363c894e2c23a0?page=3) | Entydig isolert hendelse |

---

## 3. Kvalitetsvurdering for Batch 01 V3

* **Ingen valgt confirmed/conflict utfordres av en sterkere event:** Svakere omtaler finnes i noen sesonger, men ingen konkurrerende avishendelse overgår eller motsier de valgte hendelsene.
* **Ingen alternativ event matcher tilgjengelige source-hints bedre:** Saker der alternative hendelser matchet cup/serie-hint bedre (f.eks. Ørsta 1947 #19) er trygt degradert til `ambiguous`.
* **Ingen bekreftet sak har motstridende kildesjekk:** Nordlandet 1948 #15 ble nedgradert pga. motstridende baneangivelse (`checks.homeAway: conflict`).
* **Ingen dato og score kommer fra forskjellige events.**
* **Observert presisjon i utvalget:** 4 av 4 `confirmed` og 3 av 3 `conflict` er reelle og korrekt allokert i dette utvalget. Dette dokumenterer observert presisjon i Batch 01 V3, ikke en universell eller formell presisjonsgaranti for uprøvde årganger.

---

## 4. Beslutning: `READY_FOR_BATCH_02`

Dette er en empirisk målebeslutning basert på de første 45 automatiske sakene: Modellen og avstemmingsreglene er tilstrekkelig konservative og kildekritiske til at vi kan gå videre til neste, ikke-overlappende utvalg.

### Anbefaling for Batch 02:

```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1950 --to-year 1964 \
  --unlinked-only --limit 260 \
  --output .cache/ingest/nb-newspaper-discovery/batch-02.yaml
```

**Målt populasjonsutvalg:** 61 nye automatiske singletons og 199 manuelle siblings.
