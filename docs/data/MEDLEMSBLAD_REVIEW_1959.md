# Visuell kontroll og innhøsting av AaFK Medlemsblad 1959 (Vol. 10 Nr. 1–6)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad for Aalesunds Fotballklubb 1959** (Vol. 10, hefte 1–6, 84 sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til arkivets prinsipper:
- OCR og ALTO brukes som arbeidsindeks og kandidatgenerator.
- De trykte faksimilene kontrolleres visuelt som primærkilde.
- `sourceId + page` brukes som stabil kontrollidentitet (kontrollert entydig for samlebindet 1–84).
- Kildepåstander lagres i `data/source-results/` før eventuell opprettelse av kanoniske kamper.
- Usikre datoer eller koblinger konstrueres ikke.

Kilde-ID: `medlemsblad-for-aalesunds-fotb-1959-515a`  
URN: `URN:NBN:no-nb_digitidsskrift_2021060283025_001`

---

## Completion-matrise 1959

| Kategori | Status | Notat |
|---|---:|---|
| Sider visuelt kontrollert | 84/84 | Samtlige 6 hefter kontrollert side for side |
| A-lagsresultater vurdert | 29/29 | 18 seire, 5 uavgjort, 6 tap, mål 64–31 (side 60) |
| Fixture-kilder vurdert | 2 | Vårterminliste s. 17, høstterminliste s. 39 |
| Nye canonical | 1 | AaFK – 1. FC Tatran Prešov (1–4, 16.07.1959) |
| Berikede canonical | 0 | Ingen eksisterende 1959-kamper fra før |
| Person candidates vurdert | 16/16 | Alle personfunn eksplisitt disponert |
| Person roles vurdert | 8/8 | Hovedstyre, oppmenn, trenere, dameavdeling |
| Nye personer | 2 | Kjell Saure (nestformann), Knut Høyer (sekretær) |
| Berikede personer | 8 | Henriksen, Sæther, Walderhaug, Larsen, Olsen, Skarbøvik, Vadseth, Holand |
| Roller opprettet/beriket | 9 | Formann, nestformann, sekretær, kasserer, oppmann, trener |
| Mentions vurdert | 12 | Aarø, Vadseth, Skarbøvik, Holand, Listhaug, Sætre, Furseth, Thorseth, Sperre |
| Honors/milepæler | 5 | Aarø (gullmerke 200+ kamper), Vadseth (sølvmerke 150 kamper & Brusdal), Skarbøvik (klubbens gullmerke), Holand (Brusdal junior) |
| Observations | 0 | Dugnadsarbeid på Kråmyra ført i årsberetning |
| Snapshots | 1 | `1959-aafk.yaml` (s. 7, 10 og 1958 s. 64) |
| Konflikter løst | 0 | Ingen motstridende kilder |
| Konflikter åpne | 0 | Ingen uavklarte konflikter |
| Identity uncertain | 0 | Alle personer entydig identifisert |

---

## Terminlister og fixture-reconciliation 1959

- **Vårterminliste (s. 17):** Landsdelsserien Møre 1958/59 (vår). Viser kamper mot Langevåg, Dahle, Clausenengen, Molde og Volda. Inneholder **ingen eksakte kalenderdatoer** (kun rundeangivelse).
- **Høstterminliste (s. 39):** Landsdelsserien Møre 1959/60 (høst). Viser de 9 høstkampene mot KFK, Langevåg, Clausenengen, Molde, Braatt, Hødd, Skarbøvik, KFK og Langevåg. Inneholder **ingen eksakte kalenderdatoer**.
- **Konklusjon:** Ingen kanoniske kamper opprettet fra fixture alene. Samtlige 29 A-lagskamper er komplett dokumentert med resultater på side 60 og lagret i `data/source-results/medlemsblad-for-aalesunds-fotb-1959-515a.yaml`. Den internasjonale kampen mot Tatran Prešov (16.07.1959) er opprettet som kanonisk kamp med full oppstilling og pausefakta fra side 26 og sesongresultat fra side 60.

---

## Personfunn og eksplisitt disposition 1959

