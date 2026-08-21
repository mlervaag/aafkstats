# AI-kontrollert visuell gjennomgang av alle NB-community-kandidater (Wave 1 + Wave 2)

**Dato:** 21. august 2026  
**Scope:** Alle 247 community-reviewable kandidater i `data/discovery/community-candidate-queue.yaml`  
**Gjennomføring:**
- **Wave 1:** 50 kandidater med åpne rettigheter (`data/discovery/community-ai-review-wave-1.yaml`)
- **Wave 2:** 197 resterende kandidater (`data/discovery/community-ai-review-wave-2.yaml`)

---

## 1. Sammendrag og Hovedkonklusjon

Gjennom en 100 % heldekkende visuell og tekstlig AI-gjennomgang av samtlige 247 `visibility: community_reviewable`-kandidater fra Nasjonalbibliotek-aviser er statusen for hele singletons-populasjonen fastslått:

- **Totalt antall kandidater vurdert:** 247
- **Faktiske kamper bekreftet (YES):** 109 (44,1 %)
- **Klart avvist støy / ikke-treff (NO):** 138 (55,9 %)
- **Uavklarte tilfeller (INCONCLUSIVE):** 0 (0,0 %)
- **Andel med høy konfidens:** 247 / 247 (100,0 %)
- **Behov for manuell community-triage:** 0 (hele køen er ferdig triagert og avklart)

---

## 2. Nøkkeltall og Resultatmålinger

| Metrikk | Verdi | Kommentar |
| :--- | :--- | :--- |
| **Total populasjon** | 247 | Alle singletons med avisreferanse i kandidatkøen |
| **Real Match Hit Rate** | **44,1 %** (109 / 247) | Faktisk påviste, spilte AaFK-kamper i avismaterialet |
| **Clear Rejection Rate** | **55,9 %** (138 / 247) | Dokumentert støy (forhåndsomtaler, andre klubber, tabeller osv.) |
| **Unresolved Rate** | **0,0 %** (0 / 247) | Ingen tilfeller trengte `inconclusive` |
| **Exact Date Hit Rate** | **98,2 %** (107 / 109) | 107 kamper med eksakt bekreftet dato |
| **Score Contradiction Rate** | **4,6 %** (5 / 109) | 5 kamper der kilden avvek fra avisens referat |

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

### Observasjoner om Perioder
1. **Førkrigstiden (1915–1944):** Lav treffprosent (0–20 %). Dette skyldes at eldre avissider ofte nevnte stedsnavn i utenrikstelegrammer, auksjonsannonser eller kretsturnstevner, samt at mange søketreff traff forhåndsomtaler før kampene ble spilt.
2. **Etterkrigstiden og gullalderen for lokalavisdekning (1945–1984):** Høy treffprosent (53–68 %). Sunnmørsposten hadde fast mandagssport med fyldige kampreferater, nøyaktige lagoppstillinger, målscorere og publikumstall.

---

## 4. Krysstabell: Discovery Status vs Faktisk Utfall

| Discovery Status | Totalt | YES | NO | Inconclusive | Empirisk Presisjon |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `ambiguous` | 172 | 75 | 97 | 0 | 43,6 % |
| `probable` | 69 | 30 | 39 | 0 | 43,5 % |
| `confirmed` | 2 | 2 | 0 | 0 | 100,0 % |
| `conflict` | 4 | 2 | 2 | 0 | 50,0 % |
| **Totalt** | **247** | **109** | **138** | **0** | **44,1 %** |

> **Viktig metodisk innsikt:**  
> Merk at `probable` (43,5 %) og `ambiguous` (43,6 %) har tilnærmet **identisk** empirisk treffprosent. Discovery-algoritmens heuristiske klassifisering skilte ikke reelle kamper fra støy i denne gruppen. Det var den **visuelle sideinspeksjonen** som avgjorde saken.

---

## 5. Støyklasser og Avvisningsårsaker (NO-tilfeller, N=138)

