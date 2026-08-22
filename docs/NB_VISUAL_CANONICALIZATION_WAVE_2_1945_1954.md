# NB Visual Review Canonicalization (Wave 2: 1945–1954 / Faktisk snitt: 1945–1948)

## 1. Bakgrunn og Mål

Denne rapporten dokumenterer kanoniseringen av verifiserte Wave 2-hypoteser fra perioden 1945–1954 basert på visuell faksimilereview i Nasjonalbibliotekets nettbibliotek (PR #203).

Kanoniseringen følger de strenge prinsippene fra PR #200:
- **Ekte avisartikler er primærbeviset (`actualVisualSource`).**
- **Full Source-Result Identity Gate:** Kun observasjoner der motstander, dato, bane og score matcher eksakt uten uavklarte konflikter blir kanonisert.
- **Faktisk kanoniseringssnitt:** Samtlige 36 ready-saker fra Wave 2-utvalget 1945–1954 tilhører sesongene **1945–1948**. Ingen tilhører 1954–1957, og det er **0 overlap** med de 54 forskjøvede radene i Medlemsblad 1965.
- **Idempotens:** Kjøring mot et allerede oppdatert arkiv produserer 0 nye skrivinger.

---

## 2. Populasjonsregnskap og Utvalg

| Kategori | Antall | Beskrivelse |
|---|---|---|
| **Totalt Wave 2 reviewet (1945–1954)** | **62** | Fullført visuell review i PR #203 (fordelt på 1945–1948) |
| **Kanonisk kvalifisert (`canonicalEligibility: ready`)** | **36** | Sikre funn med fullstendig avisbevis (1945–1948) |
| **Ekskludert fra kanonisering (ikke ready)** | **26** | Saker med konflikter, søskentvetydighet eller utilstrekkelig bevis |
| **Skjæringspunkt med forskjøvede Medlemsblad-rader** | **0** | Ingen overlap med 1954–1957 reparasjonen |

### Fordeling av ekskluderte saker (Community Rest Queue)
- **Søskentvetydighet (`sibling_resolution`):** 16
- **Scorekonflikt (`score_conflict`):** 1
- **Ulik hendelse (`different_event`):** 8
- **Ikke senior A-lag (`non_senior`):** 1

---

## 3. Kanoniseringsresultater

| Metrikk | Verdi | Beskrivelse |
|---|---|---|
| **Klarerte input-saker** | **36** | Maksimalt antall input-kandidater |
| **Nye kanoniske kamper opprettet** | **36** | Unike, nye kamper i `data/seasons/<år>/matches/` |
| **Eksisterende kamper beriket** | **0** | Ingen duplikater mot eksisterende kamper |
| **Kilderesultater koblet (`matchId`)** | **36** | `data/source-results/` oppdatert |
| **NB-observasjoner opprettet** | **36** | `data/observations/nasjonalbiblioteket/` |
| **Blokkert av identitetskonflikt** | **0** | Ingen kollisjoner |
| **Nye klubber opprettet** | **0** | 100 % eksisterende kanoniske klubb-ID-er benyttet |
| **Nye turneringer opprettet** | **0** | 100 % eksisterende turneringer benyttet |
| **Destruktive endringer** | **0** | Ingen data eller kamper slettet |

---

## 4. Sesongfordeling av Kanoniserte Kamper

| Sesong | Nye kamper | Eksempler på kamper |
|---|---|---|
| **1945** | 5 | Spjelkavik (30.09), KFK (20.10), Hødd (29.07), Volda (22.09), Træff (05.08) |
| **1946** | 6 | Rollon (27.06, 02.07), KFK (26.05), Kvik Halden (09.07), Aksla (07.09), Clausenengen (23.06) |
| **1947** | 10 | Rollon (15.06), KFK (11.05, 07.06, 21.09), Drafn (07.07), Frigg (26.10), Clausenengen (07.09, 05.10, 22.06), Molde (24.08) |
| **1948** | 15 | Skarbøvik (18.04), Molde (24.05, 03.10), Ørsta (17.10), Træff (13.06), Bodø/Glimt (04.07), Lyn (23.05), Sarpsborg (06.06), Rollon (12.09, 21.04, 18.05, 09.08), Langevåg (17.05), KFK (30.05, 22.08) |
| **Totalt** | **36** | |

---

## 5. Idempotens og Verifikasjon

| Kjøring | Nye kamper | Nye observasjoner | Nye koblinger | Filer skrevet | Allerede tilstede |
|---|---|---|---|---|---|
| **Første kjøring (`--apply`)** | 36 | 36 | 36 | 72 | 0 |
| **Andre kjøring (Idempotens-test)** | 0 | 0 | 0 | **0** | **36** |

---

## 6. Sjekkliste for Kvalitetskrav

- [x] Kun Wave 2 ready-saker fra 1945–1954 er behandlet (faktisk 1945–1948).
- [x] Frozen Wave 2 selection er 100 % bevart historisk.
- [x] Skjæringspunkt med de 54 forskjøvede Medlemsblad-radene er beviselig 0.
- [x] Avisbevis (`actualVisualSource`) benyttet som autoritativ provenienskilde.
- [x] `matchDate` hentet fra visuelt observert dato og bevis, aldri implisitt fra avisens utgivelsesdato (`issueDate`).
- [x] 0 nye klubber og 0 nye turneringer opprettet.
- [x] Alle 36 kamper validerer mot arkivskjemaet (`pnpm validate`).
