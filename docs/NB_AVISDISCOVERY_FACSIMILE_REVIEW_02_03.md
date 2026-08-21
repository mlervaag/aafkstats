# Faksimileverifisering og Ground-Truth for NB-avisdiscovery (Batch 02 og 03)

**Dato:** 21. august 2026  
**Status:** Fullført faksimilegjennomgang og kanonisering  
**Oppdragsgrense:** Historisk kildekontroll og faksimile-ground-truth mot Nasjonalbibliotekets aviser etter rekalibrering i PR #187.  

---

## 1. Bakgrunn og formål

PR #187 («Rekalibrer NB-avisdiscovery mot faksimile-ground-truth») innførte strengere temporale regler og lokal setningsbinding i discovery-pipelinen. Denne rapporten dokumenterer en fullstendig, kildekritisk faksimilestudie av hele kontrollpopulasjonen på 16 saker fra Batch 02 og 03:

- **12 saker med status `confirmed`** etter PR #187 (8 fra Batch 02, 4 fra Batch 03, inkludert 4 nye saker som ble løftet til confirmed i PR #187).
- **4 saker med nedgradert status** (`ambiguous` / `probable`) etter PR #187 for å evaluere graden av *over-abstention* (konservative avvisninger) mot *korrekte avvisninger*.

---

## 2. Kontrollpopulasjon og faksimilebevis

Hver enkelt sak er kontrollert visuelt mot Nasjonalbibliotekets avisfaksimiler i Sunnmørsposten.

