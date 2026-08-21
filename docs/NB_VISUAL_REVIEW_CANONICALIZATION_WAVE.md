# Sluttrapport: Kanonisering etter Faksimile-Reaudit (Wave 1 + Wave 2)

**Dato:** 2026-08-21  
**Ansvarlig:** Antigravity AI  
**Status:** `READY_FOR_SOURCE_RESULT_WIDE_RETRIEVAL`  
**Gjennomført populasjon:** 109 tidligere YES-kandidater fra Wave 1 + Wave 2

---

## 1. Sammendrag og Bakgrunn

Tidligere heuristikk og fritekst-parsing (`extractReviewedOpponentFromReason`) førte til at feilaktige kandidater og ikke-senior-kamper ble foreslått kanonisert (f.eks. Roald 1939 der avisen viste Kløna/Nørvekammeratene 8-2, og Spjelkavik 1940 der avisen viste sammensatt A/B-lag 8-0).

Denne bølgen har gjennomført en **streng faksimile-reaudit med presise semantiske ansvarsgrenser**:
- **21 kandidater** gjennomgikk ny strukturert faksimile-reaudit med visuell bekreftelse og er klassifisert som `canonical_ready` (`reviewBasis: new_facsimile_reaudit`, `visuallyReviewed: true`, `provisional: false`).
- **2 kandidater** ble stoppet av tidligere etablert ground truth fra PR #190 (`reviewBasis: prior_ground_truth`, `visuallyReviewed: true`, `provisional: false`): Roald 1939 og Spjelkavik 1940.
- **De øvrige 86 sakene** ble konservativt sendt til oppfølgingskøen gjennom deterministiske porter og eksisterende Wave-review-data (`reviewBasis: prior_wave_review` / `deterministic_gate`, `visuallyReviewed: false`, `provisional: true`), uten at det påstås ny full faksimile-reaudit for disse.

---

## 2. Revisjonsstatistikk

| Kategori / Disposisjon | Antall | Beskrivelse |
|:---|:---:|:---|
| **Kanonisering (`canonical_ready`)** | **21** | 19 nye kamper opprettet + 2 eksisterende kamper beriket |
| **Score-konflikter (`score_conflict`)** | **36** | Samme kamp og dato, men kildepåstand og avis har avvikende score |
| **Avvikende hendelse / feil motstander (`wrong_event`)** | **48** | Feil motstander eller umulig temporal rapport (`issueDate < matchDate`) |
| **Ikke-senior / sammensatt lag (`non_senior`)** | **2** | Roald 1939 (Kløna) og Spjelkavik 1940 (sammensatt A/B-lag) |
| **Usikker dato (`date_uncertain`)** | **2** | Usikker datopresisjon |
| **Totalt revidert** | **109** | Fullstendig logget i `data/discovery/nb-canonical-review-audit.yaml` |

---

## 3. De 21 Kanoniserte Kampene

| Kampdato | Motstander | Resultat | H/B | Konkurranse | Kilde | Status |
|:---|:---|:---:|:---:|:---|:---|:---|
| 1925-09-13 | Viking | 1–2 (e.e.o.) | Borte | NM 4. runde | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Beriket eksisterende |
| 1933-07-08 | Moss | 3–1 | Borte | Treningskamp (turné) | aalesunds-fotballklub-gjennem-1939-ec28 | Ny kamp |
| 1933-08-13 | Nydalen | 4–2 | Hjemme | Treningskamp | aalesunds-fotballklub-gjennem-1939-ec28 | Ny kamp |
| 1938-05-22 | Hødd | 3–2 | Hjemme | Treningskamp | aalesunds-fotballklub-gjennem-1939-ec28 | Ny kamp |
| 1938-06-06 | FK Sykkylven | 8–2 | Borte | Treningskamp (2. pinsedag) | aalesunds-fotballklub-gjennem-1939-ec28 | Ny kamp |
| 1946-07-11 | Reidulf | 1–1 | Hjemme | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1946-08-11 | Falken Høyanger | 2–1 | Hjemme | NM 2. runde | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1946-08-25 | Freidig | 2–3 | Hjemme | NM 3. runde | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Beriket eksisterende |
| 1947-05-26 | Freidig | 0–1 | Hjemme | Treningskamp (pinse) | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1947-06-13 | Aksla | 2–4 | Borte | Treningskamp (pokal) | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1947-06-15 | Ørsta | 2–0 | Hjemme | NM 1. runde | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1947-08-24 | Nordlandet | 1–1 | Hjemme | 1. divisjon | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1950-07-02 | Freidig | 0–2 | Borte | NM 2. runde | medlemsblad-for-aalesunds-fotb-1950-62fa | Ny kamp |
| 1951-04-15 | Aksla | 5–1 | Nøytral | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1951-07-13 | Fremad | 2–4 | Hjemme | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1960-07-24 | Vigra | 13–1 | Borte | Treningskamp (baneåpning) | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1961-04-30 | Velledalen/Ringen | 2–1 | Borte | 1. divisjon | sunnmore-fotballkrets-arsrapport-1961 | Ny kamp |
| 1963-06-30 | Spartak | 1–6 | Hjemme | Treningskamp (oppvisning) | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1964-04-19 | Velledalen/Ringen | 3–1 | Borte | Treningskamp | sunnmore-fotballkrets-arsrapport-1964 | Ny kamp |
| 1965-07-12 | Stålkameratene | 1–7 | Borte | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1977-09-17 | Bergsøy | 1–0 | Borte | 3. divisjon | sunnmore-fotballkrets-arsrapport-1977 | Ny kamp |

---

## 4. Nye Motstanderklubber (5 klubber)

- `nydalen` (Nydalen)
- `sk-reidulf` (Reidulf)
- `il-falken-hoyanger` (Falken, Høyanger)
- `vigra-il` (Vigra)
- `stalkameratene` (Stålkameratene)

*(Merk: `il-roald` opprettes ikke da Roald 1939 korrekt ble avvist).*

---

## 5. Oppfølgingskø (88 saker)

Alle 88 ikke-kanoniserte saker er lagret i `data/discovery/nb-visual-review-followup.yaml` med fullstendig maskinlesbar disposisjon og begrunnelse for videre manuell eller kildespesifikk innhøsting.
