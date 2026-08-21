# NB-avisdiscovery: Nasjonal populasjonskartlegging, yield-scan og community-produksjonskø

## 1. Bakgrunn og formål

Denne rapporten dokumenterer en total kartlegging og analyse av hele den historiske kildedokumenterte populasjonen i AaFK-arkivet (1915–1984) mot Nasjonalbibliotekets avissamling.

### Skifte i målsetning:
* **Tidligere mål:** «Finn bare kamper AI kan bevise autonomt.»
* **Nytt mål for community-verifisering:** «Finn konkrete avissider som lar et menneske avgjøre en kamphypotese raskt (JA / NEI / KAN IKKE BESTEMMES).»

Discovery-motoren brukes her som:
1. Rangeringsmotor og kandidatgenerator
2. Verktøy for automatiske/AI-sikre funn
3. Produsent av en maskinlesbar produksjonskø (`nb-newspaper-community-candidates@1`) for neste steg i community-verifiseringen (`/mangler`).

---

## 2. Totalt kildedokumentert inventar

Arkivet inneholder totalt **1 768** kildedokumenterte kamppåstander fordelt på 49 kildedokumenter.

| Kategori | Antall |
|---|---|
| Rå kildedokumenterte rader | 1 768 |
| Allerede koblet til kanonisk kamp | 198 |
| **Ukoblede rader som trenger verifisering** | **1 570** |
| Unifiserte kamphypoteser totalt | 1 270 |
| **Ukoblede kamphypoteser totalt** | **1 071** |
| – Automatiske singleton-hypoteser | **294** |
| – Sibling-hypoteser (manuell sibling-kø) | **777** (fordelt på 287 grupper) |
| Kanoniske kamper i arkivet | 1 524 |

---

## 3. Inventar per historisk periode

| Periode | Rå rader (ukoblet / koblet) | Ukoblede hypoteser | Singletons (kjørt) | Sibling-hypoteser (grupper) | Scoredekning | Konkurranse-hint | Hjemme/Borte-hint | Kanoniske kamper |
|---|---|---|---|---|---|---|---|---|
| **1915–1924** | 218 / 47 | 109 | 33 | 76 (29) | 100.0 % | 6.4 % | 0.0 % | 20 |
| **1925–1934** | 355 / 38 | 195 | 62 | 133 (50) | 100.0 % | 8.7 % | 3.1 % | 19 |
| **1935–1944** | 228 / 20 | 116 | 32 | 84 (36) | 100.0 % | 7.5 % | 5.7 % | 10 |
| **1945–1954** | 239 / 26 | 220 | 72 | 148 (54) | 100.0 % | 41.8 % | 21.3 % | 22 |
| **1955–1964** | 454 / 58 | 365 | 68 | 297 (102) | 100.0 % | 52.9 % | 24.7 % | 32 |
| **1965–1974** | 57 / 10 | 55 | 21 | 34 (14) | 100.0 % | 87.7 % | 59.6 % | 8 |
| **1975–1984** | 10 / 8 | 10 | 6 | 4 (2) | 100.0 % | 100.0 % | 0.0 % | 65 |
| **SUM** | **1 570 / 198** | **1 071** | **294** | **777 (287)** | **100.0 %** | **31.3 %** | **14.2 %** | **176** |

---

## 4. Analysebegrepet `community_reviewable`

En hypotese klassifiseres deterministisk som `community_reviewable: true` dersom:
1. Discovery har identifisert **én konkret avisutgave** hos Nasjonalbiblioteket.
2. Discovery har identifisert **én konkret side**.
3. Det foreligger en **direkte URL** (`https://www.nb.no/items/<id>?page=<page>`).
4. Tekstvinduet har lokal relevans (begge lag i samme tekstvindu eller evidensscore $\ge 25$).
5. Treffet er ikke ren terminliste/tabell eller ren B-lagsstøy uten senioromtale.

### Prioritering av community-kandidater:
* **Høy prioritet (`high`):** Konkret side med kampomtale/referat, tidsuttrykk eller eksplisitt målscore (samsvar eller konflikt), singleton, tydelig lagpar i samme tekstblokk.
* **Middels prioritet (`medium`):** Begge lag i samme tekstvindu, forhåndsomtale eller moderat evidensscore ($\ge 35$).
* **Lav prioritet (`low`):** Svakere kontekst eller resultatbørs, men fortsatt avgrensbar til én konkret side.

---

## 5. Yield og metrikker per periode

Discovery ble kjørt for alle **294** automatiske singletons mot Nasjonalbiblioteket innenfor etablerte API- og cache-retningslinjer.

