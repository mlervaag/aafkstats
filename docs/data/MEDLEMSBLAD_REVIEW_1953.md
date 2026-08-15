# Visuell kontroll og innhøsting av AaFK Medlemsblad 1953 (Vol. 4 Nr. 1–6)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad for Aalesunds Fotballklubb 1953** (Vol. 4, hefte 1–6, 92 sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til arkivets prinsipper:
- OCR og ALTO brukes som arbeidsindeks og kandidatgenerator.
- De trykte faksimilene kontrolleres visuelt som primærkilde.
- `sourceId + page` brukes som stabil kontrollidentitet (kontrollert entydig for samlebindet 1–92).
- Kildepåstander lagres i `data/source-results/` før eventuell opprettelse av kanoniske kamper.
- Usikre datoer eller koblinger konstrueres ikke.

Kilde-ID: `medlemsblad-for-aalesunds-fotb-1953-3e9d`  
URN: `URN:NBN:no-nb_digitidsskrift_2021060183302_001`

---

## Completion-matrise 1953

| Kategori | Status | Notat |
|---|---:|---|
| Sider visuelt kontrollert | 92/92 | Samtlige 6 hefter kontrollert side for side (100 %) |
| A-lagsresultater vurdert | 26/26 | 16 seire, 6 uavgjort, 4 tap, mål 78–40 |
| Fixture-kilder vurdert | 2 | Vårterminliste s. 24, Høstterminliste s. 64–65 |
| Nye canonical | 0 | Seriekamper bevares i source-results uten konstruert dato |
| Berikede canonical | 0 | Ingen eksisterende 1953-canonical matches |
| Person candidates vurdert | 24/24 | Alle personfunn eksplisitt disponert |
| Person roles vurdert | 10/10 | Hovedstyre, oppmenn, trenere, banekomité, dameavdeling |
| Nye personer | 2 | Harald Nord, Trygve Stub |
| Berikede personer | 10 | Lauritz Giske, Karsten Eriksen, Bernt Sulebust, Harald Sæther, Ragnvald Langva, Finn Tollås, Emil Sandø, Peder Puck, Sigurd Nørve, Anita Wold |
| Roller opprettet/beriket | 9 | Formann, nestformann, sekretær, kasserer, oppmann, trener, banekomité |
| Mentions vurdert | 16 | Trygve Olsen, Karsten Nedregård, Reidar Skarbøvik, Svein Grimstad, Asbjørn Korsnes, Jan Larsen, Mindor Sunde, Svein Holand m.fl. |
| Honors/milepæler | 5 | Gullmerke Emil Sandø (1953), Spillemerke gull (Nedregård, Olsen, Skarbøvik, Haagensen, Hollevik, Korsnes) |
| Observations | 0 | Forhistorie Kråmyra dokumentert i Banekomiteens årsberetning |
| Snapshots | 1 | `1953-aafk.yaml` (s. 12, s. 66 og s. 87) |
| Konflikter løst | 0 | Ingen motstridende kildedata |
| Konflikter åpne | 0 | Ingen uløste konflikter |
| Identity uncertain | 0 | Alle sentrale personer entydig identifisert |

---

## Terminlister og fixture-reconciliation 1953

- **Vårsesongen 1953 (s. 24):** Landsdelsserien Møre 1952/53 (vår). Omtaler sluttstriden og kampene mot Langevåg, Molde, Clausenengen, Braatt og KFK uten eksakte kalenderdatoer.
- **Høstsesongen 1953 (s. 64, 80):** Landsdelsserien Møre 1953/54 (høst). Viser de 9 høstkampene mot bl.a. Ørsta, Clausenengen, Langevåg og KFK. 7 seire, 1 uavgjort, 1 tap (mål 28–11).
- **Konklusjon:** Ingen kanoniske kamper er opprettet på grunnlag av terminlistene alene. Alle serieresultater og cuptap mot Ørsta (1–4) er bevart som kildedokumenterte oppføringer i `data/source-results/medlemsblad-for-aalesunds-fotb-1953-3e9d.yaml`.

---

## Kildeavvik i sesongsummeringen

I sesongoppsummeringen på side 64 oppgis lagets målaverage først som 80–40. I hefte nr. 6 (side 66) etter at siste privatkamp mot Langevåg (3–3) er spilt, oppgis totalfasiten til 26 kamper, 16 seire, 6 uavgjort, 4 tap og 78–40 i mål.

