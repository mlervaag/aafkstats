# Evalueringsrapport: Kontrollert Sibling-Pilot (10 grupper)

Dato: 2026-08-20  
Kilde: `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`  
Utvalg: 10 stratifiserte sibling-grupper (totalt 26 kamphypoteser) i perioden 1945–1964.  
Modus: `--resolve-siblings` (kontrollert pilotmodus; default v1 forblir manuell ruting for søsken).  
Manuell fasit: `packages/ingest/test/fixtures/nb-newspaper-sibling-pilot.yaml`  
Rådata: `.cache/ingest/nb-newspaper-discovery/sibling-pilot-10.yaml`

---

## 1. Sammenligning: Baseline (PR #184) vs. Konservativ Retting (PR #185)

Målingene skiller strengt mellom **foreslått kandidathendelse** (`candidateEventId`), **akseptert allokering** (`eventId` med `decision: accepted`), og **hva som faktisk stemmer mot uavhengig historisk fasit**.

### Før/Etter-sammenligningstabell

| Parameter | Før (PR #184 baseline) | Etter (PR #185 retting) | Endring / Betydning |
| :--- | :---: | :---: | :--- |
| **Totalt antall hypoteser** | 26 | 26 | Samme 10 pilotgrupper |
| **Aksepterte allokeringer (`eventId` satt)** | 26 (100 %) | 6 (23.1 %) | Kun entydig dokumenterte hendelser aksepteres |
| **Uavklarte / avviste (`eventId: undefined`)** | 0 (0 %) | 20 (76.9 %) | Sikker failure mode for usikre og svake kandidater |
| **Confidence-fordeling:** | | | |
| – High confidence | 26 (100 %) | 6 (23.1 %) | Kun tildelinger med tidskausalt bevis, fragmentmatch og margin |
| – Medium confidence | 0 (0 %) | 7 (26.9 %) | Kandidater med moderat margin / usikre datoer (kun for manuell review) |
| – Low confidence / rejected | 0 (0 %) | 13 (50.0 %) | Avviste / uavklarte uten aksept |
| **Falske high-confidence allokeringer** | **8** | **0** | **100 % eliminering av overkonfidente feiltildelinger** |
| **Eksakt korrekte aksepterte allokeringer** | 11 | 6 | Herd #5, Herd #9, Aksla #7, Skarbøvik #12, Skarbøvik #28, Åndalsnes #16 |
| **Korrekt avviste (unresolved/symmetric)** | 0 | 6 | Sarpsborg #10, Kvik #19, #21, #28, Clausenengen #5, Aksla #9 |
| **Fullt korrekte grupper** | 4 | 4 | `1948|sarpsborg`, `1963|kvik`, `1959|aksla`, `1962|herd` |
| **Delvis korrekte grupper** | 2 | 3 | `1959|skarbovik`, `1963|clausenengen`, `1964|andalsnes` |
| **Feilede grupper** | 3 | 2 | `1963|raufoss-il`, `1960|langevag` |
| **Uverifiserte grupper** | 1 | 1 | `1961|molde-fk` |

---

## 2. Nøkkelrettinger Implementert i PR #185

### 1. Skille mellom kandidat og akseptert allokering
- **Kandidat (`candidateEventId`)**: Beste hendelse fra 1-til-1-fordelingen, brukt for inspeksjon og manuell review. Produserer aldri terminal `confirmed` eller `conflict` alene.
- **Akseptert (`eventId`, `decision: "accepted"`)**: Settes **kun** dersom allokeringen oppfyller samtlige strenge sikkerhetskrav (`confidence === "high"`).
- Alle ikke-aksepterte hypoteser ender som `ambiguous` (med kandidat) eller `not_found` (avvist).

### 2. Bevaring av lagdeling for kildekonflikter (Åndalsnes 1964 #16)
- Scorematch er ikke et absolutt vilkår for hendelsesidentitet. Når en hendelse er entydig identifisert gjennom tidskausal dato, felles omtale i samme avsnitt, avisrapportert resultat og sterk margin, aksepteres hendelsen med `high` confidence.
- `reconcile` alene avgjør om allokeringen ender som `confirmed` eller `conflict`.
- **Resultat:** Åndalsnes 1964 #16 aksepteres til `1964-05-24` og identifiseres korrekt som reell kildekonflikt mellom 4–0 i medlemsbladet og 6–1 i avisen.

### 3. Reell global fordelingsmargin for runner-up
- For grupper med fullstendig søk beregnes marginen mot den beste alternative komplette fordelingen der den aktuelle hypotese-hendelse-kanten er forbudt.
- Tette swapper (som swap-margin 2) får lav margin og aldri kunstig high confidence.
- En negativ eller null margin gir **aldri** medium eller high confidence.

### 4. Query-relativ avstemming (Herd 1962 #9 løst)
- `analyzeEvent` i `reconciliation.ts` evaluerer `scoreFound` dynamisk mot `query.expectedScore` for den konkrete hypotesen som avstemmes.
- **Resultat:** Herd 1962 #9 får `status: confirmed`, `checks.score: confirmed` og ingen falsk kildekonflikt.

### 5. Symmetrisk avvisning og forankring mot uoppklarte søsken
- Hypoteser med identiske scores og hints som har like kant-scorer til samtlige hendelser (som Kvik #19 og #21, begge 1–1) forblir uallokert (`decision: "rejected"`).
- Senere søsken i samme gruppe (som Kvik #28) kan ikke få high confidence uten eksplisitt konkurransebevis dersom foregående søsken er uoppklarte.

---

## 3. Gruppe-for-gruppe Gjennomgang mot Manuell Fasit

### 1. `1963|raufoss-il` – **FAILED (TRYGT FEILMODUS)**
- **Fasit:** 2. divisjon 1963. Bortekamp 1963-06-09 (0–1), hjemmekamp 1963-10-06 (0–2).
- **Allokering:** Begge hypoteser forblir uallokert (`confidence: medium/low`, `decision: unresolved`).
- **Vurdering:** Kampene mangler dekning i avisindeksen og avvises trygt uten feilaktig aksept.

### 2. `1948|sarpsborg` – **FULLY CORRECT**
- **Fasit:** Mangler entydig verifisert samtidsdekning; skal forbli `unresolved`.
- **Allokering:** `1948 #10` forblir uallokert (`confidence: medium`, `decision: unresolved`).
- **Klassifisering:** `correctly_rejected`.

### 3. `1960|langevag` – **FAILED (TRYGT FEILMODUS)**
- **Fasit:** #3 (3–3, 1960-07-06) og #14 (5–4, 1960-05-01) er verifiserte enkelthendelser.
- **Allokering:** Hypotesene forblir uallokerte med kandidatforslag for manuell review. Ingen falsk high confidence.

### 4. `1959|skarbovik` – **PARTIALLY CORRECT**
- **Fasit:** #12 (6–1, 1959-07-15), #25 (1–1, 1959-04-16), #28 (1–0 cup, 1959-05-18).
- **Allokering:** #12 og #28 aksepteres til eksakt riktige datoer (`confidence: high`, `exact_correct`). #25 forblir uallokert (`margin: 0`). Ingen falsk high confidence.

### 5. `1961|molde-fk` – **UNVERIFIED**
- **Fasit:** Alle 3 hypoteser holdes som `unverified`.
- **Allokering:** Uallokert, `unverified`.

### 6. `1963|kvik` – **FULLY CORRECT**
- **Fasit:** De to 1–1 (#19 og #21) mangler differensierende bevis (`unresolved`). #28 (2–0) har kildeavvik mot høstoppføringen (`unresolved`).
- **Allokering:**
  - #19 og #21: Korrekt avvist som symmetriske (`correctly_rejected`).
  - #28: Forblir uallokert med `confidence: medium` pga. uoppklarte foregående søsken (`correctly_rejected`).
- **Klassifisering:** 3/3 korrekt avvist.

### 7. `1963|clausenengen` – **PARTIALLY CORRECT**
- **Fasit:** #17 (NM 1. runde, 1963-05-30) er verifisert. #5 (treningskamp 5–1) mangler dato (`unresolved`).
- **Allokering:** #5 korrekt avvist som uallokert pga. manglende avisrapportert resultat (`correctly_rejected`). #17 forblir uallokert kandidat (`low` margin).

### 8. `1959|aksla` – **FULLY CORRECT**
- **Fasit:** #7 (3–0, 1959-04-13) er verifisert. #9 (3–0) mangler differensierende hints (`unresolved`).
- **Allokering:**
  - #7: Akseptert til 1959-04-13 med `confidence: high`, `status: confirmed` (`exact_correct`).
  - #9: Korrekt avvist som uallokert (`correctly_rejected`).
- **Klassifisering:** 2/2 korrekte.

### 9. `1964|andalsnes` – **PARTIALLY CORRECT**
- **Fasit:** #16 (4–0 vs 6–1 cup, 1964-05-24) er reell kildekonflikt.
- **Allokering:** #16 akseptert til 1964-05-24 (`confidence: high`, `status: conflict`, `exact_correct`). #23 forblir uallokert (`margin: 0`).
- **Klassifisering:** Reell kildekonflikt korrekt identifisert.

### 10. `1962|herd` – **FULLY CORRECT**
- **Fasit:** #5 (1–0, 1962-04-25) og #9 (2–0, 1962-06-20).
- **Allokering:**
  - #5: Akseptert til 1962-04-25 (`confidence: high`, `status: confirmed`).
  - #9: Akseptert til 1962-06-20 (`confidence: high`, `status: confirmed`, ingen falsk konflikt).
- **Klassifisering:** 2/2 eksakt korrekte.

---

## 4. Beslutningsport og Konklusjon

**Status: `NEEDS_FURTHER_SIBLING_FIX`**

### Begrunnelse
- Falske high-confidence allokeringer er redusert fra **8 til 0** (100 % eliminering).
- Ingen falsk overkonfidens oppstår for usikre hendelser (Raufoss, Sarpsborg, Kvik, Clausenengen #5, Aksla #9).
- Reelle kildekonflikter (Åndalsnes #16) identifiseres og bevares presist uten å blokkeres av resultatavvik.
- Siden flere historiske kamper (Raufoss, Langevåg) inntil videre mangler tilstrekkelig avisindeksering og holdes uallokerte, beholdes status `NEEDS_FURTHER_SIBLING_FIX` inntil ranking- og berikelsestilpasninger er evaluert på et senere tidspunkt.
- Default-policy forblir uendret: Sibling-grupper rutes til manuell inspeksjon (`sibling_group`).
