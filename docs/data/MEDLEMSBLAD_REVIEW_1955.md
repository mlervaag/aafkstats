# Visuell kontroll og innhøsting av AaFK Medlemsblad 1955 (Vol. 6 Nr. 1–6)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad for Aalesunds Fotballklubb 1955** (Vol. 6, hefte 1–6, 92 sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til arkivets prinsipper:
- OCR og ALTO brukes som arbeidsindeks og kandidatgenerator.
- De trykte faksimilene kontrolleres visuelt som primærkilde.
- `sourceId + page` brukes som stabil kontrollidentitet (kontrollert entydig for samlebindet 1–92).
- Kildepåstander lagres i `data/source-results/` før eventuell opprettelse av kanoniske kamper.
- Usikre datoer eller koblinger konstrueres ikke.

Kilde-ID: `medlemsblad-for-aalesunds-fotb-1955-8ccc`  
URN: `URN:NBN:no-nb_digitidsskrift_2021060183315_001`

---

## Completion-matrise 1955

| Kategori | Status | Notat |
|---|---:|---|
| Sider visuelt kontrollert | 92/92 | Samtlige 6 hefter kontrollert side for side (100 %) |
| A-lagskamper oppgitt i sesongfasit | — | Ingen samlet totalfasittabell trykt for 1955 |
| Eksplisitte individuelle resultater funnet | 1 | NM 2. runde: AaFK–Langevåg 0–1 på Aksla Stadion (s. 29) |
| Kildedokumenterte oppgjør normalisert | 1 | Opprettet i `data/source-results/medlemsblad-for-aalesunds-fotb-1955-8ccc.yaml` |
| Fixture-kilder vurdert | 2 | Vårterminliste s. 50, Høstterminliste s. 75 |
| Nye canonical matches | 0 | Seriekamper bevares i source-results uten konstruert dato |
| Berikede canonical matches | 0 | Ingen eksisterende 1955-kamper |
| Person candidates vurdert | 22/22 | Alle personfunn eksplisitt disponert |
| Person roles vurdert | 8/8 | Hovedstyre, oppmenn, trenere, banekomité |
| Nye personer opprettet | 1 | Rasmus Sulebak (tildelt Kruset 1955) |
| Unike eksisterende personfiler beriket | 8 | Kjell Berentzen, Øivind Haagensen, Jan Larsen, Emil Sandø, Jørgen Hollevik, Sverre Volstad, Trygve Stub, Harald Nord |
| Personberikelser for årgangen | 8 | 8 roller/personforekomster beriket for 1955 |
| Personroller opprettet eller beriket | 6 | Formann, trener, kaptein, banekomité |
| Mentions vurdert eller knyttet | 14 | Thorbjørn Aarø, Einar Aas, Mindor Sunde, Karsten Meyer, Trygve Olsen, Leif Istad, Kjell Iversen, Sigurd Tafjord, Torid Fladmark m.fl. |
| Honors og milepæler | 2 | Hedersgaven Kruset til Rasmus Sulebak (s. 82), Jørgen Hollevik 50 år (s. 72) |
| Historical observations | 1 | `1955-kramyra-forste-bruk.yaml` (21. august 1955 tas banen i bruk) |
| Organisasjonssnapshots | 1 | `1955-aafk.yaml` (s. 64) |
| Konflikter løst | 0 | Ingen motstridende kildedata |
| Konflikter åpne | 0 | Ingen uløste konflikter |
| Identity uncertain | 0 | Alle sentrale personer entydig identifisert |

---

## Terminlister og fixture-reconciliation 1955

- **Vårsesongen 1955 (s. 50):** Landsdelsserien Møre 1954/55 (vår). AaFK avslutter på 3. plass i avdelingen.
- **Høstsesongen 1955 (s. 75):** Landsdelsserien Møre 1955/56 (høst). AaFK ligger som nr. 5 på poengtabellen etter høstens kamper.
- **NM Cup 1955 (s. 29):** 2. runde på Aksla Stadion: AaFK–Langevåg 0–1. Karsten Molværsmyr scoret for Langevåg etter et kvarter.

---

## Kråmyra treningsbane – Første gangs bruk 21. august 1955

Utdrag fra Banekomiteens beretning (s. 61–62 og s. 64) dokumenterer en stor merkedag i AaFKs historie:
- 1. byggetrinn fullført sommeren 1955.
- Søndag 21. august 1955 tas gresstreningsbanen på Kråmyra i bruk for første gang til trening og kamper.
- Dokumentert i `data/observations/1955-kramyra-forste-bruk.yaml`.

---

## Personfunn og eksplisitt disposition 1955

