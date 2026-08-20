# Evaluering av NB-avisdiscovery: Batch 02 (1950–1964) [HISTORISK / ERSTATTET]

> [!WARNING]
> **HISTORISK MÅLING MED AVDEKKEDE SIKKERHETSSVAKHETER**  
> Denne rapporten dokumenterer den opprinnelige evalueringen av Batch 02 (PR #180). Beslutningen `READY_FOR_CONTROLLED_SIBLING_EXPERIMENT` er **trukket tilbake** fordi rårapporten avdekket at:
> 1. Temporalt umulige avisbevis (f.eks. en avis trykket 1. juni klynget til en kamp 3. juni) ble aggregert inn i samme hendelse (Guard 1959 #2).
> 2. Resultatkonflikter ble erklært selv når andre separate hendelser i sesongen hadde samsvarende kilderesultat (Spjelkavik 1953 #8, Guard 1955 #1).
> 3. Kildehints for cup/serie ble overstyrt av rå ranking-terskel (Sykkylven 1955 #12).
> 
> **Korrekt midlertidig status:** `FIX_RECONCILE_BEFORE_MORE_BATCHES`.  
> Batch 02 kjøres på nytt som **Batch 02 V2** etter at kodefiksen er merget.

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: 260 ukoblede kamphypoteser i perioden 1950–1964 (ikke-overlappende med Batch 01)  
Kodeversjon: PR #178  
Kommandolinje:
```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1950 --to-year 1964 \
  --unlinked-only --limit 260 \
  --output .cache/ingest/nb-newspaper-discovery/batch-02.yaml
```

---

## 1. Nøkkeltall for Batch 02

| Parameter | Batch 02 Resultat | Merknad |
| :--- | :---: | :--- |
| **totalHypotheses** | 260 | 61 automatiske singletons + 199 manuelle siblings |
| **automaticSingletonHypotheses** | 61 | 100 % behandlet automatisk |
| **manualSiblingHypotheses** | 199 | Rutet direkte til manuell review (`sibling_group`) |
| **confirmed** | **6** | 9.8 % av de automatiske |
| **conflict** | **6** | 9.8 % av de automatiske (avdekket 3 feilallokeringer) |
| **probable** | **3** | 4.9 % av de automatiske |
| **ambiguous** | **240 (41 auto + 199 man)** | 67.2 % av de automatiske (og 199 manuelle siblings) |
| **not_found** | **5** | 8.2 % av de automatiske |
| **candidateIssuesFound** | 4 629 | Kandidatutgaver identifisert |
| **issuesEnriched** | 298 | Utgaver beriket med fulltekst/OCR |
| **nbRequests** | 999 | Totalt antall API-kall mot NB |
| **NB-kall per automatisk sak** | **16.38** | Stabil kostnadseffektivitet |
| **NB-kall per confirmed/conflict** | **83.25** | 999 kall fordelt på 12 saker |
| **hypothesesWithTemporalEvidence** | 51 | 83.6 % av de automatiske har tidsbevis |
| **hypothesesWithResultAgreement** | 8 | 6 confirmed + 2 nedgradert pga. `homeAway: conflict` |
| **hypothesesWithResultConflict** | 6 | Målt i rårapporten |
| **siblingGroupsSkipped** | 72 grupper | Unngått unødvendige NB-kall for 199 sibling-saker |

---

## 2. Faktiske Confirmed (6) og Conflict (6) fra rå-YAML (`batch-02.yaml`)

### A. De 6 faktiske `confirmed`-sakene

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Merknad |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1952 #4` Eid** | 2–3 | `1952-05-18` (**high**) | 3–2 (rev) | **106** | [Sunnmørsposten 19.05.1952 s. 3](https://www.nb.no/items/860e6053c29be84051f099a53d5fb617?page=3) | Referat «i går», bortekamp bekreftet |
| **`1952 #8` Årstad** | 5–1 | `1952-07-04` (**high**) | 5–1 | **92** | [Sunnmørsposten 05.07.1952 s. 3](https://www.nb.no/items/d8a17ff56d2c49d69b2a1efb2ed354dc?page=3) | Referat «i går» |
| **`1952 #9` Lyn, Gjøvik** | 1–3 | `1952-07-10` (**high**) | 3–1 (rev) | **92** | [Sunnmørsposten 11.07.1952 s. 5](https://www.nb.no/items/a127a05d28e31b9829490c8feb733637?page=5) | Referat «i går» |
| **`1953 #6` Moss FK** | 2–0 | `1953-07-07` (**high**) | 2–0 | **67** | [Sunnmørsposten 08.07.1953 s. 3](https://www.nb.no/items/b97694a34074db019578c785cee664dd?page=3) | Referat «i går» |
| **`1953 #19` Hødd** | 3–1 | `1953-08-23` (**high**) | 3–1 | **117** | [Sunnmørsposten 24.08.1953 s. 2](https://www.nb.no/items/dd7a9b1eb4db00a7752eebc9aa569ae4?page=2) | Resultatbørs 1. divisjon «i går» |
| **`1958 #15` Braatt** | 1–1 | `1958-05-11` (**high**) | 1–1 | **80** | [Sunnmørsposten 12.05.1958 s. 2](https://www.nb.no/items/7ddff643a17e4d54af5b9b1cc7202151?page=2) | Referat «i går» |

*Merknad:* Sakene `1952 #16 Clausenengen` (homeAway-konflikt), `1953 #4 Sykkylven` og `1953 #13 Clausenengen` er i realiteten `ambiguous` i rå-YAML og hører ikke hjemme i confirmed-tabellen.

### B. De 6 `conflict`-sakene i rå-YAML

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Avdekket svakhet |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1953 #5` Skarbøvik** | 4–0 | `1953-08-22` (**low**) | 4–2 | **76** | [Sunnmørsposten 24.08.1953 s. 2](https://www.nb.no/items/dd7a9b1eb4db00a7752eebc9aa569ae4?page=2) | Reell konflikt |
| **`1953 #8` Spjelkavik** | 2–1 | `1953-07-07` (**high**) | 3–2 | **86** | [Sunnmørsposten 08.07.1953 s. 3](https://www.nb.no/items/b97694a34074db019578c785cee664dd?page=3) | **FEILALLOKERT:** Separat event i sesongen har source-score 2–1 $\to$ må bli ambiguous |
| **`1955 #1` Guard** | 2–0 | `1955-08-29` (**high**) | 6–0 | **87** | [Sunnmørsposten 30.08.1955 s. 4](https://www.nb.no/items/c0496eb719658bd7c1734316f1d91a45?page=4) | **FEILALLOKERT:** Separat event i sesongen har source-score 2–0 $\to$ må bli ambiguous |
| **`1955 #12` Sykkylven** | 2–2 | `1955-05-19` (**high**) | 3–0 | **67** | [Sunnmørsposten 20.05.1955 s. 2](https://www.nb.no/items/c5e5988d379d5ea705113f0833418f88?page=2) | **FEILALLOKERT:** Annen event matcher 1. divisjon/bortekamp bedre $\to$ må bli ambiguous |
| **`1956 #10` Braatt** | 2–3 | `1956-08-19` (**high**) | 2–2 | **86** | [Sunnmørsposten 20.08.1956 s. 2](https://www.nb.no/items/6c8a954e78462194c98565773b88293e?page=2) | Reell konflikt |
| **`1959 #2` Guard** | 6–2 | `1959-06-03` (**high**) | 6–3 | **70** | [Sunnmørsposten 04.06.1959 s. 7](https://www.nb.no/items/64819a24494e4d0100bcb4cf400a6f54?page=7) | **KLYNGEFEIL:** Avis fra 1. juni klynget til kamp 3. juni $\to$ må bli ambiguous |

---

## 3. Konklusjon for PR #180

# `FIX_RECONCILE_BEFORE_MORE_BATCHES`

Evalueringen i PR #180 var for optimistisk og fanget ikke opp at tre av konflikt-sakene hadde parallelle kildetall i sesongen eller temporalt umulige avisdatoer. Avstemmingslogikken må korrigeres (Fase 2 og 3) før Batch 02 re-evalueres som V2.
