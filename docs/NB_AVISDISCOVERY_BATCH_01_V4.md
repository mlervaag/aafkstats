# Evaluering av NB-avisdiscovery: Batch 01 V4 (Kumulativ: Tidskausalitet & Konservativ Home/Away)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: De 100 første ukoblede kamphypotesene i perioden 1945–1964  
Kodeversjon: PR #181 (tidskausal klynging) + PR #183 (konservativ `homeAway`-inferens og regex-escaping)  
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

Batch 01 V3 ble kjørt før PR 181. Batch 01 V4 representerer den kumulative effekten av både tidskausalitetsbeskyttelsen (PR 181) og den konservative home/away-inferensen (PR 183):

| Parameter | Batch 01 V2 (hendelseskoherent) | Batch 01 V3 (hintvalidert) | Batch 01 V4 (kumulativ) | Endring fra V3 |
| :--- | :---: | :---: | :---: | :--- |
| **totalHypotheses** | 100 | 100 | **100** | Identisk populasjonsutvalg |
| **automaticSingletonHypotheses** | 45 | 45 | **45** | 100 % automatisk behandlet |
| **manualSiblingHypotheses** | 55 | 55 | **55** | Rutet direkte til review (`sibling_group`) |
| **confirmed** | 5 | 4 | **6** | **+2**: Aksla 1948 #2 (tidskausalitet) og Nordlandet 1948 #15 (homeAway) |
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

## 2. Manuell kontroll av Confirmed (6) og Conflict (3) i V4 samt Produksjonsverifikasjon (PR #186)

### A. De 6 `confirmed`-sakene fra discovery og fasit etter full faksimilekontroll

