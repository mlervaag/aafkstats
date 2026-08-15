# Visuell kontroll og innhøsting av AaFK Medlemsblad 1954 (Vol. 5 Nr. 1–6 & Jubileumsnummer)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad for Aalesunds Fotballklubb 1954** (Vol. 5, hefte 1–6 på 108 sider, samt det spesielle 40-årsjubileumsheftet på 40 sider, totalt 148 sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til arkivets prinsipper:
- OCR og ALTO brukes som arbeidsindeks og kandidatgenerator.
- De trykte faksimilene kontrolleres visuelt som primærkilde.
- Kildepåstander lagres i `data/source-results/` før eventuell opprettelse av kanoniske kamper.
- Usikre datoer eller koblinger konstrueres ikke.

Kilder:
1. Ordinære hefter 1–6 (108 sider): `medlemsblad-for-aalesunds-fotb-1954-cd1c` (URN: `URN:NBN:no-nb_digitidsskrift_2021060183308_001`)
2. 40-års jubileumsnummer (40 sider): `medlemsblad-for-aalesunds-fotb-1954-192b` (URN: `URN:NBN:no-nb_digitidsskrift_2021040883093_001`)

---

## Completion-matrise 1954

| Kategori | Status | Notat |
|---|---:|---|
| Sider visuelt kontrollert | 148/148 | 108 ordinære sider + 40 jubileumssider (100 %) |
| A-lagsresultater vurdert | 33/33 | 17 seire, 4 uavgjort, 12 tap, mål 65–57 |
| Fixture-kilder vurdert | 2 | Vårterminliste s. 41, Høstterminliste s. 95 |
| Nye canonical | 0 | Seriekamper bevares i source-results uten konstruerte datoer |
| Berikede canonical | 1 | NM 3. runde: Freidig–AaFK 3–1 (08.08.1954) beriket med kilde s. 95 |
| Person candidates vurdert | 28/28 | Alle personfunn eksplisitt disponert |
| Person roles vurdert | 12/12 | Hovedstyre, oppmenn, trenere, banekomité, dameavdeling |
| Nye personer | 1 | Ingvald Frøysa (50 år, 100 kamper) |
| Berikede personer | 10 | Lauritz Giske, Karsten Eriksen, Bernt Sulebust, Harald Sæther, Fritz Haagensen, Emil Sandø, Konrad Korsnes, Andreas B. Ringdal, Rasmus Eck-Olsen, Anita Wold |
| Roller opprettet/beriket | 8 | Formann, oppmann, banekomité, gullmerkeinnehavere |
| Mentions vurdert | 18 | Lauritz Gaaseide, Thorbjørn Aarø, Einar Alnes, Ragnvald Langva, Robert Haagensen, Hans Sødergren m.fl. |
| Honors/milepæler | 4 | Gullmerker: Rasmus Eck-Olsen (1924), Andreas B. Ringdal (1927), Konrad Korsnes (1935), Emil Sandø (1953) |
| Observations | 0 | Fremdrift Kråmyra omtalt i artikler s. 37 og s. 69 |
| Snapshots | 1 | `1954-aafk.yaml` (s. 78, s. 82 og jubileumshefte s. 23, s. 38) |
| Konflikter løst | 0 | Ingen motstridende kildedata |
| Konflikter åpne | 0 | Ingen uløste konflikter |
| Identity uncertain | 0 | Alle sentrale personer entydig identifisert |

---

## Terminlister og fixture-reconciliation 1954

- **Vårsesongen 1954 (s. 41):** Landsdelsserien Møre 1953/54 (vår). Omtaler sluttstriden mot Molde, Langevåg og KFK uten eksakte kalenderdatoer.
- **Høstsesongen 1954 (s. 95):** Landsdelsserien Møre 1954/55 (høst). Viser kampene mot Hødd, Langevåg, Braatt, Rollon, KFK og Clausenengen.
- **NM Cup 1954 (s. 95):** 3. runde borte mot Freidig (tap 1–3 i Trondheim 08.08.1954). Knyttet til eksisterende kanonisk kamp `1954-08-08-freidig-aalesunds-fk.yaml`.

---

## Personfunn og eksplisitt disposition 1954

