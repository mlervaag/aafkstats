# Visuell kontroll og innhøsting av AaFK Medlemsblad 1957 (Vol. 8 Nr. 1–6)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad for Aalesunds Fotballklubb 1957** (Vol. 8, hefte 1–6, 92 sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til arkivets prinsipper:
- OCR og ALTO brukes som arbeidsindeks og kandidatgenerator.
- De trykte faksimilene kontrolleres visuelt som primærkilde.
- `sourceId + page` brukes som stabil kontrollidentitet (kontrollert entydig for samlebindet 1–92).
- Kildepåstander lagres i `data/source-results/` før eventuell opprettelse av kanoniske kamper.
- Usikre datoer eller koblinger konstrueres ikke.

Kilde-ID: `medlemsblad-for-aalesunds-fotb-1957-7672`  
URN: `URN:NBN:no-nb_digitidsskrift_2021060383002_001`

---

## Completion-matrise 1957

| Kategori | Status | Notat |
|---|---:|---|
| Sider visuelt kontrollert | 92/92 | Samtlige 6 hefter kontrollert side for side |
| A-lagsresultater vurdert | 29/29 | 12 seire, 7 uavgjort, 10 tap, mål 58–43 |
| Fixture-kilder vurdert | 2 | Vårterminliste s. 17, høstterminliste s. 39 |
| Nye canonical | 1 | AaFK – ESV Westbahn Linz (0–1, 28.07.1957) |
| Berikede canonical | 0 | Ingen eksisterende 1957-kamper fra før |
| Person candidates vurdert | 18/18 | Alle personfunn eksplisitt disponert |
| Person roles vurdert | 8/8 | Hovedstyre, oppmenn, trenere, dameavdeling |
| Nye personer | 2 | Ole Aasen, Hans Ole Sødergren |
| Berikede personer | 8 | Henriksen, Korsnes, Sæther, Sandø, Puck, Nørve, Eriksen, Aas, Aarø |
| Roller opprettet/beriket | 9 | Formann, sekretær, oppmann, kasserer, trener |
| Mentions vurdert | 12 | Fladmark, Kristoffersen, Vadseth, Sunde, Finsnes m.fl. |
| Honors/milepæler | 7 | Æresmedlemmer (Sandø, Puck), Gullmerke (Nørve, Eriksen), Spillemerke sølv (Korsnes, Aarø), Årets spiller (Aas) |
| Observations | 1 | Kråmyra klubbhus 1. byggetrinn innviet 26.10.1957 |
| Snapshots | 1 | `1957-aafk.yaml` (s. 7 og s. 90) |
| Konflikter løst | 0 | Ingen motstridende kilder |
| Konflikter åpne | 0 | Ingen uavklarte konflikter |
| Identity uncertain | 0 | Alle personer entydig identifisert |

---

## Terminlister og fixture-reconciliation 1957

- **Vårterminliste (s. 17):** Landsdelsserien Møre 1956/57 (vår). Viser kamprekkefølgen mot Hødd, Framtid, Molde, KFK og Langevåg. Inneholder **ingen eksakte kalenderdatoer** (kun rundeangivelse).
- **Høstterminliste (s. 39):** Landsdelsserien Møre 1957/58 (høst). Viser de 9 høstkampene mot KFK, Langevåg, Rollon, Braatt, Hødd, Spjelkavik, Clausenengen, KFK og Langevåg. Inneholder **ingen eksakte kalenderdatoer**.
- **Konklusjon:** Ingen kanoniske kamper er opprettet på grunnlag av terminlistene alene. Alle serieresultater er bevart som kildedokumenterte oppføringer i `data/source-results/`.

---

## Personfunn og eksplisitt disposition 1957