Tabellen under viser status i discovery-pipeline sammenstilt med faktisk fasit etter full visuell faksimileverifikasjon i produksjonsinnhøstingen (PR #186):

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Discovery status | Full faksimilekontroll (PR #186) | Ground truth status | Kanoniseringsstatus |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- | :--- |
| **`1946 #15` Ranheim** | 2–2 | `1946-06-16` (**low**) | 2–2 | Confirmed (80) | [Sunnmørsposten 17.06.1946 s. 2](https://www.nb.no/items/af8f813e3c216326b9ee3e0de58ae934?page=2). Fullt referat fra Kristiansund bekrefter turnering lørdag 15. juni 1946. Ranheim ledet 2–0, AaFK utlignet til 2–2 (mål: Thor Tolaas 75', Karl Løvold 82'). | `facsimile_verified` | `canonicalizable` (opprettet som `1946-06-15-aalesunds-fk-ranheim`) |
| **`1948 #2` Aksla** | 4–0 | `1948-09-12` (**low**) | 4–0 | Confirmed (80) | [Sunnmørsposten 13.09.1948 s. 2](https://www.nb.no/items/cbe628172c918375fcfa15f5d3ff2ce0?page=2). **Falsk positiv:** Avisen har *ingen* 4–0-kamp mellom AaFK og Aksla. Omtaler en walkover i 3. div (B-lag) som ikke ble spilt, samt Aksla–Sykkylven 0–4 (s. 4). Discovery klynget separate notiser. | `false_positive` | `not_canonicalizable` (forblir ukoblet) |
| **`1948 #13` Langevåg** | 2–5 | `1948-05-15` (**low**) | 2–5 | Confirmed (78) | [Sunnmørsposten 18.05.1948 s. 3](https://www.nb.no/items/7296eeedf43258308f8872c3ab3b4fda?page=3). **Falsk positiv:** Avisen har *ingen* kamp mellom AaFK og Langevåg. Omtaler Sykkylven–Langevåg 5–2, Skarbøvik–AaFK 4–1 og Rollon–AaFK 2–0 (B-lag). Discovery koblet tall på tvers av artikler. | `false_positive` | `not_canonicalizable` (forblir ukoblet) |
| **`1948 #15` Nordlandet** | 6–1 | `1948-05-06` (**high**) | 6–1 | Confirmed (92) | [Sunnmørsposten 07.05.1948 s. 3](https://www.nb.no/items/7cda78a78859ee7142e92f2c724d4122?page=3). Referat under «1. divisjon. Å. F. K.-Nordlandet» bekrefter kamp spilt i Kr.sund Kr. Himmelfartsdag torsdag 6. mai 1948 (over 2000 tilskuere). Nordlandet 1, AaFK 6. | `facsimile_verified` | `canonicalizable` (opprettet som `1948-05-06-nordlandet-aalesunds-fk`) |
| **`1949 #2` Herd** | 2–4 | `1949-06-12` (**low**) | 4–2 (rev) | Confirmed (87) | [Sunnmørsposten 17.06.1949 s. 3](https://www.nb.no/items/be1c570e6e541ed3e0e225d039799bc1?page=3). Forhåndsomtale av en *utsatt* privatkamp nevner at Herd vant 4–2 i første møte, men oppgir **ingen eksakt dato**. Kampen fant ikke sted 12.06.1949. | `article_relationship_verified`, `exact_date_not_verified` | `not_canonicalizable` (forblir ukoblet) |
| **`1949 #5` Øvre Telemark Kretslag** | 0–1 | `1949-07-10` (**high**) | 0–1 | Confirmed (80) | [Sunnmørsposten 11.07.1949 s. 2](https://www.nb.no/items/ccc608592b713b4338a54a48a2822378?page=2). Referat «Telemarks-laget vant 1-0 over AaFK» dokumenterer privatkamp på Aksla stadion søndag kveld 10. juli 1949. AaFK tapte 0–1. | `facsimile_verified` | `canonicalizable` (opprettet som `1949-07-10-aalesunds-fk-ovre-telemark-kretslag`) |

*Kvalitets- og verifikasjonsvurdering:*
- **Pipeline-klassifisering:** Discovery klassifiserte 6 saker som `confirmed`.
- **Tidligere preliminær snippet-evaluering:** Antok 6 av 6 som korrekte basert på isolert tekstsøk.
- **Full faksimilekontroll i PR #186 (Ground Truth):**
  - **3 av 6 kanoniserbare (50.0 %):** Ranheim, Nordlandet og Øvre Telemark er fullt verifisert mot primærkilden og opprettet som kanoniske kamper.
  - **2 av 6 falske positive (33.3 %):** Aksla og Langevåg skyldtes at discovery klynget tall og klubbnavn fra separate artikler på samme avisside.
  - **1 av 6 ufullstendig dato (16.7 %):** Herd bekrefter riktig møte/resultat, men mangler sikker kampdato og kan derfor ikke kanoniseres uten gjetting.

Dette viser hvorfor NB-discovery må forbli beslutningsstøtte, og at visuell faksimilekontroll mot primærkilden er obligatorisk før kanonisering.

### B. Alle 3 `conflict`-saker

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Kildekritisk observasjon |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- | :--- |
| **`1945 #3` Herd** | 5–1 | `1945-07-08` (**high**) | 2–0 | **67** | [Sunnmørsposten 09.07.1945 s. 2](https://www.nb.no/items/996171a08ad98118ad1097f4f42254ab?page=2) | Avisa oppgir 2–0, kilden 5–1. Entydig enkeltkamp. Holdt uavklart for separat konflikt-PR. |
| **`1947 #8` Skarbøvik** | 1–0 | `1947-06-01` (**high**) | 4–1 | **67** | [Sunnmørsposten 02.06.1947 s. 3](https://www.nb.no/items/a30220bab7b19402a6aaaf84544c5fa1?page=3) | Avisa oppgir 4–1, kilden 1–0. Entydig enkeltkamp. Holdt uavklart for separat konflikt-PR. |
| **`1948 #4` Ørsta** | 2–4 | `1948-05-30` (**high**) | 3–1 | **67** | [Sunnmørsposten 31.05.1948 s. 3](https://www.nb.no/items/72b8ec34ebd51bf2fd363c894e2c23a0?page=3) | Avisa oppgir 3–1, kilden 2–4. Entydig enkeltkamp. Holdt uavklart for separat konflikt-PR. |

*Kvalitetsvurdering:* Samtlige 3 saker er **observert korrekt etter manuell kontroll** som reelle kildeavvik mot entydige samtidige kampreferater.

---

## 3. Endringsanalyse: Hvorfor sakene endret status i V4
- **Aksla 1948 #2 (4–0):** Gikk fra `ambiguous` til `confirmed` i V4 pga. tidskausal klynging, men full faksimilekontroll i PR #186 viste at klyngingen koblet disconnected notiser. Saken representerer en pipeline-svakhet som skal rekalibreres i en egen PR.
- **Nordlandet 1948 #15 (6–1):** Gikk fra `ambiguous` til `confirmed` i V4 etter konservativ home/away-inferens (PR #183). Full faksimilekontroll bekreftet kampen (spilt Kr. Himmelfartsdag 6. mai 1948 i Kristiansund, Nordlandet 1, AaFK 6).