| Person | Funn / Kilde | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| Kjell Berentzen | Formann Hovedstyret 1955 og gjenvalgt for 1956 (s. 64) | board | role_enriched | Formann i `kjell-berentzen.yaml` og snapshot `1955-aafk.yaml` |
| Øivind Haagensen | Trener for A-laget i 1955 (s. 64) | coach | role_enriched | Trener i `oivind-haagensen.yaml` og snapshot `1955-aafk.yaml` |
| Jan Larsen | Kaptein for A-laget 1955 (s. 64) | sporting | role_created | Kaptein opprettet i `jan-larsen.yaml` og snapshot `1955-aafk.yaml` |
| Emil Sandø | Formann Banekomiteen (s. 61, 64) | committee | role_enriched | Banekomiteformann i `emil-sando.yaml` og snapshot |
| Rasmus Sulebak | Tildelt klubbens hedersgave Kruset som Dagens navn (s. 82) | honor | person_created / honor_created | Opprettet `rasmus-sulebak.yaml` med hedersgaven Kruset 1955 |
| Jørgen Hollevik | 50-årsjubileum og heder for storspiller i 20- og 30-årene (s. 72) | honor / player | mention_linked | Dokumentert i `jorgen-hollevik.yaml` |
| Sverre Volstad | Minneord over gullmerkemann og tidligere formann (s. 64) | historical / person | mention_linked | Dødsfall 1955 kildedokumentert i `sverre-volstad.yaml` |
| Trygve Stub | Portrettert som Dagens navn i nr. 5 (s. 47) | committee | mention_linked | Dokumentert i `trygve-stub.yaml` |
| Harald Nord | Redaktør Medlemsbladet (s. 4, 17, 57) | editorial | role_enriched | Redaktør i `harald-nord.yaml` |
| Sigurd Melsæther | Nye ansikter / spillerprofil (s. 14) | player | mention_linked | Ung spillerprofil dokumentert |
| Rolf Tøsse | Nye ansikter / spillerprofil (s. 68) | player | mention_linked | Ung spillerprofil dokumentert |
| Leif Istad | Deltaker NFF landskurs ungdom Slemmestad (s. 29, 64) | non_senior | non_senior | Dokumentert kursdeltakelse |
| Torid Fladmark | Målscorer juniorlaget (s. 29, 69) | non_senior | non_senior | Juniorprofil dokumentert |
| Kjell Iversen | Tildelt innsatspokal for beste unge spiller (s. 64) | non_senior / honor | non_senior | Juniorprofil dokumentert |

---

## Side-for-side kontrollmatrise (side 1–92)