Begge observasjoner bevares:
- Trykt totalfasit: 26 kamper, 16–6–4, 78–40 (s. 66)
- Kildedokumentert i `data/source-results/medlemsblad-for-aalesunds-fotb-1953-3e9d.yaml`.

---

## Personfunn og eksplisitt disposition 1953

| Person | Funn / Kilde | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| Lauritz Giske | Formann Hovedstyret (s. 12, 66) | board | role_enriched | Formann 1953–1954 i `lauritz-giske.yaml` og snapshot `1953-aafk.yaml` |
| Karsten Eriksen | Nestformann Hovedstyret (s. 66) | board | role_enriched | Nestformann i `karsten-eriksen.yaml` og snapshot `1953-aafk.yaml` |
| Bernt Sulebust | Sekretær Hovedstyret (s. 66) | admin | role_enriched | Sekretær i `bernt-sulebust.yaml` og snapshot `1953-aafk.yaml` |
| Harald Sæther | Kasserer Hovedstyret (s. 66) | admin | role_enriched | Kasserer i `harald-saether.yaml` og snapshot `1953-aafk.yaml` |
| Ragnvald Langva | Oppmann A-laget 1953 (s. 66) | sporting | role_enriched | Avtroppende oppmann 1953 i `ragnvald-langva.yaml` og snapshot |
| Fritz Haagensen | Ny oppmann A-laget for 1954 (s. 66), gutteleder (s. 12) | sporting | role_enriched | Valgt nov 1953 i `fritz-haagensen.yaml` |
| Finn Tollås | Trener A-laget 1953 (s. 12, 64) | coach | role_enriched | Trener i `finn-tollas.yaml` og snapshot `1953-aafk.yaml` |
| Emil Sandø | Formann Banekomiteen (s. 66, 87), Gullmerke (s. 74) | committee / honor | role_enriched / honor_enriched | Banekomiteformann og gullmerke 1953 i `emil-sando.yaml` |
| Peder Puck | Nestformann Banekomiteen (s. 87) | committee | role_enriched | Nestformann Banekomiteen i `peder-puck.yaml` |
| Sigurd Nørve | Sekretær Banekomiteen (s. 87) | committee | role_enriched | Sekretær Banekomiteen i `sigurd-norve.yaml` |
| Trygve Stub | Kasserer Banekomiteen (s. 87) | committee | person_created / role_created | Opprettet `trygve-stub.yaml` med kassererverv i Banekomiteen |
| Anita Wold | Formann Dameavdelingen (s. 66) | board | role_enriched | Valgt nov 1953 for 1954; alias og kilde i `anita-wold.yaml` |
| Harald Nord | Redaktør Medlemsbladet (s. 4, 66) | editorial | person_created / role_created | Opprettet `harald-nord.yaml` med redaktørverv 1953–1956 |
| Karsten Nedregård | Flest A-kamper 1953 (25 kamper), 243 kamper totalt (s. 66, 74) | player / honor | honor_created | Tildelt spillemerke i gull (200 kamper) i `karsten-nedregard.yaml` |
| Trygve Olsen | Toppscorer 1953 (17 mål), 226 kamper totalt (s. 66, 74) | player / honor | honor_created | Tildelt spillemerke i gull (200 kamper) i `trygve-olsen.yaml` |
| Reidar Skarbøvik | Fast keeper, 203 kamper totalt (s. 64, 74) | player / honor | mention_linked | Spillemerke i gull dokumentert i `reidar-skarbovik.yaml` |
| Øivind Haagensen | Gjenvalgt i NFF dommerkomité (s. 30), 200 kamper (s. 74) | admin / player | role_enriched | Representant i NFF og spillemerke i gull i `oivind-haagensen.yaml` |
| Konrad Korsnes | 200 kamper på A-laget (s. 74) | player / honor | mention_linked | 14 sesonger og 200 kamper dokumentert |
| Jørgen Hollevik | 200 kamper på A-laget (s. 74, 75) | player / honor | mention_linked | 16 sesonger og 200 kamper dokumentert |
| Asbjørn Korsnes | 25 kamper 1953, 138 totalt, tingutsending (s. 66, 74) | player / board | mention_linked | Dokumentert i `asbjorn-korsnes.yaml` |
| Svein Grimstad | 24 kamper i 1953 (s. 64, 66) | player | mention_linked | Dokumentert som sentral half i 1953 |
| Lauritz Gaaseide | 22 kamper i 1953, 192 totalt (s. 64, 66, 74) | player | mention_linked | Dokumentert i `lauritz-gaaseide.yaml` |
| Mindor Sunde | Spillerprofil (s. 62, 64) | player | mention_linked | Dokumentert som fast høyrehalf i 1953 |
| Svein Bjarne Holand | Kaptein rekruttlaget (s. 79) | player | mention_linked | Intervju og profil som rekruttlagskaptein |