| År | Nr | Motstander | Kilde-score | Status i PR #187 | Aviskilde (Sunnmørsposten) | Faksimile-funn og bevis | Ground Truth | Disposisjon |
|---|---|---|---|---|---|---|---|---|
| **1949** | #17 | Langevåg | [4, 0] | `confirmed` *(ny)* | 27.06.1949 s. 2 / 28.06.1949 s. 2 | Referat: NM 1. runde spilt søndag 26. juni 1949 på Aksla stadion. AaFK vant 4–0 (pause 1–0). 2 300 tilskuere. | 1949-06-26, Aksla, NM 1. runde, 4–0 | `facsimile_verified_canonicalizable` |
| **1952** | #4 | Eid | [2, 3] | `confirmed` | 19.05.1952 s. 3 / 20.05.1952 s. 2 | Referat: Privatkamp på Nordfjordeid søndag 18. mai 1952. Eid vant 3–2 (AaFK tapte 2–3). | 1952-05-18, Nordfjordeid, Privatkamp, 2–3 (Eid 3–2) | `facsimile_verified_canonicalizable` |
| **1952** | #8 | Årstad | [5, 1] | `confirmed` | 05.07.1952 s. 3 | Referat: Privatkamp på Aksla stadion fredag 4. juli 1952 («i går»). AaFK slo Hovedserielaget Årstad 5–1. | 1952-07-04, Aksla, Privatkamp, 5–1 | `facsimile_verified_canonicalizable` |
| **1952** | #9 | Lyn, Gjøvik | [1, 3] | `ambiguous` *(nedgradert)* | 11.07.1952 s. 5 | Referat: Første kamp på Østlandsturné spilt torsdag 10. juli 1952 på Gjøvik. Gjøvik-Lyn vant 3–1. | 1952-07-10, Gjøvik, Privatkamp, 1–3 (Gjøvik-Lyn 3–1) | `facsimile_verified_canonicalizable` (Over-abstention) |
| **1952** | #16 | Clausenengen | [1, 0] | `confirmed` | 05.05.1952 s. 3 | Referat: Landsdelsseriekamp i Kristiansund søndag 4. mai 1952 («i går»). AaFK vant 1–0. | 1952-05-04, Kristiansund, 1. divisjon, 1–0 (CFK 0–1) | `facsimile_verified_canonicalizable` |
| **1953** | #6 | Moss FK | [2, 0] | `confirmed` | 08.07.1953 s. 3 | Referat: Privatkamp på Aksla stadion tirsdag 7. juli 1953 («i går kveld»). AaFK slo Moss FK 2–0. Nesten 2 000 tilskuere. | 1953-07-07, Aksla, Privatkamp, 2–0 | `facsimile_verified_canonicalizable` |
| **1953** | #19 | Hødd | [3, 1] | `confirmed` | 24.08.1953 s. 2 / 25.08.1953 s. 3 | Referat: Landsdelsseriekamp på Aksla stadion søndag 23. august 1953 («i går»). AaFK slo Hødd 3–1 (pause 2–0). | 1953-08-23, Aksla, 1. divisjon, 3–1 | `facsimile_verified_canonicalizable` |
| **1953** | #21 | KFK | [1, 3] | `confirmed` *(ny)* | 07.09.1953 s. 2 *(feil dato 24.08 i pipeline)* | Referat: Landsdelsseriekamp på Aksla stadion søndag 6. september 1953 («i går»). KFK vant 3–1 over AaFK. *(Pipeline bandt feilaktig dato 23.08 fra en resultatbørs 24.08 der KFK tapte mot Ørsta).* | 1953-09-06, Aksla, 1. divisjon, 1–3 | `facsimile_verified_canonicalizable` (Korriger dato til 1953-09-06) |
| **1955** | #34 | Måløy | [3, 2] | `confirmed` | 25.07.1955 s. 2 | Referat: Privatkamp/turné i Måløy søndag 24. juli 1955 («i går»). AaFK vant 3–2 (Måløy ledet 2–0 ved pause). | 1955-07-24, Måløy, Privatkamp, 3–2 (Måløy 2–3) | `facsimile_verified_canonicalizable` |
| **1955** | #35 | Herd | [4, 3] | `confirmed` *(ny)* | 20.05.1955 s. 2 | Notiser på samme side: 1) «Aa.F.K. og Herd spilte uavgjort 1—1 i en privat-reservelagskamp på Nørve onsdag kveld». 2) «Ørsta-Herd 3-4 ... i går». Pipeline klynget scoren 4–3 fra Ørsta–Herd til AaFK–Herd! | **Falsk positiv i pipeline.** Ingen AaFK 4–3-seier i avisen. | `false_positive` (Avvist fra kanonisering) |
| **1958** | #15 | Braatt | [1, 1] | `probable` *(nedgradert)* | 12.05.1958 s. 2 | Referat: Landsdelsseriekamp på Aksla stadion søndag 11. mai 1958 («i går»). AaFK og Braatt delte poengene 1–1. | 1958-05-11, Aksla, 1. divisjon, 1–1 | `facsimile_verified_canonicalizable` (Over-abstention) |
| **1961** | #17 | Herd | [1, 2] | `ambiguous` *(nedgradert)* | 17.06.1961 s. 6 | Notis: «... at Langevågs lilleputter serievant 3—1 over Herd fredag ... at ÅFKs lilleputter slo Spjelkavik 2—1». To separate lilleputtkamper. Ingen senior-kamp. | **Falsk positiv i eldre discovery.** Korrekt nedgradert i PR #187. | `relationship_verified_but_insufficient` / `correct_abstention` |
| **1963** | #1 | Spjelkavik | [4, 1] | `confirmed` *(ny)* | 25.03.1963 s. 3 | Referat: Treningskamp (3x25 min) på Nørve lørdag 23. mars 1963. AaFK (2. div.) vant 4–1 over Spjelkavik. | 1963-03-23, Nørve, Treningskamp, 4–1 | `facsimile_verified_canonicalizable` |
| **1963** | #11 | Årstad | [0, 4] | `confirmed` | 22.07.1963 s. 3 / 24.07.1963 s. 6 | Referat: Privatkamp på Aksla stadion søndag 21. juli 1963 («i går»). Årstad vant 4–0 over et svakt AaFK-lag. | 1963-07-21, Aksla, Privatkamp, 0–4 | `facsimile_verified_canonicalizable` |
| **1963** | #14 | Sunnmøringen | [0, 2] | `ambiguous` *(nedgradert)* | 28.09.1963 s. 6 / 30.09.1963 s. 2 | Forhåndsomtale 28.09 for søndag 29.09. Referat 30.09 s. 2: «Sunnmøringen slo ÅFK 2-0» på Aksla søndag 29. september 1963. | 1963-09-29, Aksla, Privatkamp, 0–2 | `facsimile_verified_canonicalizable` (Over-abstention) |
| **1963** | #18 | Hødd | [2, 5] | `confirmed` | 24.06.1963 s. 2 *(feil dato 07.09 i pipeline)* | Referat: NM 2. runde spilt på Høddvoll søndag 23. juni 1963. Hødd slo AaFK 5–2. *(Pipeline utledet dato 1963-09-07 fra en forhåndsomtale 11.09 av en kommende privatkamp som retrospektivt nevnte 5–2 fra cupen).* | 1963-06-23, Høddvoll, NM 2. runde, 2–5 (Hødd 5–2) | `facsimile_verified_canonicalizable` (Korriger dato til 1963-06-23) |

---

## 3. Presisjonsmåling for current confirmed (12 saker)

Av de 12 sakene som var klassifisert som `confirmed` av pipeline etter PR #187:

1. **Full matchpresisjon (Korrekt kamp + korrekt score + eksakt korrekt dato):**  
   **9 av 12 saker (75,0 %)**  
   (1949 #17 Langevåg, 1952 #4 Eid, 1952 #8 Årstad, 1952 #16 Clausenengen, 1953 #6 Moss, 1953 #19 Hødd, 1955 #34 Måløy, 1963 #1 Spjelkavik, 1963 #11 Årstad).

2. **Reell kamp- og relasjonspresisjon (Korrekt kampidentitet og resultat):**  
   **11 av 12 saker (91,7 %)**  
   (De 9 over, pluss 1953 #21 KFK og 1963 #18 Hødd som er faktiske kamper med verifisert resultat, men med feil dato i automatisert utledning).

3. **Falske positiver i score/kamp:**  
   **1 av 12 saker (8,3 %)**  
   (1955 #35 Herd: scoren 4–3 tilhørte nabonotisen Ørsta–Herd på samme side; AaFK spilte 1–1 i reservelagskamp).

4. **Kjente feilkilder på datobinding:**  
   **2 av 12 saker (16,7 %)**  
   - *1953 #21 KFK*: Sammensatt resultatbørs 24.08.1953 forførte pipelinen til dato 23.08 (da KFK tapte for Ørsta), mens AaFK–KFK 1–3 faktisk ble spilt 06.09.1953.
   - *1963 #18 Hødd*: Retrospektiv referanse i en forhåndsomtale 11.09.1963 arvet datoen til den nye privatkampen (september), mens NM 2. runde faktisk ble spilt 23.06.1963.

---

## 4. Evaluering av de 4 nye confirmed fra PR #187

PR #187 løftet fire spesifikke saker fra `ambiguous` til `confirmed`:

- **1949 #17 Langevåg [4, 0]**: **True positive**. Fullstendig bekreftet i Sunnmørsposten 27.06.1949 s. 2 og 28.06.1949 s. 2 (NM 1. runde, Aksla stadion, 2 300 tilskuere, 26.06.1949).
- **1963 #1 Spjelkavik [4, 1]**: **True positive**. Fullstendig bekreftet i Sunnmørsposten 25.03.1963 s. 3 (Treningskamp 3x25 min, Nørve, 23.03.1963).
- **1953 #21 KFK [1, 3]**: **Partiell true positive / datobindingsfeil**. Kampen og resultatet er 100 % ekte (AaFK–KFK 1–3 i Landsdelsserien), men datoen 1953-08-23 var feilutledet fra en resultatbørs; faksimilen 07.09.1953 s. 2 beviser at datoen var 1953-09-06.
- **1955 #35 Herd [4, 3]**: **False positive**. Pipeline blandet nabonotiser.

**Konklusjon for nye confirmed:** 2/4 (50,0 %) feilfrie datoer, 3/4 (75,0 %) korrekte kamper, 1/4 (25,0 %) falsk positiv.

---

## 5. Evaluering av de 4 nedgraderte sakene (Over-abstention analyse)

PR #187 nedgraderte fire saker for å unngå usikre koblinger:

- **1961 #17 Herd [1, 2]**: **Korrekt abstention (True negative / correct rejection)**. Avisnotisen 17.06.1961 s. 6 omhandlet utelukkende lilleputtkamper (Langevåg–Herd og AaFK–Spjelkavik). Den tidligere confirmed-statusen var en ren hallusinasjon/støy. Nedgraderingen reddet arkivet fra feilaktig kanonisering.
- **1952 #9 Lyn, Gjøvik [1, 3]**: **Over-abstention**. Kampen fant sted torsdag 10. juli 1952 på Gjøvik (Sunnmørsposten 11.07.1952 s. 5). Pipelinen avsto fordi «i går» sto i brødteksten og ikke i samme setning som scoren i tittelblokken.
- **1958 #15 Braatt [1, 1]**: **Over-abstention**. Kampen fant sted søndag 11. mai 1958 på Aksla stadion (Sunnmørsposten 12.05.1958 s. 2). Pipelinen avsto fordi setningsbindingen var for snever.
- **1963 #14 Sunnmøringen [0, 2]**: **Over-abstention**. Kampen fant sted søndag 29. september 1963 på Aksla stadion (Sunnmørsposten 28.09.1963 s. 6 og 30.09.1963 s. 2). Pipelinen feiltolket en forhåndsomtale eller manglet temporalt fremover-oppslag.

**Konklusjon om nedgraderinger:** 1 av 4 var en kritisk og korrekt avvisning av støy; 3 av 4 var over-abstention der faksimilen har solid dokumentasjon. Dette viser at pipeline-reglene etter PR #187 er svært trygge mot falske positiver, men noe for konservative på komplekse layoutformater.

---

## 6. Systematiske svakheter i NB-discovery (til separat PR)

Faksimilegjennomgangen avdekker to distinkte svakheter i den nåværende discovery-algoritmen:

1. **Resultatbørs- og flernotis-forurensning:**
   - *Eksempel:* Sunnmørsposten 20.05.1955 s. 2 (Herd 1955 #35) og 24.08.1953 s. 2 (KFK 1953 #21).
   - Når en avisside inneholder flere kampresultater i samme spalte eller seksjon (f.eks. reservelagskamp + juniorkamp + nabokamp), kan score eller dato fra en nabonotis lekke over til AaFK-klyngen.
   - *Anbefalt tiltak:* Krev at entitetsnavn («AaFK», «Aalesund») og motstandernavn forekommer innenfor samme avgrensede overskrift/avsnittsblokk som måltallene, og innfør negativ filtrering mot urelaterte klubbpar (f.eks. «Ørsta–Herd») i samme linje.

2. **Retrospektiv kampreferanse vs. arrangementsdato:**
   - *Eksempel:* Sunnmørsposten 11.09.1963 s. 6 (Hødd 1963 #18).
   - En forhåndsomtale av en kommende kamp nevner tidligere oppgjør («Sist laga spilte mot hverandre var i cupen, og da vant Hødd 5–2»). Algoritmen knytter den historiske scoren (5–2) til arrangementsdatoen for den kommende kampen (september i stedet for juni).
   - *Anbefalt tiltak:* Gjenkjenn retrospektive markører som «sist laga spilte», «den gang vant», «i forrige runde», og hindre at disse arver nåtids-datoer fra artikkelens hovedtema.

---

## 7. Gjennomførte arkivendringer i denne PR-en

Følgende 14 verifiserte kamper er kanonisert og beriket med kilde- og observasjonsgrunnlag:

1. `1949-06-26-aalesunds-fk-langevag.yaml` (NM 1. runde, 4–0, 2 300 tilskuere)
2. `1952-05-04-clausenengen-aalesunds-fk.yaml` (1. divisjon Møre, 0–1)
3. `1952-05-18-eid-il-aalesunds-fk.yaml` (Privatkamp, 3–2 til Eid)
4. `1952-07-04-aalesunds-fk-arstad-il.yaml` (Privatkamp, 5–1)
5. `1952-07-10-gjovik-lyn-aalesunds-fk.yaml` (Privatkamp, 3–1 til Gjøvik-Lyn)
6. `1953-07-07-aalesunds-fk-moss.yaml` (Privatkamp, 2–0, 2 000 tilskuere)
7. `1953-08-23-aalesunds-fk-hodd.yaml` (1. divisjon Møre, 3–1)
8. `1953-09-06-aalesunds-fk-kfk.yaml` (1. divisjon Møre, 1–3)
9. `1955-07-24-maloy-il-aalesunds-fk.yaml` (Privatkamp, 2–3 til AaFK)
10. `1958-05-11-aalesunds-fk-braatt.yaml` (1. divisjon Møre, 1–1)
11. `1963-03-23-aalesunds-fk-spjelkavik.yaml` (Treningskamp 3x25 min, 4–1)
12. `1963-06-23-hodd-aalesunds-fk.yaml` (NM 2. runde, 5–2 til Hødd)
13. `1963-07-21-aalesunds-fk-arstad-il.yaml` (Privatkamp, 0–4)
14. `1963-09-29-aalesunds-fk-sunnmoringen.yaml` (Privatkamp, 0–2)

Alle 14 har tilhørende observasjonsfiler under `data/observations/nasjonalbiblioteket/` med deterministisk `payloadHash`, oppdaterte `matchId`-pekere i `data/source-results/`, og nye klubbentiteter (`arstad-il`, `maloy-il`, `sunnmoringen`) i `data/clubs/`.

---

## 8. Beslutningsport for videre NB-discovery

**Beslutning:** **`FIX_DISCOVERY_BEFORE_NEW_BATCH`**

### Begrunnelse:
Selv om presisjonen for kampidentitet og resultat er høy (91,7 %), viser kontrollen at discovery-algoritmen fortsatt har to systematiske sårbarheter:
1. Den kan feilaktig klynge måltall fra nabonotiser på samme side (falsk positiv som 1955 #35 Herd).
2. Den kan hekte feil dato på en ekte kamp når den leser resultatbørser eller retrospektive omtaler (1953 #21 KFK og 1963 #18 Hødd).

Før neste store batch med helautomatisert discovery kjøres (f.eks. Batch 04 og fremover), bør disse to mønstrene utbedres i en egen målrettet algoritme-PR. Inntil det er gjort, må ingen NB-funn kanoniseres uten manuell visuell faksimilekontroll.
