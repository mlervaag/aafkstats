# Re-audit og streng kanonisering av NB-visuell gjennomgang (PR 196)

Dette dokumentet oppsummerer re-auditen og den strenge kanoniseringsprosessen for **PR 196** etter identitets- og temporalrevisjonen av samtlige 109 positive relasjoner fra Wave 1 og Wave 2.

---

## 1. Bakgrunn og problemstilling

Under den opprinnelige kanoniseringen i PR 196 ble det avdekket at den tidligere visuelle AI-gjennomgangen i enkelte tilfeller rapporterte `sameMatch: true` selv om avisartikkelen omtalte en helt annen motstander eller en kamp spilt frem i tid relativt til utgivelsesdatoen:
1. **Motstanderfeil:** Eksempelvis kandidat AaFK–Sykkylven der avissiden faktisk omtalte AaFK–Langevåg; kandidat Drammens BK der avissiden omtalte Kristiansund FK; kandidat Sandane der avissiden omtalte Molde.
2. **Temporal umulighet:** Eksempelvis avisutgaver publisert om våren/sommeren (f.eks. terminlister eller forhåndsomtaler) som feilaktig ble tolket som dokumentasjon av et høstresultat.
3. **Score-avvik:** Saker der kilde og avis omtaler samme historiske oppgjør på samme dato, men med ulikt sluttresultat.

For å sikre at kun 100 % verifiserte fakta kanoniseres, ble samtlige 109 positive kandidater underlagt en fullstendig re-audit med strenge porter for motstanderidentitet, temporal gyldighet, score-samsvar, datopresisjon og eksplisitt konkurransekartlegging.

---

## 2. Re-audit-statistikk og populasjonstrakt

```
+-------------------------------------------------------------------------+
| 109 Tidligere YES-relasjoner (fra 247 singleton-kandidater Wave 1 + 2)  |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
   86 Avvist / Oppfølging (78.9 %)                      23 Kanoniske klare (21.1 %)
          |                                                   |
   +------+-----------------------------+                     +-- 21 Nye kamper
   |                                    |                     +--  2 Eksisterende kamper
   |-- 23 Opponent mismatch             |                     +-- 23 NB-observasjoner
   |-- 38 Temporal invalid (future)     |                     +-- 23 Source-results koblet
   |-- 24 Score-konflikter              |
   +--  1 Date uncertain (medium dato)  |
```

### Detaljert fordeling av de 109 sakene:
- **Tidligere YES:** 109
- **True same-event & canonical-ready:** 23 (21 nye kamper + 2 eksisterende beriket)
- **Score-konflikter (samme kamp, avvikende score):** 24
- **Opponent mismatch (feil motstander på siden):** 23
- **Temporal invalid (utgivelsesdato før kampdato):** 38
- **Date uncertain (ikke eksakt dato):** 1

---

## 3. Oversikt over de 23 kanoniserte hendelsene

Samtlige 23 kanoniserte saker tilfredsstiller:
- Visuelt bekreftet motstanderidentitet (`opponentIdentityMatches: true`)
- Visuelt bekreftet hendelsesidentitet (`sameMatch: true`)
- Ingen temporal umulighet (`issueDate >= matchDate`)
- Bekreftet score (`score.status: confirmed`)
- Eksakt kampdato (`matchDate.confidence: high`)
- Eksplisitt mappet konkurranse (`competition.competitionId !== null`)