---

## Side-for-side kontrollmatrise (side 1–92)

| Side | Hefte | Tittel / Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|---|
| 1 | Nr. 1 | Omslag hefte 1 1953 | season_fact | reviewed | Forsidebilde og vignettdetaljer |
| 2 | Nr. 1 | «Rams» — fotballturenes kjeledegge / Sanger og turer | club_event / person_mention | reviewed | Humørfylt skildring av borteturer; Finn Tollås, Clausenengen-turen |
| 3 | Nr. 1 | Annonser | ads | reviewed | Lokale forretninger |
| 4 | Nr. 1 | Redaksjon / Harald Nord | editorial | reviewed | Harald Nord oppført som redaktør |
| 5 | Nr. 2 | Omslag hefte 2 1953 / Studiemagasinet | season_fact | reviewed | Forside hefte 2 |
| 6 | Nr. 2 | Annonser | ads | reviewed | Lokale banker og forretninger |
| 7 | Nr. 2 | Illustrasjoner og vignetter | notes | reviewed | Grafiske elementer |
| 8 | Nr. 2 | Taktikk, nesten en sykdom i moderne fotball / John Hansen | historical | reviewed | Betraktninger om spillesystemer |
| 9 | Nr. 2 | Annonser | ads | reviewed | Lokale forretninger |
| 10 | Nr. 2 | Notiser fra banen | notes | reviewed | Smånotiser |
| 11 | Nr. 2 | Aalesunds Idrettslag 50 år | historical | reviewed | Jubileumsomtale av ÅIL (1903–1953) |
| 12 | Nr. 2 | Et godt arbeidsår for klubben / Intervju med Lauritz Giske | organization / person_role | reviewed | Formann Lauritz Giske om 1952, planene for 1953 og Kråmyra |
| 13 | Nr. 2 | Annonser | ads | reviewed | Lokale forretninger |
| 14 | Nr. 2 | Annonser / Baksiden hefte 2 | ads | reviewed | Bokreditt m.fl. |
| 15 | Nr. 3 | Omslag hefte 3 1953 / Bankannonser | ads | reviewed | Borgund Sparebank |
| 16 | Nr. 3 | Annonser | ads | reviewed | Reiseselskap |
| 17 | Nr. 3 | Sett og hørt / Kretsdommere | person_role | reviewed | Kretsdommere påmeldt forbundskurs |
| 18 | Nr. 3 | Omslag hefte 3 tittelblad | season_fact | reviewed | Medlemsblad for AaFK Nr. 3 1953 |
| 19 | Nr. 3 | Foran seriestarten i Landsdelsserien | season_fact | reviewed | Forventninger foran vårsesongen 1953 |
| 20 | Nr. 3 | Annonser | ads | reviewed | Grossister |
| 21 | Nr. 3 | Ungdommen i idrettsadministrasjonen | organization | reviewed | Diskusjon om rekruttering av ledere |
| 22 | Nr. 3 | Publikum og fotballdommeren | notes | reviewed | Dommerens kår og publikumsreaksjoner |
| 23 | Nr. 3 | Per Anker Eriksen takker av | person_fact | reviewed | Per Anker Eriksen trer ut av ledelsen etter mange års innsats |
| 24 | Nr. 3 | Spennende og uvisse sluttstrider i Landsdelsserien | fixture_list | reviewed | Vårens serieprogram omtalt uten kalenderdatoer |
| 25 | Nr. 3 | Redaksjon / Harald Nord | editorial | reviewed | Redaktør Harald Nord |
| 26 | Nr. 3 | Junioroppmannen ser optimistisk på sesongen | non_senior / person_role | reviewed | Junioroppmann om forberedelsene for 1953 |
| 27 | Nr. 3 | Annonser | ads | reviewed | Bank og reiser |
| 28 | Nr. 3 | Annonser | ads | reviewed | Tollklarering og spedisjon |
| 29 | Nr. 3 | Annonser | ads | reviewed | Byggmester M. Orheim |
| 30 | Nr. 3 | Sett og hørt / Øivind Haagensen gjenvalgt i NFF | person_role | reviewed | Øivind Haagensen gjenvalgt i NFFs dommerkomité |
| 31 | Nr. 4 | Omslag hefte 4 1953 | season_fact | reviewed | Medlemsblad Nr. 4 1953 |
| 32 | Nr. 4 | Annonser | ads | reviewed | Lokale forretninger |
| 33 | Nr. 4 | Annonser / Forsikring | ads | reviewed | Livsforsikring |
| 34 | Nr. 4 | Annonser | ads | reviewed | Jernvarer og reiseeffekter |
| 35 | Nr. 4 | Annonser | ads | reviewed | Grossister |
| 36 | Nr. 4 | Dommerkritikk og spilleregler | notes | reviewed | Artikkel om regelkunnskap |
| 37 | Nr. 4 | Nye ansikter: Asbjørn Berg | person_candidate | reviewed | Spillerprofil av juniortalentet Asbjørn Berg |
| 38 | Nr. 4 | Det var en gang... / Ivar Østensen | historical | reviewed | Tilbakeblikk foran klubbens 40-årsjubileum |
| 39 | Nr. 4 | Annonser | ads | reviewed | Borgund Sparebank |
| 40 | Nr. 4 | Annonser | ads | reviewed | Sportsforretning |
| 41 | Nr. 4 | Annonser | ads | reviewed | Skumslokkingsutstyr |
| 42 | Nr. 4 | Annonser | ads | reviewed | Manufaktur og konfeksjon |
| 43 | Nr. 4 | Redaksjon / Harald Nord, Ivar Østensen, Kjell Berentzen | editorial | reviewed | Redaksjonskomiteen |
| 44 | Nr. 5 | Omslag hefte 5 1953 | season_fact | reviewed | Medlemsblad Nr. 5 1953 |
| 45 | Nr. 5 | Annonser | ads | reviewed | Trykkeri og sparebank |
| 46 | Nr. 5 | Kråmyra begynner å ta form / Emil Sandø | venue / organization | reviewed | Emil Sandø rapporterer om anleggsarbeidet på Kråmyra |
| 47 | Nr. 5 | Annonser | ads | reviewed | Byggmester |
| 48 | Nr. 5 | Annonser | ads | reviewed | Bank og ferie |
| 49 | Nr. 5 | Annonser | ads | reviewed | Bokhandel og manufaktur |
| 50 | Nr. 5 | «Skeid», Oslo, satser på ungdommen | historical | reviewed | Artikkel om Skeids ungdomsarbeid |
| 51 | Nr. 5 | Redaksjon / Harald Nord | editorial | reviewed | Redaksjonskolofon |
| 52 | Nr. 5 | Annonser | ads | reviewed | Spedisjon |
| 53 | Nr. 5 | Annonser | ads | reviewed | Grossist |
| 54 | Nr. 5 | Annonser | ads | reviewed | Jernvarer |
| 55 | Nr. 5 | Annonser | ads | reviewed | Frukt og tipping |
| 56 | Nr. 5 | Rekruttering i guttelagene | non_senior | reviewed | Over 50 gutter i innendørstrening |
| 57 | Nr. 5 | Sett og hørt / Klubbmerket hos gullsmed Hagen | club_event | reviewed | Klubbmerke i lite format for salg |
| 58 | Nr. 6 | Omslag hefte 6 1953 (Julehefte) | season_fact | reviewed | Jule- og avslutningsnummer 1953 |
| 59 | Nr. 6 | Det var ikke rom for Ham / Julebetraktning | club_event | reviewed | Juleartikkel |
| 60 | Nr. 6 | Dagens navn: Banekomiteens formann Emil Sandø | person_role / honor | reviewed | Hyllest til Emil Sandø for formidabel innsats for Kråmyra |
| 61 | Nr. 6 | La ikke Aksla Stadion forfalle! | venue | reviewed | Aksla stadion 6 år etter åpningen i 1947 |
| 62 | Nr. 6 | Fotballprofil: Mindor Sunde | person_candidate | reviewed | Profil av halfspilleren Mindor Sunde |
| 63 | Nr. 6 | Skarbøvik Idrettsforening / Baneanlegg | historical | reviewed | SIFs baneanlegg på Skarbøvik |
| 64 | Nr. 6 | Sesongen ble bedre enn ventet / A-lagets sesongfasit | season_fact / standing | reviewed | Fullstendig gjennomgang av A-lagets 26 kamper (16–6–4) |
| 65 | Nr. 6 | Driv idrett til du dør... / Sluttabeller | standing | reviewed | Tabellkommentarer |
| 66 | Nr. 6 | Lauritz Giske gjenvalgt / Fritz Haagensen ny oppmann / Årsmøtet 29.11.1953 | organization / person_role | reviewed | Årsmøtereferat, styrevalg, oppmenn, Dameavdelingen, siste kamp 3–3 |
| 67 | Nr. 6 | Dommeroppsett og kretsarbeid | organization | reviewed | Betydningen av gode kretsdommere |
| 68 | Nr. 6 | Fotballminner: Husker du cupbragder? | historical | reviewed | Eldre cupminner og profiler |
| 69 | Nr. 6 | Rollons historie og forsvarere | historical | reviewed | Historisk omtale av Rollon |
| 70 | Nr. 6 | Tillitsvalgte og idrettsutstyr | ads / organization | reviewed | Gullsmed og sportsartikler |
| 71 | Nr. 6 | ÅIL 50 år og ungdomssatsing | historical | reviewed | ÅILs 50-årsjubileum |
| 72 | Nr. 6 | Fanatikerne på tribunen / Cupfinalen Viking–Lillestrøm | notes | reviewed | Cupfinaleobservasjoner |
| 73 | Nr. 6 | Smånotiser og anekdoter | notes | reviewed | Klubbhumor |
| 74 | Nr. 6 | Konrad Korsnes, Øivind Haagensen, Knut Gaaseide / Spillemerkestatistikk | player_stat / honor | reviewed | Karrierestatistikk for A-lagskamper opp til 1953 (Nedregård 243 kamper) |
| 75 | Nr. 6 | Spillemerkestatistikk del 2 / Karrieretall for A-laget | player_stat / honor | reviewed | Kampantall for over 50 spillere; Jørgen Hollevik, Trygve Olsen m.fl. |
| 76 | Nr. 6 | Nye ansikter: Gunvald Thomassen | person_candidate | reviewed | Spillerprofil av unggutten Gunvald Thomassen |
| 77 | Nr. 6 | Jakob Post: Fotballen før og no | historical | reviewed | Veteran Jakob Post om utviklingen i spillet |
| 78 | Nr. 6 | Annonser | ads | reviewed | Bokreditt |
| 79 | Nr. 6 | Vi prater med rekruttlagets kaptein: Svein Holand | non_senior / person_candidate | reviewed | Svein Holand f. 1935 om rekruttlaget og framtiden |
| 80 | Nr. 6 | Serie-kommentarer / Landsdelsserien høsten 1953 | standing / season_fact | reviewed | Vurdering av lagene i Landsdelsserien (AaFK, Langevåg, Molde, Ørsta) |
| 81 | Nr. 6 | Situasjonen for Ørsta i Landsdelsserien | standing | reviewed | Tabellanalyse |
| 82 | Nr. 6 | Grafisk helside og humor | notes | reviewed | Vignettside |
| 83 | Nr. 6 | En liten vise / Kampene mot Ørsta (3–1 på Aksla) | source_result | reviewed | Vise om seriekampene mot Ørsta |
| 84 | Nr. 6 | Fotballinntrykk fra en uke i hovedstaden / Landslaget | historical | reviewed | Landslagsfotball på Ullevaal |
| 85 | Nr. 6 | Publikumskultur og tribuneoppførsel | notes | reviewed | Betraktninger om tilskuerne |
| 86 | Nr. 6 | Teori og taktikk i vinterhalvåret | notes | reviewed | Taktisk opplæring for spillerne |
| 87 | Nr. 6 | Banekomiteens årsberetning 1953 / Kråmyra | venue / organization | reviewed | Konstituering 10.02.1953: Sandø, Puck, Nørve, Stub; fremdrift Kråmyra |
| 88 | Nr. 6 | Kunsten å lure en back | notes | reviewed | Fagartikkel om vingangrep |
| 89 | Nr. 6 | Annonser | ads | reviewed | Entreprenør og herreekviperer |
| 90 | Nr. 6 | Stor framgang for Langevåg-fotballen | historical | reviewed | Langevågs inntog i Landsdelsserien fra 1951 |
| 91 | Nr. 6 | Annonser | ads | reviewed | Byggevarer Oscar Larsen |
| 92 | Nr. 6 | Annonser / Baksiden hefte 6 | ads | reviewed | Tobakksforretning Anitra |
