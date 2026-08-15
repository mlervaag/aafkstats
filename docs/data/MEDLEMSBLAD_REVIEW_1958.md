# Visuell kontroll og innhøsting av AaFK Medlemsblad 1958 (Vol. 9 Nr. 1–6)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad for Aalesunds Fotballklubb 1958** (Vol. 9, hefte 1–6, 84 sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til arkivets prinsipper:
- OCR og ALTO brukes som arbeidsindeks og kandidatgenerator.
- De trykte faksimilene kontrolleres visuelt som primærkilde.
- `sourceId + page` brukes som stabil kontrollidentitet (kontrollert entydig for samlebindet 1–84).
- Kildepåstander lagres i `data/source-results/` før eventuell opprettelse av kanoniske kamper.
- Usikre datoer eller koblinger konstrueres ikke.

Kilde-ID: `medlemsblad-for-aalesunds-fotb-1958-5725`  
URN: `URN:NBN:no-nb_digitidsskrift_2021060383003_001`

---

## Completion-matrise 1958

| Kategori | Status | Notat |
|---|---:|---|
| Sider visuelt kontrollert | 84/84 | Samtlige 6 hefter kontrollert side for side |
| A-lagsresultater vurdert | 29/29 | 17 seire, 4 uavgjort, 8 tap, mål 57–43 |
| Fixture-kilder vurdert | 1 | Vårterminliste s. 17 |
| Nye canonical | 0 | Ingen eksakte datoer utenom NM/terminførte seriekamper |
| Berikede canonical | 0 | Serieresultater lagret som source_results |
| Person candidates vurdert | 14/14 | Alle personfunn eksplisitt disponert |
| Person roles vurdert | 8/8 | Hovedstyre, oppmenn, trenere, dameavdeling |
| Nye personer | 2 | Rolf Kvissel (sekretær 1958), Mindor Sunde |
| Berikede personer | 6 | Henriksen, Korsnes, Sæther, Walderhaug, Larsen, Olsen |
| Roller opprettet/beriket | 8 | Formann, sekretær, oppmann, trener, junioroppmann |
| Mentions vurdert | 10 | Aarø (193 kamper), Sunde (130 kamper), Sætre, Furseth, Sperre |
| Honors/milepæler | 3 | Aarø 193 kamper, Sunde 130 kamper, Sæther takket for 6 år som kasserer |
| Observations | 0 | Banearbeid på Kråmyra dekket i klubbens årsberetninger |
| Snapshots | 1 | `1958-aafk.yaml` (s. 7 og 1957 s. 65) |
| Konflikter løst | 0 | Ingen motstridende kilder |
| Konflikter åpne | 0 | Ingen uavklarte konflikter |
| Identity uncertain | 0 | Alle personer entydig identifisert |

---

## Terminlister og fixture-reconciliation 1958

- **Vårterminliste (s. 17):** Landsdelsserien Møre 1957/58 (vår). Viser kamper mot Hødd, Braatt, Clausenengen, Spjelkavik og KFK. Inneholder **ingen eksakte kalenderdatoer** (kun rundeangivelse).
- **Konklusjon:** Ingen kanoniske kamper opprettet fra fixture alene. Enkeltresultater med kjent dato/runde (f.eks. NM-kamper og seieren over Hødd 1–0 på Høddvoll) er ført i `data/source-results/medlemsblad-for-aalesunds-fotb-1958-5725.yaml`.

---

## Personfunn og eksplisitt disposition 1958

| Person | Funn / Kilde | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| Hans J. Henriksen | Formann 1958 (s. 7) | board | role_enriched | Formann i `hans-j-henriksen.yaml` og snapshot `1958-aafk.yaml` |
| Asbjørn Korsnes | Nestformann 1958 (s. 7) | board | role_enriched | Nestformann i `asbjorn-korsnes.yaml` og snapshot `1958-aafk.yaml` |
| Rolf Kvissel | Sekretær 1958 (1957 s. 65, 1958 s. 7) | admin | person_created / role_created | Opprettet `rolf-kvissel.yaml` med sekretærrolle 1958 |
| Harald Sæther | Kasserer (s. 7, takket for 6 år på s. 83) | admin | role_enriched | Kasserer 1953–1960 i `harald-saether.yaml` |
| Ole Walderhaug | Oppmann A-laget 1958 (s. 7, 54) | sporting | role_enriched | Oppmann i `ole-walderhaug.yaml` og snapshot `1958-aafk.yaml` |
| Jan Larsen | Trener og kaptein 1958 (s. 16, 69) | coach | role_enriched | Trener i `jan-larsen.yaml` og snapshot `1958-aafk.yaml` |
| Trygve Olsen | Junioroppmann 1958 (s. 7, 76) | sporting | role_enriched | Junioroppmann i `trygve-olsen.yaml` og snapshot |
| Reidar Skarbøvik | Gutteoppmann 1958 (s. 7, 72) | sporting | role_enriched | Gutteoppmann i `reidar-skarbovik.yaml` og snapshot |
| Gerd Strømsholm | Formann Dameavdelingen (s. 83) | board | role_enriched | Formann Dameavdelingen i `gerd-stromsholm.yaml` og snapshot |
| Thorbjørn Aarø | Nådde 193 A-kamper (s. 80), venstre back på Mørelaget mot landslaget (s. 31) | player | milestone_created | Dokumentert i `torbjorn-aaro.yaml` |
| Mindor Sunde | Nådde 130 A-kamper (s. 80), banens beste på bylaget (s. 80) | player | person_created / milestone_created | Opprettet `mindor-sunde.yaml` med 130-kampers milepæl |
| Einar Aas | Målvakt, reserve på Mørelaget mot landslaget (s. 31) | player | mention_linked | Dokumentert i `einar-aas.yaml` |
| Jacob Sætre | 22. benyttede spiller på A-laget i 1958 (s. 83) | player | mention_linked | Dokumentert i review |
| Rolf Sperre | Juniorlagets toppscorer med 30 mål (s. 76) | non_senior | mention_linked | Dokumentert i review |