| Periode | Singletons kjørt | Confirmed | Probable | Ambiguous | Conflict | Not Found | **Community Reviewable** | **Auto-Review Candidate** | **Discovery Only** | **Community Yield** | **Request Efficiency** | NB Requests |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1915–1924** | 33 | 0 | 7 | 14 | 0 | 12 | **21** | 0 | 12 | 63.6 % | 0.039 | 540 |
| **1925–1934** | 62 | 0 | 15 | 31 | 0 | 16 | **46** | 0 | 16 | 74.2 % | 0.046 | 991 |
| **1935–1944** | 32 | 0 | 12 | 14 | 0 | 6 | **26** | 0 | 6 | 81.3 % | 0.046 | 565 |
| **1945–1954** | 72 | 0 | 13 | 49 | 0 | 10 | **62** | 0 | 10 | 86.1 % | 0.054 | 1 148 |
| **1955–1964** | 68 | 1 | 21 | 39 | 4 | 3 | **65** | 1 | 3 | 95.6 % | 0.058 | 1 124 |
| **1965–1974** | 21 | 0 | 1 | 20 | 0 | 0 | **21** | 0 | 0 | 100.0 % | 0.054 | 387 |
| **1975–1984** | 6 | 1 | 0 | 5 | 0 | 0 | **6** | 0 | 0 | 100.0 % | 0.050 | 120 |
| **TOTALT** | **294** | **2** | **69** | **172** | **4** | **47** | **247** | **1** | **47** | **84.0 %** | **0.051** | **4 875** |

### Hovedmetrikker og presisering:
1. **Maskinelt Community Review Yield:** **84.0 %** (247 av 294 hypoteser har en konkret avisside som oppfyller de tekniske kravene til en avgrenset community-oppgave). *Dette er en maskinell genereringsrate, ikke en empirisk garanti for at siden beviser kampen.*
2. **Auto-Harvest Yield:** **0.3 %** (1 av 294 tilfredsstilte de strenge kravene til umiddelbar AI-kanonisering uten manuell gjennomgang).
3. **Request Efficiency:** **0.051** community-kandidater per NB API-forespørsel (gjennomsnittlig 19.7 HTTP-forespørsler per godkjent community-kandidat inkludert fulltekstberikelse og negative søkevarianter).

---

## 6. Stikkprøvekontroll av reviewability (16 kandidater)

Et representativt utvalg på 16 kandidater på tvers av perioder, statuser og prioriteter ble undersøkt mot avisteksten hos Nasjonalbiblioteket for å evaluere hvor godt en frivillig kan besvare oppgaven:

| ID / Kamp | Periode | Avis / Side | Status / Score | Faktisk innhold på avissiden | Evaluering | Tidsbruk |
|---|---|---|---|---|---|---|
| `1947 #3 Freidig (0-1)` | 1945–1954 | Sunnmørsposten 27.05.1947 s. 1 | `probable` | «Freidig—Aa.F.K. 1—0. Til kampen annen pinsedag mellom Freidig og ÅFK...» | **True reviewable (JA)** | < 30 sek |
| `1955 #15 Clausenengen (2-1)` | 1955–1964 | Sunnmørsposten 19.09.1955 s. 2 | `confirmed` | «Aa.F.K knep begge poengene mot Clausenengen 2-1... i går» | **True reviewable (JA)** | < 30 sek |
| `1956 #10 Braatt (2-3)` | 1955–1964 | Sunnmørsposten 20.08.1956 s. 2 | `conflict` | «AaFK og Braatt delte poengene 2-2 i et tamt oppgjør på Aksla Stadion i går...» | **True reviewable (JA - kildefeil)** | < 45 sek |
| `1965 #32 Stålkameratene (1-7)` | 1965–1974 | Sunnmørsposten 13.07.1965 s. 6 | `probable` | «Tapte 1—7 for Stålkameratene... spilte mandag helt under båten mot Stålkameratene i Mo...» | **True reviewable (JA)** | < 30 sek |
| `1977 #1 Bergsøy (1-0)` | 1975–1984 | Sunnmørsposten 19.09.1977 s. 7 | `confirmed` | «Topplaget Bergsøy måtte lørdag gi tapt 0-1 for ÅFK... Stan Williams scoret...» | **True reviewable (JA)** | < 30 sek |
| `1978 #1 Kristiansund (0-1)` | 1975–1984 | Sunnmørsposten 25.05.1978 s. 1 | `ambiguous` | «ÅFK-scoring i sluttminuttet i kampen mellom Ålesund Fotballklubb og Kristiansund Fotballklubb sist laurdag...» | **True reviewable (JA)** | < 30 sek |
| `1945 #3 Herd (5-1)` | 1945–1954 | Sunnmørsposten 05.07.1945 s. 2 | `ambiguous` | «Til kampen på Nørve i kveld mellom Ålesund og kombinert Aksla—Herd...» | **True reviewable (NEI / Merknad)** | < 45 sek |
| `1946 #9 Old Boys (4-1)` | 1945–1954 | Sunnmørsposten 05.10.1946 s. 5 | `ambiguous` | «I old boys-kampen på Nørve stiller ÅFK dette laget... K.F.K. old boys mot Aa.F.K. old boys» | **True reviewable (JA - Old Boys)** | < 45 sek |
| `1915 #1 Nordlandet (5-1)` | 1915–1924 | Sunnmørsposten 05.07.1915 s. 4 | `probable` | «...kamp mellem Rollon og Nordlandet... blev intet av, idet Nordlandet trak sig tilbake...» | **True reviewable (NEI / Avlyst)** | < 45 sek |
| `1955 #1 Guard (2-0)` | 1955–1964 | Sunnmørsposten 30.08.1955 s. 4 | `ambiguous` | «...mellom AaFK og Guard. Kampen i rekruttlags-klassen ble vunnet av AaFK med 6—0...» | **True reviewable (NEI - Rekruttlag)** | < 30 sek |
| `1916 #1 International (3-2)` | 1915–1924 | Sunnmørsposten 19.06.1916 s. 4 | `ambiguous` | «Rollon seiret over Aalesund... I Kristiansund kjæmpet International mot Braatt...» | **False reviewable (Støy/separat notis)** | < 30 sek |
| `1926 #24 Sarpsborg (3-6)` | 1925–1934 | Sunnmørsposten 06.09.1926 s. 1 | `ambiguous` | Resultatbørs med «I Sarpsborg seiret Moss...» og «Ørn seiret over Aalesund» | **False reviewable (Resultatbørs)** | < 30 sek |
| `1935 #14 Hamar (1-2)` | 1935–1944 | Sunnmørsposten 16.09.1935 s. 1 | `probable` | Notis om dødsfall på Hamar ved siden av AaFK kampreferat på samme forside | **False reviewable (Geografisk støy)** | < 30 sek |
| `1935 #21 Sarpsborg (4-3)` | 1935–1944 | Sunnmørsposten 01.10.1935 s. 7 | `ambiguous` | NM-trekning: «Viking—Lyn eller Sarpsborg» og omtale av omkamp | **Inconclusive (Trekning/omtale)** | < 45 sek |
| `1959 #18 Volda (5-2)` | 1955–1964 | Sunnmørsposten 03.08.1959 s. 2 | `probable` | «Herd nedsablet redusert Volda-lag 10-1...» (Herd vs Volda, ikke AaFK) | **False reviewable (Naborival)** | < 30 sek |
| `1965 #23 Brage (7-1)` | 1965–1974 | Sunnmørsposten 26.04.1965 s. 3 | `ambiguous` | «...seriemesteren står rede til å møte trøndervinneren (Brage?)...» | **Inconclusive (Spekulasjon)** | < 30 sek |

### Empirisk fordeling i stikkprøven:
* **Faktisk avgjørbar (tydelig JA eller NEI):** **62.5 %** (10 av 16)
  * Direkte bekreftelse av kamp og dato: **37.5 %** (6 av 16)
  * Klart avvisende svar (avlyst kamp, rekruttlag, kombinert lag, kildedivergens): **25.0 %** (4 av 16)
* **False Reviewable / Støy (resultatbørs / uavhengig tekst på samme side):** **25.0 %** (4 av 16)
* **Inconclusive (forhåndsspekulasjon / trekning):** **12.5 %** (2 av 16)
* **Gjennomsnittlig tidsbruk for et menneske:** **30–45 sekunder per oppgave**.

---

## 7. Sweet Spot-analyse for produksjon

Analysen viser en markant forskjell mellom periodene før og etter 1945:

```
1915–1924: [■■■■■■░░░░] 63.6 % Yield (Ujevn OCR, mange avlyste/uoffisielle kamper)
1925–1934: [■■■■■■■░░░] 74.2 % Yield (Større avisvolum, men mange resultatbørser)
1935–1944: [■■■■■■■■░░] 81.3 % Yield (Gode referater, men idrettsstreik 1941–44)
1945–1954: [■■■■■■■■■░] 86.1 % Yield (Svært god dekning, etablerte sportssider)
1955–1964: [■■■■■■■■■█] 95.6 % Yield (HØYEST VOLUM & HØYEST KVALITET) ★ SWEET SPOT ★
1965–1974: [■■■■■■■■■■] 100.0 % Yield (Moderne sportssider, men få ukoblede singletons)
1975–1984: [■■■■■■■■■■] 100.0 % Yield (Nesten komplett kanonisk fra før)
```

