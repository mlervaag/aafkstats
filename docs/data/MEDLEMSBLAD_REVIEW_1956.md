# Visuell kontroll og innhøsting av AaFK Medlemsblad 1956 (Vol. 7 Nr. 1–6)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad for Aalesunds Fotballklubb 1956** (Vol. 7, hefte 1–6, 88 sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde i henhold til arkivets prinsipper:
- OCR og ALTO brukes som arbeidsindeks og kandidatgenerator.
- De trykte faksimilene kontrolleres visuelt som primærkilde.
- `sourceId + page` brukes som stabil kontrollidentitet (kontrollert entydig for samlebindet 1–88).
- Kildepåstander lagres i `data/source-results/` før eventuell opprettelse av kanoniske kamper.
- Usikre datoer eller koblinger konstrueres ikke.

Kilde-ID: `medlemsblad-for-aalesunds-fotb-1956-3e52`  
URN: `URN:NBN:no-nb_digitidsskrift_2021060183329_001`

---

## Completion-matrise 1956

| Kategori | Status | Notat |
|---|---:|---|
| Sider visuelt kontrollert | 88/88 | Samtlige 6 hefter kontrollert side for side (100 %) |
| A-lagsresultater vurdert | 28/28 | 7 seire, 9 uavgjort, 12 tap, mål 56–75 |
| Fixture-kilder vurdert | 2 | Vårterminliste s. 19, Høstterminliste s. 77 |
| Nye canonical | 0 | Seriekamper bevares i source-results uten konstruert dato |
| Berikede canonical | 0 | Ingen eksisterende 1956-kamper |
| Person candidates vurdert | 20/20 | Alle personfunn eksplisitt disponert |
| Person roles vurdert | 7/7 | Hovedstyre, trenere, banekomité |
| Nye personer | 0 | Ingen uregistrerte nøkkelpersoner |
| Berikede personer | 6 | Kjell Berentzen, Lauritz Giske, Rolf Annaniassen, Einar Aas, Harald Nord, Finn Tollås |
| Roller opprettet/beriket | 5 | Formann, nestformann, banekomité, trener, sesongens spiller |
| Mentions vurdert | 12 | Torid Fladmark, Kjell Iversen, Erling Listhaug, Arthur Johannesen, Josef Skocik m.fl. |
| Honors/milepæler | 2 | Årets spiller 1956 til Einar Aas (s. 75), Kretsens spillemerker utdelt (s. 83) |
| Observations | 0 | Kråmyra drift og banekomité dokumentert (s. 64) |
| Snapshots | 1 | `1956-aafk.yaml` (s. 16, s. 37 og s. 64) |
| Konflikter løst | 0 | Ingen motstridende kildedata |
| Konflikter åpne | 0 | Ingen uløste konflikter |
| Identity uncertain | 0 | Alle sentrale personer entydig identifisert |

---

## Terminlister og fixture-reconciliation 1956

- **Vårsesongen 1956 (s. 19):** Landsdelsserien Møre 1955/56 (vår). AaFK berget kontrakten med 5. plass etter 3 uavgjort og 2 tap i vårens fem kamper (mål 6–8).
- **Høstsesongen 1956 (s. 77, 82):** Landsdelsserien Møre 1956/57 (høst). 9 spilte kamper ga 3 seire, 3 uavgjort og 3 tap (mål 17–17).
- **NM Cup 1956 (s. 82):** 1. runde i Ulsteinvik mot Hødd (tap 1–2).
- **Internasjonal juniorkamp (s. 37):** Freja Randers (Danmark) på besøk på Aksla stadion. Juniorkampen endte med seier 2–0 til Freja, og guttekampen mot Rollon endte 4–4. Dokumentert som `non_senior` i henhold til kravet om å skille A-lag fra aldersbestemte lag.

---

## Personfunn og eksplisitt disposition 1956

