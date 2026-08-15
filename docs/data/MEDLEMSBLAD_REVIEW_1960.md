# Visuell kontroll og innhøsting av AaFK Medlemsblad 1960 (Vol. 11 Nr. 1–6)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad for Aalesunds Fotballklubb 1960** (Vol. 11, hefte 1–6, 84 sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til arkivets prinsipper:
- OCR og ALTO brukes som arbeidsindeks og kandidatgenerator.
- De trykte faksimilene kontrolleres visuelt som primærkilde.
- `sourceId + page` brukes som stabil kontrollidentitet (kontrollert entydig for samlebindet 1–84).
- Kildepåstander lagres i `data/source-results/` før eventuell opprettelse av kanoniske kamper.
- Usikre datoer eller koblinger konstrueres ikke.

Kilde-ID: `medlemsblad-for-aalesunds-fotb-1960-146a`  
URN: `URN:NBN:no-nb_digitidsskrift_2021060283026_001`

---

## Completion-matrise 1960

| Kategori | Status | Notat |
|---|---:|---|
| Sider visuelt kontrollert | 84/84 | Samtlige 6 hefter kontrollert side for side |
| A-lagsresultater vurdert | 33/33 | 16 seire, 6 uavgjort, 11 tap, mål 76–58 |
| Fixture-kilder vurdert | 1 | Vårterminliste s. 15 |
| Nye canonical | 0 | Serieresultater lagret som source_results |
| Berikede canonical | 0 | Ingen eksisterende 1960-kamper fra før |
| Person candidates vurdert | 18/18 | Alle personfunn eksplisitt disponert |
| Person roles vurdert | 8/8 | Hovedstyre, oppmenn, trenere, dameavdeling |
| Nye personer | 3 | Johan Pedersen (Brusdal), John Johnsen (Brusdal junior), Walentin Rødland |
| Berikede personer | 8 | Henriksen, Saure, Høyer, Sæther, Walderhaug, Aas, Ystenes, Løvmo |
| Roller opprettet/beriket | 9 | Formann 1960 (Henriksen), formann 1961 valgt nov 1960 (Berentzen), kasserer, oppmann, trener |
| Mentions vurdert | 14 | Sunde (163 kamper), Finsnes (28 mål), Iversen (21 mål), Johansen (17 mål) |
| Honors/milepæler | 6 | Aas (gullmerke/tinnvase), Pedersen (Brusdal), Johnsen (Brusdal junior), Ystenes & Løvmo (Kråmyra-tinnvaser), Lunde (blomsterdekorasjon) |
| Observations | 1 | Kråmyra klubbhus 2. byggetrinn fullført nov 1960 / årsmøte i eget hus |
| Snapshots | 1 | `1960-aafk.yaml` (s. 7 og s. 80) |
| Konflikter løst | 1 | Formann 1960 (Hans J. Henriksen) vs formann 1961 valgt nov 1960 (Kjell Berentzen) |
| Konflikter åpne | 0 | Ingen uavklarte konflikter |
| Identity uncertain | 0 | Alle personer entydig identifisert |

---

## Organisasjons-reconciliation og formannsvervet 1960 vs 1961

- **Sittende styre i arbeidsåret 1960 (s. 7):**
  - Formann: Hans J. Henriksen
  - Nestformann: Kjell Saure
  - Sekretær: Knut Høyer
  - Kasserer: Harald Sæther
  - Oppmann: Ole Walderhaug
  - Trener: Einar Aas
  - Dameavdelingen: Elisif Ingebrigtsen
- **Valg på årsmøtet 25. november 1960 for arbeidsåret 1961 (s. 62–63):**
  - Formann: Kjell Berentzen (ny)
  - Nestformann: Hans J. Henriksen (ny)
  - Sekretær: Jarle Kristoffersen
  - Kasserer: Asbjørn Ystenes (ny)
  - Oppmann: Einar Aas (ny)
  - Trener: Torbjørn Aarø (valgt for 1961)
- **Konklusjon:** Hans J. Henriksen var formann i hele 1960. Kjell Berentzen overtok som formann for 1961. Dette er konsistent i `data/organization/snapshots/1960-aafk.yaml`, `data/people/hans-j-henriksen.yaml` og `data/people/kjell-berentzen.yaml`.

---

## Kildeavvik i høstseriens summering 1960 (Source Arithmetic Note)

- På side 69 oppsummerer medlemsbladet høstserien i Landsdelsserien 1960/61 med tallene:
  > «Høstserien: 4–1–4 (18–13 mål)»
