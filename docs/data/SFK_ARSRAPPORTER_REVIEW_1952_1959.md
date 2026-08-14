# Visuell kontroll av SFK-årsrapportene 1952–1959

Denne loggen dokumenterer normaliseringen av AaFKs A-lag fra Sunnmøre Fotballkrets'
årsrapporter 1952–1959. Original PDF-side er kontrollert visuelt og er primærkilde.
OCR er bare brukt som arbeidsindeks. RSSSF er brukt som uavhengig kontroll og til å
supplere seier–uavgjort–tap når SFK bare trykker kamper, mål og poeng.

Den stabile kontrollidentiteten er `sourceId + page`. «Kandidat» er en av de 44
maskinelt foreslåtte sidene. «Weak-only» er en relevant side som kandidatmotoren
ikke tok med fordi siden bare skrev et svakt AaFK-alias, typisk «Aalesund».

Kun senior-A-laget er normalisert her. Reserve, junior, guttelag, kretslag, dommere,
tillitsvalgte og øvrige personfunn er eksplisitt utsatt til egne, senere løp.

## Resultat

- 44 av 44 kandidatsider er visuelt kontrollert.
- 12 relevante weak-only-sider (13 handlingspunkter) er kontrollert i tillegg.
- Åtte hovedseriesesonger og åtte komplette sluttabeller er normalisert.
- 23 seniorresultater som ikke kan løftes direkte til kanoniske kamper er
  registrert i `data/source-results/`.
- To eksisterende NM-kamper er beriket med SFK-proveniens.
- Ingen kampdato er konstruert fra årsrapportene.

## Kontrollpunkter