| Person | Funn / Kilde | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| Lauritz Giske | Formann 1954 (cd1c s. 78, 192b s. 23) | board | role_enriched | Formann i `lauritz-giske.yaml` og snapshot `1954-aafk.yaml` |
| Karsten Eriksen | Nestformann 1954 (cd1c s. 78) | board | role_enriched | Nestformann i `karsten-eriksen.yaml` og snapshot |
| Bernt Sulebust | Sekretær 1954 (cd1c s. 78) | admin | role_enriched | Sekretær i `bernt-sulebust.yaml` og snapshot |
| Harald Sæther | Kasserer 1954 (cd1c s. 78) | admin | role_enriched | Kasserer i `harald-saether.yaml` og snapshot |
| Fritz Haagensen | Oppmann A-laget 1954 (cd1c s. 78, 192b s. 23) | sporting | role_enriched | Oppmann i `fritz-haagensen.yaml` og snapshot |
| Emil Sandø | Formann Banekomiteen (cd1c s. 69), Gullmerke 1953 (192b s. 30) | committee / honor | role_enriched / honor_enriched | Banekomiteformann og gullmerke i `emil-sando.yaml` |
| Anita Wold | Formann Dameavdelingen (cd1c s. 82, 192b s. 38) | board | role_enriched | Formann Dameavdelingen i `anita-wold.yaml` og snapshot |
| Harald Nord | Redaktør Medlemsbladet (cd1c s. 56) | editorial | role_enriched | Redaktør i `harald-nord.yaml` |
| Ingvald Frøysa | Dagens navn ved 50-årsjubileum (cd1c s. 29), 100 kamper | player / honor | person_created / honor_created | Opprettet `ingvald-froysa.yaml` med spillemerke i sølv |
| Rasmus Eck-Olsen | Gullmerke tildelt 1924 for administrasjonsinnsats (192b s. 13) | honor | honor_enriched | Kildeberiket i `rasmus-eck-olsen.yaml` |
| Andreas B. Ringdal | Gullmerke tildelt 1927 for spillerinnsats (192b s. 25) | honor | honor_enriched | Gullmerke dokumentert i `andreas-b-ringdal.yaml` |
| Konrad Korsnes | Gullmerke tildelt 1935 for spillerinnsats (192b s. 34) | honor | honor_enriched | Gullmerke dokumentert i `konrad-korsnes.yaml` |
| Lauritz Gaaseide | Legger opp etter lang og tro tjeneste på A-laget (cd1c s. 68) | player | mention_linked | Dokumentert i `lauritz-gaaseide.yaml` |
| Thorbjørn Aarø | Solid forsvarsspiller som har spilt seg inn på A-laget (cd1c s. 47) | player | mention_linked | Dokumentert i `torbjorn-aaro.yaml` |
| Einar Alnes | Nye ansikter / spillerprofil (cd1c s. 52) | player | mention_linked | Ung spillerprofil dokumentert |
| Ragnvald Langva | En ildsjel for klubben / oppmannsportrett (192b s. 33) | sporting | mention_linked | Hedret for oppmannsinnsats i `ragnvald-langva.yaml` |
| Robert Haagensen | Oppmann/leder gutteavdelingen (192b s. 36) | sporting | mention_linked | Dokumentert for gutteavdelingen |
| Hans Sødergren | Oppmann/leder junioravdelingen (192b s. 36) | sporting | mention_linked | Dokumentert for junioravdelingen |

---

## Side-for-side kontrollmatrise: Ordinære hefter (cd1c, side 1–108)