| Person | Funn / Kilde | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| Hans J. Henriksen | Formann 1957 (s. 7) | board | role_enriched | Formann i `hans-j-henriksen.yaml` og snapshot `1957-aafk.yaml` |
| Asbjørn Korsnes | Nestformann (s. 7), 150 kamper sølvmerke (s. 70) | board / honor | role_enriched / honor_created | Nestformann og `spillemerke-solv-150-kamper` i `asbjorn-korsnes.yaml` |
| Ole Aasen | Sekretær 1957 (s. 7) | admin | person_created / role_created | Opprettet `ole-aasen.yaml` med sekretærrolle 1957 |
| Harald Sæther | Kasserer (s. 7) | admin | role_enriched | Kassererrolle 1953–1960 i `harald-saether.yaml` |
| Hans Ole Sødergren | Oppmann A-laget 1957 (s. 7) | sporting | person_created / role_created | Opprettet `hans-ole-sodergren.yaml` med oppmannsrolle 1957 |
| Finn Tollås | Trener A-laget 1957 (s. 7, 16) | coach | role_enriched | Trener i snapshot `1957-aafk.yaml` |
| Gerd Strømsholm | Formann Dameavdelingen (s. 79, 90) | board | role_enriched | Formann Dameavdelingen i `gerd-stromsholm.yaml` og snapshot |
| Emil Sandø | Æresmedlem utnevnt nov 1957 (s. 81) | honor | honor_created | Tildelt `aeresmedlem-1957` i `emil-sando.yaml` |
| Peder Puck | Æresmedlem utnevnt nov 1957 (s. 81) | honor | honor_created | Tildelt `aeresmedlem-1957` i `peder-puck.yaml` |
| Sigurd Nørve | Gullmerke utdelt nov 1957 (s. 81) | honor | honor_created | Tildelt `gullmerke-1957` i `sigurd-norve.yaml` |
| Karsten Eriksen | Gullmerke utdelt nov 1957 (s. 81) | honor | honor_created | Tildelt `gullmerke-1957` i `karsten-eriksen.yaml` |
| Thorbjørn Aarø | Seniorstatuett (s. 69), Sølvmerke 162 kamper (s. 71) | honor | honor_created | Tildelt `seniorstatuett-1957` og sølvmerke i `torbjorn-aaro.yaml` |
| Torid Fladmark | Juniorstatuett 1957 (s. 69) | honor | honor_created | Tildelt `juniorstatuett-1957` i `thorid-fladmark.yaml` |
| Einar Aas | Årets spiller 1957 for 3. gang (s. 68) | honor | honor_created | Tildelt `arets-spiller-1957` i `einar-aas.yaml` |
| Rolf Annaniassen | Leder Banekomiteen (s. 52, 77) | committee | role_enriched | Hedret for Kråmyra; koblet i observation |
| Åge Bentzen | Minneord over politikonstabel/spiller (s. 45) | person | mention_linked | Dokumentert i review |
| Olav Ingebrigtsen | Minneord over formann 1916 (s. 32) | person | already_documented | Dokumentert i klubbhistorikken |
| Mathias Sandø | Minneord over stifter (s. 32) | person | already_documented | Dokumentert i klubbhistorikken |

---

## Side-for-side kontrollmatrise (side 1–92)

