# Visuell kontroll av SFK-årsrapportene 1960–1969

Denne loggen dokumenterer normaliseringen av AaFKs A-lag fra Sunnmøre Fotballkrets'
årsrapporter 1960–1969. Original PDF-side er kontrollert visuelt og er primærkilde.
OCR er bare brukt som arbeidsindeks. RSSSF er brukt som uavhengig kontrollkilde.

Den stabile kontrollidentiteten er `sourceId + page`. «Kandidat» er en av de 70
maskinelt foreslåtte sidene fra kandidatindeksen. «Weak-only» er en relevant side
som kandidatmotoren ikke tok med fordi siden bare brukte et svakt AaFK-alias,
typisk «Aalesund» eller «Aafk» i løpende tekst/tabell.

Kun senior-A-laget er normalisert her. Reserve, junior, guttelag, smågutt,
kretslag, dommere, tillitsvalgte og øvrige personfunn er eksplisitt utsatt til
egne, senere løp.

## Resultat

- 70 av 70 kandidatsider er visuelt kontrollert (totalt 72 kontrollpunkter på kandidatsidene).
- 11 relevante weak-only-/manuelt oppdagede sider er kontrollert i tillegg.
- Ni nye/oppdaterte hovedseriesesonger (1960–1965, 1967–1969) og ni komplette sluttabeller er normalisert.
- 1966 (golden case) er verifisert mot originalrapporten uten duplisering.
- 38 seniorresultater som ikke kan løftes direkte til nye kanoniske kamper er registrert i `data/source-results/`.
- 12 eksisterende kanoniske kamper (NM, kvalifisering og opprykk) er beriket med SFK-proveniens.
- Ingen usikker kampdato er konstruert eller antatt; eksakte SFK-datoer er registrert strukturert der kilden oppgir dem.

## Kontrollpunkter

