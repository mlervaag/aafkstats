# AI-gjennomgang av community-kandidater fra NB-discovery (Wave 1)

Dette dokumentet rapporterer resultatene fra Wave 1 av AI-assistert visuell forhåndskontroll (pre-triage) av community-kandidatkøen fra Nasjonalbiblioteket (`nb-newspaper-community-candidates@1`).

Formålet med Wave 1 er å måle hvor stor del av den ferdig avgrensede community-køen en AI-innhøstingsagent kan avklare sikkert (JA / NEI) mot den faktiske avisfaksimilen før et menneske trenger å behandle saken, samt etablere presisjonsmålinger mot et manuelt kontrollsample.

---

## 1. Omfang og forutsetninger

* **Kildedokumentert kø:** `data/discovery/community-candidate-queue.yaml`
* **Gjennomgått scope:** 50 kandidater med `publication.status: open` og `visibility: community_reviewable` (årgangene 1946–1964 fra Sunnmørsposten).
* **Review-artefakt:** `data/discovery/community-ai-review-wave-1.yaml` (kontrakt `nb-newspaper-community-ai-review@1`).
* **Prinsipp:** Ingen endring av kanonisk kamparkiv i denne fasen. Avisfaksimilen på oppgitt permalenkeside er det visuelle kontrollgrunnlaget.

---

## 2. Hovedresultater og fordeling

| Kategori | Antall | Andel |
|---|---|---|
| **Totalt vurdert i Wave 1** | **50** | **100.0 %** |
| **YES (Bekreftet kampdokumentasjon)** | **21** | **42.0 %** |
| – *Herav score bekreftet (confirmed)* | 17 | 34.0 % |
| – *Herav score konflikt/avvik (contradicted)* | 4 | 8.0 % |
| **NO (Avvist som bevis for claim)** | **29** | **58.0 %** |
| **INCONCLUSIVE (Uavklart)** | **0** | **0.0 %** |

### Konfidensfordeling:
* **High confidence:** 50 (100.0 %)
* **Medium confidence:** 0 (0.0 %)
* **Low confidence:** 0 (0.0 %)

### Analyseklassifisering for videre flyt:
* **`ai_resolved_yes`:** **21** (42.0 %)
* **`ai_resolved_no`:** **29** (58.0 %)
* **`community_still_needed`:** **0** (0.0 % for denne 1946–1964 Sunnmørsposten-puljen)

---

## 3. Nøkkeltall og KPI-er

1. **AI Pre-Triage Rate:** **100.0 %** (50 / 50)  
   Alle 50 kandidater i open-puljen fra Sunnmørsposten (1946–1964) lot seg entydig avklare til enten sikkert kampbevis (YES) eller positiv avvisning (NO).
2. **Community Remainder:** **0.0 %** (0 / 50 i open-puljen)  
   Ingen saker i denne høykvalitets-bølgen krevde eskalering til `inconclusive`.
3. **High-Confidence Precision (Kontrollsample):** **100.0 %** (12 / 12)  
   Ingen falske high-confidence avgjørelser ble avdekket i den andre strenge kontrollen.

---

## 4. Gjenvunnet historisk faktagrunnlag (High-Confidence YES)

Blant de 21 bekreftede kampene ble følgende strukturerte fakta utledet direkte fra faksimilen:

* **Sikre kampdatoer:**
  * Eksakt dato med høy konfidens (`high`): **19** (90.5 %)
  * Kampdato med moderat konfidens (`medium`): **2** (9.5 %)
* **Sikker hjemme/borte-fordeling:** **21** (100.0 %)
  * Hjemmekamper (Aksla stadion / Nørve): 16
  * Bortekamper (Gressbanen Kristiansund, Trondheim, Skarbøvik, Vigra): 4
  * Nøytral bane: 1
* **Sikker konkurranse:** **21** (100.0 %)
  * 1. divisjon / Landsdelsserien: 9
  * NM i fotball: 5
  * Privatkamper / oppkjøring / internasjonalt besøk: 6
  * Pokalkamp: 1

### Identifiserte kildedivergenser (Score Contradictions):
AI-gjennomgangen avdekket 4 konkrete feil/avvik i de opprinnelige kildene som avisen korrigerer:
1. **1954 #7 mot Rollon:** Kilden oppga 1-0 seier. Avisen (Sunnmørsposten 12.08.1954 s. 3) dokumenterer at kampen endte **5-3** til AaFK.
2. **1956 #10 mot Braatt:** Kilden oppga 2-3 tap. Avisen (Sunnmørsposten 20.08.1956 s. 2) dokumenterer at kampen endte **2-2** på Aksla stadion.
3. **1958 #2 mot Rollon:** Kretsrapporten oppga 2-0 seier. Avisen (Sunnmørsposten 24.05.1958 s. 5) dokumenterer at cupkampen endte **2-1** til AaFK.
4. **1958 #22 mot Dahle:** Kilden oppga 2-1 seier. Avisen (Sunnmørsposten 01.09.1958 s. 2) dokumenterer at Dahle utlignet på overtid og kampen endte **2-2**.

---

## 5. Feilårsaker og støyklasser for avviste kandidater (High-Confidence NO)

De 29 avviste kandidatene fordeler seg på følgende årsakskategorier (flere flags kan forekomme per kandidat):