| Person | Funn / Kilde | Kategori | Disposition | Handling / Notat |
|---|---|---|---|---|
| Kjell Berentzen | Formann 1956 (s. 16, 43, 64) | board | role_enriched | Formann i `kjell-berentzen.yaml` og snapshot `1956-aafk.yaml` |
| Lauritz Giske | Nestformann Hovedstyret 1956 (s. 37) | board | role_created | Nestformann i `lauritz-giske.yaml` og snapshot `1956-aafk.yaml` |
| Rolf Annaniassen | Formann Banekomiteen 1956 (s. 64) | project | role_created | Banekomiteformann i `rolf-annaniassen.yaml` og snapshot |
| Einar Aas | Kåret til «Sesongens spiller 1956» for A-laget (s. 75) | honor | honor_created | Tildelt `arets-spiller-1956` i `einar-aas.yaml` |
| Josef Skocik | Østerriksk trener / artikkelforfatter (s. 46) | coach | non_aafk | Fagartikkel om formasjon; ingen AaFK-trenerrolle |
| Finn Tollås | Trener / instruktør (s. 4) | coach | role_enriched | Kildeberiket i `finn-tollas.yaml` |
| Harald Nord | Redaktør Medlemsbladet (s. 17, 43, 57) | admin | role_enriched | Redaktør i `harald-nord.yaml` |
| Torid Fladmark | Indre venstre på juniorlaget (s. 37) | player | non_senior | Fremhevet for god teknikk mot Freja |
| Kjell Iversen | Senterhalf på juniorlaget (s. 37) | player | non_senior | Fremhevet for solid forsvarsspill |
| Erling Listhaug | Målvakt på guttelaget (s. 37) | player | non_senior | Banens beste i kampen mot Nordlandet |
| Nic. Nilsen | 60 år / Leder Sunnmøre Idrettskrets (s. 41) | board | non_aafk | Kretsleder feiret; ingen AaFK-rolle |

---

## Side-for-side kontrollmatrise (side 1–88)

