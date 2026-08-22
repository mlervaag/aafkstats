# Reparasjonsrapport: Korreksjon av årsforskyvning i Medlemsblad 1965 (Skann 14)

**Dato:** 2026-08-22  
**Opphav:** PR 205  
**Berørt kilde:** `data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml` («Våre kamper gjennom 50 år»)  
**Beslutningsport:** `SOURCE_YEAR_SHIFT_REPAIRED`

---

## 1. Rotårsak og Bakgrunn

Kilden «Våre kamper gjennom 50 år» i AaFKs medlemsblad fra 1965 (side 8–16) inneholder en retrospektiv oversikt over klubbens kamper fra 1915 til 1965 trykt over flere spalter.

På **skann 14** (side 14) oppstod en transkripsjonsfeil ved overgang mellom spalter/avsnitt:
- Årsoverskriftene for sesongene 1954, 1955, 1956 og 1957 ble forskjøvet.
- Resultatene, motstandernavnene, målene og hjemme/borte-markeringene var i hovedsak transkribert korrekt fra trykket, men **54 kildepåstander** ble plassert under feil sesongår.

---

## 2. De 54 flyttede kildepåstandene

Totalt 54 kildepåstander er flyttet til sitt korrekte sesongår, og de gjenværende radene i hver sesong er renummerert sekvensielt:

| Opprinnelig sesong & rader | Korrekt sesong & nye rader | Antall | Beskrivelse / Innhold |
| :--- | :--- | :---: | :--- |
| **1955 #1 – #23** | **1954 #10 – #32** | **23** | Fortsettelsen av 1954-sesongen (inkl. Guard 2–0 i jubileumsturneringen og Freidig 1–3 i cupen) |
| **1955 #24 – #36** | **1955 #1 – #13** | **13** | Starten av 1955-sesongen (begynner med Aksla 6–2) |
| **1956 #1 – #16** | **1955 #14 – #29** | **16** | Fortsettelsen av 1955-sesongen (serie og cup) |
| **1956 #17 – #29** | **1956 #1 – #13** | **13** | Starten av 1956-sesongen (begynner med Rollon 1–3) |
| **1957 #1 – #15** | **1956 #14 – #28** | **15** | Fortsettelsen av 1956-sesongen (serie og cup) |
| **1957 #16 – #44** | **1957 #1 – #29** | **29** | Den faktiske 1957-sesongen (begynner med Aksla 4–1) |

Fullstendig maskinlesbar mapping mellom alle gamle og nye koordinater er lagret i:
`data/discovery/medlemsblad-1965-year-shift-mapping.yaml`

---

## 3. Sesongregnskap (før og etter reparasjon)

| Sesong | Antall rader FØR | Antall rader ETTER | Netto endring | Forklaring |
| :---: | :---: | :---: | :---: | :--- |
| **1954** | 9 | **32** | +23 | Fikk tilført 23 rader som feilaktig lå under 1955 |
| **1955** | 36 | **29** | -7 | Mistet 23 rader til 1954, fikk 16 rader fra 1956 |
| **1956** | 29 | **28** | -1 | Mistet 16 rader til 1955, fikk 15 rader fra 1957 |
| **1957** | 44 | **29** | -15 | Mistet 15 rader til 1956 |
| **Totalt** | **118** | **118** | **0** | **Totalt antall kildepåstander i kilden er 100 % bevart** |

Totalt antall source-results i arkivet forblir **1 777**.

---

## 4. Audit av `matchId` og kanoniske kamper

### Prinsipp: Separasjon av evidenslag
En ekte avisartikkel funnet i en 1955-avis beviser at det fant sted en reell kamp i 1955. Den kan derimot **ikke** bevise at en 1954-kildepåstand beskrev denne 1955-kampen.

### Gjennomgang av de 54 flyttede radene:
10 av de 23 radene som ble flyttet fra 1955 til 1954 hadde en eksisterende `matchId` i 1955:
1. `1955-04-22-aalesunds-fk-rollon` (AaFK – Rollon 1–0, Sunnmørsposten 1955-04-23 s. 3)
2. `1955-05-15-aalesunds-fk-rollon` (AaFK – Rollon 2–4, Sunnmørsposten 1955-05-16 s. 2)
3. `1955-05-19-aalesunds-fk-rollon` (AaFK – Rollon 3–0, Sunnmørsposten 1955-05-20 s. 2)
4. `1955-05-30-aalesunds-fk-molde-fk` (AaFK – Molde 1–1, Sunnmørsposten 1955-05-31 s. 2)
5. `1955-07-11-aalesunds-fk-hodd` (AaFK – Hødd 3–1, Sunnmørsposten 1955-07-12 s. 3)
6. `1955-08-14-kfk-aalesunds-fk` (KFK – AaFK 2–0, Sunnmørsposten 1955-08-15 s. 2)
7. `1955-09-12-aalesunds-fk-guard` (AaFK – Guard 2–0, Sunnmørsposten 1955-09-13 s. 5)
8. `1955-09-25-langevag-aalesunds-fk` (Langevåg – AaFK 2–0, Sunnmørsposten 1955-09-26 s. 2)
9. `1955-10-09-aalesunds-fk-kfk` (AaFK – KFK 2–3, Sunnmørsposten 1955-10-10 s. 2)
10. `1955-11-06-hodd-aalesunds-fk` (Hødd – AaFK 1–2, Sunnmørsposten 1955-11-07 s. 2)