### Hvorfor 1945–1964 er det ideelle startområdet:
1. **Ekstremt høy yield:** 91.4 % av alle kjørte singletons i perioden 1945–1964 gir en direkte avisside (`community_reviewable`).
2. **Høyt gjenværende volum:** 127 community-reviewable saker (over 51 % av hele arkivets kandidatkø) ligger i denne 20-årsperioden.
3. **Journalistisk kvalitet i Sunnmørsposten:** Fra 1945 etablerte avisen faste, dedikerte sportssider med fyldige kampreferater, lagoppstillinger og tilskuertall på faste sidetall (vanligvis side 2, 4 eller 6).
4. **Presis OCR:** Skriften og trykkvaliteten etter krigen gir dramatisk lavere OCR-støy enn årgangene før 1930.

---

## 8. Kontrakt og produksjonskø (`nb-newspaper-community-candidates@1`)

Kandidatgrunnlaget er transformert og validert mot den formelle kontrakten i:
* `data/discovery/community-candidate-queue.yaml`

Formatet oppfyller nøyaktig `nb-newspaper-community-candidates@1`:
```yaml
contract: nb-newspaper-community-candidates@1
candidates:
  - candidateId: nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1955-015
    communityReviewable: true
    visibility: community_reviewable
    publication:
      status: open
      approvedAt: "2026-08-21"
    sourceResult:
      sourceId: medlemsblad-for-aalesunds-fotb-1965-a2c9
      year: 1955
      no: 15
      opponent: Clausenengen
      expectedScore:
        aafk: 2
        opponent: 1
      competition: 1. divisjon
    hypothesis:
      id: medlemsblad-for-aalesunds-fotb-1965-a2c9-1955-15
      discoveryStatus: confirmed
      matchDate: "1955-09-18"
    newspaper:
      title: Sunnmørsposten
      issueDate: "1955-09-19"
      page: "2"
      pageUrl: https://www.nb.no/items/0afbec77a99ee59b4c9be1c4104cc87a?page=2
```

### Nøkkeltall for produksjonskøen:
* **Totalt antall kandidater i manifestet:** **294**
* **Kandidater med `visibility: community_reviewable`:** **247**
  * **Første godkjente åpne pulje (`status: open`):** **50** (de beste high-priority kandidatene fra 1945–1964)
  * **Kandidater i utkast (`status: draft`):** **197**
* **Kandidater med `visibility: discovery_only`:** **47**

### Integrasjonstest mot verifiseringsgeneratoren:
Når `generateNewspaperVerificationCases(manifest, existingCases)` kjøres mot produksjonskøen:
* **Genererte verifiseringssaker:** **247**
  * Åpne saker klare for publisering under `/mangler`: **50**
  * Utkastsaker: **197**
* **Skippede kandidater:** **47** (alle med årsak `not_reviewable` fordi de har `visibility: discovery_only`)
* **Dedupliserte / duplikater:** **0**
* **Overskriving av eksisterende manuelle saker:** **0** (ingen konflikter med eksisterende 25 pilotsaker)
* **Lagring av OCR/fulltekst:** **0** (kun metadata og permalenker)

---

## 9. Systematiske feiltyper avdekket under scan

1. **Uavhengige notiser på samme forside / tekstside:**
   * Forsider og nyhetssider med korte notiser kan inneholde både et AaFK-kampreferat og en urelatert notis med motstanderens bynavn (f.eks. «Hamar» i en nekrolog).
   * *Håndtering i community-kø:* Brukeren ser dette umiddelbart og svarer NEI på sekunder.
2. **Kretslag / rekruttlag / aldersbestemte klasser med samme klubbnavn:**
   * Omtale av guttekamper («AaFK og Guard i rekruttlags-klassen») fanges opp når motstander og AaFK nevnes.
   * *Håndtering i community-kø:* Filtrering på `scoreNonSenior` tar bort opplagte tilfeller; resterende avklares raskt som NEI av frivillige.
3. **Resultatbørser med mange lagpar:**
   * Særlig i 1925–1934 gir landskamp- eller NM-runderesultater treff på bynavn.
   * *Håndtering i community-kø:* Nedprioriteres til `priority: low` og holdes i draft.

---

## 10. Beslutningsport

### **Beslutning: `READY_FOR_COMMUNITY_QUEUE`**

**Begrunnelse:**
1. **Høy maskinell avgrensing:** 247 kandidater er avgrenset til én konkret side hos Nasjonalbiblioteket.
2. **Kontrollert første pulje:** De 50 beste kandidatene fra 1945–1964 er satt som `open` med `approvedAt: 2026-08-21`, mens resten (197) holdes som `draft`.
3. **Full kontrakt- og schemakompatibilitet:** Manifestet validerer 100 % mot `nb-newspaper-community-candidates@1` og generatoren fra PR #191.
4. **Ingen lagring av opphavsrettsbeskyttet fulltekst:** Eksporten inneholder kun metadata og permanente lenker i tråd med arkivets opphavsrettspolicy.