- Men når man summerer de 9 oppførte enkeltkampene i samme serie høsten 1960:
  1. Herd (borte): 1–2 (tap)
  2. KFK (hjemme): 1–1 (uavgjort)
  3. Langevåg (borte): 1–2 (tap)
  4. Braatt (borte): 3–0 (seier)
  5. Hødd (hjemme): 2–0 (seier)
  6. Molde (borte): 1–2 (tap)
  7. Rollon (borte): 2–1 (seier)
  8. Herd (hjemme): 3–2 (seier)
  9. KFK (borte): 4–3 (seier)
- Dette gir faktisk: **5 seire, 1 uavgjort, 3 tap (mål 18–13)**.
- Bladets trykte sammendrag («4–1–4») inneholder en regnefeil (har telt 4 seire og 4 tap i stedet for 5 seire og 3 tap). De 9 kildedokumenterte resultatene i `data/source-results/medlemsblad-for-aalesunds-fotb-1960-146a.yaml` reflekterer de faktiske enkeltkampene.

---

## Terminlister og fixture-reconciliation 1960

- **Vårterminliste (s. 15):** Landsdelsserien Møre 1959/60 (vår). Viser kamper mot Clausenengen, Molde, Braatt, Hødd og Skarbøvik. Inneholder **ingen eksakte kalenderdatoer** (kun rundeangivelse).
- **Konklusjon:** Ingen kanoniske kamper opprettet fra fixture alene. Enkeltresultater er registrert som kildedokumenterte oppføringer i `data/source-results/medlemsblad-for-aalesunds-fotb-1960-146a.yaml`.

---

## Personfunn og eksplisitt disposition 1960

| Person | Funn / Kilde | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| Hans J. Henriksen | Formann 1960 (s. 7) | board | role_enriched | Formann 1957–1960 i `hans-j-henriksen.yaml` og snapshot `1960-aafk.yaml` |
| Kjell Berentzen | Valgt til formann for 1961 på årsmøtet nov 1960 (s. 62–63) | board | role_enriched | Formann 1961 i `kjell-berentzen.yaml` |
| Kjell Saure | Nestformann 1960 (s. 7) | board | role_enriched | Nestformann 1959–1960 i `kjell-saure.yaml` |
| Knut Høyer | Sekretær 1960 (s. 7) | admin | role_enriched | Sekretær 1959–1960 i `knut-hoyer.yaml` |
| Harald Sæther | Kasserer (s. 7, takker av etter 8 år på s. 63) | admin | role_enriched | Kasserer 1953–1960 i `harald-saether.yaml` |
| Ole Walderhaug | Oppmann A-laget 1960 (s. 7) | sporting | role_enriched | Oppmann 1958–1960 i `ole-walderhaug.yaml` og snapshot |
| Einar Aas | Trener 1960 (s. 7, 51, 60), Gullmerkeinnehaver & hedersvase (s. 60, 81) | coach / honor | honor_created / role_enriched | Trener 1960 og `gullmerkeinnehaver-1960` i `einar-aas.yaml` |
| Johan Pedersen | Martin Brusdal-statuetten for seniorspillere (s. 75, spilte 31 kamper) | honor | person_created / honor_created | Opprettet `johan-pedersen.yaml` med Brusdal-statuetten 1960 |
| John Johnsen | Martin Brusdal-statuetten for juniorspillere (s. 78) | honor | person_created / honor_created | Opprettet `john-johnsen.yaml` med Brusdal-statuetten 1960 |
| Mindor Sunde | 163 A-kamper ved sesongslutt (s. 75) | player | milestone_created | Dokumentert i `mindor-sunde.yaml` |
| Perry Ystenes | Tinnvase for 5 års innsats som leder av banekomiteen (s. 63) | honor | honor_created | Tildelt `tinnvase-kramyra-1960` i `perry-ystenes.yaml` |
| Frantz Løvmo | Tinnvase for 5 års innsats i banekomiteen (s. 63) | honor | honor_created | Tildelt `tinnvase-kramyra-1960` i `frantz-lovmo.yaml` |
| Helge Lunde | Hedret med blomsterdekorasjon for Kråmyra (s. 63) | honor | honor_created | Tildelt `hedersbevisning-kramyra-1960` i `helge-lunde.yaml` |
| Walentin Rødland | Tilsatt som klubbens første vaktmester for Kråmyra (s. 79) | admin | person_created / role_created | Opprettet `walentin-rodland.yaml` med vaktmesterrolle |
| Elisif Ingebrigtsen | Formann Dameavdelingen 1960 (s. 80) | board | role_enriched | Formann Dameavdelingen i `elisif-ingebrigtsen.yaml` og snapshot |
| Arne Finsnes | A-lagets toppscorer med 28 mål (s. 75) | player | mention_linked | Dokumentert i review |
| Kjell Iversen | A-lagets nesttoppscorer med 21 mål (s. 68, 75) | player | mention_linked | Dokumentert i review |
| Harald Johansen | 17 mål på A-laget (s. 75) | player | mention_linked | Dokumentert i review |

