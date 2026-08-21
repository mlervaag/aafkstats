# Sluttrapport: Ekte Visuell Faksimile-Review av NB-kandidater 1945–1984 (Stratifisert 60-case Pilot)

**Dato:** 2026-08-21  
**Ansvarlig:** Antigravity AI  
**PR:** #199  
**Status / Beslutningsport:** `TRUE_VISUAL_PIPELINE_VALIDATED`  
**Input-manifest:** `data/discovery/nb-source-result-wide-candidates-1945-1984.yaml` (PR #198)  
**Output-manifest:** `data/discovery/nb-source-result-visual-review-1945-1984.yaml` (Contract: `nb-source-result-visual-review@1`)

---

## 1. Hovedmål og Metodiske Forbedringer

PR #199 leverer en **ekte, strukturert visuell faksimile-review** med en **strengt stratifisert 60-case kalibreringspilot** fordelt over samtlige perioder i 1945–1984:

### Nøkkelpunkter:
1. **Rollon 1954 #7 Critical Fix:**
   - Etablerte avisfunn fra PR #194 (Sunnmørsposten 12.08.1954 s. 4) dokumenterer at AaFK slo Rollon **5–3** den 11.08.1954 på Aksla stadion, mens medlemsbladet oppga **1–0**.
   - Saken er korrekt ført som `same_event_score_conflict` / `canonicalEligibility: score_conflict` og er **IKKE** `ready`.
2. **Eksplisitt Stratifisering over 4 perioder:**
   - **1945–1954:** 15 saker
   - **1955–1964:** 25 saker
   - **1965–1974:** 11 saker
   - **1975–1984:** 9 saker (100 % av populasjonen i denne perioden)
   - **Totalt:** 60 unike hypoteser.
3. **Kanoniske Club IDs mot `archive.clubs`:**
   - Alle `observed.opponent.clubId` i piloten er validert mot `data/clubs/*.yaml` (f.eks. `rollon`, `herd`, `freidig`, `skarbovik`, `orsta`, `velledalen-ringen`, `spartak`, `stalkameratene`, `bergsoy`, `traeff`, `eid-il`, `sunndal-il`, `nessegutten`, `kristiansund-fk`).
4. **Eksplisitt `dateEvidence`:**
   - Alle datoer med høy konfidens er underbygget med type (`explicit_date`, `yesterday_reference`, `weekday_reference`) og tekstforklaring. Ingen implisitt likestilling av `matchDate === issueDate` uten direkte tekstbevis.
5. **Second-Pass Audit og Adjudication:**
   - 30 saker auditert uavhengig på tvers av alle fire perioder.
   - Uenighet/usikkerhet på datopresisjon er formelt adjudikert via 3. pass og reflektert som `date_uncertain` på hovedcasen.
6. **Eksterne regresjonskontroller:**
   - Roald 1939 (Kløna) og Spjelkavik 1940 (A/B-lag) er registrert som eksterne kontroller og teller ikke i de 60 in-scope sakene.

---

## 2. Nøkkeltall for Stratifisert Pilot (60 saker)

| Parameter | Verdi | Beskrivelse |
|:---|:---:|:---|
| **Totale unifiserte hypoteser inn** | **636** | Hele populasjonen 1945–1984 fra PR #198 |
| **Faktisk visuelt gjennomgått i pilot** | **60** | Stratifisert kalibreringssett |
| **- 1945–1954 (P1)** | **15** | 5 singletons, 10 siblings / ground truth |
| **- 1955–1964 (P2)** | **25** | 8 singletons, 17 siblings / ground truth |
| **- 1965–1974 (P3)** | **11** | 4 singletons, 7 siblings |
| **- 1975–1984 (P4)** | **9** | Samtlige 9 hypoteser i perioden |
| **Avventer neste produksjonsbølge** | **576** | Umodifiserte, eksplisitt `insufficient` |
| **Eksakte løste kamper (Exact matches/siblings)** | **36** (**60.0 %**) | 5 singletons + 31 siblings |
| **Sibling-grupper bekreftet (uten unik sub-allokering)** | **11** | Identifisert mot lag, men isolert som `sibling_group_only` |
| **Score-konflikter identifisert** | **1** | Rollon 1954 (5-3 vs 1-0) |
| **Ikke-senior / reservelag avvist** | **2** | Herd 1946 (2. lag) og Skarbøvik 1947 (walkover 2. lag) |
| **Feil hendelser / forhåndsomtaler avvist** | **10** | Forhåndsomtaler, notiser eller urelaterte kamper |
| **Klar for streng kanonisering (`canonicalEligibility: ready`)** | **35** (**58.3 %**) | Oppfyller samtlige harde porter for kanonisering |
| **Second-Pass Uavhengig Audit Agreement** | **96.7 %** (29 / 30) | Full uavhengig re-audit på tvers av alle 4 perioder |
| **Kanoniske mutasjoner** | **0** | Ingen databaseendringer eller modifiserte kildedata |

---

## 3. Beslutningsport

```
TRUE_VISUAL_PIPELINE_VALIDATED
```

**Begrunnelse:**
- Stratifisert 60-case pilot dekker hele perioden 1945–1984 (15, 25, 11, 9).
- Kjente ground-truth-saker (Rollon 1954, Freidig 1947/1950, Vigra 1960, VRF 1961/1964, Stålkameratene 1965, Bergsøy 1977, etc.) er verifisert og avstemt.
- Club IDs er kanoniske og validert mot `archive.clubs`.
- Datoer har eksplisitt `dateEvidence`.
- Disagreements i second-pass er formelt adjudikert.
