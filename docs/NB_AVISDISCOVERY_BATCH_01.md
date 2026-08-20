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

> **Viktig merknad om batch 01:**  
> Batch 01 var en foreløpig målekjøring for å teste pipeline, rate-limiting og hypotesedannelsen mot Nasjonalbiblioteket. Kjøringen avdekket en sentral svakhet i den opprinnelige avstemmingslogikken (reconciliation): **event-sammenblanding (kryss-hendelses-sammenstilling)**. Fordi dato og resultat ble valgt uavhengig av hverandre på tvers av alle berikede utgaver for en hypotese, ble datoer og resultater fra separate avishendelser mot samme motstander i noen tilfeller satt sammen til et tilsynelatende bekreftet treff.
>
> Tallene nedenfor beholdes som historiske råmålinger fra den første batchkjøringen.

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

## 2. Nøkkeltall fra Batch 01 (historisk måling)

| Parameter | Målt verdi |
| :--- | :--- |
| **totalHypotheses** | 100 |
| **automaticSingletonHypotheses** (`policy: automatic`) | 45 |
| **manualSiblingHypotheses** (`policy: manual`) | 55 |
| **confirmed** | 10 (foreløpig måling; inneholder event-sammenblanding) |
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

### Forklaring på avviket mellom `conflict: 7` og `hypothesesWithResultConflict: 8`
* Den opprinnelige reconcile-logikken satte `status: "conflict"` dersom en kandidat var sterk nok og det fantes en dato, samtidig som et vilkårlig bevis i treffmengden hadde et avvikende resultat (`checks.score: "conflict"`). Den krevde ikke at datoen og resultatkonflikten kom fra samme avishendelse.
* Metrikken `hypothesesWithResultConflict` talte opp alle saker der `checks.score === "conflict"` (totalt 8).
* Avviket skyldes at 7 av disse 8 sakene oppnådde tilstrekkelig samlet score til å få `status: "conflict"`, mens den 8. saken — **1946 #9 (Old Boys)** — falt tilbake til `status: "ambiguous"` fordi ingen enkeltkandidat nådde terskelen `STRONG_SCORE` (60), til tross for at resultatkonflikten (5–0) fra oktober og datoen (1946-07-11) fra juli ble aggregert globalt.
* Verken de 7 `conflict`-statusene eller de 10 `confirmed`-statusene i Batch 01 var dermed garantert hendelseskoherente i den opprinnelige kjøringen.

### Effektivitet
* **Gjennomsnittlig antall NB-forespørsler per automatisk hypotese:** 16.69
* **Gjennomsnittlig antall berikede utgaver per automatisk hypotese:** 4.80

---

## 3. Statusfordeling for automatiske saker (45 singletons)

I samsvar med v1-policyen ble alle 55 sibling-saker rutet direkte til manuell vurdering (`reviewReason: sibling_group`) uten unødige API-kall.

Fordelingen blant de **45 automatiske singleton-sakene** i den rå batchrapporten:

| Status | Antall | Andel (%) | Beskrivelse |
| :--- | :---: | :---: | :--- |
| **confirmed** | 10 | **22.2 %** | Dato og resultat funnet (merk: flere saker blandet bevis fra ulike hendelser). |
| **conflict** | 7 | **15.6 %** | Kampdato funnet, og avisas resultat avviker fra kilden. |
| **probable** | 5 | **11.1 %** | Kamp/dato identifisert, men mangler fullstendig scorebekreftelse. |
| **ambiguous** | 18 | **40.0 %** | Flere mulige datoer/artikler, eller forhåndsomtale uten sluttresultat. |
| **not_found** | 5 | **11.1 %** | Ingen relevante avisutgaver funnet med standard søkenøkkel. |
| **Totalt** | **45** | **100.0 %** | |

---

## 4. Kvalitetskontroll og funn om event-sammenblanding

### A. Observasjon av event-sammenblanding i `confirmed`
En grundig manuell kildegjennomgang av de 10 sakene med status `confirmed` avdekket at flere saker ikke var hendelseskoherente:

* **1949 #2 vs Herd (kilde: 2–4):** Valgt dato ble satt til `1949-08-21` (fra en august-artikkel), mens resultatbeviset `4–2` kom fra en annen kamp i [Sunnmørsposten 1949-06-17, s. 3](https://www.nb.no/items/be1c570e6e541ed3e0e225d039799bc1?page=3) som pekte på `1949-06-12`. Dato og resultat tilhørte to separate kamper.
* **1946 #15 vs Ranheim (kilde: 2–2):** Valgt dato ble satt til `1946-07-09` (fra en juli-artikkel), mens resultatbeviset pekte på en kamp i juni (`1946-06-16`).
* **Ekte sammenhengende bekreftelser:** Eksempler som `1948 #15` vs Nordlandet (6–1, 1948-05-06) og `1949 #5` vs Øvre Telemark Kretslag (0–1, 1949-07-10) har helhetlige og sammenhengende dato- og resultatbevis fra samme hendelse og er reelle bekreftelser.

### B. Gjennomgang av de 7 `conflict`-sakene
1. `1945 #3` vs Herd: Kilden oppgir 5–1. [Sunnmørsposten 1945-07-09, s. 2](https://www.nb.no/items/996171a08ad98118ad1097f4f42254ab?page=2) refererer kamp 1945-07-08 med 2–0 til AaFK.
2. `1946 #23` vs Herd: Kilden oppgir 3–2. [Sunnmørsposten 1946-05-31, s. 3](https://www.nb.no/items/8308a93a2da1e40182258f1f90969044?page=3) refererer kamp 1946-05-30 med 5–2.
3. `1947 #8` vs Skarbøvik: Kilden oppgir 1–0. [Sunnmørsposten 1947-06-02, s. 3](https://www.nb.no/items/a30220bab7b19402a6aaaf84544c5fa1?page=3) refererer kamp 1947-06-01 med 4–1.
4. `1947 #11` vs Nordlandet: Kilden oppgir 1–1. [Sunnmørsposten 1947-08-25, s. 3](https://www.nb.no/items/6907ff25365ef85e08332b354883414e?page=3) refererer kamp 1947-08-24 med 2–1.
5. `1947 #19` vs Ørsta: Kilden oppgir 2–0. [Sunnmørsposten 1947-06-16, s. 2](https://www.nb.no/items/b9f26b17b28591454cc2728abf168881?page=2) refererer kamp 1947-06-15 med 2–1.
6. `1948 #4` vs Ørsta: Kilden oppgir 2–4. [Sunnmørsposten 1948-05-31, s. 3](https://www.nb.no/items/72b8ec34ebd51bf2fd363c894e2c23a0?page=3) refererer kamp 1948-05-30 med 3–1.
7. `1948 #22` vs Clausenengen: Kilden oppgir 0–3. [Sunnmørsposten 1948-08-23, s. 3](https://www.nb.no/items/0ea813630869f93082af8f0e8f7ea036?page=3) refererer kamp 1948-08-20 med 1–4.

### C. `probable`-saker (5 saker)
* `1946 #10` vs Skjerm, Danmark (7–0): Omtalt i [Sunnmørsposten 1946-10-05, s. 5](https://www.nb.no/items/0f2428d54279b2e05cce61bd28006fb4?page=5), mangler presis dato.
* `1947 #5` vs Frigg, Oslo (3–3): Kampdato 1947-10-26 funnet i [Sunnmørsposten 1947-10-27, s. 1](https://www.nb.no/items/06c6294bc3f1fc99072c75ca51bf3494?page=1).
* `1948 #5` vs Treff, Molde (1–1): Kampdato 1948-06-27 funnet i [Sunnmørsposten 1948-06-28, s. 2](https://www.nb.no/items/963f2218be2c92dbe17338af39dcc1f8?page=2).
* `1948 #7` vs Snøgg, Notodden (2–4): Kampdato 1948-07-06 funnet i [Sunnmørsposten 1948-07-06 s. 4 / 07-07 s. 3](https://www.nb.no/items/51ccfcaff48b2f557263234a552a8f68?page=4).
* `1948 #25` vs Veblungsnes (1–0): NM-kamp 1948-06-27 funnet i [Sunnmørsposten 1948-06-28, s. 2](https://www.nb.no/items/963f2218be2c92dbe17338af39dcc1f8?page=2).

### D. Gjennomgang av alle 18 automatiske `ambiguous`-saker
De 18 sakene faller i tre hovedkategorier:

1. **Dato funnet, men mangler parsbar sluttscore i berikede utdrag (7 saker):**
   * `1945 #7` Spjelkavik: Dato 1945-06-24 funnet, men ingen bekreftet score i utdraget.
   * `1946 #6` Kvik, Halden: Dato 1946-07-11 funnet i forhåndsomtale, mangler sluttresultat.
   * `1946 #25` Falken, Høyanger: Dato 1946-08-11 funnet, mangler sluttresultat.
   * `1946 #26` Freidig, Trondheim: Dato 1946-09-08 funnet («gårsdagens»), mangler sluttresultat.
   * `1948 #6` Glimt, Bodø: Dato 1948-07-02 funnet, mangler sluttresultat.
   * `1948 #8` Lyn, Oslo: Dato 1948-05-23 funnet, mangler sluttresultat.
   * `1949 #4` Halmia, Sverige: Dato 1949-06-18 funnet, mangler sluttresultat.

2. **Konkurrerende datobevis fra ulike avishendelser (9 saker):**
   * `1945 #10` Herd/Aksla Skarbøvik: Bevis peker mot både 1945-08-24 og 1945-09-12.
   * `1945 #12` Hødd: Bevis peker mot både 1945-07-05 og 1945-08-29.
   * `1945 #18` Træff, Molde: Bevis peker mot både 1945-08-17 og 1945-08-24.
   * `1946 #7` Reidulf, Oslo: Bevis peker mot både 1946-07-11 og 1946-09-22.
   * `1946 #8` Veblungsnes: Bevis peker mot både 1946-05-12 og 1946-09-01.
   * `1947 #4` Dr. Ballklubb: Bevis peker mot både 1947-07-04 og 1947-10-26.
   * `1947 #13` Molde: Bevis peker mot flere ulike datoer (1947-06-22, 1947-06-28, 1947-07-19, 1947-10-05, 1947-10-26).
   * `1948 #26` Fremad, L.hammer: Bevis peker mot både 1948-06-20 og 1948-08-20.
   * `1949 #3` Dr. Ballklubb: Bevis peker mot både 1949-06-02 og 1949-08-21.

3. **Event-splitt / uavklart kobling (2 saker):**
   * `1946 #5` KFK i Molde: Flere artikler nevnt, men ingen entydig datokandidat.
   * `1946 #9` Old Boys: Dato 1946-07-11 fra juli-utgave, mens 5–0-score stammet fra oktober.

### E. `not_found`-saker (5 av 5)
1. `1945 #6` vs Politiaspirantene (7–3): Privatkamp/uvanlig motstander.
2. `1946 #11` vs Braatt (10–1): Bortekamp i Kristiansund.
3. `1947 #6` vs Valdemarsvik, Sverige (6–4): Utenlandsk turnélag.
4. `1948 #9` vs Hälsingland Kretslag, Sverige (2–1): Svensk kretslag.
5. `1948 #27` vs Skeid, Oslo (2–4): Privatkamp.

---

## 5. Konklusjon og tiltak

1. **Pipeline og infrastruktur er stabil:** 751 NB-kall ble gjennomført uten feil eller API-blokkeringer.
2. **Kritisk krav til neste iterasjon:** Avstemmingen må gjøres **hendelseskoherent**. Dato og resultat må stamme fra samme sammenhengende avishendelse (`NewspaperEvent`) før en hypotese kan klassifiseres som `confirmed` eller `conflict`.
3. **Neste steg:** Implementere hendelseskoherent avstemming i en egen kode-PR og legge til regresjonstester for enkeltsakene før det kjøres nye batcher.