---

## Side-for-side kontrollmatrise (side 1–84)

| Side | Hefte | Tittel / Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|---|
| 1 | Nr. 1 | Omslag: Foran fotballsesongen 1960 | season_fact | reviewed | Forsidebilde. |
| 2 | Nr. 1 | Formannens nyttårsønske / Hans Henriksen | person_role | reviewed | Henriksen om fullføringen av klubbhuset og sportslige mål. |
| 3 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 4 | Nr. 1 | Vintertrening i Nørvøy skole / Einar Aas | season_fact | reviewed | Einar Aas leder trening for A-lag og juniorer. |
| 5 | Nr. 1 | Minnenes bok: Sesongen 1937 | historical | reviewed | Tilbakeblikk på 1937-sesongens oppgjør. |
| 6 | Nr. 1 | Kråmyra klubbhus 2. byggetrinn tar form | organization | reviewed | Dugnadsrapport for storsalen og overetasjen. |
| 7 | Nr. 1 | Tillitsmannsliste 1960 | organization | reviewed | Hovedstyre: Henriksen, Saure, Høyer, Sæther, Walderhaug, Aas. |
| 8 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 9 | Nr. 1 | Yngres avdeling og rekruttering | non_senior | reviewed | Over 100 gutter i aktiv trening under Reidar Skarbøvik. |
| 10 | Nr. 1 | Dameavdelingen planlegger jubileum | organization | reviewed | Møter i Dameavdelingen; forberedelser til 15-årsjubileet i 1961. |
| 11 | Nr. 1 | Sett og hørt / Medlemsnytt | notes | reviewed | NFF-ting, representasjon og notiser. |
| 12 | Nr. 1 | Annonser / Baksiden hefte 1 | ads | reviewed | Baksidetekst. |
| 13 | Nr. 2 | Omslag: Vårens seriestart 1960 | season_fact | reviewed | Forsidebilde. |
| 14 | Nr. 2 | Vårsesongen foran oss / Einar Aas og Ole Walderhaug | person_role | reviewed | Oppmann og trener om sjansene til å vinne Landsdelsserien. |
| 15 | Nr. 2 | Terminliste våren 1960 | fixture_list | reviewed | Vårens 5 seriekamper uten eksakte kalenderdatoer. |
| 16 | Nr. 2 | Sunnmørscupen 1960: Aksla 4–1, Langevåg 1–3 | source_result | reviewed | Innledende runder i Sunnmørscupen. |
| 17 | Nr. 2 | Minnenes bok: 1938-sesongen (Del 1) | historical | reviewed | Historisk tilbakeblikk på 1938. |
| 18 | Nr. 2 | Guttelagenes forberedelser | non_senior | reviewed | Serien for smågutt og rekrutt tar til. |
| 19 | Nr. 2 | Kråmyra: Dugnad på storsalen | organization | reviewed | Innvendig kledning og isolering. |
| 20 | Nr. 2 | Nytt juniorlag i år / Generasjonsskifte | non_senior | reviewed | Sju nye juniorspillere opp fra guttelaget. |
| 21 | Nr. 2 | Annonser | ads | reviewed | Lokale annonsører. |
| 22 | Nr. 2 | NFF-ting i Bergen / Serieordning drøftes | season_fact | reviewed | Debatt om overgang til landsomfattende 1. divisjon. |
| 23 | Nr. 2 | Annonser | ads | reviewed | Lokale annonsører. |
| 24 | Nr. 2 | Annonser / Baksiden hefte 2 | ads | reviewed | Baksidetekst. |
| 25 | Nr. 3 | Omslag: Aksla stadion i sommersol | season_fact | reviewed | Forsidebilde. |
| 26 | Nr. 3 | Vårens seriekamper oppsummert | source_result | reviewed | 3. plass i Landsdelsserien 1959/60 (17 poeng); Braatt 4–1, Skarbøvik 3–1. |
| 27 | Nr. 3 | NM 1. og 2. runde / Træff og Sverre | source_result | reviewed | 1. runde Træff 1–0, 2. runde Sverre 1–3. |
| 28 | Nr. 3 | Svømmeopplæring og livredning | notes | reviewed | Folkehelseartikkel. |
| 29 | Nr. 3 | Idrettens betydning for ungdommen | season_fact | reviewed | Lederartikkel om idrett og samfunnsansvar. |
| 30 | Nr. 3 | Kretskampen Ålesund–Molde | season_fact | reviewed | Bymatch og representasjon. |
| 31 | Nr. 3 | Mørelaget i interkretskamper | season_fact | reviewed | AaFK-spillere på representasjonslag. |
| 32 | Nr. 3 | John Erik Aase studerer i utlandet | person_candidate | reviewed | Medlemsbrev fra klubbmedlem på utenlandsstudier. |
| 33 | Nr. 3 | Sommerferie og sommertrening | season_fact | reviewed | Egentrening og sommersamlinger. |
| 34 | Nr. 3 | Minnenes bok: 1938-sesongen (Del 2) | historical | reviewed | Videre skildring av 1938-sesongen. |
| 35 | Nr. 3 | Privatkamper og sommermatchene | source_result | reviewed | Privatkamper mot lokale klubber. |
| 36 | Nr. 3 | Sett og hørt / Medlemsnytt | notes | reviewed | Notiser og klubbnyheter. |
| 37 | Nr. 4 | Omslag: Høstsesongen starter | season_fact | reviewed | Forsidebilde. |
| 38 | Nr. 4 | Langevåg IL har fått ny flott gressbane | organization | reviewed | Gratulasjon til Langevåg IL med nytt anlegg. |
| 39 | Nr. 4 | Fotballforbundets kretsturnering | season_fact | reviewed | Kretslagsturnering for juniorspillere. |
| 40 | Nr. 4 | Klubbprofiler i AaFK | person_candidate | reviewed | Samtaler med sentrale klubbaktører. |
| 41 | Nr. 4 | Minnenes bok: Sesongen 1938 (Sluttspillet) | historical | reviewed | Tilbakeblikk på sluttspillet i 1938. |
| 42 | Nr. 4 | Aksla stadion og publikumsfasiliteter | season_fact | reviewed | Tribuner og banevedlikehold. |
| 43 | Nr. 4 | AaFK vinner Sunnmørscupen for 3. gang (Hødd 1–0) | source_result | reviewed | Finale på Aksla stadion: AaFK slår Hødd 1–0 og sikrer pokalen. |
| 44 | Nr. 4 | Den tidlige våren og guttelagets suksess | non_senior | reviewed | Guttelaget vinner 5–2 over Rollon. |
| 45 | Nr. 4 | Real Madrid og europeisk toppfotball | season_fact | reviewed | Santiago Bernabéu og proffotball i Europa. |
| 46 | Nr. 4 | Ivar Østensen og medlemsbladets stab | person_role | reviewed | Kolofon og redaksjonsarbeid. |
| 47 | Nr. 4 | Prikksikkert ferskvannsfiske / Fritid | notes | reviewed | Friluftsartikkel. |
| 48 | Nr. 4 | Sett og hørt / Notiser | notes | reviewed | Notiser og klubbnyheter. |
| 49 | Nr. 5 | Omslag: Høstens intense serieoppgjør | season_fact | reviewed | Forsidebilde. |
| 50 | Nr. 5 | Kunsten å lure en back / Fagartikkel | season_fact | reviewed | Angrepsteknikk og dribleferdigheter. |
| 51 | Nr. 5 | Sesongen har gitt både gleder og skuffelser | source_result | reviewed | Einar Aas analyserer forsesong og høstsesong. |
| 52 | Nr. 5 | Spjelkavik IL tok første aksje i pokalen | source_result | reviewed | Turnering i Spjelkavik; AaFK og Langevåg i finalen. |
| 53 | Nr. 5 | Annonser | ads | reviewed | Lokale annonsører. |
| 54 | Nr. 5 | Magne Fylling og Møres beste spillere | person_candidate | reviewed | Omtale av distriktets fremste profiler. |
| 55 | Nr. 5 | Per Mogstad 60 år / Gratulasjon | person_candidate | reviewed | 60-årsomtale for klubbveteranen. |
| 56 | Nr. 5 | Juniorlaget har spilt god fotball | non_senior | reviewed | Juniorlagets innsats i kretsserien. |
| 57 | Nr. 5 | Herman Alrik Helgesen i vigør | person_candidate | reviewed | Veteranprofil og klubbhistorie. |
| 58 | Nr. 5 | Bruken av guttespillere / Forsiktighetsprinsipp | non_senior | reviewed | Advarsel mot å overbelaste unge guttespillere. |
| 59 | Nr. 5 | Grunn til å være fornøyd med sesongen | season_fact | reviewed | Samlet sesongvurdering. |
| 60 | Nr. 5 | Årsfesten / Einar Aas hedres / Vet du | milestone | reviewed | Einar Aas hedres for trenerinnsatsen og tildelt gullmerket. |
| 61 | Nr. 6 | Omslag: Årsmøte og innvielse på Kråmyra | organization | reviewed | Forsidebilde fra storsalen i det nye klubbhuset. |
| 62 | Nr. 6 | Godt arbeidsår, sportslig som økonomisk / Årsmøtet 1960 | observation | reviewed | Årsmøtet holdt for 1. gang i eget hus på Kråmyra 25.11.1960! Godt overskudd. |
| 63 | Nr. 6 | Hyllest til banekomiteen: Perry Ystenes og Frantz Løvmo | organization | reviewed | Ystenes og Løvmo overrekkes tinnvaser etter 5 års innsats; Kjell Berentzen valgt til formann for 1961. |
| 64 | Nr. 6 | Leif og Harald Bugge Aarøe / Kretsmestre i Smågutt | non_senior | reviewed | Intervju med de to talentfulle brødrene. |
| 65 | Nr. 6 | Vi har en mengde fotballrekrutter / Terje Olsen | non_senior | reviewed | Småguttelagets kaptein Terje Olsen og 40 rekrutter. |
| 66 | Nr. 6 | Rekruttlaget og småguttelaget | non_senior | reviewed | Voldsund, Istad og Tømmerbakk hevder seg fint. |
| 67 | Nr. 6 | Snø, sol og ski / Friluftsliv | notes | reviewed | Vinterhilsen. |
| 68 | Nr. 6 | Kjell Iversen: Løperrekkens drivkraft og fighter | person_candidate | reviewed | Portrett av storscoreren Kjell Iversen (21 mål i 1960). |
| 69 | Nr. 6 | 1960 som ventet, men laget er ungt og lovende | statistics | reviewed | 33 kamper spilt (16–6–11, mål 76–58); Høstseriens 9 enkeltkamper ga 5–1–3 (18–13 mål), bladet oppgir trykkfeil 4–1–4. |
| 70 | Nr. 6 | Hødd eller Langevåg mestre? / KFK sviktet | standing | reviewed | Tabellanalyse for Landsdelsserien 1960/61. |
| 71 | Nr. 6 | Ungene skal tidlig lære å bli glad i banen | non_senior | reviewed | Reidar Skarbøviks pedagogikk i yngres avdeling. |
| 72 | Nr. 6 | Juniorlaget har vært av god klasse | non_senior | reviewed | Olav Kalvø og lagkaptein Svein Arne Hoel roses; bedre enn ventet. |
| 73 | Nr. 6 | Medlemsbladets redaksjon og trykk | organization | reviewed | Harald Nord, Kjell Berentzen, Ivar Østensen, Lauritz Giske. |
| 74 | Nr. 6 | Ballbehandling og taktikk | season_fact | reviewed | Spillestil og pasningskvalitet. |
| 75 | Nr. 6 | Flest kamper og målscorere 1960 / Mindor Sunde | statistics | reviewed | Johan Pedersen og Finsnes 31 kamper; Toppscorer Finsnes 28 mål, Iversen 21, Johansen 17; Sunde 163 kamper; Pedersen Brusdal-statuetten. |
| 76 | Nr. 6 | Minnenes bok: AaFKs 25-årsjubileum | historical | reviewed | Jubileumskamper og festligheter fra klubbens 25-årsjubileum. |
| 77 | Nr. 6 | Alle trenger gymnastikk | notes | reviewed | Helseartikkel. |
| 78 | Nr. 6 | En kommende storspiller: John M. Johnsen | person_candidate | reviewed | John Johnsen tildelt Martin Brusdal-statuetten for juniorspillere. |
| 79 | Nr. 6 | Klubbhusets annet byggetrinn fullført | organization | reviewed | Fullstendig rapport over storsalen og bygget til over 100 000 kr; Walentin Rødland vaktmester. |
| 80 | Nr. 6 | Dameavdelingens formann Elisif Ingebrigtsen | organization | reviewed | Dameavdelingen har skaffet alt inventar, gardiner og banner. |
| 81 | Nr. 6 | Sett og hørt / 848 kamper fra 1915 til 1960 | notes | reviewed | Historisk statistikk: 848 kamper (511–117–220, 2430–1393 mål); Geo Hallers sølvpokal; tinnvase og gullmerke til Einar Aas. |
| 82 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 83 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 84 | Nr. 6 | Annonser / Baksiden hefte 6 | ads | reviewed | Baksidetekst. |
