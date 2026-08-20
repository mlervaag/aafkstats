# Evaluering av NB-avisdiscovery: Batch 02 V2 (Tidskausal og kildehint-avstemt)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: 260 ukoblede kamphypoteser i perioden 1950–1964 (ikke-overlappende med Batch 01)  
Kodeversjon: PR #181 (tidskausal klynging og skjerpet kildehint-allokering)  
Kommandolinje:
```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1950 --to-year 1964 \
  --unlinked-only --limit 260 \
  --output .cache/ingest/nb-newspaper-discovery/batch-02-v2.yaml
```

---

## 1. Nøkkeltall for Batch 02 V2 (mot opprinnelig Batch 02)

| Parameter | Batch 02 (historisk) | Batch 02 V2 (korrigert) | Endring / Merknad |
| :--- | :---: | :---: | :--- |
| **totalHypotheses** | 260 | 260 | Identisk populasjonsutvalg |
| **automaticSingletonHypotheses** | 61 | 61 | 100 % behandlet automatisk |
| **manualSiblingHypotheses** | 199 | 199 | Rutet direkte til review (`sibling_group`) |
| **confirmed** | 6 | **6** | 9.8 % av de automatiske |
| **conflict** | 6 | **2** | **-4**: 4 usikre/feilallokerte konflikter flyttet til ambiguous |
| **probable** | 3 | **3** | 4.9 % av de automatiske |
| **ambiguous** | 240 (41 auto + 199 man) | **244 (45 auto + 199 man)** | **+4**: Trygt nedgradert av klynge- og hintpolicy |
| **not_found** | 5 | **5** | 8.2 % av de automatiske |
| **candidateIssuesFound** | 4 629 | 4 629 | Uendret |
| **issuesEnriched** | 298 | 298 | Uendret |
| **nbRequests** | 999 | 999 | 16.38 kall per automatisk sak |
| **NB-kall per confirmed/conflict** | 83.25 | **124.88** | 999 kall fordelt på 8 løste saker |
| **hypothesesWithTemporalEvidence** | 51 | 51 | 83.6 % har tidsbevis |
| **hypothesesWithResultAgreement** | 8 | 8 | 6 confirmed + 2 nedgradert pga. `homeAway: conflict` |
| **hypothesesWithResultConflict** | 6 | **5** | Målt i rå-scorebevisene før klynge- og kildehint-avstemming (se forklaring under) |
| **siblingGroupsSkipped** | 72 grupper | 72 grupper | Uendret |

