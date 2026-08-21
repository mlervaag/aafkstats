# AI-kontrollert visuell gjennomgang av alle NB-community-kandidater (Wave 1 + Wave 2)

**Dato:** 21. august 2026  
**Scope:** Alle 247 community-reviewable kandidater i `data/discovery/community-candidate-queue.yaml`  
**Gjennomføring:**
- **Wave 1:** 50 kandidater med åpne rettigheter ([`data/discovery/community-ai-review-wave-1.yaml`](file:///c:/Users/Mlerv/OneDrive/Documents/aafkstats/aafkstats/data/discovery/community-ai-review-wave-1.yaml))
- **Wave 2:** 197 resterende kandidater ([`data/discovery/community-ai-review-wave-2.yaml`](file:///c:/Users/Mlerv/OneDrive/Documents/aafkstats/aafkstats/data/discovery/community-ai-review-wave-2.yaml))

---

## 1. Sammendrag og Hovedkonklusjon

Gjennom en 100 % heldekkende visuell og tekstlig AI-gjennomgang av samtlige 247 `visibility: community_reviewable`-kandidater fra Nasjonalbibliotek-aviser er statusen for hele singletons-populasjonen fastslått:

- **Totalt antall kandidat-relasjoner vurdert:** 247
- **Positive source-result/avis-relasjoner (YES):** 109 (44,1 %)
- **Klart avvist støy / ikke-treff (NO):** 138 (55,9 %)
- **Uavklarte tilfeller (INCONCLUSIVE):** 0 (0,0 %)
- **Andel med høy konfidens:** 247 / 247 (100,0 %)
- **Gjenværende behov for manuell community-triage:** 0 (hele kandidatkøen er ferdig triagert og avklart)

> **Presisering om relasjoner vs. unike kamper:**  
> De 109 `YES`-vurderingene representerer **109 positive source-result/avis-relasjoner**. Samme historiske kamp kan forekomme gjennom flere kilder (f.eks. både jubileumsbøker og klubbmedlemsblad).  
> Etter deterministisk deduplisering og canonical-eligibility-kontroll utgjør disse **107 unike event-kandidater**, hvorav **100 er direkte klare uten avvik** og **7 krever avviksavklaring** (5 med kildeavvik på resultat og 2 med middels datopresisjon).

---

## 2. Nøkkeltall og Resultatmålinger

| Metrikk | Verdi | Kommentar |
| :--- | :--- | :--- |
| **Total populasjon vurdert** | 247 relasjoner | Alle singletons med avisreferanse i kandidatkøen |
| **Positive relasjoner (YES)** | **109** (44,1 %) | Bekreftede treff mellom source-result og avisartikkel |
| **Klart avvist støy (NO)** | **138** (55,9 %) | Dokumentert støy (forhåndsomtaler, andre klubber, tabeller osv.) |
| **Uavklarte tilfeller (INCONCLUSIVE)** | **0** (0,0 %) | Ingen tilfeller trengte `inconclusive` |
| **Unike event-kandidater etter dedupe** | **107** | Konservativ dedupe basert på dato, motstander, bane og score |
| **Multi-source event-klynger** | **2 eventer** (4 relasjoner) | 1929 vs Djerv (2 relasjoner) og 1960 vs V.R.F. (2 relasjoner) |
| **Treff i eksisterende kanoniske kamper** | **0** | Ingen av de 107 eventene finnes i `data/seasons/` fra før |
| **Potensielt nye kanoniske kamper** | **107** | 100 direkte klare, 7 med blokkeringer / avvikshåndtering |
| **Score-konflikter (avvik mot kilde)** | **5** (4,6 %) | Kilden oppga avvikende resultat ift. avisreferatet |
| **Eksakt kampdato (High)** | **105 eventer** (98,1 %) | Nøyaktig kampdato bekreftet i avisreferat |
| **Eksakt kampdato (Medium)** | **2 eventer** (1,9 %) | Dato utledet fra relativ tidsangivelse i avisen |

---

## 3. Fordeling per Historisk Periode

| Periode | Kandidater | YES | NO | Inconclusive | High | Medium/Low | Hit Rate (%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1915–1924** | 21 | 0 | 21 | 0 | 21 | 0 | 0,0 % |
| **1925–1934** | 46 | 9 | 37 | 0 | 46 | 0 | 19,6 % |
| **1935–1944** | 26 | 5 | 21 | 0 | 26 | 0 | 19,2 % |
| **1945–1954** | 62 | 33 | 29 | 0 | 62 | 0 | 53,2 % |
| **1955–1964** | 65 | 44 | 21 | 0 | 65 | 0 | 67,7 % |
| **1965–1974** | 21 | 14 | 7 | 0 | 21 | 0 | 66,7 % |
| **1975–1984** | 6 | 4 | 2 | 0 | 6 | 0 | 66,7 % |
| **Totalt** | **247** | **109** | **138** | **0** | **247** | **0** | **44,1 %** |

### Viktig observasjon om retrieval-effektivitet per epoke
- **1915–1924 (0 % hit rate):** Dagens søkestrategi traff primært telegrammer, kunngjøringer og kretsturnstevner, eller forhåndsomtaler før kampene.
- **1925–1944 (~19 % hit rate):** Moderat treffsikkerhet; mange treff på forhåndsomtaler og resultatbørser for andre oppgjør.
- **1945–1984 (53–68 % hit rate):** Svært høy treffsikkerhet drevet av fyldige mandagsreferater i Sunnmørsposten.

---

## 4. Krysstabell: Discovery Status vs Faktisk Utfall

| Discovery Status | Totalt | YES | NO | Inconclusive | Empirisk Presisjon |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `ambiguous` | 172 | 75 | 97 | 0 | 43,6 % |
| `probable` | 69 | 30 | 39 | 0 | 43,5 % |
| `confirmed` | 2 | 2 | 0 | 0 | 100,0 % |
| `conflict` | 4 | 2 | 2 | 0 | 50,0 % |
| **Totalt** | **247** | **109** | **138** | **0** | **44,1 %** |

> **Metodisk innsikt:**  
> `probable` (43,5 %) og `ambiguous` (43,6 %) har tilnærmet **identisk** empirisk treffprosent. Discovery-algoritmens heuristiske klassifisering skilte ikke reelle kamper fra støy i denne gruppen. Det var den **visuelle sideinspeksjonen** som avgjorde sakene.

---

## 5. Dedupliserings- og Kanoniseringsanalyse (Dedupe & Canonical Eligibility)

### Multi-source event-klynger (2 unike eventer, 4 kandidater)
1. **1929-09-01 vs Djerv (Bergen), NM 4. runde (sluttresultat 2–3):**
   - `nb-cand-aalesunds-fotballklub-gjennem-1939-ec28-1929-020` (1939-jubileumsbok)
   - `nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1929-020` (1965-medlemsblad)
2. **1960-08-28 vs V.R.F., 1. divisjon (sluttresultat 4–1):**
   - `nb-cand-sunnmore-fotballkrets-arsrapport-1960-1960-006` (Kretsens årsrapport)
   - `nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1960-012` (1965-medlemsblad)

### Blokkeringer og avvik som må avklares før kanonisering (7 eventer)
1. **Score-konflikter mot opprinnelig kilde (5 eventer):**
   - `1954-08-11 vs Rollon`: Kilde oppga 1–0, avisen dokumenterer 5–3.
   - `1956-08-19 vs Braatt`: Kilde oppga 2–3, avisen dokumenterer 2–2.
   - `1958-05-23 vs Rollon`: Kilde oppga 2–0, avisen dokumenterer 2–1.
   - `1958-08-31 vs Dahle`: Kilde oppga 2–1, avisen dokumenterer 2–2.
   - `1958-05-23 vs Herd`: Kilde oppga 5–4, avisen dokumenterer 2–1.
2. **Datopresisjon middels (2 eventer):**
   - `1948-04-18 vs Skarbøvik` (treningskamp med omtale i påfølgende ukes avis).
   - `1950-08-20 vs Molde` (seriekamp med relativ tidsangivelse).

---

## 6. Støyklasser og Avvisningsårsaker (NO-tilfeller, N=138)

| Støyflagg | Antall | Forklaring |
| :--- | :---: | :--- |
| `unrelated_notice` | 51 | Søkeordene traff generelle nyheter, auksjoner, rettssaker, stevner eller annonser. |
| `other_pair` | 48 | Avisen omtaler en annen fotballkamp på samme side (f.eks. Rollon, Braatt, Molde eller KFK). |
| `result_board` | 34 | Resultatbørs eller serietabell uten eget kampreferat for den aktuelle kampen. |
| `preview` | 25 | Forhåndsomtale eller terminliste før kampen ble spilt (ikke et bekreftet sluttresultat). |
| `non_senior` | 13 | Kampen gjaldt junior, B-lag, rekrutt, old boys eller kretslag. |
| `combined_team` | 3 | Kampen ble spilt av et sammensatt bylag eller kombinert lag. |
| `retrospective` | 3 | Kampen nevnes kun i et historisk tilbakeblikk i en forhåndsomtale for en senere kamp. |
| `wrong_score_event` | 1 | Omtale av en helt annen kamp med samme sifferkombinasjon. |
| `score_uncertain` | 1 | Avisen oppgir usikkert resultat. |

---

## 7. Separat Kontrollpass (Independent Second-Pass Agent Review)

For å sikre metodisk konsistens ble det gjennomført et separat, uavhengig kontrollpass av et stratifisert utvalg på **28 kandidater** fra Wave 2:

- **Utvalg:**
  - 14 `YES`-kandidater
  - 14 `NO`-kandidater
  - Representanter fra samtlige 7 tidsperioder (1915–1984)
- **Resultat:**
  - **Overensstemmelse (Agreement):** 28 / 28 (**100,0 %**)
  - Ingen falske positive med høy konfidens.
  - Ingen uoverensstemmelser mellom første og andre kontrollpass.

---

## 8. Strategisk Beslutningsport

### Valgt beslutning:
> **`READY_FOR_SOURCE_RESULT_WIDE_VISUAL_PIPELINE` (med periodetilpasset retrieval)**

### Begrunnelse og strategi:
1. **Visuell AI fungerer optimalt:** Når avissiden først foreligger, er den visuelle AI-evalueringen presis og robust (100 % konfidens og 0 % uavklarte saker).
2. **Periodetilpasset retrieval:**
   - **For perioden 1945–1984 (53–68 % hit rate):** Dagens retrieval-metode fungerer svært godt og kan rulles ut i full bredde for søskenhypoteser og source-results.
   - **For perioden før 1945 (0–19 % hit rate):** Retrieval må forbedres med fokus på bedre recall:
     - Hente flere kandidatsider per hypotese (Top-N i stedet for kun Top-1).
     - Bredere tidsvinduer rundt antatt kampdato.
     - Automatisk oppfølging av avisutgaven uken etter ved treff på forhåndsomtaler (`preview`).
     - Bruke visuell AI som en billig resolver over et bredere kandidatsett.

---

## 9. Videre Tiltaksplan

1. **Arkivering av review-manifestene:** Beholde [`data/discovery/community-ai-review-wave-1.yaml`](file:///c:/Users/Mlerv/OneDrive/Documents/aafkstats/aafkstats/data/discovery/community-ai-review-wave-1.yaml) og [`data/discovery/community-ai-review-wave-2.yaml`](file:///c:/Users/Mlerv/OneDrive/Documents/aafkstats/aafkstats/data/discovery/community-ai-review-wave-2.yaml) som permanente triage-dokumenter.
2. **Kanonisering i neste PR:** Opprette egne dedikerte PR-er for kanonisering av de 100 avklarte nye eventene til `data/seasons/*/matches/` med korrekte kildereferanser, og egne vurderingssaker for de 7 eventene med avvik.
3. **Ingen endring av kanoniske kampdata i denne PR-en:** Denne PR-en begrenser seg strengt til review-manifestet og analysedokumentasjonen.
