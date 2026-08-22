# Kanonisering av sikre NB-funn fra visuell review 1945–1984 (PR 200)

## 1. Bakgrunn og grunnlag
Denne rapporten dokumenterer kanoniseringen av de sikre visuelle avis-observasjonene fra PR #199 for perioden 1945–1984.

- **Sannhetsgrunnlag:** Visuell faksimile-review fra PR #199 (`data/discovery/nb-source-result-visual-review-1945-1984.yaml`).
- **Skille mellom gjenfinningskandidat og faktisk visuell kilde:** `actualVisualSource` skiller den faktiske utgaven og det trykte sidenummeret (`printedPage`) fra søkemotorens visningsindeks (`viewerPage` / `?page=...`).
- **Prinsipp:** Ingen heuristisk inferens, ingen bruk av rå OCR som sannhetskilde, streng event-deduplisering mot eksisterende kamper og fullstendig preservasjonsgaranti for historiske kildepåstander.

---

## 2. Nøkkeltall og resultatregnskap

### Initial Application (Første gangs materialisering)

| Metrikk | Antall | Notat |
|---|---:|---|
| **PR199 Ready Input** | 25 | Saker med `canonicalEligibility: ready` fra PR199 |
| **Nye kanoniske kamper opprettet** | 24 | Opprettet med fullstendig struktur og NB-proveniens |
| **Eksisterende kamper beriket** | 0 | Ingen duplikate treff i eksisterende kamper |
| **Source-results lenket** | 24 | `matchId` satt på nøyaktig `matchedSourceResult` |
| **NB newspaper observations opprettet** | 24 | Lagret med `payloadHash` under `data/observations/nasjonalbiblioteket/` |
| **Blokkerte eksisterende konflikter** | 0 | Ingen motstridende kanoniske kamper funnet |
| **Avvist ved Full Identity Gate** | 1 | `sunnmore-fotballkrets-arsrapport-1976#1976-002` (kildens 2–1 vs Skarbøvik vs avisens 2–0 vs Clausenengen) |
| **Nye klubber opprettet** | 0 | Alle matcher refererer til eksisterende kanoniske klubber |
| **Slettede kanoniske kamper** | 0 | Streng additivitetsgaranti bevart |

### Idempotens-kontroll (Re-apply)

| Metrikk | Resultat |
|---|---:|
| **Nye kamper opprettet** | 0 |
| **Kamper beriket** | 0 |
| **Allerede korrekt til stede (`alreadyPresent`)** | 24 |
| **Source-results lenket** | 0 |
| **Observasjoner opprettet** | 0 |
| **Filer skrevet** | 0 |

---

## 3. Proveniens og Actual Visual Source Audit

En grundig audit av alle 25 ready-saker avdekket følgende avvik mellom søkekandidater og faktisk visuell kilde:

1. **Træff 1975** (`sunnmore-fotballkrets-arsrapport-1975#1975-001`):
   - Gjenfinningskandidat: `Sunnmørsposten 1975-05-29 s. 6`
   - Faktisk visuell kilde: `Sunnmørsposten 1975-05-30 s. 7` (viewerPage: 6)
   - Avklaring: Kampen ble spilt torsdag 29. mai 1975; referatet sto i fredagsavisen 30. mai på trykt side 7 (som vises som page 6 i NB Viewer).
2. **Eid 1975** (`sunnmore-fotballkrets-arsrapport-1975#1975-002`):
   - Gjenfinningskandidat: `Sunnmørsposten 1975-06-12 s. 6`
   - Faktisk visuell kilde: `Sunnmørsposten 1975-06-12 s. 7` (viewerPage: 6)
   - Avklaring: Trykt side er 7, viewer-indeks er 6.
3. **1976 #2** (`sunnmore-fotballkrets-arsrapport-1976#1976-002`):
   - Gjenfinningskandidat: `Sunnmørsposten 1976-03-22 s. 6`
   - Faktisk visuell kilde: `Sunnmørsposten 1976-06-17 s. 9` (viewerPage: 6)
   - Avklaring: Avvist av Full Identity Gate (motstander og mål avviker).

Alle 24 kanoniserte kamper og observasjoner benytter nå konsistent `actualVisualSource` på tvers av `externalReports`, `providers`, `note` og `data/observations/nasjonalbiblioteket/`.

---

## 4. Regresjonskontroller mot kjente problemcaser

| Case / Hypothese | Status | Resultat i PR 200 |
|---|---|---|
| **1976 #2** (`#1976-002`) | `source_identity_conflict` | **IKKE kanonisert** (avvist pga. motstander- og målavvik, lagt i restkø) |
| **Rollon 1954** (`#1954-007`) | `score_conflict` | **IKKE kanonisert** (bevart som konflikt) |
| **Rollon 1955 #9** (`#1955-009`) | `competition_conflict` | **IKKE kanonisert** (bevart som konflikt) |
| **Rollon 1955 #13** (`#1955-013`) | `insufficient` / `sibling_group_only` | **IKKE kanonisert** |
| **Herd 1965 #8** (`#1965-008`) | `insufficient` / `sibling_group_only` | **IKKE kanonisert** |
| **Herd 1965 #1** (`#1965-001`) | `ready` | **Kanonisert** som ny kamp 1965-05-23 mot Herd (1–1) |

---

## 5. Preservation Audit og Idempotens

- **Preservation Audit:** `pnpm data:historical-preservation` rapporterer **0 destructive changes**, 0 slettede filer og 0 ulovlige modifikasjoner på kildedata.
- **Source-Result Preservation:** Kildens opprinnelige påstander (`opponent`, `score`, `note`, `competitionId`) forblir fullstendig urørt; kun `matchId` lenkes.
- **Idempotens:** Kjøring av `pnpm ingest:nb-visual-canonicalization --apply` gjentatte ganger produserer 0 nye duplikater, 0 nye observasjoner og rapporterer alle 24 kamper som `already_present` med `filesWritten: 0`.
- **Rå OCR:** Ingen rå OCR-snippets eller fulltekst-dump er lagret i git.

---

## 6. Restkø for Community Research (Forberedelse til PR 201)

Restkøen inkluderer nå både PR199-saker som ikke var ready, og eventuelle PR200-avviste saker:

| Reststatus | Antall | Neste steg |
|---|---:|---|
| `sibling_resolution` | 20 | Community research (PR 201) |
| `score_conflict` | 1 | Community / redaksjonell vurdering |
| `competition_conflict` | 1 | Community / redaksjonell vurdering |
| `date_research` | 1 | Community research |
| `source_reconciliation` | 1 | Redaksjonell kildeavstemming (1976 #2) |
| `non_senior` | 2 | Lukket (ikke seniorkamper) |
| `different_event` | 10 | Lukket (avistreff for andre hendelser) |
| `unreviewed_awaiting_visual_batch` | 576 | Neste visuelle AI-bølge |

**Totalt kandidater for videre research:** **24 saker** (20 sibling groups + 1 score conflict + 1 competition conflict + 1 date research + 1 source reconciliation).

---

## 7. Beslutningsport

```text
READY_FOR_COMMUNITY_RESEARCH_WAVE
```
