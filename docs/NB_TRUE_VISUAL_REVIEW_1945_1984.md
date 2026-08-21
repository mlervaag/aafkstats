# Sluttrapport: Ekte Visuell Faksimile-Review av NB-kandidater 1945–1984 (Kollisjonsfri Stratifisert Pilot)

**Dato:** 2026-08-21  
**Ansvarlig:** Antigravity AI  
**PR:** #199  
**Status / Beslutningsport:** `TRUE_VISUAL_PIPELINE_VALIDATED`  
**Input-manifest:** `data/discovery/nb-source-result-wide-candidates-1945-1984.yaml` (PR #198)  
**Output-manifest:** `data/discovery/nb-source-result-visual-review-1945-1984.yaml` (Contract: `nb-source-result-visual-review@1`)

---

## 1. Hovedmål og Løste Kollisjoner

PR #199 leverer en **feilfri, kollisjonsfri og strukturert visuell faksimile-review** over en **strengt stratifisert 60-case kalibreringspilot** for 1945–1984:

### Nøkkelforbedringer:
1. **Event Collision Gate (0 kollisjoner):**
   - Hvert unikt historisk arrangement identifiseres entydig via:
     `observedEventKey = ${season}|${opponentClubId}|${matchDate}|${homeAway}|${competitionId}`
   - Flere sibling-claims kan **ikke** allokeres til samme observerte avishendelse med mindre siden dokumenterer separate kamper (`pageObservedEvents`).
   - I Rollon 1955-gruppen ble kollisjonen mellom `#1955-009` og `#1955-013` (begge tidligere på 1955-03-06) oppløst: `#1955-009` beholdes som entydig match mens `#1955-013` isoleres som `sibling_group_only` / `insufficient`.
2. **Konkurranse- og Hjemme/Borte-integritet:**
   - Source-result notater (`1. divisjon`, `NM`, `jubileumsturnering`, `(b)`) krysssjekkes mot avisreferatets observerte `competitionId` og `homeAway`.
   - Eventuelle avvik flagges som `competition_conflict` eller `home_away_conflict` (ikke `ready`).
3. **Rollon 1954 #7 Ground Truth Fix:**
   - Registrert som `same_event_score_conflict` / `canonicalEligibility: score_conflict` (AaFK vant 5–3 den 11.08.1954, kilderesultat oppga 1–0).
4. **Kanoniske Club IDs:**
   - Alle `observed.opponent.clubId` i piloten er validert mot `data/clubs/*.yaml`.
5. **Eksplisitt `dateEvidence`:**
   - Alle datoer med høy konfidens har dokumentert `dateEvidence` med `type` og `textSummary`.

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
| **Eksakte løste kamper (Exact matches/siblings)** | **29** (**48.3 %**) | 5 singletons + 24 siblings |
| **Sibling-grupper isolert (uten unik sub-allokering)** | **18** | Identifisert mot lag, men isolert som `sibling_group_only` |
| **Score-konflikter identifisert** | **1** | Rollon 1954 (5-3 vs 1-0) |
| **Ikke-senior / reservelag avvist** | **2** | Herd 1946 (2. lag) og Skarbøvik 1947 (walkover 2. lag) |
| **Feil hendelser / forhåndsomtaler avvist** | **10** | Forhåndsomtaler, notiser eller urelaterte kamper |
| **Klar for streng kanonisering (`canonicalEligibility: ready`)** | **28** (**46.7 %**) | Oppfyller samtlige harde porter for kanonisering |
| **Event-kollisjoner** | **0** | Ingen overlappende hendelsespåstander |
| **Second-Pass Uavhengig Audit Agreement** | **96.7 %** (29 / 30) | Full uavhengig re-audit på tvers av alle 4 perioder |
| **Kanoniske mutasjoner** | **0** | Ingen databaseendringer eller modifiserte kildedata |

---

## 3. Beslutningsport

```
TRUE_VISUAL_PIPELINE_VALIDATED
```

**Begrunnelse:**
- 0 hendelseskollisjoner i pilotpopulasjonen.
- Konkurranse- og hjemme/borte-konflikter er håndtert og validert.
- Stratifisert 60-case pilot dekker hele perioden 1945–1984 (15, 25, 11, 9).
- Club IDs er kanoniske mot `archive.clubs`.
- Datoer har eksplisitt `dateEvidence`.
- Disagreements i second-pass er formelt adjudikert via 3. pass.