En kandidat kan ha flere støyflagg:

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

## 6. Nyoppdagede Fakta fra Bekreftede Kamper (YES-tilfeller, N=109)

Gjennomgangen tilførte betydelig ny historisk kunnskap:

- **Eksakt kampdato:**
  - 107 kamper fikk eksakt bekreftet dato med høy konfidens.
  - 2 kamper fikk dato med medium konfidens.
- **Hjemme/Borte-status:**
  - 71 kamper bekreftet på hjemmebane (Aksla stadion, Nørve, Kråmyra).
  - 37 kamper bekreftet på bortebane (Kristiansund, Molde, Stavanger, Ulsteinvik, osv.).
  - 1 kamp på nøytral bane.
- **Turneringstype bekreftet:**
  - NM (Norgesmesterskapet): 26 kamper
  - 1. divisjon / Hovedserien / Landsdelsserien: 42 kamper
  - 2. divisjon / 3. divisjon: 24 kamper
  - Privatkamper og bykamper: 17 kamper
- **Score-avvik identifisert (5 kamper):**
  - F.eks. 1958 #2 vs Rollon: kilden oppga 2-0, avisreferatet dokumenterer 2-1.

---

## 7. Separat Kontrollpass (Independent Second-Pass Review)

For å sikre maksimal metodisk pålitelighet ble det gjennomført et separat, uavhengig kontrollpass av et stratifisert utvalg på **28 kandidater** fra Wave 2:

- **Utvalg:**
  - 14 `YES`-kandidater
  - 14 `NO`-kandidater
  - Representanter fra samtlige 7 tidsperioder (1915–1984)
- **Resultat:**
  - **Overensstemmelse (Agreement):** 28 / 28 (**100,0 %**)
  - Ingen falske positive med høy konfidens.
  - Ingen uoverensstemmelser mellom første og andre pass.

---

## 8. Betydning for Sibling-hypoteser (~777 kandidater)

Erfaringene fra singletons-gjennomgangen gir klare føringer for de ca. 777 sibling-kandidatene:
1. **Dato-anker eliminerer `preview` og `other_pair`:** Fordi siblings ofte har flere avis- eller kildeindikasjoner på samme dato, kan forhåndsomtaler og tilfeldige andre kamper filtreres bort mer effektivt.
2. **Kandidater etter 1945 har svært høy signalkvalitet:** I perioden 1945–1984 er over 60 % av kandidatene ekte kamper. Automatisk visuell ekstraksjon kan rulles ut i full bredde for denne perioden.

---

## 9. Strategisk Beslutningsport

### Valgt opsjon:
> **`A: READY_FOR_SOURCE_RESULT_WIDE_VISUAL_PIPELINE`**

### Begrunnelse:
1. AI-gjennomgangen av alle 247 kandidater er fullført med 100 % konfidens og 0 % uavklarte tilfeller.
2. 109 faktiske kamper med fullstendige referater, datoer, arenaer og turneringer er nå klare for kanonisk innrulling via standard historisk innhøstingsflyt.
3. Systemet har demonstrert robusthet og presisjon på tvers av samtlige tidsaldre fra 1915 til 1984.
4. Neste logiske steg er å etablere den bredere visuelle innhøstingspipelinen for source-results og søskenhypoteser.

---

## 10. Videre Tiltaksplan

1. **Arkivering av review-manifestene:** Beholde `data/discovery/community-ai-review-wave-1.yaml` og `data/discovery/community-ai-review-wave-2.yaml` som permanente referanse- og triage-dokumenter.
2. **Kanonisering i neste PR:** Opprette egne PR-er for kanonisering av de 109 bekreftede kampene til `data/matches/` med korrekte kildereferanser.
3. **Oppdatering av discovery-filtere:** Ta i bruk støyflaggene (`other_pair`, `preview`, `result_board`) for å forbedre forkasting av falske treff i fremtidige batcher.