---

## Side-for-side kontrollmatrise (side 1–84)

| Side | Hefte | Tittel / Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|---|
| 1 | Nr. 1 | Omslag: Foran ny sesong | season_fact | reviewed | Forsidebilde. |
| 2 | Nr. 1 | Formannens nyttårsønske: Godt samarbeid og sportslig fremgang | person_role | reviewed | Hans Henriksen oppsummerer 1957 og ser fram mot 1958; Kråmyra utvides. |
| 3 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 4 | Nr. 1 | Innendørstrening og instruksjon | season_fact | reviewed | Treningstider på Nørvøy skole for A-lag, junior og gutter. |
| 5 | Nr. 1 | Minnenes bok: 1920-årenes store kamper | historical | reviewed | Tilbakeblikk på cupkamper mot Drafn og Rollon. |
| 6 | Nr. 1 | Dugnad på Kråmyra og baneutvidelse | organization | reviewed | Planering av banen og grøfting mot Aksla. |
| 7 | Nr. 1 | Tillitsmenn for 1958 | organization | reviewed | Oversikt over styre, komiteer og oppmenn valgt nov 1957. Formann: Henriksen, Nestformann: Korsnes, Sekr: Kvissel, Kass: Sæther, Oppmann: Walderhaug. |
| 8 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 9 | Nr. 1 | Guttelagene i vintertrening | non_senior | reviewed | Rekrutteringsarbeid under Reidar Skarbøvik. |
| 10 | Nr. 1 | Sett og hørt / Medlemsnytt | notes | reviewed | NFF-ting, reiser og arrangementer. |
| 11 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 12 | Nr. 1 | Junioravdelingens planer | non_senior | reviewed | Trygve Olsen om sesongforberedelsene. |
| 13 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 14 | Nr. 1 | Annonser / Baksiden hefte 1 | ads | reviewed | Baksidetekst. |
| 15 | Nr. 2 | Omslag: Klar for seriestart våren 1958 | season_fact | reviewed | Forsidebilde. |
| 16 | Nr. 2 | Vårsesongen foran oss / Trener Jan Larsen | person_role | reviewed | Jan Larsen om taktikk, tempo og offensivt spill. |
| 17 | Nr. 2 | Terminliste våren 1958 | fixture_list | reviewed | Vårens 5 seriekamper i Landsdelsserien Møre uten eksakte kalenderdatoer. |
| 18 | Nr. 2 | Vårcupen 1958 / AaFK vinner pokalen | source_result | reviewed | AaFK vinner Vårcupen for annet år på rad med 3–1 over Skarbøvik i finalen. |
| 19 | Nr. 2 | Minnenes bok: 1930-årenes triumfer | historical | reviewed | Historisk tilbakeblikk. |
| 20 | Nr. 2 | Guttelagenes kamper og serier | non_senior | reviewed | Oppsett for gutte- og småguttelag. |
| 21 | Nr. 2 | Anlegget på Kråmyra under utbedring | organization | reviewed | Rolf Hofmos befaring og banekomiteens tiltak. |
| 22 | Nr. 2 | Annonser | ads | reviewed | Lokale annonsører. |
| 23 | Nr. 2 | Lorang Ridder-Nilsen om A-lagets spillestil | person_role | reviewed | Den kjente fotballtreneren analyserer AaFKs styrker og svakheter. |
| 24 | Nr. 2 | Sett og hørt / Notiser | notes | reviewed | Notiser og klubbnytt. |
| 25 | Nr. 3 | Omslag: Vårens suksess i Landsdelsserien | season_fact | reviewed | Forsidebilde. |
| 26 | Nr. 3 | Vårens seriekamper: 9 av 10 poeng | source_result | reviewed | AaFK ubeseiret i vårens 5 seriekamper (4–1–0, 10–3 mål); seier over KFK 2–1. |
| 27 | Nr. 3 | Privatkamper og Sommercupen | source_result | reviewed | Herds cup: Herd 5–4, Aksla 4–2, finale Langevåg 2–3. |
| 28 | Nr. 3 | Idrettslederen som organisator | season_fact | reviewed | Lederartikkel om administrativt ansvar. |
| 29 | Nr. 3 | Juniorlaget i KFKs jubileumsturnering | non_senior | reviewed | Juniorlaget til finale mot Freidig (0–1). |
| 30 | Nr. 3 | Tabell og resultater våren 1958 | source_result | reviewed | Tabelloversikt over Landsdelsserien 1957/58. |
| 31 | Nr. 3 | Mørelaget mot A-landslaget på Aksla stadion | person_role | reviewed | Thorbjørn Aarø venstre back, Einar Aas keeperreserve mot Landslaget 29.07.1958. |
| 32 | Nr. 3 | Guttelaget og ferdighetsmerket | non_senior | reviewed | Merkeprøver og teknisk trening. |
| 33 | Nr. 3 | Annonser | ads | reviewed | Lokale annonsører. |
| 34 | Nr. 3 | Minnenes bok: Jack Norwall og revyene | historical | reviewed | Klubbkvelder og revytradisjon i AaFK. |
| 35 | Nr. 3 | A-lagets resultater våren 1958 | source_result | reviewed | Samlet våroppsummering. |
| 36 | Nr. 3 | Sett og hørt / Medlemsnytt | notes | reviewed | Notiser og medlemsnytt. |
| 37 | Nr. 4 | Omslag: Høstsesongen i Landsdelsserien | season_fact | reviewed | Forsidebilde. |
| 38 | Nr. 4 | Seriekommentarer etter 5 spilleomganger | source_result | reviewed | Rapport fra høstsesongens første kamper. |
| 39 | Nr. 4 | NM 1. og 2. runde / Molde-kampen | source_result | reviewed | NM 1. runde Rollon 2–0, 2. runde Molde 0–2. |
| 40 | Nr. 4 | Økonomi og tilskuerforhold på Aksla | season_fact | reviewed | Økonomisk analyse av baneleie og billettavgift. |
| 41 | Nr. 4 | Kommunal støtte til idrettsanlegg | organization | reviewed | Drøfting av baneforhold i Ålesund. |
| 42 | Nr. 4 | Gutte-cupen en stor suksess | non_senior | reviewed | Mange talenter i guttecupen på Aksla. |
| 43 | Nr. 4 | Sommerdager på Furuset / NFF instruksjonsleir | person_role | reviewed | Jan Larsen og spillere på kurs. |
| 44 | Nr. 4 | Treningsprogram og metodikk | season_fact | reviewed | Moderne treningsprinsipper. |
| 45 | Nr. 4 | Annonser | ads | reviewed | Lokale annonsører. |
| 46 | Nr. 4 | Muntre historier fra fotballturer | historical | reviewed | Anekdoter fra klubbens reiser. |
| 47 | Nr. 4 | Satsting på junioravdelingen | non_senior | reviewed | Klubbens fremtidsstrategi for de yngre. |
| 48 | Nr. 4 | Sett og hørt / Notiser | notes | reviewed | Notiser og klubbnyheter. |
| 49 | Nr. 5 | Omslag: Høstsesongens innspurt | season_fact | reviewed | Forsidebilde. |
| 50 | Nr. 5 | Banekomiteens årsrapport for 1958 | organization | reviewed | Perry Ystenes, Frantz Løvmo, Helge Lunde, Helmer Lausund om arbeidet på Kråmyra. |
| 51 | Nr. 5 | Banekomiteens sammensetning | organization | reviewed | Komiteens medlemmer og dugnadsinnsats. |
| 52 | Nr. 5 | Cupmesterskapet 1958 oppsummert | season_fact | reviewed | Nasjonal cupomtale (Skeid cupmester). |
| 53 | Nr. 5 | En prat med Knut Gudem (Skeid) i Ålesund | person_role | reviewed | Skeid-spilleren trener med AaFK under sitt opphold i byen. |
| 54 | Nr. 5 | En prat med oppmann Ole Walderhaug | person_role | reviewed | Walderhaug om 16–17 jevngode A-lagsspillere og fin lagånd. |
| 55 | Nr. 5 | Sesongvurdering og spillerutvikling | person_role | reviewed | Walderhaugs analyse av lagets fremgang. |
| 56 | Nr. 5 | Annonser | ads | reviewed | Lokale annonsører. |
| 57 | Nr. 5 | Pokalseriene for smågutter og rekrutter | non_senior | reviewed | Resultater for yngres avdeling. |
| 58 | Nr. 5 | Juniorlaget har hatt en fin sesong | non_senior | reviewed | Kretsmesterskapet i havn for juniorlaget; 29–3 i mål på 5 kamper. |
| 59 | Nr. 5 | Trening og kameratskap i junioravdelingen | non_senior | reviewed | Trygve Olsens opplegg for de unge. |
| 60 | Nr. 5 | Sett og hørt / Medlemsnytt | notes | reviewed | Notiser og personia. |
| 61 | Nr. 6 | Omslag: Årsmøte og julehilsen 1958 | season_fact | reviewed | Forsidebilde. |
| 62 | Nr. 6 | Leder: Et barn er oss født / Julerefleksjon | notes | reviewed | Redaktør Harald Nords julehilsen. |
| 63 | Nr. 6 | Et sterkt og aktivt år for klubben / Årsmøtet 1958 | organization | reviewed | Årsmøtet 28.11.1958 i Maskinistforeningen; godkjenning av beretning og regnskap. |
| 64 | Nr. 6 | Valgene for 1959 / Tillitsmenn | organization | reviewed | Styre valgt: Henriksen (formann), Saure (nestformann), Høyer (sekr), Sæther (kass). |
| 65 | Nr. 6 | Årsfasitten 1958: 29 kamper spilt (57–43 mål) | statistics | reviewed | Fullstendig fasit: Vår 4–1–0 (10–3), Høst 5–3–1 (13–11), Cup 1–0–1 (2–3), Cup 2–0–1 (7–1), Sommer 2–0–1 (11–9), Privat 2–0–5 (14–16). |
| 66 | Nr. 6 | Klubben satser på ungdommen | non_senior | reviewed | Generasjonsskiftet bærer frukter; talentene overtar på A-laget. |
| 67 | Nr. 6 | Med A-laget som reserve sesongen 1958 | person_candidate | reviewed | Rapport fra reservekeeperens opplevelser på borteturene. |
| 68 | Nr. 6 | Reservelaget har hatt en bra sesong | non_senior | reviewed | Reservelagets innsats i den lokale serien. |
| 69 | Nr. 6 | Er det så lett å være trener? | person_role | reviewed | Trenerrollen belyst; Ole Walderhaug og Jan Larsen får ros. |
| 70 | Nr. 6 | Serieordningen over kalenderåret drøftes | season_fact | reviewed | Forslag om overgang til vår-høst serie i fotballen. |
| 71 | Nr. 71 | Publikumsstatistikk 1958 / Nedgang på Aksla | statistics | reviewed | 31 000 færre tilskuere enn i toppåret 1951; 1958 litt bedre enn 1957. |
| 72 | Nr. 6 | Betenkelig tendens hos guttespillerne / Foreldrenes rolle | non_senior | reviewed | Reidar Skarbøvik om disiplin og fremmøte. |
| 73 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 74 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 75 | Nr. 6 | Guttelagenes sammensetning / Hødd-seieren 1–0 | source_result | reviewed | Aldersklasser (rekrutt, smågutt, gutt); mimring om 1–0 seieren over Hødd på Høddvoll. |
| 76 | Nr. 6 | Fin sesong for juniorlaget / Kretsmesterskap | non_senior | reviewed | 19 kamper (13–2–4, 74–15 mål); Toppscorer Rolf Sperre 30 mål, Furseth 11, Bigseth 9. |
| 77 | Nr. 6 | God juniorfotball et resultat av ferdighetsmerkene | non_senior | reviewed | Knut Høyers arbeid med merkeprøvene gir resultater. |
| 78 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 79 | Nr. 6 | Turistforeningen og folkeidretten | notes | reviewed | Artikkel om friluftsliv på Sunnmøre. |
| 80 | Nr. 6 | Kampen om plassene på A-laget / Mindor Sunde | person_candidate | reviewed | Mindor Sunde runder 130 kamper; serieavslutning mot KFK (0–0); Aarø 193 kamper. |
| 81 | Nr. 6 | Fremtidens fotballstil i smeltedigelen | season_fact | reviewed | Taktisk analyse av 4-backssystemet og sonespill. |
| 82 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 83 | Nr. 6 | Sett og hørt / Representasjon og tillitsvalgte | notes | reviewed | Harald Sæther takkes for 6 tunge år som kasserer; Jacob Sætre 22. spiller på A-laget; Dameavdelingen gir 500 kr. |
| 84 | Nr. 6 | Annonser / Baksiden hefte 6 | ads | reviewed | Baksidetekst. |
