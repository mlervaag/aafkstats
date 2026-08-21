# Evaluering av NB-avisdiscovery: Batch 03 (Sluttføring av singleton-baseline)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: De resterende 180 ukoblede kamphypotesene i perioden 1945–1964 (58 automatiske singletons og 122 manual siblings), etter at Batch 01 (100) og Batch 02 (260) er ekskludert basert på stabile `hypothesisId`-er.  
Kodeversjon: Standard v1-modus (uten `--resolve-siblings`, med PR #181 tidskausalitet og PR #183 konservativ home/away-inferens).  
Kommandolinje (reproduserbar via stabil ID-liste):
```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --hypothesis-ids-file packages/ingest/test/fixtures/nb-newspaper-batch-03-ids.txt \
  --output .cache/ingest/nb-newspaper-discovery/batch-03.yaml
```

---

## 1. Nøkkeltall for Batch 03

| Parameter | Batch 03 Verdi | Merknad |
| :--- | :---: | :--- |
| **totalHypotheses** | **180** | Resterende populasjon (540 - 360) |
| **automaticSingletonHypotheses** | **58** | 100 % av resterende singletons |
| **manualSiblingHypotheses** | **122** | Rutet direkte til review (`sibling_group`) |
| **confirmed** | **4** | Herd 1961 #17, Årstad 1963 #11, Sunnmøringen 1963 #14, Hødd 1963 #18 |
| **conflict** | **3** | Sandane 1949 #16, Volda 1959 #18, Valder 1964 #3 |
| **probable** | **13** | Omtaler/datoer funnet, men mangler score-samsvar |
| **ambiguous** | **158** (36 auto + 122 man) | 122 sibling_group + 36 auto med usikre/manglende data |
| **not_found** | **2** | Zelj, Zarajevo 1962 #7 og 1964 #9 (utenlandske turnélag) |
| **candidateIssuesFound** | **4 527** | Avisutgaver identifisert |
| **issuesEnriched** | **266** | Utgaver med fulltekstanalyse |
| **nbRequests** | **929** | API-kall mot Nasjonalbiblioteket |
| **hypothesesWithTemporalEvidence** | **43** | 74.1 % av singletons har tidsbevis |
| **hypothesesWithResultAgreement** | **4** | 4 confirmed |
| **hypothesesWithResultConflict** | **5** | Råkonflikter (3 endelige konflikter) |
| **hypothesesWithoutUsefulTemporalEvidence** | **15** | 25.9 % uten tidsbevis |
| **siblingGroupsSkipped** | **54** | Sibling-grupper rutet til manuell kø |
| **NB-kall per automatisk hypotese** | **16.02** | 929 / 58 |
| **NB-kall per confirmed/conflict** | **132.71** | 929 / 7 |

---

## 2. Manuell kontroll av Confirmed (4) og Conflict (3) i Batch 03

### A. Alle 4 `confirmed`-saker

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Kildekritisk observasjon |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1961 #17` Herd** | 1–2 | `1961-06-16` (**low**) | 2–1 (rev) | **87** | [Sunnmørsposten 17.06.1961 s. 6](https://www.nb.no/items/046080e8c5e70308851a755172974b2e?page=6) | Lørdagsavis refererer fredagens cup/privatkamp, Herd vant 2–1 (AaFK 1–2). Korrekt. |
| **`1963 #11` Årstad** | 0–4 | `1963-07-21` (**high**) | 4–0 (rev) | **119** | [Sunnmørsposten 22.07.1963 s. 3](https://www.nb.no/items/4ec32ae7ea9824af72ed1ef01dc8a888?page=3) | Mandagsavis omtaler søndagens kamp «i går», Årstad slo AaFK 4–0 i Bergen. Korrekt. |
| **`1963 #14` Sunnmøringen** | 0–2 | `1963-09-29` (**high**) | 2–0 (rev) | **77** | [Sunnmørsposten 30.09.1963 s. 2](https://www.nb.no/items/19487f9ee69ed326bca1b4e93ae20c7a?page=2) | Mandagsavis refererer kampen «i går», Sunnmøringen slo AaFK 2–0. Korrekt. |
| **`1963 #18` Hødd** | 2–5 | `1963-09-07` (**low**) | 5–2 (rev) | **78** | [Sunnmørsposten 11.09.1963 s. 6](https://www.nb.no/items/dca714f3de453690ab577b4622fe49ae?page=6) | NM-kamp 2. runde på Høddvoll lørdag 7. september, Hødd vant 5–2. Korrekt. |

*Kvalitetsvurdering for Batch 03:* 4 av 4 saker fra Batch 03 fremstår som plausible treff ved preliminær kontroll. Endelig kanonisering forutsetter full visuell faksimilekontroll mot primærkilden i produksjon.

### B. Alle 3 `conflict`-saker

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Kildekritisk observasjon |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1949 #16` Sandane** | 3–1 | `1949-06-05` (**low**) | 12–2 | **77** | [Sunnmørsposten 10.06.1949 s. 3](https://www.nb.no/items/54bdb91c6e3f07eee24362bef1f931de?page=3) | Avisen omtaler oppgjør med store sifre (12–2), mens kilden oppgir 3–1. Reell kildekonflikt. Korrekt stoppet. |
| **`1959 #18` Volda** | 5–2 | `1959-08-02` (**high**) | 10–1 | **67** | [Sunnmørsposten 03.08.1959 s. 2](https://www.nb.no/items/d8bc98b86487ffa44867907700d9edef?page=2) | Mandagsavis omtaler kamp «i går» med sifrene 10–1, mens medlemsbladet oppgir 5–2. Kildedivergens fanget opp. |
| **`1964 #3` Valder** | 8–2 | `1964-04-25` (**low**) | 2–0 | **77** | [Sunnmørsposten 27.04.1964 s. 2](https://www.nb.no/items/fe8a6fcf858e806daac06824f4181141?page=2) | Avisen omtaler lørdagskamp med 2–0, mens kilden oppgir 8–2. Reell kildekonflikt. Korrekt stoppet. |

*Kvalitetsvurdering:* 3 av 3 (100 %) er **reelle kildekonflikter** der avis og kilde oppgir divergerende resultater. Presisjon for `conflict`: **100 %**.

---

## 3. Representativt utvalg fra Probable, Ambiguous og Not Found

- **Probable (13 saker):**
  - `1949 #18 Mesna IF` (3–2): Dato `1949-09-18` (high) funnet i Sunnmørsposten 19.09.1949, men uten eksplisitt scoretekst i samme avsnitt.
  - `1960 #5 Juniorkretslaget` (5–1): Treningskamp omtalt med dato `1960-04-26` (low).
  - `1960 #6 Ørsta` (7–2) & `1960 #7 Vigra` (13–1): Lokale kamper funnet, men mangler full score-matching.
  - `1961 #12 Brage` (2–1): Kampomtale 1961-06-05 (low).
  - `1963 #9 Spartak` (1–6) & `1963 #13 Horsens` (3–1): Internasjonale privatkamper bekreftet omtalt med sikker dato, men scoreformatet i avisen er sammensatt.
  - `1964 #13 Årstad` (1–0): Sunnmørsposten 27.07.1964 s. 3 har artikkel med resultat 1–0, men mangler entydig datoindeks i brødteksten (`date: unknown`).
- **Ambiguous (auto-singletons: 36 saker):**
  - `1949 #10 KFK` (1–1): Har resultatliste «i går 1–1 (away)», men har flere uoverensstemmende datoer i andre dagsaviser (`date.disagreement`), holdt konservativt i ambiguous.
  - `1949 #13 Braatt` (2–2): Avis oppgir 4–2 på lørdag 1949-06-11, score mismatch.
  - `1960 #21 Clausenengen` (1–1): Sikker dato `1960-05-22` (high), men mangler eksplisitt score i utdraget.
  - `1964 #7 Aksla` (5–2): Avisen oppgir 4–1 den 26. mai 1964.
- **Not Found (2 saker):**
  - `1962 #7 Zelj, Zarajevo` (1–4) og `1964 #9 Zelj, Zarajevo` (1–5): Jugoslavisk turnélag/privatkamp (FK Željezničar Sarajevo); ingen avisartikler funnet under de vanlige skrivemåtene.

---

## 4. Samlet Singleton-Status for hele populasjonen (164 singletons)

Med fullføringen av Batch 03 er **samtlige 164 automatiske singletons** i hele populasjonen (1945–1964) ferdig innhøstet og vurdert:

| Parameter | Batch 01 V4 (100) | Batch 02 V3 (260) | Batch 03 (180) | **Totalt / Kumulativt (164 singletons)** |
| :--- | :---: | :---: | :---: | :--- |
| **Automatiske singletons** | 45 | 61 | 58 | **164** (100 % dekning) |
| **Confirmed** | 6 | 8 | 4 | **18** |
| **Conflict** | 3 | 2 | 3 | **8** |
| **Probable** | 3 | 3 | 13 | **19** |
| **Ambiguous (automatiske singletons)** | 28 | 43 | 36 | **107** |
| **Not Found** | 5 | 5 | 2 | **12** |
| **NB-forespørsler (requests)** | 751 | 999 | 929 | **2 679** |

### Samlede Nøkkeltall og Erfaringer fra Produksjonskontroll (PR #186):

1. **Pipeline-identifiserte Confirmed:** Totalt **18 saker** klassifisert som `confirmed` av discovery-algoritmen.
2. **Erfaring fra første fullstendige faksimilekontroll (Batch 01 i PR #186):**
   - **3 av 6 kanonisert direkte (50.0 %):** Ranheim, Nordlandet og Øvre Telemark ble fullt verifisert mot Nasjonalbibliotekets avisfaksimiler.
   - **2 av 6 falske positive (33.3 %):** Aksla 1948 #2 og Langevåg 1948 #13 skyldtes at discovery klynget tall og klubbnavn på tvers av separate notiser på samme avisside.
   - **1 av 6 manglende eksakt dato (16.7 %):** Herd 1949 #2 omtaler det historiske møtet, men mangler sikker kampdato.
   - **Endelig precision for alle 18 `confirmed`:** Må anses som *ikke ferdig målt* inntil samtlige saker har gjennomgått tilsvarende full visuell faksimilekontroll i produksjon.
3. **Observert presisjon for Conflict:** **100.0 %** (8 av 8 saker representerer reelle kildedivergenser; 0 falske konflikter).
4. **Løsningsgrad i discovery (Confirmed + Conflict):** **15.9 %** (26 av 164 singletons rutet til løsningskandidater).
5. **Manuell køandel (Probable + Ambiguous + Not Found):** **84.1 %** (138 av 164 singletons trygt rutet til manuell inspeksjon).
6. **NB-kostnad per automatisk hypotese:** **16.34** API-kall (2 679 / 164).
7. **NB-kostnad per discovery-kandidat (confirmed/conflict):** **103.04** API-kall (2 679 / 26).
8. **Fordeling av Date Confidence for alle 26 løste saker:**
   - **High confidence:** **16 / 26** (61.5 %)
   - **Low confidence:** **10 / 26** (38.5 %) (utledet fra ukedag som «søndag/lørdag» i påfølgende mandagsavis)
   - **Medium confidence:** 0 / 26
