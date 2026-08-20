# Evaluering av NB-avisdiscovery: Batch 02 V3 (Konservativ hjemme/borte-inferens)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: 260 ukoblede kamphypoteser i perioden 1950–1964 (ikke-overlappende med Batch 01)  
Kodeversjon: Konservativ `homeAway`-inferens (ingen antagelse om hjemmebane fra seierssifre, fjerning av `AWAY_CITIES`)  
Kommandolinje:
```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1950 --to-year 1964 \
  --unlinked-only --limit 260 \
  --output .cache/ingest/nb-newspaper-discovery/batch-02-v3.yaml
```

---

## 1. Nøkkeltall: Sammenligning mot tidligere versjoner

| Parameter | Batch 02 (historisk) | Batch 02 V2 (tidskausal) | Batch 02 V3 (konservativ) | Endring fra V2 |
| :--- | :---: | :---: | :---: | :--- |
| **totalHypotheses** | 260 | 260 | **260** | Identisk populasjonsutvalg |
| **automaticSingletonHypotheses** | 61 | 61 | **61** | 100 % behandlet automatisk |
| **manualSiblingHypotheses** | 199 | 199 | **199** | Rutet direkte til review (`sibling_group`) |
| **confirmed** | 6 | 6 | **8** | **+2**: Clausenengen 1952 #16 og Måløy 1955 #34 bekreftes |
| **conflict** | 6 | 2 | **2** | Uendret |
| **probable** | 3 | 3 | **3** | Uendret |
| **ambiguous** | 240 (41 auto + 199 man) | 244 (45 auto + 199 man) | **242 (43 auto + 199 man)** | **-2**: Løftet til confirmed |
| **not_found** | 5 | 5 | **5** | Uendret |
| **candidateIssuesFound** | 4 629 | 4 629 | **4 629** | Uendret |
| **issuesEnriched** | 298 | 298 | **298** | Uendret |
| **nbRequests** | 999 | 999 | **999** | 16.38 kall per automatisk sak |
| **hypothesesWithTemporalEvidence** | 51 | 51 | **51** | 83.6 % har tidsbevis |
| **hypothesesWithResultAgreement** | 8 | 8 | **8** | 8 av 8 confirmed |
| **hypothesesWithResultConflict** | 6 | 5 | **5** | Målt i råtreff (2 endelige konflikter) |
| **Ambiguous-kø inkl. siblings** | 240 / 260 | 244 / 260 | **242 / 260** | 93.1 % av utvalget |
| **Reell manuell kø (inkl. probable & not_found)** | 248 / 260 | 252 / 260 | **250 / 260** | 96.2 % av utvalget |

---

## 2. Manuell kontroll av Confirmed (8) og Conflict (2) i V3

