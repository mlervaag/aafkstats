# Sluttrapport: Ekte Visuell Faksimile-Review av NB-kandidater 1945–1984 (60-case Kalibreringspilot)

**Dato:** 2026-08-21  
**Ansvarlig:** Antigravity AI  
**PR:** #199  
**Status / Beslutningsport:** `TRUE_VISUAL_PIPELINE_VALIDATED`  
**Input-manifest:** `data/discovery/nb-source-result-wide-candidates-1945-1984.yaml` (PR #198)  
**Output-manifest:** `data/discovery/nb-source-result-visual-review-1945-1984.yaml` (Contract: `nb-source-result-visual-review@1`)

---

## 1. Hovedmål og Metodisk Ombygging

PR #199 gjennomfører en **fundamentalt ekte visuell faksimile-review** av kandidatpopulasjonen fra PR #198 for perioden **1945–1984**:

### Kjerneendringer fra forrige iterasjon:
1. **Fjernet all automatisk faksimile-generering:** Ingen historiske fakta genereres fra `reasonCodes`, `machinePriority`, `expectedScore` eller datoheuristikk.
2. **Review-manifestet som autoritativ input:** CLI-verktøyet (`packages/ingest/src/cli/nb-visual-review-1945-1984.ts`) fungerer kun som validator, integritetskontrollør og rapportør.
3. **Kontrollert 60-case kalibreringspilot:** I stedet for å generere syntetiske resultater for alle 636 saker på én gang, har vi gjennomført en grundig, faktisk visuell gjennomgang av et representativt kalibreringssett på **60 saker**.
4. **Resterende 576 hypoteser:** Er eksplisitt markert som `unreviewed_awaiting_visual_batch` med `canonicalEligibility: insufficient`. Ingen påstås å være reviewet før faksimilen er åpnet.
5. **Ingen kanonisk mutasjon:** PR #199 muterer 0 produksjonsfiler.

---

## 2. Kalibreringspilotens Sammensetning (60 saker)

| Kategori | Antall Saker | Beskrivelse |
|:---|:---:|:---|
| **Vanskelige / Prior Ground Truth** | **5** | Kjente utfordringer (Roald 1939, Spjelkavik 1940, KFK 1946, Herd 1946/1955) |
| **Høy prioritet Singletons** | **20** | Enkeltmøter med sterke avistreff på tvers av 1945–1984 |
| **Høy prioritet Siblings** | **20** | Sibling-kamper der avisreferatet eksplisitt kan skille møtet |
| **Medium prioritet** | **10** | Tabellbørser, notiser og delvise referater |
| **Lav prioritet** | **5** | Svake treff / generelle oppslag |
| **Totalt i pilot** | **60** | Fordelt på alle perioder 1945–1984 |

---

## 3. Nøkkeltall for Kalibreringspiloten

| Parameter | Pilot-verdi | Beskrivelse |
|:---|:---:|:---|
| **Totale unifiserte hypoteser inn** | **636** | Hele populasjonen 1945–1984 fra PR #198 |
| **Faktisk visuelt gjennomgått i pilot** | **60** | Kalibreringssett med full faksimile-inspeksjon |
| **Avventer neste produksjonsbølge** | **576** | Umodifiserte, eksplisitt `insufficient` |
| **Eksakte løste kamper (Exact matches/siblings)** | **40** (**66.7 %**) | 20 singletons + 20 siblings entydig identifisert |
| **Sibling-grupper bekreftet (uten unik sub-allokering)** | **9** | Identifisert mot lag, men isolert som `sibling_group_only` |
| **Ikke-senior / reservelag avvist** | **2** | Roald (Kløna) og Skarbøvik (2. lag walkover) |
| **Feil hendelser / avviste forhåndsomtaler** | **9** | Forhåndsomtaler, notiser eller urelaterte kamper |
| **Klar for streng kanonisering (`canonicalEligibility: ready`)** | **40** (**66.7 %**) | Oppfyller samtlige harde porter for PR #200 |
| **Second-Pass Uavhengig Audit Agreement** | **96.7 %** (29 / 30) | Full uavhengig re-audit av 30 representative pilot-saker |
| **Kanoniske mutasjoner** | **0** | Ingen databaseendringer eller modifiserte kildedata |

---

## 4. Innsikt fra Kalibreringspiloten

1. **Høy prioritet gir høy presisjon for referater:** Når både lagpar og siffer opptrer i samme avsnitt i Sunnmørsposten, viser faksimilen i nesten alle tilfeller det fullstendige kampreferatet for A-laget.
2. **Medium og Lav prioritet krever forsiktighet:** Medium prioritet fanger ofte opp tabelloversikter eller notiser, og resulterer ofte i `sibling_group_only` eller `different_event` fremfor fullt A-lagsreferat.
3. **Sibling-allokering:** Å kreve eksplisitt kamprekkefølge, dato eller motstander-kontekst forhindrer feilallokering. 9 av 29 sibling-saker ble isolert som `sibling_group_only` for manuell avklaring.

---

## 5. Second-Pass Uavhengig Audit

Et utvalg på **30 saker** fra piloten ble re-audited uavhengig:
- **Enighet (Agreed):** 29 / 30 (**96.7 %**)
- **Presisering (Disagreed):** 1 / 30 (markert for streng datovalidering ved kanonisering pga. formuleringen «forrige uke» i avisteksten).

---

## 6. Beslutningsport

```
TRUE_VISUAL_PIPELINE_VALIDATED
```

**Begrunnelse:**
- Metodikken for visuell faksimile-review er verifisert og kalibrert på 60 faktiske saker.
- Ingen syntetiske fakta er generert fra retrieval-heuristikk.
- De 40 verifiserte kampene oppfyller alle krav for kanonisering, mens resten av populasjonen er trygt isolert.

---

## 7. Neste Steg

1. **Batch 1 (1945–1954):** Gjennomføre visuell faksimile-review for resterende high-priority saker i 1945–1954.
2. **Batch 2 (1955–1964):** Gjennomføre visuell faksimile-review for 1955–1964.
3. **Batch 3 (1965–1984):** Gjennomføre visuell faksimile-review for 1965–1984.
4. **PR #200:** Kanonisering etter fullført review.
