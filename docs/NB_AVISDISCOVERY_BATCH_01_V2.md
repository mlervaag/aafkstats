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

## 2. Detaljert kilde- og hintgjennomgang (Confirmed og Conflict)

### A. Gjennomgang av de 5 `confirmed`-sakene

| Sak / Motstander | Kilde-score | Utledet dato | Avis-score | Confidence | Source-hints / Sjekker | Vurdering |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1946 #15` Ranheim** | 2–2 | `1946-06-16` (low) | 2–2 | **80** | Ingen hints | Koherent bekreftelse |
| **`1948 #13` Langevåg** | 2–5 | `1948-05-15` (low) | 2–5 | **78** | `homeAway: away` (avisa: borte ✓) | Koherent bekreftelse |
| **`1948 #15` Nordlandet** | 6–1 | `1948-05-06` (high) | 6–1 | **129** | `homeAway: away` (avisa: hjemme ✗) | **IKKE FULLSTENDIG BEKREFTET**: `checks.homeAway: conflict` |
| **`1949 #2` Herd** | 2–4 | `1949-06-12` (low) | 4–2 (rev) | **87** | Ingen hints | Koherent bekreftelse |
| **`1949 #5` Øvre Telemark Kretslag** | 0–1 | `1949-07-10` (high) | 0–1 | **80** | Ingen hints | Koherent bekreftelse |

> **Observasjon (1948 #15 Nordlandet):**  
> Selv om dato (1948-05-06) og resultat (6–1) er internt koherente fra Sunnmørsposten, oppgir kilden at kampen var en bortekamp, mens avisreferatet dokumenterer en hjemmekamp på Kråmyra (`checks.homeAway: "conflict"`). Saken kan derfor **ikke** godkjennes som en fullstendig kildebekreftelse før homeAway-konflikten fører til `ambiguous`.

### B. Gjennomgang av de 6 `conflict`-sakene

| Sak / Motstander | Kilde-score | Utledet dato | Avis-score | Confidence | Source-hints / Sjekker | Vurdering |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1945 #3` Herd** | 5–1 | `1945-07-08` (high) | 2–0 | **67** | Ingen hints | Koherent konflikt |
| **`1947 #8` Skarbøvik** | 1–0 | `1947-06-01` (high) | 4–1 | **67** | Ingen hints | Koherent konflikt |
| **`1947 #11` Nordlandet** | 1–1 | `1947-05-11` (high) | 2–1 | **85** | `competition: serie` | Koherent konflikt |
| **`1947 #19` Ørsta** | 2–0 | `1947-08-24` (high) | 2–1 | **67** | `competition: cup` | **IKKE SIKKERT ALLOKERT**: Annen sterk cup-event 1947-06-15 finnes |
| **`1948 #4` Ørsta** | 2–4 | `1948-05-30` (high) | 3–1 | **67** | `homeAway: away` | Koherent konflikt |
| **`1948 #22` Clausenengen** | 0–3 | `1948-06-29` (medium) | 1–4 | **74** | `competition: 1. divisjon` | Koherent konflikt |

> **Observasjon (1947 #19 Ørsta):**  
> Kilden spesifiserer at dette var en cupkamp (`competitionHint: "cup"`). Det valgte eventet 24. august 1947 (2–1) mangler cup-kontekst, mens et annet sterkt bevis i samme sesong på 15. juni 1947 dokumenterer cupkamp mot Ørsta. Saken er internt koherent mot 24. august, men kan ikke entydig allokeres til dette kilderesultatet når det finnes et annet event som matcher source-hintet bedre.

---

## 3. Taksonomi over de 26 automatiske `ambiguous`-sakene

1. **Konkurrerende datobevis fra ulike avishendelser (14 saker):**
   * `1945 #7` Spjelkavik, `1945 #10` Herd/Aksla Skarbøvik, `1945 #12` Hødd, `1945 #18` Træff, `1946 #7` Reidulf, `1946 #8` Veblungsnes, `1946 #23` Herd (nedgradert fra conflict pga. 7 ulike datoer), `1947 #4` Dr. Ballklubb, `1947 #13` Molde, `1947 #17` Aksla (tidligere confirmed), `1948 #1` Skarbøvik (tidligere confirmed), `1948 #2` Aksla (tidligere confirmed), `1948 #26` Fremad, `1949 #3` Dr. Ballklubb.
2. **Dato funnet, men mangler parsbar sluttscore i artikkel (8 saker):**
   * `1946 #6` Kvik Halden, `1946 #24` Clausenengen (tidligere confirmed), `1946 #25` Falken, `1946 #26` Freidig, `1947 #3` Freidig (tidligere confirmed), `1948 #6` Glimt Bodø, `1948 #8` Lyn Oslo, `1949 #4` Halmia.
3. **Nedgradert fra `probable` til `ambiguous` pga. konkurrerende dateringer (2 saker):**
   * `1948 #7` Snøgg, Notodden: Sprik mellom 1948-07-06 og 1948-09-12.
   * `1948 #25` Veblungsnes: Sprik mellom 1948-06-27 og fire andre kampdatoer.
4. **Event-splitt / uavklart kobling (2 saker):**
   * `1946 #5` KFK i Molde: Ingen entydig datokandidat.
   * `1946 #9` Old Boys: Dato fra juli og score fra oktober tilhører separate hendelser.

---

## 4. Beslutning: `BLOCKED_FOR_BATCH_02`

Kjøring av Batch 02 er **blokkert** inntil to gjenværende sikkerhetsrisikoer i reconcile er lukket:
1. **HomeAway-konflikt skal gi `ambiguous`:** En hendelse der `checks.homeAway === "conflict"` må aldri få status `confirmed`.
2. **Beskyttelse mot feilallokering ved konkurrerende events med bedre hint-match:** En scoreConflict kan bare bli status `conflict` dersom hendelsen er entydig og det ikke finnes et annet sterkt event som matcher `competitionHint` eller `homeAwayHint` bedre.

---

## 5. Anbefalt utvalg for fremtidig Batch 02 (ikke-overlappende)

En naiv utvidelse til `--from-year 1945 --to-year 1964 --limit 250` ville gitt:
* 88 automatiske totalt
* 45 allerede evaluerte saker
* **Kun 43 nye automatiske singletons**

For å oppnå et reelt og ikke-overlappende utvalg på minst 60 nye automatiske singletons, skal Batch 02 defineres som:
* **Kommando:**
  ```sh
  pnpm ingest:nb-newspaper-discover -- \
    --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
    --from-year 1950 --to-year 1964 \
    --unlinked-only --limit 260 \
    --output .cache/ingest/nb-newspaper-discovery/batch-02.yaml
  ```
* **Målt utvalg:** **61 nye automatic singletons** og 199 manual siblings.