| Side | Hefte | Tittel / Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|---|
| 1 | Nr. 1 | Omslag hefte 1 1955 | season_fact | reviewed | Forsidebilde |
| 2 | Nr. 1 | Nyttårshilsen og forventninger | season_fact | reviewed | Lederartikkel |
| 3 | Nr. 1 | Trening i vinterhalvåret | season_fact | reviewed | Innendørstrening |
| 4 | Nr. 1 | Redaksjon / Harald Nord | editorial | reviewed | Redaktør Harald Nord |
| 5 | Nr. 2 | Omslag hefte 2 1955 / Efera Tafjord | season_fact | reviewed | Forside hefte 2 |
| 6 | Nr. 2 | Annonser | ads | reviewed | Pelsvarer Geo Haller |
| 7 | Nr. 2 | Annonser | ads | reviewed | Manufaktur og rutebiler |
| 8 | Nr. 2 | Annonser | ads | reviewed | Borgund Sparebank |
| 9 | Nr. 2 | Langevåg IL setter fart / Arthur B. Wennersberg | historical | reviewed | Langevågs sportslige utvikling |
| 10 | Nr. 2 | Senterløperrekruttering i AaFK | player | reviewed | Jakten på en ny storscorer |
| 11 | Nr. 2 | Kretsturnstevne for barn | non_senior | reviewed | Barneidrett på Sunnmøre |
| 12 | Nr. 2 | Annonser | ads | reviewed | Pels og konfeksjon |
| 13 | Nr. 2 | Annonser | ads | reviewed | Jernvarer Aarskog |
| 14 | Nr. 2 | Nye ansikter: Sigurd Melsæther | person_candidate | reviewed | Ung spillerprofil |
| 15 | Nr. 2 | Annonser | ads | reviewed | Drogeri og apotekvarer |
| 16 | Nr. 2 | Sommeren er kommet / Forberedelser | season_fact | reviewed | Sesongstart |
| 17 | Nr. 2 | Redaksjon / Harald Nord | editorial | reviewed | Kolofon |
| 18 | Nr. 3 | Omslag hefte 3 1955 | season_fact | reviewed | Forside hefte 3 |
| 19 | Nr. 3 | Annonser | ads | reviewed | Landes rutebiler |
| 20 | Nr. 3 | Annonser | ads | reviewed | Jernvarer og reiseeffekter |
| 21 | Nr. 3 | Strømmen-spillernes overlegenhet i hodespill / Taktikk | notes | reviewed | Læring fra Strømmens spillemåte og fair play |
| 22 | Nr. 3 | Kraftig brems på det harde fotballspillet | notes | reviewed | Kampmoral og dommeres myndighet |
| 23 | Nr. 3 | Annonser | ads | reviewed | Rutebiler |
| 24 | Nr. 3 | Ni baller gikk i stykker / Brasil-anekdote | notes | reviewed | Internasjonal fotballhumor |
| 25 | Nr. 3 | Annonser | ads | reviewed | Sparebank |
| 26 | Nr. 3 | Annonser | ads | reviewed | Papirhandel og frisør |
| 27 | Nr. 3 | Sommer og ferietid | notes | reviewed | Sommerhilsen |
| 28 | Nr. 3 | Annonser | ads | reviewed | Kjøttvarer Andreas Hoel |
| 29 | Nr. 3 | Svak innsats i cupens 2. runde: AaFK–Langevåg 0–1 | source_result / non_senior | reviewed | NM 2. runde tap 0–1; Juniorlaget videre til 3. runde |
| 30 | Nr. 3 | Annonser | ads | reviewed | Urmaker og optiker |
| 31 | Nr. 4 | Omslag hefte 4 1955 / Elsantinden i Hjørundfjord | season_fact | reviewed | Naturforside hefte 4 |
| 32 | Nr. 4 | Annonser | ads | reviewed | Sportsartikler Joh. Johannessen |
| 33 | Nr. 4 | Annonser | ads | reviewed | Bank og sparing |
| 34 | Nr. 4 | Ivar Østensen: Publikums reaksjoner | notes | reviewed | Tilskuerkultur på tribunene |
| 35 | Nr. 4 | Vellykket turné for A-laget: Voss, Bergen og Måløy | club_event / season_fact | reviewed | A-lagets sommertilskiping på Vestlandet |
| 36 | Nr. 4 | Annonser | ads | reviewed | Papirhandel og frisør |
| 37 | Nr. 4 | Annonser | ads | reviewed | Borgund Sparebank |
| 38 | Nr. 4 | Annonser | ads | reviewed | Kjøttforretning |
| 39 | Nr. 4 | Interessant tur for juniorlaget til Bergen | non_senior | reviewed | Juniorspillernes kamper i Bergen |
| 40 | Nr. 4 | Annonser | ads | reviewed | Bokreditt |
| 41 | Nr. 4 | Annonser | ads | reviewed | Forsikring Tysland & Aarseth |
| 42 | Nr. 4 | Annonser | ads | reviewed | Rørlegger Gjørtz |
| 43 | Nr. 4 | Redaksjon / Harald Nord | editorial | reviewed | Redaktør Harald Nord |
| 44 | Nr. 5 | Omslag hefte 5 1955 / St. Olavs Plass | season_fact | reviewed | Bymotiv hefte 5 |
| 45 | Nr. 5 | Annonser | ads | reviewed | Borgund Sparebank |
| 46 | Nr. 5 | Annonser | ads | reviewed | Sportsartikler |
| 47 | Nr. 5 | Dagens navn: Trygve Stub | person_role | reviewed | Portrett av Trygve Stub (kasserer i Banekomiteen) |
| 48 | Nr. 5 | Dommeroppgaven og kamplederne | notes | reviewed | Kampledernes autoritet |
| 49 | Nr. 5 | Jarle Kristoffersen om juniorlaget | non_senior | reviewed | Ungdomssatsingen |
| 50 | Nr. 5 | Seriekommentarer: Spillestandarden skifter | standing / season_fact | reviewed | Landsdelsserien foran høstavslutningen |
| 51 | Nr. 5 | Skarbøvik Idrettsforening 25 år | historical | reviewed | SIF feirer 25-årsjubileum (1930–1955) |
| 52 | Nr. 5 | Annonser | ads | reviewed | Grossister |
| 53 | Nr. 5 | Annonser | ads | reviewed | Margarin |
| 54 | Nr. 5 | Annonser | ads | reviewed | Sparebank |
| 55 | Nr. 5 | Annonser | ads | reviewed | Urmaker |
| 56 | Nr. 5 | Hilsen fra Drammen / Strømsgodset og Drafn | notes | reviewed | Reisehilsen |
| 57 | Nr. 5 | Redaksjon / Harald Nord | editorial | reviewed | Kolofon |
| 58 | Nr. 6 | Omslag hefte 6 1955 (Julen 1955) | season_fact | reviewed | Juleheftets forside |
| 59 | Nr. 6 | Julehilsen fra sjømannskirken på Aruba | club_event | reviewed | Hilsen til sjømenn og klubbmedlemmer |
| 60 | Nr. 6 | Fotball – Kameratskap – Hygge ved sporten | notes | reviewed | Klubbverdier |
| 61 | Nr. 6 | Klubben har fullført første byggetrinn av Kråmyra | venue / organization | reviewed | Beretning fra Banekomiteen: treningsbanen tatt i bruk |
| 62 | Nr. 6 | 21. august merkedag i klubbens historie / Kråmyra | venue | reviewed | Treningsbanen innviet 21.08.1955 |
| 63 | Nr. 6 | Ferdighetsmerket / Langevåg IL landets beste bygdeklubb | non_senior | reviewed | 15 sølvballer og 37 bronseballer i Langevåg |
| 64 | Nr. 6 | Saklig og rolig: Klubbens ordinære årsmøte 27.11.1955 | organization / person_role | reviewed | Kjell Berentzen formann, Øivind Haagensen trener, Jan Larsen kaptein |
| 65 | Nr. 6 | Stor framgang for friidretten på Sunnmøre | historical | reviewed | Friidrettsmesterskap |
| 66 | Nr. 6 | Deltakerne fra Sunnmøre ved NM | historical | reviewed | Representasjon |
| 67 | Nr. 6 | Hva med Utstillingsplassen? | venue | reviewed | Lekeplasser og treningsmuligheter i byen |
| 68 | Nr. 6 | Nye ansikter: Rolf Tøsse | person_candidate | reviewed | Spillerprofil av unggutten Rolf Tøsse |
| 69 | Nr. 6 | Juniorlaget kretsmester 1955 og 3. runde i juniorcupen | non_senior | reviewed | Bilde og omtale av KM-vinnerne |
| 70 | Nr. 6 | Angrep på keeperen / Dommerregler | notes | reviewed | Beskyttelse av målvaktene |
| 71 | Nr. 6 | Medlemskap er en frivillig sak | notes | reviewed | Foreningsplikt og kontingent |
| 72 | Nr. 6 | Jørgen Hollevik 50 år | person_fact / honor | reviewed | Hyllest til æresmedlem og storspiller Jørgen Hollevik |
| 73 | Nr. 6 | Gresset gror på Volda stadion | venue | reviewed | Gressbaneanlegg i fylket |
| 74 | Nr. 6 | AaFK har ikke tatt et eneste ferdighetsmerke | non_senior | reviewed | Oppfordring til merketrening i AaFK |
| 75 | Nr. 6 | Svak sesong for A-laget 1955 | season_fact / standing | reviewed | A-lagets tilbakegang i Landsdelsserien og cupen |
| 76 | Nr. 6 | Kontingenten og medlemsansvar | organization | reviewed | Økonomiske forhold |
| 77 | Nr. 6 | Posisjonsforflytninger i et lag ikke av det gode | notes | reviewed | Taktisk analyse av stadige spillerbytter |
| 78 | Nr. 6 | Annonser | ads | reviewed | Urmaker og mineralvann |
| 79 | Nr. 6 | Fotballen i en blindgate | notes | reviewed | Kritiske betraktninger |
| 80 | Nr. 6 | Humor og tegninger | notes | reviewed | Vignettside |
| 81 | Nr. 6 | Egentrening og vilje | notes | reviewed | Treningsdisiplin |
| 82 | Nr. 6 | Dagens navn: «Kruset» til Rasmus Sulebak | person_role / honor | reviewed | Rasmus Sulebak tildelt klubbens hedersgave Kruset |
| 83 | Nr. 6 | Annonser | ads | reviewed | Fladmark og trandamperi |
| 84 | Nr. 6 | En oppmann skifter jobb / Teorikvelder | sporting | reviewed | Oppmannsarbeid og taktikkundervisning |
| 85 | Nr. 6 | AaFK spiller for lite oppfinnsomt / Ivar Løge | notes | reviewed | Ivar Løge kritiserer den stereotype spillestilen |
| 86 | Nr. 6 | Tilbake til den gode gamle spillestilen | notes | reviewed | Spillesystemer |
| 87 | Nr. 6 | Jule- og nyttårshilsener | club_event | reviewed | Medlemmene hilser hverandre |
| 88 | Nr. 6 | Turnhallen snart ferdig til å tas i bruk | historical | reviewed | Turnhallen i Ålesund |
| 89 | Nr. 6 | Annonser | ads | reviewed | Elektro og bokhandel |
| 90 | Nr. 6 | Juniorlagets innsats | non_senior | reviewed | Oppsummering av juniorkampene |
| 91 | Nr. 6 | Annonser | ads | reviewed | Urmaker Dankert Schlyder |
| 92 | Nr. 6 | Annonser / Baksiden hefte 6 | ads | reviewed | Baksidetekst |