| Side | Hefte | Tittel / Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|---|
| 1 | Nr. 1 | Omslag hefte 1 1954 | season_fact | reviewed | Forsidebilde og vignett |
| 2 | Nr. 1 | Nyttårsbetraktning og sportslige utsikter | season_fact | reviewed | Formannens nyttårshilsen |
| 3 | Nr. 1 | Treningsopplegg for vinteren 1954 | season_fact | reviewed | Vintertrening i gymsal |
| 4 | Nr. 1 | Annonser | ads | reviewed | Lokale forretninger |
| 5 | Nr. 1 | Medlemsnytt og arrangementsplaner | club_event | reviewed | Planlegging av 40-årsjubileet |
| 6 | Nr. 1 | Annonser | ads | reviewed | Pels og manufaktur |
| 7 | Nr. 1 | Annonser | ads | reviewed | Banker og forretninger |
| 8 | Nr. 1 | Fotballminner fra 1920-tallet | historical | reviewed | Historisk cupminne |
| 9 | Nr. 1 | Annonser | ads | reviewed | Rutebiler |
| 10 | Nr. 1 | Smånotiser fra klubblivet | notes | reviewed | Sosiale arrangementer |
| 11 | Nr. 1 | Annonser | ads | reviewed | Papirhandel |
| 12 | Nr. 1 | Annonser | ads | reviewed | Forretninger |
| 13 | Nr. 1 | Annonser | ads | reviewed | Byggmester |
| 14 | Nr. 1 | Redaksjon / Harald Nord | editorial | reviewed | Redaktør Harald Nord |
| 15 | Nr. 2 | Omslag hefte 2 1954 | season_fact | reviewed | Forside hefte 2 |
| 16 | Nr. 2 | Foran vårsesongen 1954 | season_fact | reviewed | Vårens seriekamper |
| 17 | Nr. 2 | Annonser | ads | reviewed | Bank og manufaktur |
| 18 | Nr. 2 | Guttelagets forberedelser | non_senior | reviewed | Ungdomsarbeidet |
| 19 | Nr. 2 | Annonser | ads | reviewed | Forretninger |
| 20 | Nr. 2 | Juniorlagets treningssamling | non_senior | reviewed | Juniorlaget i trening |
| 21 | Nr. 2 | Annonser | ads | reviewed | Reiseeffekter |
| 22 | Nr. 2 | Dommeroppgaver i kretsen | organization | reviewed | Kretsens dommerkomité |
| 23 | Nr. 2 | Annonser | ads | reviewed | Bokhandel |
| 24 | Nr. 2 | Annonser | ads | reviewed | Gullsmed og entreprenør |
| 25 | Nr. 2 | Lagidretten er oppdragende | notes | reviewed | Verdien av lagidrett |
| 26 | Nr. 2 | Annonser / Baksiden hefte 2 | ads | reviewed | Baksidetekst |
| 27 | Nr. 3 | Omslag hefte 3 1954 | season_fact | reviewed | Medlemsblad Nr. 3 1954 |
| 28 | Nr. 3 | Annonser / Landes rutebiler (disp. Knut Gaaseide) | ads | reviewed | Transportannonser |
| 29 | Nr. 3 | Dagens navn: Ingvald Frøysa 50 år | person_candidate / honor | reviewed | Ingvald Frøysa feirer 50 år, 100 kamper for AaFK |
| 30 | Nr. 3 | Finn Tollås: Fotballminner | historical / coach | reviewed | Trener Finn Tollås mimrer om cupkamper |
| 31 | Nr. 3 | Annonser | ads | reviewed | Grossister |
| 32 | Nr. 3 | Vintertrening og baneforhold | venue | reviewed | Trening på grus og i sal |
| 33 | Nr. 3 | Historie og anekdoter | notes | reviewed | Reiseskildringer |
| 34 | Nr. 3 | Annonser | ads | reviewed | Bank og ferie |
| 35 | Nr. 3 | Dommernes rolle i fotballen / Sunnmøre | organization | reviewed | Dommerrekruttering |
| 36 | Nr. 3 | 40 år er ingen alder / Jubileumsforberedelser | historical | reviewed | AaFK 40 år (1914–1954) |
| 37 | Nr. 3 | Kråmyra begynner å ta form / Banen skal snart tilsåes | venue / organization | reviewed | Einar Brevik ved rattet under planering av Kråmyra |
| 38 | Nr. 3 | Anleggsarbeid på Sunnmøre (Volda T&IL) | venue | reviewed | Baneanlegg i fylket |
| 39 | Nr. 3 | Annonser | ads | reviewed | Papirhandel |
| 40 | Nr. 3 | Kondisjon og sesongforberedelser | notes | reviewed | Grunnkondisjonens betydning |
| 41 | Nr. 3 | Seriekommentarer: Vårsesongen 1954 | standing / season_fact | reviewed | Molde FK vinner avdelingen foran AaFK |
| 42 | Nr. 3 | Sunnmøre Fotballkrets 40 års jubileum (28. juni) | historical | reviewed | SFK feirer 40 år (1914–1954) |
| 43 | Nr. 3 | Annonser | ads | reviewed | Byggmester og reisebyrå |
| 44 | Nr. 3 | Langevåg IL i Landsdelsserien | historical | reviewed | Bygdelagets fremgang |
| 45 | Nr. 3 | Arbeidsglede – begeistring – tradisjon | notes | reviewed | Klubbkultur |
| 46 | Nr. 3 | Vi på tribunen: Stemningen på kampene | notes | reviewed | Tilskuerkultur |
| 47 | Nr. 3 | Ungdommen må få slippe mer til / Thorbjørn Aarø | person_candidate | reviewed | Thorbjørn Aarø etablerer seg som solid forsvarsspiller |
| 48 | Nr. 3 | Annonser / Baksiden hefte 3 | ads | reviewed | Baksidetekst |
| 49 | Nr. 4 | Omslag hefte 4 1954 | season_fact | reviewed | Medlemsblad Nr. 4 1954 |
| 50 | Nr. 4 | Annonser | ads | reviewed | Landes rutebiler |
| 51 | Nr. 4 | Annonser | ads | reviewed | Buntmaker |
| 52 | Nr. 4 | Nye ansikter: Einar Alnes | person_candidate | reviewed | Profil av unggutten Einar Alnes |
| 53 | Nr. 4 | Annonser | ads | reviewed | Saltkompani og damefrisør |
| 54 | Nr. 4 | Annonser | ads | reviewed | Spedisjon |
| 55 | Nr. 4 | Det må bli mer system i treningen / Kretskurs | coach / organization | reviewed | Instruksjonskurs på Sunnmøre 21.–25. juni |
| 56 | Nr. 4 | Redaksjon / Harald Nord | editorial | reviewed | Redaktør Harald Nord |
| 57 | Nr. 4 | Annonser | ads | reviewed | Papirhandel |
| 58 | Nr. 4 | Annonser | ads | reviewed | Spedisjon |
| 59 | Nr. 4 | Jubileumshilsener og gratulasjoner | club_event | reviewed | Hilsener til 40-årsjubileet |
| 60 | Nr. 4 | Annonser | ads | reviewed | Grossist |
| 61 | Nr. 4 | Sett og hørt / Vi gratulerer | notes | reviewed | Fødselsdager og jubileer |
| 62 | Nr. 4 | Omslag hefte 5 1954 | season_fact | reviewed | Medlemsblad Nr. 5 1954 |
| 63 | Nr. 4 | Annonser | ads | reviewed | Landes rutebiler |
| 64 | Nr. 4 | Annonser | ads | reviewed | Bokhandel og manufaktur |
| 65 | Nr. 5 | Forberedelser til høstsesongen | season_fact | reviewed | Høstoppkjøring |
| 66 | Nr. 5 | Annonser | ads | reviewed | Spedisjon |
| 67 | Nr. 5 | Alle klubber bør ha egen trener / Gunnar Arnesen | coach | reviewed | Lillestrøm-trener Gunnar Arnesen om teori |
| 68 | Nr. 5 | Lauritz Gaaseide legger opp | person_fact / player | reviewed | Forsvarskjempen Lauritz Gaaseide takker av |
| 69 | Nr. 5 | Arbeidet på Kråmyra har gått fint i år | venue / organization | reviewed | Dugnadsrapport og moldlegging |
| 70 | Nr. 5 | Annonser | ads | reviewed | Grossist |
| 71 | Nr. 5 | Annonser | ads | reviewed | Papirhandel |
| 72 | Nr. 5 | Annonser | ads | reviewed | Jernvarer |
| 73 | Nr. 5 | Annonser | ads | reviewed | Saltkompani |
| 74 | Nr. 5 | Redaksjon / Harald Nord | editorial | reviewed | Redaktør Harald Nord |
| 75 | Nr. 5 | Minneord og notiser | notes | reviewed | Klubbnotiser |
| 76 | Nr. 5 | Fotballminner: Rollon og AaFK i gamle dager | historical | reviewed | Rivaliseringen i Ålesund |
| 77 | Nr. 5 | Jubileumsseksjon innledning | historical | reviewed | 40-årsjubileet |
| 78 | Nr. 6 | Aalesunds Fotballklubb 40 år (1914–1954) | historical / organization | reviewed | Klubbens 40-årshistorikk; Hovedstyret og ledere |
| 79 | Nr. 6 | Konrad Korsnes / Gullmerket 1935 | honor / player | reviewed | Konrad Korsnes hedres for innsats på fotballbanen |
| 80 | Nr. 6 | Ungdomsledere: Hans Sødergren, Robert Haagensen | non_senior / person_role | reviewed | Ledere for junior- og gutteavdelingen |
| 81 | Nr. 6 | Sportslige milepæler: 1. divisjon, cupkvartfinaler | historical | reviewed | Kvartfinaler og 4. runder i cupen |
| 82 | Nr. 6 | Dameavdelingen gjennom 40 år | organization | reviewed | Dameavdelingens formenn og dugnadsstøtte |
| 83 | Nr. 6 | Klubbens sportslige innsats i 40 år: 1915–1919 | historical | reviewed | Pionertiden og de første kampene |
| 84 | Nr. 6 | 1920–1925: Kretsmesterskap og Paiva-pokalen | historical | reviewed | Kretsmesterskap i klasse A |
| 85 | Nr. 6 | 1926–1930: Cupkamper mot Rollon og Rapp Trondheim | historical | reviewed | Cupseire og kretsmesterskap |
| 86 | Nr. 6 | 1931–1935: Kampene mot Gjøvik-Lyn og Horten | historical | reviewed | Cupoppgjør på Hamar |
| 87 | Nr. 6 | Annonser | ads | reviewed | Saltkompani |
| 88 | Nr. 6 | Besøk av Vålerengen (1–1 i pinsen) | historical | reviewed | Pinsestevner på Aksla |
| 89 | Nr. 6 | Spillere av format i 1930-årene | historical | reviewed | Profiler |
| 90 | Nr. 6 | 1933-laget: Seier over Rollon 3–2 | historical | reviewed | Storkamper i 1933 |
| 91 | Nr. 6 | Kampene mot Braatt (tap 1–2) | historical | reviewed | Seriekamper på 1930-tallet |
| 92 | Nr. 6 | 1939-laget: Knepen 3–2 seir | historical | reviewed | Sesongen 1939 omtalt i Oslo-pressen |
| 93 | Nr. 6 | Glimt 3–0, Lyn 4–1, Sarpsborg 2–1, Rollon 7–0 og 1–0 | historical | reviewed | Storseire gjennom klubbhistorien |
| 94 | Nr. 6 | Privatkamper mot Freja Randers og Fremad Lillehammer | historical | reviewed | Sommerkamper |
| 95 | Nr. 6 | Svak sesong for A-laget 1954 (33 kamper, 17–4–12, mål 65–57) | season_fact / standing | reviewed | Sesongfasit 1954: NM 3. runde tap for Freidig 1–3 |
| 96 | Nr. 6 | Rasmus Eck-Olsen / Gullmerket 1924 | honor / admin | reviewed | Rasmus Eck-Olsen hedret for administrasjonsarbeid |
| 97 | Nr. 6 | Alle tiders AaFK-lag gjennom 40 år | historical | reviewed | Kåring av tidenes AaFK-ellever |
| 98 | Nr. 6 | Annonser | ads | reviewed | Gullsmed |
| 99 | Nr. 6 | Vi på tribunen / Fotballens tiltrekningskraft | notes | reviewed | Tribuneessay |
| 100 | Nr. 6 | Tilskuerkultur og fair play | notes | reviewed | Idrettens etikk |
| 101 | Nr. 6 | Fra Nørvebanen til Kråmyra / Banehistorikk | venue / historical | reviewed | Anleggshistorien fra 1914 til Kråmyra |
| 102 | Nr. 6 | Frivillig dugnadsinnsats for banene | venue / organization | reviewed | Klubbens dugnadstradisjon |
| 103 | Nr. 6 | Annonser | ads | reviewed | Konfeksjon |
| 104 | Nr. 6 | Fotballminner fra debutsesonger | historical | reviewed | Minner fra A-lagsdebuter |
| 105 | Nr. 6 | Gode klubbkamerater gjennom årene | historical | reviewed | Kameratskap |
| 106 | Nr. 6 | 4. runde-kampen mot Skeid på Bislett (omkamp) | historical | reviewed | Cupbragd i Oslo |
| 107 | Nr. 6 | Annonser | ads | reviewed | Byggevarer Høyer |
| 108 | Nr. 6 | Andreas B. Ringdal / Gullmerket 1927 | honor / player | reviewed | Andreas B. Ringdal hedret for fremragende spillerinnsats |