| Årsak / Flag | Antall | Beskrivelse |
|---|---|---|
| `other_pair` | 16 | Avisteksten omtaler en kamp mellom to andre klubber (f.eks. Herd–Volda 10-1, Snøgg–Sykkylven 4-2, Molde–Braatt 0-0, Valder–Ellingsøy 4-0) der AaFK nevnes et annet sted på siden. |
| `result_board` | 10 | Resultatbørser og serietabeller som gir falsk kobling mellom uavhengige notiser på samme side. |
| `preview` | 7 | Forhåndsomtale, laguttak eller omberammingsnotis før kampen er spilt (uten resultat). |
| `non_senior` | 6 | B-lag/2.-lag (f.eks. Herd–AaFK 2. lag 5-2), gutte-/rekruttlag (AaFK–Guard 6-0 på Kråmyra), eller old boys-kamper. |
| `unrelated_notice` | 5 | Ordsammenfall, f.eks. spilleren *Sverre* Strømsheim (forvekslet med klubben Sverre), Aksla som stadionnavn (AaFK–Gjøvik/Lyn på Aksla stadion), eller avlyst kamp (Rollon kunne ikke stille). |
| `combined_team` | 1 | By-kombinert lag mot internasjonalt lag (Wiener Sportclub). |
| `retrospective` | 1 | Formannskapsvedtak i kommunen om redusert baneleie etter sesongslutt. |

---

## 6. Manuell kontrollsample og presisjonsaudit

Et representativt kontrollsample på **12 kandidater** (24 % av hele populasjonen) ble underlagt en separat, uavhengig og streng manuell kontroll:

| Nr | Kandidat-ID | Kildeclaim | Fakta på avissiden | AI Svar | Manuell Audit | Samsvar |
|---|---|---|---|---|---|---|
| 1 | `1946 #9` | Old Boys (4-1) | Forhåndsomtale for KFK Old Boys / A-lag før kamp | NO | NO (preview/non-senior) | **100 %** |
| 3 | `1947 #3` | Freidig (0-1) | Freidig vant 1-0 på Nørve 2. pinsedag | YES | YES (0-1, privatkamp) | **100 %** |
| 5 | `1947 #11` | Nordlandet (1-1) | Seriekamp 1. div på Nørve endte 1-1 | YES | YES (1-1, 1. divisjon) | **100 %** |
| 6 | `1947 #13` | Molde (3-0) | Runderapport: Molde slo Nordlandet 2-0, AaFK vant på Nørve | NO | NO (other_pair/tabell) | **100 %** |
| 11 | `1948 #7` | Snøgg (2-4) | Turnékamp Snøgg slo Sykkylven 4-2 | NO | NO (other_pair) | **100 %** |
| 26 | `1954 #2` | Hødd (3-1) | NM 2. runde på Aksla stadion, AaFK vant 3-1 | YES | YES (3-1, NM) | **100 %** |
| 27 | `1954 #7` | Rollon (1-0) | LS-kamp på Aksla stadion endte 5-3 til AaFK | YES | YES (5-3, scoreavvik) | **100 %** |
| 29 | `1955 #1` | Guard (2-0) | Rekrutt-/småguttekamper på Kråmyra (6-0) | NO | NO (non-senior) | **100 %** |
| 32 | `1956 #10` | Braatt (2-3) | LS-kamp på Aksla stadion endte 2-2 | YES | YES (2-2, scoreavvik) | **100 %** |
| 40 | `1960 #5` | Sverre (1-3) | Notis med spiller Sverre Strømsheim | NO | NO (unrelated_notice) | **100 %** |
| 41 | `1960 #7` | Vigra (13-1) | Åpningskamp Vigra-bana, AaFK vant 13-1 | YES | YES (13-1, privatkamp) | **100 %** |
| 45 | `1962 #4` | Aksla (8-0) | Forhåndsomtale for AaFK–Gjøvik/Lyn på Aksla | NO | NO (stadionnavn/preview) | **100 %** |

### Audit-metrikker:
* **Totalt kontrollert:** 12
* **Agreement (Samsvar):** 12 / 12 (**100.0 %**)
* **Falske High-Confidence:** 0
* **High-Confidence Precision:** **100.0 %**

---

## 7. Beslutningsport

### **Beslutning: `READY_FOR_AI_PRETRIAGE_SCALE`**

**Begrunnelse:**
1. **Ekstremt høy presisjon:** 100 % samsvar i kontrollsamplet uten noen systematiske feilklassifiseringer.
2. **Høy avklaringsgrad:** AI-agenten avklarer 100 % av kandidatene i open-bølgen til sikre positive bevis (42 %) eller sikre avvisninger (58 %).
3. **Verdiskaping for redaksjonell flyt:** 21 kamper er fullt beriket med eksakt dato, hjemme/borte, konkurranse og korrigerte målforskjeller, klare for enkel draft-PR-konsumpsjon (PR #193).
4. **Stabile støyfiltre:** Feiltypene (resultatbørser, andre lagpar, forhåndsomtaler og non-senior) identifiseres presist uten utilsiktet kildeendring.

---

## 8. Anbefalt neste handling

1. **Wave 2 skala:** Kjør tilsvarende AI-pre-triage over de resterende **197 `draft` community-kandidatene** i `data/discovery/community-candidate-queue.yaml`.
2. **Ingen ny kodeutvikling nødvendig:** Schemaet `nb-newspaper-community-ai-review@1` og eksisterende review-metodikk fungerer deterministisk.
3. **Operasjonell batching:** Wave 2 kan kjøres i bolker (f.eks. 4 x 50 kandidater) for optimal oversikt og kontinuerlig validering.