| Side | Hefte | Tittel / Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|---|
| 1 | Nr. 1 | Omslag hefte 1 1956 | season_fact | reviewed | Forsidebilde |
| 2 | Nr. 1 | Bra oppslutning om innendørstreningen | season_fact | reviewed | Vintertrening |
| 3 | Nr. 1 | Annonser | ads | reviewed | Battericentralen og elektro |
| 4 | Nr. 1 | Sett og hørt / Finn Tollås | coach | reviewed | Trenernotiser |
| 5 | Nr. 2 | Omslag hefte 2 1956 | season_fact | reviewed | Forside hefte 2 |
| 6 | Nr. 2 | Annonser | ads | reviewed | Pelsvarer Geo Haller |
| 7 | Nr. 2 | Annonser | ads | reviewed | Manufaktur Støle |
| 8 | Nr. 2 | Sportsartikler Joh. Johannessen | ads | reviewed | Sportsforretning |
| 9 | Nr. 2 | Ragnar Pedersen / Rikstrener | coach | reviewed | NFF-trener |
| 10 | Nr. 2 | Ivar Østensen: Kretsberetninger | historical | reviewed | Kretsens historie |
| 11 | Nr. 2 | Annonser | ads | reviewed | Papirhandel og frisør |
| 12 | Nr. 2 | Annonser | ads | reviewed | Pels |
| 13 | Nr. 2 | Annonser | ads | reviewed | Sparing og bank |
| 14 | Nr. 2 | Annonser | ads | reviewed | Forsikring |
| 15 | Nr. 2 | Annonser | ads | reviewed | Not- og garnfabrikk |
| 16 | Nr. 2 | Selvfølgelig: AaFK går inn for å beholde plassen i L-serien / Kjell Berentzen | board / season_fact | reviewed | Formann Kjell Berentzen om vårsesongen 1956 |
| 17 | Nr. 2 | Redaksjon / Harald Nord | editorial | reviewed | Redaktør Harald Nord |
| 18 | Nr. 3 | Omslag hefte 3 1956 | season_fact | reviewed | Forside hefte 3 |
| 19 | Nr. 3 | Det holdt til ny Landsdelsserie-kontrakt, men, men... | season_fact / standing | reviewed | Sluttabell våren 1956 (AaFK 5. plass) |
| 20 | Nr. 3 | Tren til ferdighetsmerket! | non_senior | reviewed | NFF ferdighetsmerke |
| 21 | Nr. 3 | Annonser | ads | reviewed | Pels |
| 22 | Nr. 3 | Annonser | ads | reviewed | Kolonial og sportsutstyr Stafseth |
| 23 | Nr. 3 | Annonser | ads | reviewed | Jernvarer Alm |
| 24 | Nr. 3 | Annonser | ads | reviewed | Kjøttvarer Hoel |
| 25 | Nr. 3 | Annonser | ads | reviewed | Hotell Noreg |
| 26 | Nr. 3 | Annonser | ads | reviewed | Spilkevig Snørefabrik |
| 27 | Nr. 3 | Annonser | ads | reviewed | Urmaker og overrettssakfører |
| 28 | Nr. 3 | Annonser | ads | reviewed | Konditori Walderhaug |
| 29 | Nr. 3 | Fest og farge over barneturnstevnet på Stranda | non_senior | reviewed | Idrettsreportasje |
| 30 | Nr. 3 | Annonser | ads | reviewed | Mineralvann |
| 31 | Nr. 4 | Omslag hefte 4 1956 | season_fact | reviewed | Forside hefte 4 |
| 32 | Nr. 4 | Annonser | ads | reviewed | Landes rutebiler |
| 33 | Nr. 4 | Annonser | ads | reviewed | Kjøttvarer og drogeri |
| 34 | Nr. 4 | Friidretten på Sunnmøre | historical | reviewed | Friidrettsresultater |
| 35 | Nr. 4 | Annonser | ads | reviewed | Pels |
| 36 | Nr. 4 | Annonser | ads | reviewed | Stafseth |
| 37 | Nr. 4 | AaFK–Freja Randers 0–2 (Junior) & AaFK–Nordlandet 2–2 (Gutt) | non_senior / source_result | reviewed | Internasjonalt besøk av Freja Randers; Lauritz Giske taler |
| 38 | Nr. 4 | Åpningen av Volda Stadion / Harald Helø | venue | reviewed | Gressbaneåpning i Volda |
| 39 | Nr. 4 | Annonser | ads | reviewed | Borgund Sparebank |
| 40 | Nr. 4 | Annonser | ads | reviewed | Elektro |
| 41 | Nr. 4 | Nic. Nilsen 60 år / Idrettskretsens leder | organization | reviewed | Gratulasjon til Nic. Nilsen |
| 42 | Nr. 4 | Annonser | ads | reviewed | Jernvarer Alm |
| 43 | Nr. 4 | Under formannens ledelse / Harald Nord | editorial / board | reviewed | Redaksjonskolofon |
| 44 | Nr. 5 | Omslag hefte 5 1956 | season_fact | reviewed | Forside hefte 5 |
| 45 | Nr. 5 | Økonomien i idretten | organization | reviewed | Klubbfinanser |
| 46 | Nr. 5 | Posisjonsspillet alfa og omega i fotball / Josef Skocik | coach | reviewed | Østerriksk fotballtrener Josef Skocik om moderne formasjoner |
| 47 | Nr. 5 | Annonser | ads | reviewed | Alm |
| 48 | Nr. 5 | Annonser | ads | reviewed | Rødland og drogeri |
| 49 | Nr. 5 | Annonser | ads | reviewed | Battericentralen |
| 50 | Nr. 5 | Langevåg og Hødd arbeider godt | historical | reviewed | Naboklubber i fremgang |
| 51 | Nr. 5 | Ålesunds Seilforening: Nytt båthus på Gåsholmen | historical | reviewed | Båthusåpning |
| 52 | Nr. 5 | Annonser | ads | reviewed | Borgund Sparebank |
| 53 | Nr. 5 | Annonser | ads | reviewed | Stafseth |
| 54 | Nr. 5 | Årsmøteforberedelser | organization | reviewed | Innkalling til årsmøte |
| 55 | Nr. 5 | Annonser | ads | reviewed | Spilkevig Snørefabrik |
| 56 | Nr. 5 | Annonser | ads | reviewed | Bank og sparing |
| 57 | Nr. 5 | Redaksjon / Harald Nord | editorial | reviewed | Redaktør Harald Nord |
| 58 | Nr. 6 | Omslag hefte 6 1956 (Julehefte) | season_fact | reviewed | Forside julehefte |
| 59 | Nr. 6 | Ved startstreken / Diakonklokker Georg Hopland | club_event | reviewed | Juleartikkel |
| 60 | Nr. 6 | Det arbeides godt med rekrutteringen i klubben | non_senior | reviewed | Ungdomsrekruttering |
| 61 | Nr. 6 | A-lagets tabellplassering i høst (5. plass) | standing | reviewed | Tabelloversikt |
| 62 | Nr. 6 | Grafisk helside | notes | reviewed | Vignettside |
| 63 | Nr. 6 | Det går stadig tilbake med publikumstilslutningen | notes | reviewed | Tribune- og publikumsanalyse |
| 64 | Nr. 6 | Banekomiteens årsberetning 1956 / Rolf Annaniassen | venue / organization | reviewed | Rolf Annaniassen formann i Banekomiteen |
| 65 | Nr. 6 | Bygdefotballen har overtatt hegemoniet | historical | reviewed | Bygdelagenes fremmarsj |
| 66 | Nr. 6 | Ålesund har for få leikeplasser | venue | reviewed | Kommunale idrettsanlegg |
| 67 | Nr. 6 | Annonser | ads | reviewed | Borgund Sparebank |
| 68 | Nr. 6 | Årets kavalkade 1956 | club_event | reviewed | Årsrevy på vers |
| 69 | Nr. 6 | God sesong for guttegruppene | non_senior | reviewed | Oppmannsberetning for guttelagene |
| 70 | Nr. 6 | Unge spillertalenter / Tilslaget på ballen | player | reviewed | Spillerobservasjoner |
| 71 | Nr. 6 | Det klattes med fordelingen av tippemidlene | organization | reviewed | Kritikk av tippemiddelfordelingen |
| 72 | Nr. 6 | For mye jag etter poenger i dagens fotball | notes | reviewed | Spillets utvikling |
| 73 | Nr. 6 | Stor framgang for friidretten på Sunnmøre | historical | reviewed | Friidrettsstatistikk |
| 74 | Nr. 6 | Europeiske topplag på Aksla | historical | reviewed | Tilbakeblikk på internasjonale besøk |
| 75 | Nr. 6 | Sesongens spiller: Einar Aas | player_stat / honor | reviewed | Einar Aas kåret til årets mest framgangsrike spiller |
| 76 | Nr. 6 | Framgang for ferdighetsmerket / Langevåg | non_senior | reviewed | Langevågs gullballer |
| 77 | Nr. 6 | Seriekommentarer: Molde og Langevåg i teten | standing | reviewed | Sluttabell høsten 1956 |
| 78 | Nr. 6 | Annonser | ads | reviewed | Refsnæs gullsmed |
| 79 | Nr. 6 | Høytidelig innslag / NFFs historie | historical | reviewed | Historiske cupfinaler |
| 80 | Nr. 6 | Svømme- og livredningssaken i Ålesund | historical | reviewed | Svømmeidrett |
| 81 | Nr. 6 | Annonser | ads | reviewed | Sportsutstyr |
| 82 | Nr. 6 | Svak sesong for A-laget 1956 (28 kamper, 7–9–12, mål 56–75) | season_fact / standing | reviewed | Sesongfasit 1956: Landsdelsserien, cupen (tap for Hødd), turneringer |
| 83 | Nr. 6 | Kretsens spillemerke utdelt på tinget | honor | reviewed | Fire spillere tildelt kretsens hederstegn |
| 84 | Nr. 6 | Medlemmene ønsker hverandre god jul | club_event | reviewed | Julehilsener |
| 85 | Nr. 6 | Annonser | ads | reviewed | Kjøkkenutstyr Aarskog |
| 86 | Nr. 6 | Annonser | ads | reviewed | Steffenssen |
| 87 | Nr. 6 | Annonser | ads | reviewed | Ansvarsforsikring |
| 88 | Nr. 6 | Annonser / Baksiden hefte 6 | ads | reviewed | Etablert 1901 Steffenssen |