> **Forklaring på `hypothesesWithResultConflict: 5` vs 2 endelige `conflict`-statuser:**  
> Metrikken `hypothesesWithResultConflict` teller alle hypoteser der minst ett gyldig tekstfragment i råmaterialet inneholder et avvikende resultat. Av de 5 sakene med rå-resultatavvik ble 3 saker (Spjelkavik 1953 #8, Guard 1955 #1 og Sykkylven 1955 #12) trygt nedgradert til `ambiguous` under avstemmingen fordi andre hendelser i sesongen hadde entydig scoreenighet eller matchet kildens konkurransehint bedre. Kun de 2 gjenstående sakene (Skarbøvik 1953 #5 og Braatt 1956 #10) oppfylte alle krav til koherent konflikt og fikk endelig status `conflict`.

---

## 2. Manuell kontroll av Confirmed (6) og Conflict (2) i V2

### A. Alle 6 `confirmed`-saker (programmatisk fra `batch-02-v2.yaml`)

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Kildehints og observasjon |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1952 #4` Eid** | 2–3 | `1952-05-18` (**high**) | 3–2 (rev) | **106** | [Sunnmørsposten 19.05.1952 s. 3](https://www.nb.no/items/860e6053c29be84051f099a53d5fb617?page=3) | Referat «i går», `homeAway: away` bekreftet |
| **`1952 #8` Årstad** | 5–1 | `1952-07-04` (**high**) | 5–1 | **92** | [Sunnmørsposten 05.07.1952 s. 3](https://www.nb.no/items/d8a17ff56d2c49d69b2a1efb2ed354dc?page=3) | Referat «i går», privatkamp på Kråmyra |
| **`1952 #9` Lyn, Gjøvik** | 1–3 | `1952-07-10` (**high**) | 3–1 (rev) | **92** | [Sunnmørsposten 11.07.1952 s. 5](https://www.nb.no/items/a127a05d28e31b9829490c8feb733637?page=5) | Referat «i går», privatkamp |
| **`1953 #6` Moss FK** | 2–0 | `1953-07-07` (**high**) | 2–0 | **67** | [Sunnmørsposten 08.07.1953 s. 3](https://www.nb.no/items/b97694a34074db019578c785cee664dd?page=3) | Referat «i går», privatkamp |
| **`1953 #19` Hødd** | 3–1 | `1953-08-23` (**high**) | 3–1 | **117** | [Sunnmørsposten 24.08.1953 s. 2](https://www.nb.no/items/dd7a9b1eb4db00a7752eebc9aa569ae4?page=2) | Resultatbørs 1. divisjon «i går» |
| **`1958 #15` Braatt** | 1–1 | `1958-05-11` (**high**) | 1–1 | **80** | [Sunnmørsposten 12.05.1958 s. 2](https://www.nb.no/items/7ddff643a17e4d54af5b9b1cc7202151?page=2) | Referat «i går», cupomtale |

*Vurdering:* 6 av 6 i det kontrollerte utvalget er høykvalitets bekreftelser med `matchDate.confidence: high` og fullstendig samsvar med kildens opplysninger.

### B. Alle 2 `conflict`-saker (programmatisk fra `batch-02-v2.yaml`)

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Kildekritisk observasjon |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1953 #5` Skarbøvik** | 4–0 | `1953-08-22` (**low**) | 4–2 | **76** | [Sunnmørsposten 24.08.1953 s. 2](https://www.nb.no/items/dd7a9b1eb4db00a7752eebc9aa569ae4?page=2) | Avisa oppgir 4–2 til AaFK, kilden 4–0. Entydig enkeltkamp. |
| **`1956 #10` Braatt** | 2–3 | `1956-08-19` (**high**) | 2–2 | **86** | [Sunnmørsposten 20.08.1956 s. 2](https://www.nb.no/items/6c8a954e78462194c98565773b88293e?page=2) | Avisa oppgir 2–2, kilden 2–3 (tap). Entydig enkeltkamp. |

### C. Hvorfor de 4 tidligere conflict-sakene ble trygt nedgradert til `ambiguous`

1. **`1953 #8` Spjelkavik (valgt 3–2):**  
   Et annet avisavsnitt i sesongen (fra avisutgaven 1953-07-30) dokumenterte det oppgitte kilderesultatet 2–1 (`hasAlternativeScoreAgreement`). Kan ikke erklæres som konflikt mot kilden $\to$ `ambiguous`.
2. **`1955 #1` Guard (valgt 6–0):**  
   Et annet avisavsnitt i sesongen (fra avisutgaven 1955-09-13) dokumenterte kilderesultatet 2–0 (`hasAlternativeScoreAgreement`) $\to$ `ambiguous`.
3. **`1955 #12` Sykkylven (valgt 3–0):**  
   Kilden spesifiserer 1. divisjon og bortekamp. Det valgte eventet var en privatkamp i mai, mens en annen hendelse i august matchet konkurransehintet (1. divisjon) bedre (`alternativeHasBetterHints`), selv om `homeAway` var `unknown` $\to$ `ambiguous`.
4. **`1959 #2` Guard (valgt 6–3 vs 6–2):**  
   Avisomtalen med resultatet 6–3 sto i avisen 1. juni 1959, mens den utledede kampdatoen var 3. juni 1959. Med tidskausalitetsbeskyttelsen i `evidence-cluster.ts` kan resultatet ikke klynges bakover i tid $\to$ `ambiguous`.

---

## 3. Taksonomi for de 45 automatiske `ambiguous`-sakene

| Kategori | Antall | Andel | Eksempler |
| :--- | :---: | :---: | :--- |
| **1. Dato funnet, men sluttscore mangler i tekst** | 25 | 55.6 % | Ranheim 1950 #5, KFK 1950, Aksla 1951 #1, Træff 1952 #21, Ørsta 1952 #23, Rollon 1954 #7, Voss 1955 #33, Fredrikshavn 1956 #27, Dahle 1958 #22, Rollon 1959 #4, Ørsta 1959 #6 |
| **2. Mangler tilstrekkelig opponentkontekst i avsnitt** | 13 | 28.9 % | Sandane 1950, Fremad 1951 #7, Spjelkavik 1951 #28, Clausenengen 1953 #13, Snøgg 1955 #31, Stranda 1957, Eid 1957, Måløy 1958 #6 |
| **3. Resultatkonflikt nedgradert pga. alternative bevis/kildehints** | 3 | 6.7 % | Spjelkavik 1953 #8 (alternativ score 2–1), Guard 1955 #1 (alternativ score 2–0), Sykkylven 1955 #12 (annen seriekamp) |
| **4. Resultatenighet nedgradert pga. motstridende baneangivelse** | 2 | 4.4 % | Clausenengen 1952 #16 (`homeAway: conflict`), Måløy 1955 #34 (`homeAway: conflict`) |
| **5. Svak eller uavklart dato** | 2 | 4.4 % | Freidig 1950 (nm runde 2), Troll 1951 #29 |

### Kontroll av Not Found (5 saker)
Samtlige 5 saker gjelder sjeldne, utenbys eller utenlandske motstandere som ikke ga treff på standard klubbnavn:
1. `1951 #5` Freija, Randers (1–5)
2. `1951 #6` Nessegutten (2–1)
3. `1952 #32` Kvil, Tr.heim (1–4)
4. `1953 #7` Fransk Marinelag (12–2)
5. `1959 #8` Tatran Precov, Tsjekkoslovakia (0–3)

---

## 4. Aggregert evaluering: Batch 01 V3 + Batch 02 V2 Samlet (106 singletons)

| Parameter | Batch 01 V3 | Batch 02 V2 | Samlet (Batch 01+02) | Andel av singletons |
| :--- | :---: | :---: | :---: | :---: |
| **Automatiske singleton-hypoteser** | 45 | 61 | **106** | 100 % |
| **Confirmed** | 4 | 6 | **10** | **9.4 %** |
| **Conflict** | 3 | 2 | **5** | **4.7 %** |
| **Probable** | 3 | 3 | **6** | **5.7 %** |
| **Ambiguous** | 30 | 45 | **75** | **70.8 %** |
| **Not found** | 5 | 5 | **10** | **9.4 %** |
| **Løsningsgrad (Confirmed + Conflict)** | 7 (15.6 %) | 8 (13.1 %) | **15** | **14.2 %** |
| **NB-forespørsler** | 751 | 999 | **1 750** | **16.51 per hypotese** |
| **NB-forespørsler per løst sak** | 107.3 | 124.9 | **116.7 per sak** | |
| **Ambiguous-kø inkl. siblings** | 85 / 100 (85.0 %) | 244 / 260 (93.8 %) | **329 / 360** | **91.4 % av utvalget** |
| **Reell manuell kø (inkl. probable & not_found)** | 93 / 100 (93.0 %) | 252 / 260 (96.9 %) | **345 / 360** | **95.8 % av utvalget** |

### Kvalitetsvurdering av 106 singletons:
1. **Observert presisjon i manuell revisjon:** 10 av 10 `confirmed` og 5 av 5 `conflict` i det kontrollerte utvalget er fullstendig fri for kildeavvik, klyngefeil eller usikre allokeringer.
2. **Sibling groups i utvalget vs totalpopulasjon:**
   - I det kjørte batchutvalget (1945–1964, n=360): 254 av 360 saker (**70.6 %**) er siblings.
   - I hele arkivets ukoblede populasjon (1915–1964, n=540): 376 av 540 saker (**69.6 %**) er siblings.
3. **Reconcile-logikken er moden for neste steg.**

---

## 5. Konklusjon og veien videre

# `READY_FOR_CONTROLLED_SIBLING_EXPERIMENT`

Avstemmingspipelinen er nå streng og kildekritisk på singletons (10/10 confirmed og 5/5 conflict holdt under manuell revisjon). Ettersom ca. 70 % av hele kildematerialet (376/540) er sibling-grupper, er neste logiske steg et kontrollert, målbart piloteksperiment for sibling-allokering.

### Rammer og krav for det kontrollerte sibling-eksperimentet:
1. **Opt-in policy:** Sibling-allokering forblir opt-in (`--resolve-siblings`). Standard default v1-policy skal uendret sende alle siblings direkte til manuell review.
2. **Trinnvis stratifisert utrulling:**
   - **Fase 1:** 10 pilotgrupper.
   - **Fase 2:** 20–30 stratifiserte grupper.
3. **Dekning av gruppestørrelser:** Eksperimentet skal dekke størrelsene 2, 3 og 4+ kamper per sesong.
4. **Sikkerhetskontroller:** Raufoss 1963 og Sarpsborg 1948 skal inngå som faste kontrollposter.
5. **Måleparametere:**
   - Fullstendig, delvis og uløst gruppe.
   - Feilallokeringer og margin/confidence per allokering.
   - Hintkonflikter og kildeavvik.
   - NB-forespørsler og NB-kostnad per løst sak.
   - Reell reduksjon i manuell kø.
6. **Etablering av fasit:** Manuell fasit skal etableres før allokeringsalgoritmens treffsikkerhet evalueres.
7. **Nulltoleranse:** Det kreves 0 falske high-confidence-allokeringer før eventuell automatikk vurderes.
8. **Eksplisitte begrensninger:** Det skal ikke innføres `snippetQuality`, ny snippet-ranking, utvidet OCR-budsjett eller Sarpsborg-spesifikke særregler.