### Aksjoner utført:
- **I kildedata (`data/source-results/`):** De 10 feilaktige `matchId`-koblingene på de nå 1954-plasserte radene er fjernet (`KEEP_MATCH_REMOVE_SOURCE_LINK`).
- **I kanoniske kampfiler (`data/seasons/1955/matches/`):** Referansen `sourceId: medlemsblad-for-aalesunds-fotb-1965-a2c9` er fjernet fra de 10 kampene.
- **Kanonisk bevaring:** **Ingen kanoniske kamper er slettet.** Kampene forblir 100 % gyldige, verifiserte kamper i 1955 støttet av Nasjonalbiblioteket-leverandørobservasjon og faksimile fra Sunnmørsposten.
- **Ekte 1955-kildepåstander:** 2 kamper (`1955-04-24-aalesunds-fk-hodd` og `1955-07-24-maloy-il-aalesunds-fk`) som tilhører de ekte 1955-radene (#2 og #11) beholder medlemsblad-kildereferansen.

---

## 5. Audit av `resultGroupId`

- Kun 1 flyttet rad hadde `resultGroupId`: rad 1954 #20 (tidligere 1955 #11) hadde `resultGroupId: nm-1955-langevag-runde-2`.
- Denne koblingen var feilaktig (hørte til NM 1955, mens kildepåstanden gjelder 1954). Feltet er fjernet på 1954-raden.
- Alle 1957 `resultGroupId`-er (`1957-aksla-4-1`, `forstedivisjon-1957-hodd-2-0` osv.) forblir intakte og gyldige under sesong 1957.

---

## 6. Påvirkning på NB-Hypoteser og Review-Populasjoner

| Populasjon / Periode | Før reparasjon | Etter reparasjon | Endring | Status |
| :--- | :---: | :---: | :---: | :--- |
| **1945–1954 Unifiserte hypoteser** | 225 | **248** | +23 | Utvidet med 23 nye 1954-hypoteser |
| **1955–1964 Unifiserte hypoteser** | 354 | **425** | +71 | Regenerert etter renummerering og kildejustering |
| **PR 203 gjennomførte Wave 2 reviews** | 62 | 62 | 0 | 100 % i 1945–1948; uberørt av årsforskyvningen |
| **1945–1954 Nye saker som krever review** | 0 | **23** | +23 | Må visuelt reviewes mot faksimiler fra 1954 |

### Status for kanoniseringen av de 36 Wave 2-kampene:
De 23 korrigerte 1954-kildepåstandene krever ny visuell review før de selv kan kanoniseres. Dette blokkerer derimot **ikke** kanoniseringen av de 36 sikre Wave 2-funnene fra 1945–1948, ettersom disse 36 er 100 % uberørt av årsforskyvningen på skann 14 (`canonicalized36 intersect shiftedClaims = 0`).

---

## 7. Ny Guardrail mot Årskontekst-Lekkasje

1. **Regresjonstest:** `packages/schema/test/medlemsblad-1965-shift-guardrails.test.ts` låser radantallene 32, 29, 28, 29 for 1954–1957 og kontrollerer grensene på skann 14.
2. **Runbook-oppdatering:** `docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md` er oppdatert i *Lessons Ledger* med eksplisitt krav om spalte-/sideskiftskontroll av aktiv årsoverskrift (`activeYearHeading`).

---

## 8. Sluttoppsummering og Beslutningsport

| Krav / Mål | Utfall |
| :--- | :---: |
| 54 rader flyttet til korrekt sesong | **Fullført** |
| Radtelling 32, 29, 28, 29 i 1954–1957 | **Fullført** |
| Totalt 1 777 source-results bevart | **Fullført** |
| Eksplisitt migreringsmapping lagret | **Fullført** |
| 10 uavhengige 1955-kamper bevart uten feil kildereferanse | **Fullført** |
| 0 kanoniske kamper slettet | **Fullført** |
| 36 Wave 2-kamper (1945–1948) kanonisert uten kollisjoner | **Fullført** |
| `pnpm validate` passerer med 0 feil | **Fullført** |
| Guardrails og regresjonstester etablert | **Fullført** |

**Beslutningsport:** `SOURCE_YEAR_SHIFT_REPAIRED`