### A. Alle 8 `confirmed`-saker

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Kildehints og observasjon |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1952 #4` Eid** | 2–3 | `1952-05-18` (**high**) | 3–2 (rev) | **106** | [Sunnmørsposten 19.05.1952 s. 3](https://www.nb.no/items/860e6053c29be84051f099a53d5fb617?page=3) | Referat «i går», `homeAway: away` bekreftet |
| **`1952 #8` Årstad** | 5–1 | `1952-07-04` (**high**) | 5–1 | **92** | [Sunnmørsposten 05.07.1952 s. 3](https://www.nb.no/items/d8a17ff56d2c49d69b2a1efb2ed354dc?page=3) | Referat «i går», privatkamp på Kråmyra |
| **`1952 #9` Lyn, Gjøvik** | 1–3 | `1952-07-10` (**high**) | 3–1 (rev) | **92** | [Sunnmørsposten 11.07.1952 s. 5](https://www.nb.no/items/a127a05d28e31b9829490c8feb733637?page=5) | Referat «i går», privatkamp |
| **`1952 #16` Clausenengen** | 1–0 | `1952-05-04` (**high**) | 1–0 | **92** | [Sunnmørsposten 05.05.1952 s. 3](https://www.nb.no/items/860e6053c29be84051f099a53d5fb617?page=3) | Referat «i går» fra Kristiansund, 1. divisjon |
| **`1953 #6` Moss FK** | 2–0 | `1953-07-07` (**high**) | 2–0 | **67** | [Sunnmørsposten 08.07.1953 s. 3](https://www.nb.no/items/b97694a34074db019578c785cee664dd?page=3) | Referat «i går», privatkamp |
| **`1953 #19` Hødd** | 3–1 | `1953-08-23` (**high**) | 3–1 | **117** | [Sunnmørsposten 24.08.1953 s. 2](https://www.nb.no/items/dd7a9b1eb4db00a7752eebc9aa569ae4?page=2) | Resultatbørs 1. divisjon «i går» |
| **`1955 #34` Måløy** | 3–2 | `1955-07-24` (**high**) | 3–2 | **92** | [Sunnmørsposten 25.07.1955 s. 2](https://www.nb.no/items/e892c57805177264a7536d7a12eec5bf?page=2) | Referat mandag «i går», turnékamp i Måløy |
| **`1958 #15` Braatt** | 1–1 | `1958-05-11` (**high**) | 1–1 | **80** | [Sunnmørsposten 12.05.1958 s. 2](https://www.nb.no/items/7ddff643a17e4d54af5b9b1cc7202151?page=2) | Referat «i går», cupomtale |

*Vurdering:* 8 av 8 (100 %) i det kontrollerte utvalget er høykvalitets bekreftelser med `matchDate.confidence: high` og fullstendig samsvar med kildens opplysninger.

### B. Alle 2 `conflict`-saker

| Sak / Motstander | Kilde-score | Utledet dato (`confidence`) | Avis-score | Confidence | NB-lenke | Kildekritisk observasjon |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`1953 #5` Skarbøvik** | 4–0 | `1953-08-22` (**low**) | 4–2 | **76** | [Sunnmørsposten 24.08.1953 s. 2](https://www.nb.no/items/dd7a9b1eb4db00a7752eebc9aa569ae4?page=2) | Avisa oppgir 4–2 til AaFK, kilden 4–0. Entydig enkeltkamp. |
| **`1956 #10` Braatt** | 2–3 | `1956-08-19` (**high**) | 2–2 | **86** | [Sunnmørsposten 20.08.1956 s. 2](https://www.nb.no/items/6c8a954e78462194c98565773b88293e?page=2) | Avisa oppgir 2–2, kilden 2–3 (tap). Entydig enkeltkamp. |

---

## 3. Endringer fra V2 til V3
- **Clausenengen 1952 #16:** Kilden oppga bortekamp (`homeAwayHint: away`). Avisen omtalte borteseieren 1–0 i Kristiansund som *«Seiren ble så knepen som 1—0»*. I V2 førte sifferrekkefølgen til at `homeAway: home` ble feilaktig satt, noe som ga en falsk konflikt. I V3 forblir `homeAway: unknown` når teksten mangler eksplisitte ord som «bortekamp» / «Kråmyra». Uten konflikt bekreftes kampen trygt med dato `1952-05-04` (`high`).
- **Måløy 1955 #34:** Kilden oppga bortekamp. Avisen omtalte seieren 3–2 på turné i Måløy. I V2 fikk denne også feilaktig `homeAway: home` pga. sifferrekkefølgen. I V3 er `homeAway: unknown`, og saken bekreftes med dato `1955-07-24` (`high`).

---

## 4. Aggregert evaluering: Batch 01 V4 + Batch 02 V3 Samlet (106 singletons)

| Parameter | Batch 01 V4 | Batch 02 V3 | Samlet (Batch 01+02) | Andel av singletons |
| :--- | :---: | :---: | :---: | :---: |
| **Automatiske singleton-hypoteser** | 45 | 61 | **106** | 100 % |
| **Confirmed** | 6 | 8 | **14** | **13.2 %** |
| **Conflict** | 3 | 2 | **5** | **4.7 %** |
| **Probable** | 3 | 3 | **6** | **5.7 %** |
| **Ambiguous** | 83 (28 auto + 55 man) | 242 (43 auto + 199 man) | **325 (71 auto + 254 man)** | **90.3 % av utvalget** |
| **Not found** | 5 | 5 | **10** | **2.8 % av utvalget** |
| **Løsningsgrad (Confirmed + Conflict)** | 9 (20.0 %) | 10 (16.4 %) | **19** | **17.9 %** |
| **NB-forespørsler** | 751 | 999 | **1 750** | **16.51 per hypotese** |
| **NB-forespørsler per løst sak** | 83.4 | 99.9 | **92.1 per sak** | |
| **Ambiguous-kø inkl. siblings** | 83 / 100 (83.0 %) | 242 / 260 (93.1 %) | **325 / 360** | **90.3 % av utvalget** |
| **Reell manuell kø (inkl. probable & not_found)** | 91 / 100 (91.0 %) | 250 / 260 (96.2 %) | **341 / 360** | **94.7 % av utvalget** |

### Kvalitetsvurdering:
1. **Observert presisjon i manuell revisjon:** 14 av 14 `confirmed` (100 %) og 5 av 5 `conflict` (100 %) i det kontrollerte utvalget er fullstendig fri for kildeavvik, klyngefeil eller usikre allokeringer.
2. **Reconcile- og inferens-reglene er robuste og deterministiske.**

---

## 5. Beslutningsport: `READY_FOR_CONTROLLED_SIBLING_EXPERIMENT`

Alle krav for beslutningsporten er tilfredsstilt:
1. **Live smoke:** Samtlige manifestcaser passerer `pnpm --filter @aafkstats/ingest run nb-newspaper-smoke` med 0 feil.
2. **Ingen falske positive:** 0 falske bekreftelser og 0 falske konflikter i det nye batchkjøringen.
3. **CI-integritet:** Vanlig testpakke (`pnpm test`) er 100 % deterministisk og grønn uten nettverkskall.
4. **Sikker default:** Default v1 sender alle sibling-grupper uendret til manuell review.