| År | Source ID | Side | Treff | Signal | Status | Handling | Notat |
|---:|---|---:|---|---|---|---|---|
| 1952 | sunnmore-fotballkrets-arsrapport-1952 | 5 | weak-only | serie, sluttabell | reviewed | standing | Full Landsdelsserietabell 1951/52; AaFK nr. 2. |
| 1952 | sunnmore-fotballkrets-arsrapport-1952 | 6 | kandidat | serie, junior | reviewed | non_senior | Lavere divisjoner og juniorstoff; ingen ny A-lagsfakta. |
| 1952 | sunnmore-fotballkrets-arsrapport-1952 | 7 | kandidat | serie | reviewed | no_action | Foreløpig høststilling 1952/53, ikke sluttabell. |
| 1952 | sunnmore-fotballkrets-arsrapport-1952 | 10 | weak-only | NM | reviewed | source_result | AaFK–Træff 6–1 uten sikker dato. |
| 1952 | sunnmore-fotballkrets-arsrapport-1952 | 11 | weak-only | NM | reviewed | existing_match_enriched | AaFK–Langevåg 3–1 lagret som kilderesultat; eksisterende AaFK–Kvik 1–4 beriket. |
| 1953 | sunnmore-fotballkrets-arsrapport-1953 | 5 | weak-only | serie, sluttabell | reviewed | standing | Full Landsdelsserietabell 1952/53; AaFK nr. 3. |
| 1953 | sunnmore-fotballkrets-arsrapport-1953 | 8 | weak-only | NM | reviewed | source_result | AaFK–Ørsta 2–4 uten sikker dato. |
| 1953 | sunnmore-fotballkrets-arsrapport-1953 | 9 | kandidat | NM, personer | reviewed | person_candidate | Treffet gjelder junior-/personstoff; senior-NM står på side 8. Utsatt. |
| 1954 | sunnmore-fotballkrets-arsrapport-1954 | 2 | kandidat | personer | reviewed | person_candidate | Personomtale uten egen A-lagskampfakta; utsatt. |
| 1954 | sunnmore-fotballkrets-arsrapport-1954 | 5 | kandidat | verv | reviewed | non_senior | Administrasjon og verv; utsatt. |
| 1954 | sunnmore-fotballkrets-arsrapport-1954 | 7 | kandidat | serie, personer | reviewed | no_action | Pågående tabeller/personstoff, ikke endelig A-lagstabell. |
| 1954 | sunnmore-fotballkrets-arsrapport-1954 | 8 | kandidat | serie | reviewed | no_action | Fortsettelse av lavere/pågående serier; ingen sluttabell for AaFK. |
| 1954 | sunnmore-fotballkrets-arsrapport-1954 | 9 | weak-only | serie, sluttabell | reviewed | standing | Full Landsdelsserietabell 1953/54; AaFK nr. 3. |
| 1954 | sunnmore-fotballkrets-arsrapport-1954 | 10 | kandidat | serie, junior | reviewed | non_senior | Lavere divisjoner; juniorstoffet er utsatt. |
| 1954 | sunnmore-fotballkrets-arsrapport-1954 | 11 | kandidat | serie, NM | reviewed | existing_match_enriched | Tre senior-NM-resultater lagret; eksisterende Freidig–AaFK 3–1 beriket. |
| 1954 | sunnmore-fotballkrets-arsrapport-1954 | 17 | kandidat | verv | reviewed | non_senior | Regnskap/administrasjon; ingen A-lagsfakta. |
| 1954 | sunnmore-fotballkrets-arsrapport-1954 | 18 | kandidat | verv | reviewed | non_senior | Administrasjon; ingen A-lagsfakta. |
| 1955 | sunnmore-fotballkrets-arsrapport-1955 | 2 | kandidat | junior, personer | reviewed | person_candidate | Junior- og personstoff; utsatt. |
| 1955 | sunnmore-fotballkrets-arsrapport-1955 | 4 | kandidat | personer, verv | reviewed | person_candidate | Personer og verv uten normaliserbar A-lagskamp; utsatt. |
| 1955 | sunnmore-fotballkrets-arsrapport-1955 | 5 | kandidat | verv | reviewed | non_senior | Administrasjon; ingen A-lagsfakta. |
| 1955 | sunnmore-fotballkrets-arsrapport-1955 | 6 | kandidat | serie, junior | reviewed | no_action | Pågående serie og juniorstoff, ikke sluttabell. |
| 1955 | sunnmore-fotballkrets-arsrapport-1955 | 8 | weak-only | serie, sluttabell | reviewed | standing | Full Landsdelsserietabell 1954/55; AaFK nr. 3. |
| 1955 | sunnmore-fotballkrets-arsrapport-1955 | 10 | weak-only | NM | reviewed | source_result | AaFK–Rollon 2–0 uten sikker dato. |
| 1955 | sunnmore-fotballkrets-arsrapport-1955 | 11 | weak-only | NM, junior | reviewed | source_result | AaFK–Langevåg 0–1 lagret; junior-NM under egen overskrift er utsatt. |
| 1956 | sunnmore-fotballkrets-arsrapport-1956 | 2 | kandidat | personer, verv | reviewed | person_candidate | Person- og administrasjonsstoff; utsatt. |
| 1956 | sunnmore-fotballkrets-arsrapport-1956 | 6 | kandidat | serie, reserve, junior, personer | reviewed | no_action | Pågående serier; reserve, junior og personer er utsatt. |
| 1956 | sunnmore-fotballkrets-arsrapport-1956 | 8 | weak-only | serie, sluttabell | reviewed | standing | Full Landsdelsserietabell 1955/56; AaFK nr. 5. |
| 1956 | sunnmore-fotballkrets-arsrapport-1956 | 9 | kandidat | serie, NM | reviewed | source_result | Hødd–AaFK 5–1 uten sikker dato. |
| 1956 | sunnmore-fotballkrets-arsrapport-1956 | 10 | kandidat | personer, verv | reviewed | person_candidate | Person- og vervstoff; utsatt. |
| 1956 | sunnmore-fotballkrets-arsrapport-1956 | 12 | kandidat | verv | reviewed | non_senior | Dommer-/administrasjonsstoff; utsatt. |
| 1956 | sunnmore-fotballkrets-arsrapport-1956 | 13 | kandidat | verv | reviewed | non_senior | Dommer-/administrasjonsstoff; utsatt. |
| 1957 | sunnmore-fotballkrets-arsrapport-1957 | 2 | kandidat | personer, verv | reviewed | person_candidate | Person- og administrasjonsstoff; utsatt. |
| 1957 | sunnmore-fotballkrets-arsrapport-1957 | 4 | kandidat | verv | reviewed | non_senior | Administrasjon; ingen A-lagsfakta. |
| 1957 | sunnmore-fotballkrets-arsrapport-1957 | 5 | kandidat | personer, verv | reviewed | person_candidate | Person- og vervstoff; utsatt. |
| 1957 | sunnmore-fotballkrets-arsrapport-1957 | 8 | weak-only | serie, åpningscup | reviewed | standing | Full Landsdelsserietabell 1956/57; AaFK nr. 5. |
| 1957 | sunnmore-fotballkrets-arsrapport-1957 | 8 | weak-only | åpningscup | reviewed | source_result | Tre seniorresultater lagret uten konstruert dato. |
| 1957 | sunnmore-fotballkrets-arsrapport-1957 | 9 | weak-only | NM, junior | reviewed | source_result | AaFK–Eid 1–2 etter ekstraomganger; juniorcupen er utsatt. |
| 1957 | sunnmore-fotballkrets-arsrapport-1957 | 13 | kandidat | serie, verv | reviewed | ocr_false_positive | Serieordet står i administrativ sammenheng; ingen ny A-lagsfakta. |
| 1957 | sunnmore-fotballkrets-arsrapport-1957 | 14 | kandidat | verv | reviewed | non_senior | Administrasjon; ingen A-lagsfakta. |
| 1957 | sunnmore-fotballkrets-arsrapport-1957 | 15 | kandidat | verv | reviewed | non_senior | Administrasjon; ingen A-lagsfakta. |
| 1958 | sunnmore-fotballkrets-arsrapport-1958 | 2 | kandidat | personer, verv | reviewed | person_candidate | Person- og administrasjonsstoff; utsatt. |
| 1958 | sunnmore-fotballkrets-arsrapport-1958 | 3 | kandidat | serie, verv | reviewed | no_action | Pågående/administrativ serieomtale, ikke sluttabell. |
| 1958 | sunnmore-fotballkrets-arsrapport-1958 | 6 | kandidat | NM, åpningscup | reviewed | source_result | Tre åpningscupresultater lagret; juniorstoff utsatt; senior-NM fortsetter på side 7. |
| 1958 | sunnmore-fotballkrets-arsrapport-1958 | 7 | kandidat | serie, NM, junior | reviewed | source_result | To senior-NM-resultater lagret; juniorserien er utsatt. |
| 1958 | sunnmore-fotballkrets-arsrapport-1958 | 9 | kandidat | serie, junior | reviewed | standing | Full Landsdelsserietabell 1957/58; juniorstoffet er utsatt. |
| 1958 | sunnmore-fotballkrets-arsrapport-1958 | 11 | kandidat | junior, personer | reviewed | person_candidate | Junior- og personstoff; utsatt. |
| 1958 | sunnmore-fotballkrets-arsrapport-1958 | 13 | kandidat | personer, verv | reviewed | person_candidate | Person- og vervstoff; utsatt. |
| 1958 | sunnmore-fotballkrets-arsrapport-1958 | 14 | kandidat | personer, verv | reviewed | person_candidate | Person- og vervstoff; utsatt. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 5 | kandidat | reserve, sunnmørscup | reviewed | source_result | To seniorresultater lagret; reserve- og kretslagsstoff er utsatt. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 6 | kandidat | serie | reviewed | no_action | Foreløpig seriestilling, ikke sluttabell. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 7 | kandidat | serie, reserve | reviewed | no_action | Foreløpige/lavere serier; reservestoff er utsatt. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 8 | kandidat | serie | reviewed | no_action | Foreløpig høststilling 1958/59, ikke sluttabell. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 9 | kandidat | serie, NM | reviewed | standing | Full Landsdelsserietabell 1958/59; AaFK nr. 3. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 9 | kandidat | NM | reviewed | source_result | To senior-NM-resultater lagret, begge etter ekstraomganger. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 12 | kandidat | personer, verv | reviewed | person_candidate | Person- og administrasjonsstoff; utsatt. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 13 | kandidat | serie, NM, junior, personer, verv | reviewed | ocr_false_positive | Blandet junior-/person-/administrasjonsstoff; ingen ny seniorfakta. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 14 | kandidat | verv | reviewed | non_senior | Administrasjon; ingen A-lagsfakta. |
| 1959 | sunnmore-fotballkrets-arsrapport-1959 | 15 | kandidat | verv | reviewed | non_senior | Administrasjon; ingen A-lagsfakta. |

## Kildeavvik

SFK-tabellene trykker ikke seier–uavgjort–tap i 1952–1958. Disse tre kolonnene
er derfor supplert fra RSSSF og kontrollert mot antall kamper og poeng.

- 1952: SFK oppgir Clausenengen 26–37; RSSSF oppgir 26–36. SFK-tallet er beholdt.
- 1954: Rollons 2–5–7 er en eksplisitt rekonstruksjon basert på kombinasjonen
  av kildene. SFK oppgir 14 kamper og 9 poeng, mens RSSSF oppgir 2–4–7. Én
  uavgjort er lagt til i rekonstruksjonen for å forene de to kildeopplysningene.
- 1958: SFK oppgir K.F.K. 44–19; RSSSF oppgir 43–19. SFK-tallet er beholdt.
- 1959: SFK oppgir C.F.K. 26–29 og Dahle 15–46; RSSSF oppgir henholdsvis
  27–39 og 14–48. SFKs trykte tall er beholdt.

Disse avvikene er synlige i tabellfilenes radnotater; de er ikke skjult eller
«rettet» uten kildegrunnlag.