| Dato | Motstander | Resultat | H/B/N | Konkurranse | Kilde | Status |
|:---|:---|:---:|:---:|:---|:---|:---:|
| 1925-09-13 | Viking | 1–2 | Borte | NM | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Beriket eksisterende |
| 1933-07-08 | Moss | 3–1 | Borte | Treningskamp | aalesunds-fotballklub-gjennem-1939-ec28 | Ny kamp |
| 1933-08-13 | Nydalen | 4–2 | Hjemme | Treningskamp | aalesunds-fotballklub-gjennem-1939-ec28 | Ny kamp |
| 1938-05-22 | Hødd | 3–2 | Hjemme | Treningskamp | aalesunds-fotballklub-gjennem-1939-ec28 | Ny kamp |
| 1938-06-06 | FK Sykkylven | 8–2 | Borte | Treningskamp | aalesunds-fotballklub-gjennem-1939-ec28 | Ny kamp |
| 1939-10-08 | Roald | 3–2 | Hjemme | Treningskamp | aalesunds-fotballklub-gjennem-1939-ec28 | Ny kamp |
| 1940-10-06 | Spjelkavik | 5–3 | Hjemme | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1946-07-11 | Reidulf | 1–1 | Hjemme | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1946-08-11 | Falken (Høyanger) | 2–1 | Hjemme | NM | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1946-08-25 | Freidig | 2–3 | Hjemme | NM | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Beriket eksisterende |
| 1947-05-26 | Freidig | 0–1 | Hjemme | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1947-06-13 | Aksla | 2–4 | Borte | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1947-06-15 | Ørsta | 2–0 | Hjemme | NM | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1947-08-24 | Nordlandet | 1–1 | Hjemme | 1. divisjon | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1950-07-02 | Freidig | 0–2 | Borte | NM | medlemsblad-for-aalesunds-fotb-1950-62fa | Ny kamp |
| 1951-04-15 | Aksla | 5–1 | Nøytral | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1951-07-13 | Fremad | 2–4 | Hjemme | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1960-07-24 | Vigra | 13–1 | Borte | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1961-04-30 | Velledalen/Ringen | 2–1 | Borte | 1. divisjon | sunnmore-fotballkrets-arsrapport-1961 | Ny kamp |
| 1963-06-30 | Spartak | 1–6 | Hjemme | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1964-04-19 | Velledalen/Ringen | 3–1 | Borte | Treningskamp | sunnmore-fotballkrets-arsrapport-1964 | Ny kamp |
| 1965-07-12 | Stålkameratene | 1–7 | Borte | Treningskamp | medlemsblad-for-aalesunds-fotb-1965-a2c9 | Ny kamp |
| 1977-09-17 | Bergsøy | 1–0 | Borte | 2. divisjon | sunnmore-fotballkrets-arsrapport-1977 | Ny kamp |

---

## 4. Nye klubber opprettet i `data/clubs/`

6 nye motstanderklubber er opprettet med gyldig schema:
1. `nydalen`: Nydalen (Oslo)
2. `il-roald`: Roald (Vigra)
3. `sk-reidulf`: Reidulf (Oslo)
4. `il-falken-hoyanger`: Falken (Høyanger, med eksplisitt `identityKey`)
5. `vigra-il`: Vigra (Vigra)
6. `stalkameratene`: Stålkameratene (Mo i Rana)

---

## 5. Oppfølgingskø (`data/discovery/nb-visual-review-followup.yaml`)

Samtlige 86 ikke-kanoniserte saker er plassert i oppfølgingskøen:
- **24 score-konflikter** (bevarer opprinnelig kildedata uendret i henhold til kildeintegritetsreglene).
- **23 opponent-mismatches** (med `incidentalMatch`-data registrert der en faktisk historisk kamp mot et annet lag ble omtalt på siden).
- **38 temporal-invalide saker** (forhåndsomtaler og terminlister).
- **1 date-usikker sak** (Skarbøvik 1948 med medium datopresisjon).

---

## 6. Arkivtall etter oppdatert PR 196

| Nøkkeltall | Før PR 196 | Etter PR 196 (revidert) | Endring |
|:---|:---:|:---:|:---:|
| **Kanoniske kamper** | 1 524 | **1 545** | **+21** |
| **År med kanoniske kamper** | 93 | **95** | **+2** |
| **Klubber** | 196 | **202** | **+6** |
| **Leverandørobservasjoner** | 402 | **425** | **+23** |
| **Ukoblede kilderesultater** | 1 570 | **1 547** | **-23** |

---

## 7. Verifikasjon og tester

Alle valideringer, sikkerhetskontroller og tester kjører 100 % grønt:
- `pnpm validate`: PASS (1 545 kamper, 202 klubber, 425 leverandørobservasjoner)
- `AAFK_DATA_DIR=fixtures/data pnpm validate`: PASS
- `pnpm db:build`: PASS
- `pnpm data:duplicates`: PASS (0 kollisjoner)
- `pnpm data:contradictions`: PASS
- `pnpm data:historical-preservation`: PASS (0 datatap)
- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm test`: PASS (95 testfiler / 1210 tester)

---

## 8. Beslutningsport: READY_FOR_SOURCE_RESULT_WIDE_RETRIEVAL

PR 196 har nå fullstendig eliminert feilaktige motstander- og dato-koblinger. Samtlige 23 kanoniserte kamper hviler på ugjendrivelig primærkildedokumentasjon med verifisert motstanderidentitet.

**Status:** `READY_FOR_SOURCE_RESULT_WIDE_RETRIEVAL`