| År | Source ID | Side | Treff | Signal | Status | Handling | Notat |
|---:|---|---:|---|---|---|---|---|
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 4 | weak-only | administrasjon, personer | reviewed | person_candidate | Årsberetning, kretssamlinger og instruksjon; utsatt. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 5 | kandidat | serie, sluttabell | reviewed | standing | Full Landsdelsserietabell 1959/60; AaFK nr. 3. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 5 | kandidat | NM | reviewed | source_result | 1. runde NM: Herd–AaFK 3–2 e.o. uten sikker dato; junior-NM utsatt. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 6 | weak-only | serie | reviewed | no_action | 3. og 4. divisjon 1959/60 samt høstterminer; ingen AaFK A-lagsdata. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 7 | kandidat | serie, reserve, junior | reviewed | non_senior | Reservelagsserien (AaFK nr. 2) og Juniorserien (AaFK nr. 2); utsatt. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 8 | weak-only | ungdom | reviewed | non_senior | Gutte-, smågutte- og lilleputtserien; utsatt. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 10 | kandidat | sunnmørscup | reviewed | source_result | Seks kamper i Sunnmørscupen 1960 (AaFK vinner); kretslag og By/Bygd utsatt. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 11 | kandidat | junior, personer | reviewed | person_candidate | Juniorkretslaget og legeundersøkelsen; utsatt. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 13 | kandidat | protester, administrasjon | reviewed | non_senior | Protestsak Vigra/Hareid; ingen AaFK-fakta. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 14 | kandidat | administrasjon, personer | reviewed | person_candidate | Medlemsstatistikk og styreoppsummering; utsatt. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 16 | kandidat | dommere, verv | reviewed | person_candidate | Dommerberetning og dommeroppnevnelser; utsatt. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 17 | weak-only | dommere, verv | reviewed | person_candidate | Kretsdommere og aspiranter; utsatt. |
| 1960 | sunnmore-fotballkrets-arsrapport-1960 | 18 | kandidat | regnskap | reviewed | non_senior | Balanse- og driftsregnskap; ingen A-lagsfakta. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 3 | kandidat | administrasjon, personer, verv | reviewed | person_candidate | Valg av tillitsmenn og styremedlemmer; utsatt. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 4 | kandidat | komiteer, representasjon | reviewed | person_candidate | Komite for yngre serier og representasjon; utsatt. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 5 | weak-only | personer | reviewed | person_candidate | Landslagstrener Wilhelm Kment og kurs; utsatt. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 6 | kandidat | serie, sluttabell | reviewed | standing | Full Landsdelsserietabell 1960/61; AaFK nr. 3. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 6 | kandidat | NM | reviewed | existing_match_enriched | Tre senior-NM-resultater lagret; eksisterende Rosenborg–AaFK beriket med proveniens. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 7 | weak-only | serie | reviewed | no_action | 3. og 4. divisjon høsten 1961; ingen A-lagstabell for AaFK. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 8 | weak-only | reserve | reviewed | non_senior | Reservelagsserien (AaFK nr. 3 i avd. B); utsatt. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 10 | weak-only | sunnmørscup | reviewed | source_result | Valder–AaFK 1–0 i Sunnmørscupen 1961 lagret; kretslag og By/Bygd utsatt. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 11 | kandidat | junior, personer | reviewed | person_candidate | Kandidatlaget 1962 og juniorsamlinger; utsatt. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 14 | kandidat | protester, administrasjon | reviewed | non_senior | Protestsaker (Bergsøy, Guard); ingen AaFK A-lagsfakta. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 15 | kandidat | dommere, verv | reviewed | person_candidate | Dommerkomiteens beretning og aktive dommere; utsatt. |
| 1961 | sunnmore-fotballkrets-arsrapport-1961 | 16 | kandidat | dommere, verv | reviewed | person_candidate | Kretsdommere og dommerjubileer; utsatt. |
| 1962 | sunnmore-fotballkrets-arsrapport-1962 | 3 | kandidat | administrasjon, personer, verv | reviewed | person_candidate | Kretsstyre og administrative verv; utsatt. |
| 1962 | sunnmore-fotballkrets-arsrapport-1962 | 5 | kandidat | personer, representasjon | reviewed | person_candidate | Trenere og representasjon; utsatt. |
| 1962 | sunnmore-fotballkrets-arsrapport-1962 | 6 | kandidat | NM | reviewed | source_result | 1. runde NM: AaFK–Måløy 2–1 uten sikker dato; By/Bygd og kretslag utsatt. |
| 1962 | sunnmore-fotballkrets-arsrapport-1962 | 7 | kandidat | NM | reviewed | existing_match_enriched | NM-kamper mot Freidig, Nidelv og Brann lagret; tre eksisterende kamper beriket. |
| 1962 | sunnmore-fotballkrets-arsrapport-1962 | 8 | kandidat | serie, sluttabell | reviewed | standing | Full Landsdelsserietabell 1961/62 (maratonserien); AaFK nr. 1 og landsdelsmester. |
| 1962 | sunnmore-fotballkrets-arsrapport-1962 | 10 | kandidat | kvalifisering, opprykk | reviewed | existing_match_enriched | Kvalifiseringskamper mot Kvik og Gjøvik-Lyn; eksisterende kamper beriket og returoppgjør lagret. |
| 1962 | sunnmore-fotballkrets-arsrapport-1962 | 12 | kandidat | dommere, verv | reviewed | person_candidate | Dommerkomite og autorisasjoner; utsatt. |
| 1963 | sunnmore-fotballkrets-arsrapport-1963 | 3 | kandidat | administrasjon, personer, verv | reviewed | person_candidate | Kretsting, styre og komiteer; utsatt. |
| 1963 | sunnmore-fotballkrets-arsrapport-1963 | 4 | kandidat | personer, kurs | reviewed | person_candidate | Trenerkurs og instruksjonsarbeid; utsatt. |
| 1963 | sunnmore-fotballkrets-arsrapport-1963 | 6 | kandidat | representasjon, personer | reviewed | person_candidate | Kretslag og By/Bygd; utsatt. |
| 1963 | sunnmore-fotballkrets-arsrapport-1963 | 7 | kandidat | NM | reviewed | source_result | To senior-NM-resultater lagret (Clausenengen 5–1, Hødd 2–5); juniorer utsatt. |
| 1963 | sunnmore-fotballkrets-arsrapport-1963 | 8 | weak-only | serie, sluttabell | reviewed | standing | Full tabell 2. divisjon avd. B 1963; AaFK nr. 7 og nedrykk til 3. divisjon. |
| 1963 | sunnmore-fotballkrets-arsrapport-1963 | 11 | kandidat | dommere, verv | reviewed | person_candidate | Dommerberetning og autorisasjoner; utsatt. |
| 1964 | sunnmore-fotballkrets-arsrapport-1964 | 3 | kandidat | administrasjon, verv | reviewed | non_senior | Kretsens tillitsmenn og komiteer; utsatt. |
| 1964 | sunnmore-fotballkrets-arsrapport-1964 | 4 | kandidat | kurs, personer | reviewed | person_candidate | Trenere og kursdeltakere; utsatt. |
| 1964 | sunnmore-fotballkrets-arsrapport-1964 | 6 | kandidat | NM, serie, sluttabell | reviewed | standing | Full 3. divisjon Møre-tabell (AaFK nr. 3) og to senior-NM-resultater lagret; junior-NM utsatt. |
| 1964 | sunnmore-fotballkrets-arsrapport-1964 | 7 | kandidat | serie, reserve, junior | reviewed | non_senior | Lavere divisjoner, reservelag og juniorserie; utsatt. |
| 1964 | sunnmore-fotballkrets-arsrapport-1964 | 9 | kandidat | representasjon, personer | reviewed | person_candidate | Kretslag og trenere; utsatt. |
| 1964 | sunnmore-fotballkrets-arsrapport-1964 | 11 | kandidat | personer, representasjon | reviewed | person_candidate | Spillere og representasjon; utsatt. |
| 1964 | sunnmore-fotballkrets-arsrapport-1964 | 13 | kandidat | administrasjon, jubileum | reviewed | person_candidate | Kretsens 50-årsjubileumsberetning og junior-NM-omtale; utsatt. |
| 1965 | sunnmore-fotballkrets-arsrapport-1965 | 3 | kandidat | administrasjon, verv | reviewed | non_senior | Kretsting og komiteer; utsatt. |
| 1965 | sunnmore-fotballkrets-arsrapport-1965 | 4 | kandidat | serie, sluttabell, NM | reviewed | standing | Full 3. divisjon Møre-tabell (AaFK nr. 3), to senior-NM lagret og to eksisterende beriket. |
| 1965 | sunnmore-fotballkrets-arsrapport-1965 | 5 | kandidat | serie, reserve, junior | reviewed | non_senior | 4.–6. divisjon, reserve- og juniorserien; utsatt. |
| 1965 | sunnmore-fotballkrets-arsrapport-1965 | 8 | kandidat | kurs, personer | reviewed | person_candidate | Lederkurs og representasjon; utsatt. |
| 1965 | sunnmore-fotballkrets-arsrapport-1965 | 9 | kandidat | dommere, verv | reviewed | person_candidate | Dommerkomite og autorisasjoner; utsatt. |
| 1965 | sunnmore-fotballkrets-arsrapport-1965 | 13 | kandidat | personer, representasjon | reviewed | person_candidate | Kretslag og spillere; utsatt. |
| 1966 | sunnmore-fotballkrets-arsrapport-1966 | 3 | kandidat | administrasjon, verv | reviewed | non_senior | Kretsadministrasjon og komiteer; utsatt. |
| 1966 | sunnmore-fotballkrets-arsrapport-1966 | 4 | kandidat | serie, sluttabell, NM | reviewed | standing | Golden case kontrollert: full 3. div Møre-tabell (AaFK nr. 3) og 3 NM-kamper bekreftet. |
| 1966 | sunnmore-fotballkrets-arsrapport-1966 | 5 | kandidat | serie | reviewed | no_action | 4. og 5. divisjon; ingen A-lagsdata for AaFK. |
| 1966 | sunnmore-fotballkrets-arsrapport-1966 | 7 | kandidat | representasjon, kretslag | reviewed | person_candidate | Kretslag og By/Bygd; utsatt. |
| 1966 | sunnmore-fotballkrets-arsrapport-1966 | 8 | kandidat | kurs, personer | reviewed | person_candidate | Instruksjon og kurs; utsatt. |
| 1966 | sunnmore-fotballkrets-arsrapport-1966 | 9 | kandidat | personer, kurs | reviewed | person_candidate | Trenerkurs og instruktører; utsatt. |
| 1966 | sunnmore-fotballkrets-arsrapport-1966 | 10 | kandidat | serie, reserve, junior | reviewed | non_senior | Reserve- og aldersbestemte tabeller; utsatt. |
| 1966 | sunnmore-fotballkrets-arsrapport-1966 | 12 | kandidat | administrasjon | reviewed | non_senior | Kretsstyrets årsberetning; ingen ny kampfakta. |
| 1966 | sunnmore-fotballkrets-arsrapport-1966 | 13 | kandidat | dommere, verv | reviewed | person_candidate | Dommerkomiteen; utsatt. |
| 1967 | sunnmore-fotballkrets-arsrapport-1967 | 3 | kandidat | administrasjon, verv | reviewed | non_senior | Kretsting og komiteoppnevnelser; utsatt. |
| 1967 | sunnmore-fotballkrets-arsrapport-1967 | 5 | kandidat | NM, opprykk | reviewed | existing_match_enriched | To senior-NM-kamper lagret; to opprykkskvalifiseringskamper mot Falken beriket. |
| 1967 | sunnmore-fotballkrets-arsrapport-1967 | 6 | kandidat | representasjon, personer | reviewed | person_candidate | Kretslag og By/Bygd; utsatt. |
| 1967 | sunnmore-fotballkrets-arsrapport-1967 | 7 | kandidat | kurs, personer | reviewed | person_candidate | Trenerkurs og instruksjon; utsatt. |
| 1967 | sunnmore-fotballkrets-arsrapport-1967 | 10 | kandidat | serie, sluttabell | reviewed | standing | Full 3. divisjon Møre-tabell (AaFK nr. 1 og avdelingsvinner, opprykk til 2. div). |
| 1967 | sunnmore-fotballkrets-arsrapport-1967 | 13 | kandidat | reserve, junior | reviewed | non_senior | Reserve- og juniorserietabeller; utsatt. |
| 1967 | sunnmore-fotballkrets-arsrapport-1967 | 16 | kandidat | dommere, verv | reviewed | person_candidate | Dommerkomiteen og aktive dommere; utsatt. |
| 1967 | sunnmore-fotballkrets-arsrapport-1967 | 17 | kandidat | dommere, kurs | reviewed | person_candidate | Dommerkurs og autorisasjoner; utsatt. |
| 1968 | sunnmore-fotballkrets-arsrapport-1968 | 3 | kandidat | administrasjon, verv | reviewed | non_senior | Kretsting og styresammensetning; utsatt. |
| 1968 | sunnmore-fotballkrets-arsrapport-1968 | 6 | kandidat | NM | reviewed | existing_match_enriched | Fire NM-resultater (VRF og Langevåg inkl. omkamper) lagret; eksisterende Molde-kamp beriket. |
| 1968 | sunnmore-fotballkrets-arsrapport-1968 | 8 | kandidat | kurs, personer | reviewed | person_candidate | Lederkurs og kursdeltakere; utsatt. |
| 1968 | sunnmore-fotballkrets-arsrapport-1968 | 11 | kandidat | administrasjon | reviewed | non_senior | Kretsstyrets årsberetning; ingen ny kampfakta. |
| 1968 | sunnmore-fotballkrets-arsrapport-1968 | 12 | weak-only | serie, sluttabell | reviewed | standing | Full tabell 2. divisjon avd. B 1968; AaFK nr. 2. |
| 1968 | sunnmore-fotballkrets-arsrapport-1968 | 13 | weak-only | reserve, junior | reviewed | non_senior | Reserve- og aldersbestemte serietabeller; utsatt. |
| 1968 | sunnmore-fotballkrets-arsrapport-1968 | 16 | kandidat | dommere, verv | reviewed | person_candidate | Dommerkomiteen og kretsdommere; utsatt. |
| 1969 | sunnmore-fotballkrets-arsrapport-1969 | 3 | kandidat | administrasjon, verv | reviewed | non_senior | Kretsting og styresammensetning; utsatt. |
| 1969 | sunnmore-fotballkrets-arsrapport-1969 | 6 | kandidat | NM | reviewed | source_result | To senior-NM-resultater lagret (Skarbøvik 2–1, Gossen 1–2); juniorer utsatt. |
| 1969 | sunnmore-fotballkrets-arsrapport-1969 | 7 | kandidat | representasjon, kretslag | reviewed | person_candidate | Kretskamper og representasjon; utsatt. |
| 1969 | sunnmore-fotballkrets-arsrapport-1969 | 8 | kandidat | kurs, personer | reviewed | person_candidate | Trenerkurs og instruksjonsarbeid; utsatt. |
| 1969 | sunnmore-fotballkrets-arsrapport-1969 | 14 | kandidat | serie, sluttabell | reviewed | standing | Full tabell 2. divisjon avd. B 1969; AaFK nr. 3. |
| 1969 | sunnmore-fotballkrets-arsrapport-1969 | 15 | kandidat | reserve, junior | reviewed | non_senior | Reserve- og aldersbestemte serietabeller; utsatt. |
| 1969 | sunnmore-fotballkrets-arsrapport-1969 | 18 | kandidat | dommere, verv | reviewed | person_candidate | Dommerkomiteen og aktive dommere; utsatt. |
| 1969 | sunnmore-fotballkrets-arsrapport-1969 | 22 | kandidat | junior, NM | reviewed | non_senior | Junior-NM-statistikk og årsavslutning; utsatt. |

## Kildeavvik

- **1961 (NM 3. runde):** SFK trykker på side 6 «Rosenborg / AAFK 0–1» mens RSSSF oppgir
  Rosenborg–AaFK 1–0. Rosenborg avanserte til 4. runde. Kildens trykte form er beholdt i
  notatfeltet for kilderesultatet, mens kanonisk kamp beholder 1–0 i favør Rosenborg.
- **1962 (Landsdelsserien Møre 1961/62):** SFK side 8 trykker kamper, seier, uavgjort,
  tap og poeng for «Maratonserien», men har ingen målkolonne for denne tabellen.
- **1963 (2. divisjon avd. B):** SFKs trykte målsummer har en samlet differanse på 5 mål
  (212 scorede mot 207 innslupne mål fordelt over 8 lag). SFKs eksplisitt trykte tall er beholdt.