| Side | Hefte | Tittel / Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|---|
| 1 | Nr. 1 | Omslag: Einar Aas i aksjon | season_fact | reviewed | Foto av målvakt Einar Aas i spenstig redning. |
| 2 | Nr. 1 | Formannens nyttårsønske / Hans Henriksen | person_role | reviewed | Formann Hans Henriksen om sportslige mål og klubbhus på Kråmyra. |
| 3 | Nr. 1 | Tillitsmenn og komiteer for 1957 | organization | reviewed | Oversikt over styre, sportsutvalg, banekomité og oppmenn. |
| 4 | Nr. 1 | Vintertrening og forberedelser / Nørvøy skole | season_fact | reviewed | Treningstider i gymnastikksalen og utendørs. |
| 5 | Nr. 1 | Minnenes bok: 1915–1920 (De første årene) | historical | reviewed | Tilbakeblikk på klubbens stiftelse og pionertid. |
| 6 | Nr. 1 | Dameavdelingen og dugnadsinnsats | organization | reviewed | Dameavdelingen samler inn midler til klubbhuset på Kråmyra. |
| 7 | Nr. 1 | Tillitsmannsliste 1957 / Styresammensetning | organization | reviewed | Hovedstyret: Henriksen, Korsnes, Aasen, Sæther, Sødergren. |
| 8 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 9 | Nr. 1 | Rekruttering i guttelagene / Reidar Skarbøvik | non_senior | reviewed | Reidar Skarbøvik leder 40 gutter i vintertrening. |
| 10 | Nr. 1 | Sett og hørt / Notiser | notes | reviewed | NFF-ting, medlemsnyheter og arrangementer. |
| 11 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 12 | Nr. 1 | Juniorlagets forberedelser / Leif Gjesvold | non_senior | reviewed | Leif Gjesvold om juniorsatsingen foran sesongen. |
| 13 | Nr. 1 | Annonser | ads | reviewed | Lokale annonsører. |
| 14 | Nr. 1 | Annonser / Baksiden hefte 1 | ads | reviewed | Baksidetekst. |
| 15 | Nr. 2 | Omslag: Vårens seriestart | season_fact | reviewed | Forside foran vårsesongen 1957. |
| 16 | Nr. 2 | Vårsesongen foran oss / Finn Tollås | person_role | reviewed | Trener Finn Tollås om forventninger i Landsdelsserien. |
| 17 | Nr. 2 | Terminliste våren 1957 | fixture_list | reviewed | Vårens 5 seriekamper uten eksakte kalenderdatoer. |
| 18 | Nr. 2 | Vårcupen 1957 / ÅFK vinner over Rollon 2–1 | source_result | reviewed | Vårcupfinalen: AaFK–Rollon 2–1; innledende Guard 1–0, Spjelkavik 2–0. |
| 19 | Nr. 2 | Minnenes bok: Cupbragder i 1930-årene | historical | reviewed | Tilbakeblikk på cupkamper mot Brann og Viking. |
| 20 | Nr. 2 | Guttelaget på Oslotur / Lyn og Skeid | non_senior | reviewed | Oslotur mai 1957: Junior spilte 1–1 mot Lyn på Ullevål, 0–1 mot Skeid. |
| 21 | Nr. 2 | Bygging av klubbhus på Kråmyra | organization | reviewed | Dugnadsrapport for 1. byggetrinn på Kråmyra. |
| 22 | Nr. 2 | Sett og hørt / Medlemsnytt | notes | reviewed | Notiser og arrangementer. |
| 23 | Nr. 2 | Annonser | ads | reviewed | Lokale annonsører. |
| 24 | Nr. 2 | Annonser / Baksiden hefte 2 | ads | reviewed | Baksidetekst. |
| 25 | Nr. 3 | Omslag: Kråmyra under utbygging | organization | reviewed | Forsidebilde av dugnadsarbeid på Kråmyra. |
| 26 | Nr. 3 | Westbahn Linz gjester Ålesund | new_canonical_match | reviewed | Presentasjon av det østerrikske laget ESV Westbahn Linz. |
| 27 | Nr. 3 | NM 1. runde: Eid–AaFK 2–1 e.e.o. | source_result | reviewed | Cupkamp på Nordfjordeid: Eid vinner 2–1 etter ekstraomganger. |
| 28 | Nr. 3 | Vårsesongens seriekamper oppsummert | source_result | reviewed | Landsdelsserien: Hødd 2–0, Framtid 0–0, Molde 1–3, KFK 0–2, Langevåg 2–2. |
| 29 | Nr. 3 | Sommercupen 1957 / Herds cup | source_result | reviewed | Herd Sommercup: Guard 11–1, Herd 0–1. |
| 30 | Nr. 3 | Ferdighetsmerket i fotball / Bronse- og sølvballer | non_senior | reviewed | Knut Høyer rapporterer: 30 bronseballer og 5 sølvballer tatt. |
| 31 | Nr. 3 | Aksla stadion publikum og økonomi | season_fact | reviewed | Anstrengt klubbøkonomi og billettinntekter. |
| 32 | Nr. 3 | Minneord: Olav Ingebrigtsen og Mathias Sandø | person_candidate | reviewed | Minneord over formann 1916 Olav Ingebrigtsen og stifter Mathias Sandø. |
| 33 | Nr. 3 | Privatkamper sommeren 1957 | source_result | reviewed | Stranda 5–3, Rollon 4–1, Aksla 4–1, Spjelkavik 2–2. |
| 34 | Nr. 3 | Sett og hørt / Medlemsnytt | notes | reviewed | Notiser og klubbnytt. |
| 35 | Nr. 3 | Annonser | ads | reviewed | Lokale annonsører. |
| 36 | Nr. 3 | Annonser / Baksiden hefte 3 | ads | reviewed | Baksidetekst. |
| 37 | Nr. 4 | Omslag: Høstsesongen i Landsdelsserien | season_fact | reviewed | Forsidebilde foran høstsesongen 1957/58. |
| 38 | Nr. 4 | Kampen mot Westbahn Linz (0–1) | new_canonical_match | reviewed | Rapport fra internasjonal kamp 28.07.1957: AaFK–Westbahn Linz 0–1, pause 0–0, 2 500 tilsk. Oppstilling: Aas, Vadseth, Aarø, Korsnes, Rutgerson, Sunde, Kristoffersen, Fladmark, Iversen, Larsen, Finsnes. |
| 39 | Nr. 4 | Høstterminlisten Landsdelsserien 1957/58 | fixture_list | reviewed | Terminliste for høstens 9 seriekamper uten eksakte kalenderdatoer. |
| 40 | Nr. 4 | Juniorlagets fremgang i NM junior | non_senior | reviewed | NM junior: Ørsta 3–0, Molde 1–0, Hødd 3–0, Brann 1–2. |
| 41 | Nr. 4 | Høstcupen for juniorlag / AaFK mester | non_senior | reviewed | Høstcupen: Langevåg 4–0, Rollon 5–0, Stranda 7–0 (16–0 i målforskjell). |
| 42 | Nr. 4 | Dugnad på Kråmyra går mot fullføring | organization | reviewed | Innredning av klubbhusets 1. etasje. |
| 43 | Nr. 4 | Dameavdelingens innsats og tombola | organization | reviewed | Dameavdelingens tombola gir 5 000 kr til Kråmyra. |
| 44 | Nr. 4 | Samlet kampoversikt A-laget 1957 (Del 1) | source_result | reviewed | Fullstendig tabell over årets 29 A-lagskamper (58–43 mål). |
| 45 | Nr. 4 | Minneord: Åge Bentzen | person_candidate | reviewed | Minneord over politikonstabel og AaFK-spiller Åge Bentzen. |
| 46 | Nr. 4 | Sett og hørt / Notiser | notes | reviewed | Notiser og kretsnytt. |
| 47 | Nr. 4 | Annonser | ads | reviewed | Lokale annonsører. |
| 48 | Nr. 4 | Annonser / Baksiden hefte 4 | ads | reviewed | Baksidetekst. |
| 49 | Nr. 5 | Omslag: Klubbhusets innvielse 26. oktober 1957 | organization | reviewed | Festomslag i anledning innvielsen av Kråmyra klubbhus. |
| 50 | Nr. 5 | Klubbhusets 1. byggetrinn innviet i festlig lag | observation | reviewed | Innvielsesfest 26.10.1957 for klubbhuset til 30 000 kr; over 6 000 dugnadstimer. |
| 51 | Nr. 5 | Taler ved klubbhusinnvielsen / Hans Henriksen | organization | reviewed | Formann Hans Henriksen takker banekomiteen og medlemmene. |
| 52 | Nr. 5 | Banekomiteens formann Rolf Annaniassen hedres | organization | reviewed | Rolf Annaniassen overrekkes klubbens hedersgave for ledelsen av byggingen. |
| 53 | Nr. 5 | Dameavdelingen overrekker servise og utstyr | organization | reviewed | Dameavdelingen innreder kjøkken og overrekker fullt servise. |
| 54 | Nr. 5 | Høstsesongens seriekamper / 9 kamper spilt | source_result | reviewed | KFK 0–2, Langevåg 0–2, Rollon 0–0, Braatt 4–1, Hødd 2–2, Spjelkavik 1–0, Clausenengen 1–3, KFK 1–2, Langevåg 3–1. |
| 55 | Nr. 5 | Braatt–AaFK 1–4 i Kristiansund | source_result | reviewed | Kossa Korsnes scorer 1. mål; storseier i Kristiansund. |
| 56 | Nr. 5 | AaFK–Langevåg 3–1 på Aksla | source_result | reviewed | Høstsesongens avslutningskamp: 3–1 seier over Langevåg. |
| 57 | Nr. 5 | Guttelaget avslutter sesongen | non_senior | reviewed | Oppsummering av guttelagets 14 kamper og serier. |
| 58 | Nr. 5 | Ferdighetsmerket og instruksjon | non_senior | reviewed | Evaluering av teknisk merkeprøve for yngres avdeling. |
| 59 | Nr. 5 | Sett og hørt / Medlemsnytt | notes | reviewed | Telegrammer og notiser. |
| 60 | Nr. 5 | A-lagets resultater og serietabell høst 1957 | source_result | reviewed | Sluttabell høst 1957 i Landsdelsserien Møre. |
| 61 | Nr. 5 | Annonser | ads | reviewed | Lokale annonsører. |
| 62 | Nr. 5 | Annonser / Baksiden hefte 5 | ads | reviewed | Baksidetekst. |
| 63 | Nr. 6 | Omslag: Årsmøte og sesongavslutning 1957 | season_fact | reviewed | Forsidebilde til årsheftet. |
| 64 | Nr. 6 | Årsmøtet for 1957 i Maskinistforeningen | organization | reviewed | Årsmøtereferat; godkjennelse av årsberetning og regnskap. |
| 65 | Nr. 6 | Valgene for arbeidsåret 1958 | organization | reviewed | Styre valgt nov 1957 for 1958: Henriksen, Korsnes, Kvissel, Sæther, Walderhaug. |
| 66 | Nr. 6 | Sportsutvalg og komiteer for 1958 | organization | reviewed | Sportsutvalg: Walderhaug, Ødegård, Grimstad; Junior: Trygve Olsen. |
| 67 | Nr. 6 | Gutteutvalg og banekomité for 1958 | organization | reviewed | Gutteoppmann: Reidar Skarbøvik; Banekomité: Perry Ystenes m.fl. |
| 68 | Nr. 6 | Årets spiller 1957: Einar Aas (3. gang) | person_candidate | reviewed | Einar Aas hedres som årets fremste spiller i klubben for 3. gang. |
| 69 | Nr. 6 | Klubbens statuetter 1957: Aarø og Fladmark | person_candidate | reviewed | Thorbjørn Aarø (senior) og Torid Fladmark (junior) tildeles statuettene. |
| 70 | Nr. 6 | Spillemerke i sølv: Asbjørn Korsnes (150 kamper) | person_candidate | reviewed | Asbjørn Korsnes ("Kossa") tildelt spillemerket i sølv for 150 kamper. |
| 71 | Nr. 6 | Thorbjørn Aarø tildelt sølvmerke for 162 kamper | person_candidate | reviewed | Thorbjørn Aarø tildelt spillemerke i sølv for 162 kamper på A-laget. |
| 72 | Nr. 6 | A-lagets samlede årsstatistikk 1957 | statistics | reviewed | 29 kamper (12–7–10, mål 58–43); Toppscorer Jarle Kristoffersen (9 mål). |
| 73 | Nr. 6 | Spillerinnsats og frammøtestatistikk | statistics | reviewed | Flest kamper: Aarø 27, Aas 26, Finsnes 25, Vadseth 24, Sunde 23. |
| 74 | Nr. 6 | Juniorlagets årsstatistikk 1957 | non_senior | reviewed | 16 kamper (12–1–3, mål 54–9); Toppscorer Jan Nærø (13 mål). |
| 75 | Nr. 6 | Guttelaget og ferdighetsmerket oppsummert | non_senior | reviewed | Reidar Skarbøvik oppsummerer gutteavdelingens sterke år. |
| 76 | Nr. 6 | Rekruttlaget og småguttelaget | non_senior | reviewed | Rekruttlagets trening og kamper. |
| 77 | Nr. 6 | Banekomiteens årsberetning for 1957 | organization | reviewed | Fullstendig beretning om Kråmyra-anlegget fra Rolf Annaniassen. |
| 78 | Nr. 6 | Regnskap for klubbhuset og anlegget | organization | reviewed | Dugnadstimer og økonomisk regnskap for Kråmyra. |
| 79 | Nr. 6 | Dameavdelingens årsberetning 1957 | organization | reviewed | Gerd Strømsholm om Dameavdelingens store bidrag. |
| 80 | Nr. 6 | Medlemsbladets årsrapport og opplag | organization | reviewed | Redaktør Harald Nord om 6 hefter og 1 500 i opplag. |
| 81 | Nr. 6 | Æresmedlemmer: Emil Sandø og Peder Puck | milestone | reviewed | Klubbens første æresmedlemmer siden Geo Haller 1915; Gullmerke til Nørve og Eriksen. |
| 82 | Nr. 6 | Publikumsstatistikk for AaFK 1951–1957 | statistics | reviewed | Detaljert historisk oversikt over tilskuertall på Aksla stadion. |
| 83 | Nr. 6 | Banekomiteens medlemmer takkes | organization | reviewed | Rolf Annaniassen, Helge Lunde, Frantz Løvmo, Finn Tollås, Perry Ystenes. |
| 84 | Nr. 6 | Hyggelige fotballminner: Asbjørn Korsnes | person_candidate | reviewed | Korsnes ser tilbake på 150 kamper og minnerike oppgjør. |
| 85 | Nr. 6 | Kjell Berentzen takker av som sekretær | person_role | reviewed | Berentzen takkes for 3 års styreinnsats (formann 1954–1955, sekretær 1956). |
| 86 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 87 | Nr. 6 | To lovende spillere: Kjell Iversen og Tori Fladmark | person_candidate | reviewed | Hyllest til unge talentfulle Kjell Iversen og Torid Fladmark. |
| 88 | Nr. 6 | Harald Sæther: Innsatsviljen hos AaFK før og nå | person_role | reviewed | Kasserer Harald Sæther om klubbpatriotisme og supporterkultur. |
| 89 | Nr. 6 | Utmerkelse til Nic. Nilsen (Hedersmerket) | milestone | reviewed | Kretsformann Nic. Nilsen tildelt NIFs Hedersmerke. |
| 90 | Nr. 6 | Sett og hørt / Kretslag og Dameavdelingen | notes | reviewed | Kretslag: Aas, Aarø, Meyer; Dameavdelingen velger Gerd Strømsholm. |
| 91 | Nr. 6 | Annonser | ads | reviewed | Lokale annonsører. |
| 92 | Nr. 6 | Annonser / Baksiden hefte 6 | ads | reviewed | Baksidetekst. |