| Person | Funn / Kilde | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| Hans J. Henriksen | Formann 1959 (s. 7) | board | role_enriched | Formann i `hans-j-henriksen.yaml` og snapshot `1959-aafk.yaml` |
| Kjell Saure | Nestformann 1959 (1958 s. 64, 1959 s. 7) | board | person_created / role_created | Opprettet `kjell-saure.yaml` med nestformannrolle 1959–1960 |
| Knut Høyer | Sekretær 1959 (1958 s. 64, 1959 s. 7) | admin | person_created / role_created | Opprettet `knut-hoyer.yaml` med sekretærrolle 1959–1960 |
| Harald Sæther | Kasserer (s. 7) | admin | role_enriched | Kasserer 1953–1960 i `harald-saether.yaml` |
| Ole Walderhaug | Oppmann A-laget 1959 (s. 7) | sporting | role_enriched | Oppmann i `ole-walderhaug.yaml` og snapshot `1959-aafk.yaml` |
| Jan Larsen | Trener og kaptein 1959 (s. 16, 60, 67), avskjed etter 145 A-kamper | coach / player | role_enriched / milestone_created | Trener og spiller i `jan-larsen.yaml` |
| Trygve Olsen | Junioroppmann 1959 (s. 13, 76) | sporting | role_enriched | Junioroppmann i `trygve-olsen.yaml` og snapshot |
| Reidar Skarbøvik | Leder Guttelaget (s. 7), Klubbens gullmerke (s. 64, 74) | sporting / honor | honor_enriched / role_enriched | Tildelt `gullmerkeinnehaver-1959` i `reidar-skarbovik.yaml` |
| Elisif Ingebrigtsen | Formann Dameavdelingen (s. 10) | board | role_enriched | Formann Dameavdelingen i `elisif-ingebrigtsen.yaml` og snapshot |
| Thorbjørn Aarø | Spillemerket i gull for 200+ kamper (s. 64) | honor | honor_created | Tildelt `spillemerke-gull-1959` i `torbjorn-aaro.yaml` |
| Karsten Vadseth | Spillemerket i sølv 150 kamper (s. 64), Brusdal-statuetten (s. 70) | honor | honor_created | Tildelt `spillemerke-solv-150-kamper` og Brusdal-statuetten i `karsten-vadseth.yaml` |
| Svein Bjarne Holand | Brusdal-statuetten for juniorspillere (s. 70) | honor | honor_created | Tildelt `brusdal-statuetten-junior-1959` i `svein-bjarne-holand.yaml` |
| Helge Lunde | Materialforvalter (s. 73) | sporting | role_created | Materialforvalter 1959 i `helge-lunde.yaml` |
| Erling Listhaug | Målvakt på juniorlaget, rykker opp til senior (s. 55) | player | mention_linked | Dokumentert i review |
| Per Mogstad | 60 år omtale (s. 71) | person | mention_linked | Dokumentert i review |
| Carlos Koldberg | NIF diplom tildelt (s. 82) | person | mention_linked | Dokumentert i review |

---

## Side-for-side kontrollmatrise (side 1–84)