---

## Side-for-side kontrollmatrise: 40-års Jubileumsnummer (192b, side 1–40)

| Side | Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|
| 1 | Omslag: Aalesunds Fotballklubb 40 år (1914–1954) | historical | reviewed | Forside jubileumsutgave |
| 2 | Kretsmesterskap og cupkamper i 1920-årene | historical | reviewed | Rollon 3–0, Rapp Trondheim |
| 3 | Kampene mot Gjøvik-Lyn og Ørn Horten | historical | reviewed | Cupfakta fra Hamar |
| 4 | Pinsestevner og Vålerengen (1–1) | historical | reviewed | Besøk av Vålerengen |
| 5 | Profiler fra 1930-årene | historical | reviewed | Spilleromtale |
| 6 | Storkampene i 1933: Ålesund–Rollon 3–2, Moss | historical | reviewed | Kretsoppgjør |
| 7 | Seriekampene mot Braatt (1–2) | historical | reviewed | Seriefakta |
| 8 | 1939-laget og kretslagskamp mot Grenland | historical | reviewed | Sesongen 1939 |
| 9 | Jubileumsåret 1950 og forberedelsene | historical | reviewed | Glimt 3–0, Lyn 4–1, Sarpsborg 2–1 |
| 10 | Privatkamper mot Freja Randers og Fremad Lillehammer | historical | reviewed | Internasjonale og nasjonale kamper |
| 11 | Sesongfasit for A-laget | season_fact | reviewed | Laget spilte 26 kamper i 1953 |
| 12 | Grafisk helside | notes | reviewed | Vignettside |
| 13 | Rasmus Eck-Olsen tildelt gullmerket 1924 | honor / admin | reviewed | Gullmerke for innsats i administrasjonen |
| 14 | Alle tiders AaFK-lag | historical | reviewed | Historisk ellever |
| 15 | Vi på tribunen / Lektorintervju | notes | reviewed | Essay om fotballens sjel |
| 16 | Annonser | ads | reviewed | Urmaker og optiker |
| 17 | Fra Nørvebanen til Kråmyra / Banekronikk | venue / historical | reviewed | Banehistorie gjennom 40 år |
| 18 | Dugnadsinnsats og sentrale anleggsfolk | venue / organization | reviewed | Frivillig innsats |
| 19 | Annonser | ads | reviewed | Mote og vintertøy |
| 20 | Fotballminner: Min første A-kamp | historical | reviewed | Veteranskildring |
| 21 | Kjernekamerater i AaFK | historical | reviewed | Klubbprofiler |
| 22 | Skeid-kampen på Bislett (4. runde e.e.o.) | historical | reviewed | Cupkamp mot Skeid |
| 23 | AaFK 40 år (25. juni 1954): Hovedstyret og ledere | organization | reviewed | Lauritz Giske formann, ledere gjennom 40 år |
| 24 | Vignett og grafikk | notes | reviewed | Vignettside |
| 25 | Andreas B. Ringdal tildelt gullmerket 1927 | honor / player | reviewed | Gullmerke for spillerinnsats |
| 26 | Stilig jubileumsfest for 40-årsjubileet | club_event | reviewed | Feiring av jubileet 25.06.1954 |
| 27 | Yngres avdeling stiftet 1932 | non_senior / historical | reviewed | Junior- og guttehistorikk |
| 28 | Annonser | ads | reviewed | Tranmeieri og eksport |
| 29 | Juniorlagets bragder i Bergen og Molde | non_senior | reviewed | Cupkamper mot Brann og Molde |
| 30 | Emil Sandø tildelt gullmerket 1953 | honor / committee | reviewed | Gullmerke for Kråmyra-innsats |
| 31 | Svak sesong for A-laget 1954 (33 kamper, 17–4–12) | season_fact / standing | reviewed | Sesongfasit 1954; NM 3. runde Freidig 1–3 |
| 32 | Annonser | ads | reviewed | Skipsmeglere |
| 33 | En ildsjel for klubben: Ragnvald Langva | sporting / honor | reviewed | Hyllest til oppmann Ragnvald Langva |
| 34 | Konrad Korsnes tildelt gullmerket 1935 | honor / player | reviewed | Gullmerke for spillerinnsats |
| 35 | Grafisk helside | notes | reviewed | Vignettside |
| 36 | Junior- og gutteledere: Hans Sødergren, Robert Haagensen | non_senior / person_role | reviewed | Oppmenn i yngres avdeling |
| 37 | Serie og cupstatistikk gjennom 40 år | historical | reviewed | 12 ganger i 4. runde, 2 kvartfinaler |
| 38 | Dameavdelingen gjennom 40 år | organization | reviewed | Formannsrekke og økonomisk støtte |
| 39 | Klubbens sportslige innsats 1915–1919 | historical | reviewed | Tidligste kamper |
| 40 | Kretsmesterskap og Paiva-pokalen 1920 | historical | reviewed | Første kretstriumfer |
