# Kanonisering av sikre NB-funn fra visuell review 1945–1984 (PR 200)

## 1. Bakgrunn og grunnlag
Denne rapporten dokumenterer kanoniseringen av de sikre visuelle avis-observasjonene fra PR #199 for perioden 1945–1984.

- **Sannhetsgrunnlag:** Visuell faksimile-review fra PR #199 (`data/discovery/nb-source-result-visual-review-1945-1984.yaml`).
- **Prinsipp:** Ingen heuristisk inferens, ingen bruk av rå OCR som sannhetskilde, streng event-deduplisering mot eksisterende kamper og fullstendig preservasjonsgaranti for historiske kildepåstander.

---

## 2. Nøkkeltall og resultatregnskap

| Metrikk | Antall | Notat |
|---|---:|---|
| **PR199 Ready Input** | 25 | Saker med `canonicalEligibility: ready` fra PR199 |
| **Nye kanoniske kamper** | 24 | Opprettet med fullstendig struktur og NB-proveniens |
| **Eksisterende kamper beriket** | 0 | Ingen duplikate treff i eksisterende kamper |
| **Allerede korrekt koblet (Idempotent)** | 24 | Verifisert ved re-kjøring |
| **Source-results lenket** | 24 | `matchId` satt på nøyaktig `matchedSourceResult` |
| **NB newspaper observations opprettet** | 24 | Lagret med `payloadHash` under `data/observations/nasjonalbiblioteket/` |
| **Blokkerte eksisterende konflikter** | 0 | Ingen motstridende kanoniske kamper funnet |
| **Avvist / Ugyldig (Gate block)** | 1 | `sunnmore-fotballkrets-arsrapport-1976#1976-002` (kildens 2–1 vs avisens 2–0) |
| **Nye klubber opprettet** | 0 | Alle matcher refererer til eksisterende kanoniske klubber |
| **Slettede kanoniske kamper** | 0 | Streng additivitetsgaranti bevart |

---

## 3. Avregning og regnskap (Reconciliation Accounting)

Alle 25 ready-hypoteser fra PR #199 er entydig plassert i nøyaktig én bøtte:

| Kategori | Antall |
|---|---:|
| `created` | 24 |
| `enriched_existing` | 0 |
| `already_present` (ved re-apply) | 24 |
| `blocked_existing_conflict` | 0 |
| `invalid_input` (score divergence) | 1 |
| **Totalt avregnet** | **25** |

---

## 4. Regresjonskontroller mot kjente problemcaser

| Case / Hypothese | Status | Resultat i PR 200 |
|---|---|---|
| **Rollon 1954** (`#1954-007`) | `score_conflict` | **IKKE kanonisert** (bevart som konflikt) |
| **Rollon 1955 #9** (`#1955-009`) | `competition_conflict` | **IKKE kanonisert** (bevart som konflikt) |
| **Rollon 1955 #13** (`#1955-013`) | `insufficient` / `sibling_group_only` | **IKKE kanonisert** |
| **Herd 1965 #8** (`#1965-008`) | `insufficient` / `sibling_group_only` | **IKKE kanonisert** |
| **Herd 1965 #1** (`#1965-001`) | `ready` | **Kanonisert** som ny kamp 1965-05-23 mot Herd (1–1) |

---

## 5. Preservation Audit og Idempotens

- **Preservation Audit:** `pnpm data:historical-preservation` rapporterer **0 destructive changes**, 0 slettede filer og 0 ulovlige modifikasjoner på kildedata.
- **Source-Result Preservation:** Kildens opprinnelige påstander (`opponent`, `score`, `note`, `competitionId`) forblir fullstendig urørt; kun `matchId` lenkes.
- **Idempotens:** Kjøring av `pnpm ingest:nb-visual-canonicalization --apply` gjentatte ganger produserer 0 nye duplikater, 0 nye observasjoner og rapporterer alle 24 kamper som `already_present`.
- **Rå OCR:** Ingen rå OCR-snippets eller fulltekst-dump er lagret i git.

---

## 6. Restkø for Community Research (Forberedelse til PR 201)

Pilotens restcaser som ikke var `ready` er klassifisert for videre oppfølging:

| Reststatus fra PR199 | Antall | Neste steg |
|---|---:|---|
| `sibling_group_only` | 20 | Community research (PR 201) |
| `score_conflict` | 1 | Community / redaksjonell vurdering |
| `competition_conflict` | 1 | Community / redaksjonell vurdering |
| `date_uncertain` | 1 | Community research |
| `non_senior` | 2 | Lukket (ikke seniorkamper) |
| `different_event` | 10 | Lukket (avistreff for andre hendelser) |
| `unreviewed_awaiting_visual_batch` | 576 | Neste visuelle AI-bølge |

**Kandidater egnet for Community Research:** **23 saker** (20 sibling groups + 1 score conflict + 1 competition conflict + 1 date uncertainty).

---

## 7. Beslutningsport

```text
READY_FOR_COMMUNITY_RESEARCH_WAVE
```