| Side | Hefte | Tittel / Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|---|
| 1 | Nr. 1 | Omslag: Einar Aas i full strekk | season_fact | reviewed | Forsidebilde. |
| 2 | Nr. 1 | Formannens nyttårsord: Samhold og nøkternhet | person_role | reviewed | Hans Henriksen om Kråmyra-anlegget og økonomi. |
| 3 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 4 | Nr. 1 | Vintertrening og instruksjon på Nørvøy skole | season_fact | reviewed | Treningstider for alle lag innendørs. |
| 5 | Nr. 1 | Minnenes bok: 1920-årenes store oppgjør | historical | reviewed | Historiske tilbakeblikk. |
| 6 | Nr. 1 | Kråmyra dugnadsrapport og banedekke | organization | reviewed | Banekomiteens planer for våren. |
| 7 | Nr. 1 | Tillitsmenn og komiteer for 1959 | organization | reviewed | Styre og utvalg valgt nov 1958: Henriksen, Saure, Høyer, Sæther, Walderhaug. |
| 8 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 9 | Nr. 1 | Guttelagene i vintertrening | non_senior | reviewed | Rekrutteringsarbeid under Skarbøvik. |
| 10 | Nr. 1 | Dameavdelingen: Elisif Ingebrigtsen ny formann | organization | reviewed | Gerd Strømsholm takker av; Elisif Ingebrigtsen overtar formannsvervet. |
| 11 | Nr. 1 | Minnenes bok: Hodespesialisten «Laffen» Skarbøvik | historical | reviewed | Portrett av AaFKs store hodespiller i 1930-årene. |
| 12 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 13 | Nr. 1 | Juniorlagets forberedelser / Trygve Olsen | non_senior | reviewed | Trygve Olsen om å forsvare kretsmesterskapet. |
| 14 | Nr. 1 | Sett og hørt / Medlemsnytt | notes | reviewed | Notiser og personia. |
| 15 | Nr. 2 | Omslag: Foran seriestart våren 1959 | season_fact | reviewed | Forsidebilde. |
| 16 | Nr. 2 | Vårsesongen foran oss / Trener Jan Larsen | person_role | reviewed | Jan Larsen om taktisk disiplin og hurtighet. |
| 17 | Nr. 2 | Terminliste våren 1959 | fixture_list | reviewed | Vårens 5 seriekamper uten eksakte kalenderdatoer. |
| 18 | Nr. 2 | Privatkamper og Vårcupen | source_result | reviewed | Langevåg 2–0, Spjelkavik 2–0, Guard 6–2, Skarbøvik 3–1. |
| 19 | Nr. 2 | Minnenes bok: Kampene mot Kristiansund-lagene | historical | reviewed | Historiske oppgjør mot KFK og Braatt. |
| 20 | Nr. 2 | Guttelagenes kamper og serier | non_senior | reviewed | Terminlister for gutter og smågutter. |
| 21 | Nr. 2 | Utbyggingen på Kråmyra | organization | reviewed | Dugnadsarbeid på klubbhusets 2. trinn. |
| 22 | Nr. 2 | Annonser | ads | reviewed | Lokale annonsører. |
| 23 | Nr. 2 | Trenerkurs og instruksjon i kretsen | person_role | reviewed | NFF-kurs og lokal instruksjon. |
| 24 | Nr. 2 | Sett og hørt / Medlemsnytt | notes | reviewed | Notiser og klubbnyheter. |
| 25 | Nr. 3 | Omslag: Tatran Prešov gjester Ålesund | new_canonical_match | reviewed | Presentasjon av det tsjekkoslovakiske topplaget Tatran Prešov. |
| 26 | Nr. 3 | Internasjonal kamp: AaFK–Tatran Prešov 1–4 | new_canonical_match | reviewed | Kampreferat fra Aksla stadion 16.07.1959: AaFK–Tatran Prešov 1–4 (pause 1–2), ca 2 000 tilsk. Oppstilling: Aas, Vadseth, Aarø, Johansen, Pedersen, Rutgerson, Luthentun, Iversen, Finsnes, Holand, Sperre. |
| 27 | Nr. 3 | Vårens seriekamper oppsummert | source_result | reviewed | Dahle 1–0, Volda 5–2, Clausenengen 2–2, Molde 1–1, Langevåg 0–4. |
| 28 | Nr. 3 | Sommercupen: AaFK til topps | source_result | reviewed | Spjelkavik 6–1, Skarbøvik 3–1, finale Herd 1–0 (AaFK cupmester). |
| 29 | Nr. 3 | NM 1. og 2. runde / Kvik-kampen i Trondheim | source_result | reviewed | 1. runde Skarbøvik 2–1 e.e.o., 2. runde Kvik 1–2 e.e.o. |
| 30 | Nr. 3 | Tabelloversikt og evaluering | source_result | reviewed | Landsdelsserien 1958/59 sluttabell. |
| 31 | Nr. 3 | Juniorlagets suksess i NM junior | non_senior | reviewed | Juniorlaget videre etter seier over Hødd; møter Brann i 3. runde. |
| 32 | Nr. 3 | Guttelaget og ferdighetsmerket | non_senior | reviewed | Merkeprøver og teknisk instruksjon. |
| 33 | Nr. 3 | Annonser | ads | reviewed | Lokale annonsører. |
| 34 | Nr. 3 | Minnenes bok: 1940-sesongen | historical | reviewed | Krigssesongen 1940 og Skeid-kampen. |
| 35 | Nr. 3 | Aksla stadion tilskuerforhold | season_fact | reviewed | Økonomiske betraktninger. |
| 36 | Nr. 3 | Sett og hørt / Medlemsnytt | notes | reviewed | Notiser og personia. |
| 37 | Nr. 4 | Omslag: Høstsesongen starter | season_fact | reviewed | Forsidebilde. |
| 38 | Nr. 4 | Fantastisk høststart i Landsdelsserien | source_result | reviewed | KFK 2–1 borte, Langevåg 1–0, Clausenengen 2–0, Braatt 3–0, Hødd 4–1 borte. |
| 39 | Nr. 4 | Høstterminlisten Landsdelsserien 1959/60 | fixture_list | reviewed | Terminliste for høstens 9 seriekamper uten eksakte kalenderdatoer. |
| 40 | Nr. 4 | NM junior 3. runde: Brann–AaFK 2–2 (straffespark) | non_senior | reviewed | Dramatisk cupoppgjør mot den senere norgesmesteren Brann. |
| 41 | Nr. 4 | Juniorlaget sikrer kretsmesterskapet | non_senior | reviewed | Kretsmester 1959 etter uavbrutt seiersrekke. |
| 42 | Nr. 4 | Dugnad på Kråmyra: 2. etasje reiser seg | organization | reviewed | Klubbhusets storsal tar form. |
| 43 | Nr. 4 | Dameavdelingens høstaktiviteter | organization | reviewed | Møter og utlodninger til inntekt for huset. |
| 44 | Nr. 4 | Spillerprofil: Karsten «Kakken» Vadseth | person_candidate | reviewed | Mønsterbacken Vadseth roses for sin stabilitet og fightervilje. |
| 45 | Nr. 4 | Svein Holand: Stortalent på juniorlaget | person_candidate | reviewed | Holand imponerer som lagkaptein og allroundspiller. |
| 46 | Nr. 4 | Annonser | ads | reviewed | Lokale annonsører. |
| 47 | Nr. 4 | Annonser | ads | reviewed | Lokale annonsører. |
| 48 | Nr. 4 | Sett og hørt / Notiser | notes | reviewed | Notiser og klubbnyheter. |
| 49 | Nr. 5 | Omslag: AaFK topper Landsdelsserien høsten 1959 | season_fact | reviewed | Forsidebilde av jublende AaFK-spillere. |
| 50 | Nr. 5 | Høstsesongen oppsummert / AaFK på tabelltopp | source_result | reviewed | 6 seire, 2 uavgjort, 1 tap; 14 poeng gir tabelltopp foran våren 1960. |
| 51 | Nr. 5 | Langevåg–AaFK 1–4 på Langevåg | source_result | reviewed | Sesongavslutning borte: AaFK utklasser Langevåg 4–1. |
| 52 | Nr. 5 | Banekomiteens årsberetning for 1959 | organization | reviewed | Framdrift på klubbhuset på Kråmyra. |
| 53 | Nr. 5 | Guttelaget avdelingsvinner i sin pulje | non_senior | reviewed | Guttelaget (Nedregård, Standal, With, Kleive, Johnsen, Skarbøvik). |
| 54 | Nr. 5 | Kronerulling til nye guttedrakter | non_senior | reviewed | Geo Haller gir 100 kr; giverliste hos Peder Puck og Frøysa. |
| 55 | Nr. 5 | Erling Listhaug: Juniorlagets sikre keeper | person_candidate | reviewed | Listhaug runder av juniortiden med to kretsmesterskap. |
| 56 | Nr. 5 | Reservelagets innsats i 1959 | non_senior | reviewed | Reservelaget gir god matching for unge talenter. |
| 57 | Nr. 5 | Ferdighetsmerket: Sandnes og Rogaland topper | non_senior | reviewed | Nasjonal statistikk for ferdighetsmerkene. |
| 58 | Nr. 5 | Stor dugnadsinnsats av klubbens aktive | organization | reviewed | Dugnad på klubbhuset i høstmånedene. |
| 59 | Nr. 5 | Annonser | ads | reviewed | Lokale annonsører. |
| 60 | Nr. 5 | Fullstendig kampoversikt A-laget 1959 / Jan Larsen forlater klubben | source_result | reviewed | 29 kamper (18–5–6, mål 64–31); Jan Larsen flytter til Bergen etter 145 kamper. |
| 61 | Nr. 6 | Omslag: Sesongavslutning og julehefte 1959 | season_fact | reviewed | Forsidebilde. |
| 62 | Nr. 6 | Årsmøtet for 1959 og jubileumsfesten | organization | reviewed | Årsmøtet 27.11.1959 i Maskinistforeningen; fest i Frimurerlosjen 14.11.1959. |
| 63 | Nr. 6 | Fire reserver som har fått prøve seg på A-laget | person_candidate | reviewed | Jakob Sætre, Per Inge Furseth, Jostein Thorseth og Rolf Sperre. |
| 64 | Nr. 6 | Utmerkelser: Thorbjørn Aarø gullmerke / Vadseth sølvmerke | milestone | reviewed | Aarø gullmerke (over 200 kamper); Vadseth sølvmerke (150 kamper); Skarbøvik klubbens gullmerke. |
| 65 | Nr. 6 | Kronerullingen for guttelagene / Resultater | non_senior | reviewed | Fullført innsamling; 203 kr innkommet. |
| 66 | Nr. 6 | Klubbens festkomité og sosiale arrangementer | organization | reviewed | Sellereite, Reitebø, Hoel, Hellandsvik i aksjon på kjøkkenet. |
| 67 | Nr. 6 | Trener Jan Larsens avskjedsintervju | person_role | reviewed | Larsen oppsummerer 6 fantastiske år i AaFK; Magne Fylling hedres. |
| 68 | Nr. 6 | Minner fra turer og kamper / «Lallen» og «Grakså» | historical | reviewed | Morsomme opplevelser fra Kristiansund og Høddvoll. |
| 69 | Nr. 6 | Mørefotballen trenger impulser og tempo | season_fact | reviewed | Analyse av spillenivået på Møre. |
| 70 | Nr. 6 | Statuetter til Karsten Vadseth og Svein Holand | milestone | reviewed | Brusdal-statuettene overrakt på årsmøtet til Vadseth (senior) og Holand (junior). |
| 71 | Nr. 6 | Per Mogstad 60 år / Spillerprofil i Mjølner | person_candidate | reviewed | Mogstad herjer for Mjølner og Nord-Norges landsdelslag. |
| 72 | Nr. 6 | Svein Holand: Juniorlagets kaptein og drivkraft | person_candidate | reviewed | Portrett av det store midtbanetalentet. |
| 73 | Nr. 6 | Materialforvalterne Helge Lunde og Ragnvald Langva hedres | organization | reviewed | Lunde og Langva roses på årsmøtet for mønsterorden på utstyret. |
| 74 | Nr. 6 | Utmerkelser på årsfesten: Vadseth, Aas, Skarbøvik, Sunde | milestone | reviewed | Bilde og rapport fra utdelingen av merker og hedersbevisninger. |
| 75 | Nr. 6 | Avskjedsintervju med Jan Larsen (forts.) | person_role | reviewed | Larsen om lagets fremtid og instruksjon for de unge. |
| 76 | Nr. 6 | Juniorlagets suksess i kretsserien og cupen | non_senior | reviewed | Trygve Olsen takkes; 7 spillere blir seniorer til 1960. |
| 77 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 78 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 79 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 80 | Nr. 6 | Sett og hørt / SFK-ting og nye spillere | notes | reviewed | Olaf Hesseberg melder overgang fra Emblem; Axel W. Floor på kretstinget. |
| 81 | Nr. 6 | Guttelaget avdelingsvinner / Bildereportasje | non_senior | reviewed | Bilde av guttelaget; tre jevne finalekamper mot Langevåg. |
| 82 | Nr. 6 | Carlos Koldberg NIF diplom / Medlemskontingent | milestone | reviewed | Carlos Koldberg tildelt NIFs diplom. |
| 83 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 84 | Nr. 6 | Annonser / Baksiden hefte 6 | ads | reviewed | Baksidetekst. |
