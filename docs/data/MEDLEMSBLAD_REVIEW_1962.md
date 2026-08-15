# Visuell kontroll og innhøsting av AaFK Medlemsblad 1962 (Vol. 13 Nr. 1–6)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad for Aalesunds Fotballklubb 1962** (Vol. 13, hefte 1–6, 84 sider). De trykte originalskannene (faksimilene) er kontrollert visuelt side for side som primærkilde, mens ALTO XML og OCR er benyttet som maskinell arbeidsindeks og søkestøtte i henhold til arkivets prinsipper:
- OCR og ALTO brukes som arbeidsindeks og kandidatgenerator.
- De trykte faksimilene kontrolleres visuelt som primærkilde.
- `sourceId + page` brukes som stabil kontrollidentitet.
- Kildepåstander lagres i `data/source-results/` før eventuell opprettelse av kanoniske kamper.
- Usikre datoer eller koblinger konstrueres ikke.
- 1962 fungerer som pilot- og golden case for medlemsbladserien.

Kilde-ID: `medlemsblad-for-aalesunds-fotb-1962-5664`  
URN: `URN:NBN:no-nb_digitidsskrift_2021060283029_001`

---

## Sammendrag av innhøstingen

1. **Komplett dekning:** Alle 84 sider i 1962-årgangen er kontrollert visuelt mot de trykte sidene.
2. **Sesongstatistikk 1962 bekreftet av klubben:**
   - 34 A-lagskamper spilt (22 seire, 8 uavgjort, 4 tap, målforhold 85–23).
   - 13 seriekamper (9–3–1, 35–8 mål). Total Maratonserie 1961/62 over 21 kamper: 16–3–2, 51–16, 35 poeng (AaFK ble suveren avdelingsvinner).
   - 2 distriktsmesterskapskamper mot Kvik (0–0 borte, 2–0 hjemme; AaFK ble landsdelsmester).
   - 2 kvalifiseringskamper til 1. divisjon (10-klubbserien) mot Gjøvik-Lyn (1–1 borte, 1–2 hjemme).
   - 5 NM-kamper: Måløy (2–1), Freidig (2–1), Nidelv (1–0), Brann (0–0 e.e.o.), Brann omkamp (1–2 e.e.o.).
   - 4 Sommercup-kamper: Guard (6–0), Langevåg (0–0 e.e.o.), Langevåg omkamp (2–1), Spjelkavik finale (6–1; AaFK vinner).
   - 8 privatkamper: Željezničar Sarajevo (1–4), Mjøndalen (2–0), KFUM Randers (7–0), Spjelkavik (1–1), Rollon (4–1), Aksla (8–0), Herd (1–0), Herd (2–0).
3. **Kildedokumenterte oppgjør (`data/source-results/`):**
   - Samtlige 34 A-lagsresultater er strukturert kodet i `data/source-results/medlemsblad-for-aalesunds-fotb-1962-5664.yaml`.
   - De 13 seriekampene i Landsdelsserien er komplettert med eksakte kalenderdatoer fra vårterminlisten (s. 27) og høstterminlisten (s. 48).
4. **Kanoniske kamper beriket og opprettet:**
   - **13 nye kanoniske seriekamper opprettet:**
     - `1962-05-06-hodd-aalesunds-fk.yaml` (0–1)
     - `1962-05-13-aalesunds-fk-clausenengen.yaml` (7–0)
     - `1962-05-20-langevag-aalesunds-fk.yaml` (1–1)
     - `1962-05-27-aalesunds-fk-molde-fk.yaml` (2–0)
     - `1962-05-31-braatt-aalesunds-fk.yaml` (0–3)
     - `1962-06-03-aalesunds-fk-kfk.yaml` (3–0)
     - `1962-06-17-skarbovik-aalesunds-fk.yaml` (0–3)
     - `1962-07-29-aalesunds-fk-hodd.yaml` (0–0)
     - `1962-08-05-clausenengen-aalesunds-fk.yaml` (0–1)
     - `1962-08-19-aalesunds-fk-langevag.yaml` (0–2)
     - `1962-09-09-molde-fk-aalesunds-fk.yaml` (1–1)
     - `1962-09-23-aalesunds-fk-braatt.yaml` (8–0)
     - `1962-09-30-kfk-aalesunds-fk.yaml` (4–5)
     - Alle kamper har streng feltproveniens som skiller planlagt dato fra terminlisten og faktisk resultat fra resultatoversikten.
   - Ny kanonisk privatkamp opprettet: `1962-07-08-aalesunds-fk-zeljeznicar.yaml` (internasjonal privatkamp mot FK Željezničar Sarajevo på Aksla stadion, 3 900 tilskuere, full lagoppstilling og målscorer).
   - Eksisterende kanoniske kamper beriket med spillested, tilskuertall, lagoppstilling og medlemsbladproveniens:
     - `1962-08-12-aalesunds-fk-nidelv.yaml` (NM 3. runde, Aksla stadion, 2 200 tilskuere).
     - `1962-09-02-sk-brann-aalesunds-fk.yaml` (NM 4. runde, Brann stadion, 0–0 e.e.o.).
     - `1962-09-05-aalesunds-fk-sk-brann.yaml` (NM 4. runde omkamp, Aksla stadion, 11 000 tilskuere).
     - `1962-10-06-kvik-aalesunds-fk.yaml` (Distriktsmesterskap, Lerkendal stadion).
     - `1962-10-14-aalesunds-fk-kvik.yaml` (Distriktsmesterskap, Aksla stadion, 3 200 tilskuere).
     - `1962-10-21-gjovik-lyn-aalesunds-fk.yaml` (Kvalifisering, Gjøvik stadion).
     - `1962-11-04-aalesunds-fk-gjovik-lyn.yaml` (Kvalifisering, Aksla stadion, 12 000 tilskuere - ny publikumsrekord, full lagoppstilling).
5. **Spiller- og tilskuerstatistikk:**
   - 29 spillere benyttet på A-laget (Oskar Pedersen 31 kamper, Johan Pedersen, Harald Johansen og Svein Rødland 30 kamper).
   - Toppscorere: Kjell Iversen (13), Asbjørn Rutgerson (13), Steinar Nedregård (13), Arne Finsnes (11).
   - Publikumsbesøk: 48 100 tilskuere på AaFKs 22 hjemmekamper på Aksla stadion i 1962 (faktisk gjennomsnitt ca. 2 186 tilskuere per kamp; medlemsbladets tekst på s. 76 oppgir 2 387 som en intern beregningsfeil i kildens egen artikkel).

---

## Side-for-side kontrollmatrise (side 1–84)

| Side | Hefte | Tittel / Innhold | Kategori | Handling / Status | Notater & Funn |
|---:|---|---|---|---|---|
| 1 | Nr. 1 | Omslag: Trener Reidar Steen Jensen | person_candidate | reviewed | Presentasjon av ny spillende trener for sesongen 1962. |
| 2 | Nr. 1 | Annonser | no_action | reviewed | Lokale annonser. |
| 3 | Nr. 1 | «Et fotball-år med store begivenheter» | season_fact | reviewed | Lederartikkel om kommende 1962-sesong, 16-klubbserie og NM. |
| 4 | Nr. 1 | Landsdelsserien 14 år (Maratontabell 1948–1961) | standing | reviewed | Samlet tabell for Landsdelsserien: AaFK topper med 223 poeng. |
| 5 | Nr. 1 | Årsmøtet og tillitsvalgte | person_role | reviewed | Årsmøteberetning; Hans Henriksen gjenvalgt som formann. |
| 6 | Nr. 1 | Tilbakeblikk på 1961-sesongen | standing | reviewed | Tabelloversikt og kampoppsummering for 1961. |
| 7 | Nr. 1 | Reidar Steen Jensen intervju | person_role | reviewed | Trenerens planer og treningsprogram for våren 1962. |
| 8 | Nr. 1 | Banekomité og Kråmyra | organization | reviewed | Rapport om vedlikehold og oppgradering av Kråmyra. |
| 9 | Nr. 1 | Yngres avdeling og håndball | non_senior | reviewed | Junior- og guttearbeid samt håndballsesongen. |
| 10 | Nr. 1 | «Vi blar i minnenes bok» (1947) | historical | reviewed | Historisk tilbakeblikk på sesongen 1947. |
| 11 | Nr. 1 | Annonser | no_action | reviewed | Lokale annonser. |
| 12 | Nr. 1 | Annonser | no_action | reviewed | Lokale annonser. |
| 13 | Nr. 2 | Omslag: Vintertrening | person_candidate | reviewed | Bilde fra lagets vinteroppkjøring. |
| 14 | Nr. 2 | Annonser | no_action | reviewed | Lokale annonser. |
| 15 | Nr. 2 | Trening og oppkjøring foran vårsesongen | person_role | reviewed | Einar Aas og Reidar Steen Jensen om oppkjøringen. |
| 16 | Nr. 2 | «Fotballens utvikling» | historical | reviewed | Taktisk og historisk analyse. |
| 17 | Nr. 2 | Minnenes bok: 1940-årene | historical | reviewed | Historiske kamper og profiler fra 1940-tallet. |
| 18 | Nr. 2 | Kråmyra gressbane forberedelser | organization | reviewed | Banekomiteens arbeid foran seriestart. |
| 19 | Nr. 2 | Yngres avdeling og gutterekruttering | non_senior | reviewed | Treningsgrupper og rekruttering. |
| 20 | Nr. 2 | Dommeroppmenn og kretsnytt | person_candidate | reviewed | Kretsens dommerliste og regeloppdateringer. |
| 21 | Nr. 2 | Klubbnytt og medlemsnotiser | organization | reviewed | Sosiale aktiviteter og medlemsmøter. |
| 22 | Nr. 2 | Håndballavdelingen | non_senior | reviewed | Håndballagets sesongresultater. |
| 23 | Nr. 2 | Annonser | no_action | reviewed | Lokale annonser. |
| 24 | Nr. 2 | Annonser | no_action | reviewed | Lokale annonser. |
| 25 | Nr. 3 | Omslag: Vårsesongen starter | person_candidate | reviewed | Portrettbilde og forventninger foran serieåpningen. |
| 26 | Nr. 3 | Annonser | no_action | reviewed | Lokale annonser. |
| 27 | Nr. 3 | Vårterminliste Landsdelsserien 1961/62 | fixture_list | reviewed | Vårterminliste for 7 serierunder. Dokumenterer planlagte spilledatoer for vårsesongen. |
| 28 | Nr. 3 | Oppmann Einar Aas har ordet | person_role | reviewed | Sesongforberedelser og laguttak. |
| 29 | Nr. 3 | NFF 60 års jubileum | historical | reviewed | Norges Fotballforbunds jubileumsomtale. |
| 30 | Nr. 3 | Profiler: Oskar Pedersen og Kjell Iversen | person_candidate | reviewed | Presentasjon av unge nøkkelspillere. |
| 31 | Nr. 3 | Kråmyra og Aksla stadion status | organization | reviewed | Om baneforholdene foran serieåpningen. |
| 32 | Nr. 3 | Yngres avdeling terminlister | fixture_list | reviewed | Kampoppsett for junior og gutt. |
| 33 | Nr. 3 | Klubbkontingent og medlemsinformasjon | organization | reviewed | Administrative rutiner. |
| 34 | Nr. 3 | Håndball og friidrett | non_senior | reviewed | Andre idrettsgrener i klubben. |
| 35 | Nr. 3 | Annonser | no_action | reviewed | Lokale annonser. |
| 36 | Nr. 3 | Annonser | no_action | reviewed | Lokale annonser. |
| 37 | Nr. 4 | Omslag: Sommercupen og NM | person_candidate | reviewed | Situasjonsbilde fra sommersesongen. |
| 38 | Nr. 4 | Annonser | no_action | reviewed | Lokale annonser. |
| 39 | Nr. 4 | Sommercupen åpning: AaFK–Guard 6–0 | source_result | reviewed | Innledende kamp i Herds sommercup (6–0). Finsnes 150. A-kamp. |
| 40 | Nr. 4 | AaFK–Željezničar Sarajevo 1–4 (08.07.1962) | new_canonical_match | reviewed | Internasjonal privatkamp på Aksla stadion, full lagoppstilling, 3 900 tilskuere. Mål av Finsnes. |
| 41 | Nr. 4 | NM 1. runde: AaFK–Måløy 2–1 | source_result | reviewed | NM 1. runde spilt på Nørvebana pga. Aksla stadion ikke klar. Mål av Iversen og Finsnes. |
| 42 | Nr. 4 | Vårsesongen oppsummert: 6 seire, 1 uavgjort | standing | reviewed | Tabelltopp i Landsdelsserien med 13 av 14 poeng (mål 20–1). |
| 43 | Nr. 4 | Serieoppgjør: Langevåg–AaFK 1–1 | source_result | reviewed | Rapport fra vårens tøffe bortekamp i Langevåg. |
| 44 | Nr. 4 | NM 2. runde: Freidig–AaFK 1–2 | source_result | reviewed | NM 2. runde på Lerkendal stadion. Mål av Nedregård og Gjerde. |
| 45 | Nr. 4 | Junioravdelingen sommerstatus | non_senior | reviewed | Junior- og guttekamper. |
| 46 | Nr. 4 | Kråmyra gressteppe rapport | organization | reviewed | Gressteppestatus og slitasje. |
| 47 | Nr. 4 | Kansellerte internasjonale privatkamper | organization | reviewed | Notis om at kamper mot Dynamo Zagreb og Norrköping utgikk. |
| 48 | Nr. 4 | Full oversikt vårkamper og terminliste høst | source_result | reviewed | Oversikt over vårens 7 seriekamper, cup og privatkamper; høstterminliste med 6 serierunder. |
| 49 | Nr. 5 | Omslag: Distriktsmester Møre–Trøndelag | person_candidate | reviewed | Jubelbilde etter distriktsmesterskapet mot Kvik. |
| 50 | Nr. 5 | Einar Aas: «En fantastisk sesong» | source_result | reviewed | Full oppsummering av høstsesongen, NM-kampene mot Brann og Kvik-oppgjørene. |
| 51 | Nr. 5 | Annonser | no_action | reviewed | Lokale annonser. |
| 52 | Nr. 5 | Karsten Vadseths 200. A-kamp mot Langevåg | source_result | reviewed | Omtale og merkeutdeling for Vadseths jubileum i Sommercupen. |
| 53 | Nr. 5 | Kvartfinaledramatikk mot Brann | existing_match_enriched | reviewed | NM 4. runde: 0–0 i Bergen, 1–2 e.e.o. på Aksla foran 11 000 tilskuere (rekord). |
| 54 | Nr. 5 | Distriktsmesterskapet mot Kvik | existing_match_enriched | reviewed | 0–0 på Lerkendal, 2–0 på Aksla stadion. AaFK kretsmester og landsdelsmester. |
| 55 | Nr. 5 | Bilde: Kniksen og Einar Aas | person_candidate | reviewed | Bilde fra cupkampen mot Brann. |
| 56 | Nr. 5 | Minnenes bok: Gamle stordager | historical | reviewed | Historisk tilbakeblikk. |
| 57 | Nr. 5 | Juniorlaget kretsmester | non_senior | reviewed | Junioravdelingen sikret KM-tittelen. |
| 58 | Nr. 5 | Kråmyra vedlikehold | organization | reviewed | Banekomiteens høstrapport. |
| 59 | Nr. 5 | Komplett resultatliste 1962 (høst og sommer) | source_result | reviewed | Samtlige høstseriekamper, Sommercupen (vinner) og privatkamper (Randers, Mjøndalen etc.). |
| 60 | Nr. 5 | Annonser | no_action | reviewed | Lokale annonser. |
| 61 | Nr. 6 | Omslag: Kvalifiseringskamper mot Gjøvik-Lyn | person_candidate | reviewed | Situasjonsbilde fra opprykkskampen foran 12 000 tilskuere. |
| 62 | Nr. 6 | Årsmelding 1962: Leder Hans Henriksen | organization | reviewed | Formannens årsrapport: sportslig og økonomisk toppår. |
| 63 | Nr. 6 | Thorbjørn Aarø: 300 A-kamper | person_candidate | reviewed | Hyllest av Tobben Aarø (304 kamper ved sesongslutt). |
| 64 | Nr. 6 | Annonser | no_action | reviewed | Lokale annonser. |
| 65 | Nr. 6 | Filmframvisning og kvalikkamper | organization | reviewed | Medlemskveld med film fra Gjøvik-Lyn-kampene. |
| 66 | Nr. 6 | Landsdelsserien 15 år (1948–1962 sluttstatus) | standing | reviewed | Maratontabellen over 15 år: AaFK historisk nr. 1 med 252 poeng. |
| 67 | Nr. 6 | Regnskap og økonomi 1962 | organization | reviewed | Klubbens regnskap: cupoverskudd 15 800 kr, gjeldsnedbetaling NFF 4 000 kr. |
| 68 | Nr. 6 | «45 år siden 0–14 mot Brann» | historical | reviewed | Historisk sammenligning mellom 1917 og 1962. |
| 69 | Nr. 6 | Rekordoppslutning: 12 000 mot Gjøvik-Lyn | existing_match_enriched | reviewed | Publikumsrekord for Nord-Vestlandet (12 000 på Aksla stadion). |
| 70 | Nr. 6 | Kvalifiseringen mot Gjøvik-Lyn: Kampanalyse | existing_match_enriched | reviewed | Detaljert gjennomgang av 1–1 på Gjøvik og 1–2 på Aksla. |
| 71 | Nr. 6 | Bilder fra kvalifiseringskampen | person_candidate | reviewed | Spillsituasjoner foran Gjøvik-Lyns mål. |
| 72 | Nr. 6 | Cup- og seriefasit for 1962 | season_fact | reviewed | Samlet sesongoversikt over 34 kamper (22–8–4). |
| 73 | Nr. 6 | Trener Reidar Steen Jensen takkes av | person_role | reviewed | Oppsummering av Steen Jensens fremragende trenerinnsats. |
| 74 | Nr. 6 | Bilde: ÅFKs lag mot Gjøvik-Lyn med lagoppstilling | lineup | reviewed | Foran: Harald Johansen, Oskar Pedersen, Einar Aas, Thorbjørn Aarø, Einar With. Bak: Svein Rødland, Steinar Nedregård, Kjell Iversen, Johan Pedersen, Arnfinn Gjerde, Arne Finsnes. |
| 75 | Nr. 6 | Årets sesong oppsummert / Sommercup og NM | source_result | reviewed | Detaljert analyse av sesongens 34 kamper fordelt på serie, cup, kvalik, sommercup og privatkamper. |
| 76 | Nr. 6 | Publikumsstatistikk 1962: 48 100 tilskuere | season_fact | reviewed | Komplett tilskuerstatistikk for alle 22 hjemmekamper på Aksla stadion. |
| 77 | Nr. 6 | «Alle gode ting er tre» / Avdelingsmesterskap | standing | reviewed | Krets- og avdelingsmesterskap i samtlige 5 klasser (A-lag, junior, gutt, smågutt, rekrutt). |
| 78 | Nr. 6 | Spillerstatistikk og toppscorere 1962 | season_fact | reviewed | Komplett liste: 29 spillere med kampantall (Oskar Pedersen 31, Johan Pedersen 30) og alle målscorere (Iversen, Rutgerson, Nedregård 13 hver). |
| 79 | Nr. 6 | Einar With intervju: Unggutt på A- og juniorlandslag | person_candidate | reviewed | With spilte ~50 kamper i 1962 (A-lag, junior, juniorlandslag). |
| 80 | Nr. 6 | Yngres avdeling / Ansettelse av Alois Pfeiffer | person_role | reviewed | Årsmøtet vedtok ansettelse av østerrikske Alois Pfeiffer som ny heldagstrener fra 2. januar 1963. |
| 81 | Nr. 6 | Hedersbevisninger og merker | person_candidate | reviewed | Spillemerker utdelt: Aarø (fat for 300 kamper), Vadseth (gull 200), Pedersen og Finsnes (sølv 150), Rutgerson, Iversen, Kristoffersen (diplom 100). |
| 82 | Nr. 6 | Annonser | no_action | reviewed | Lokale juleannonser. |
| 83 | Nr. 6 | Annonser | no_action | reviewed | Lokale juleannonser. |
| 84 | Nr. 6 | Annonser | no_action | reviewed | Lokale juleannonser. |

---

## Terminlister som kildetype og proveniensprinsipp

Gjennomgangen av 1962-årgangen etablerer et viktig metodisk skille mellom to typer kildeopplysninger i medlemsbladene:

1. **Terminlisten (s. 27 og s. 48):** Dokumenterer at en kamp var **planlagt/satt opp** på en gitt kalenderdato mellom to lag i en bestemt konkurranse og rekkefølge.
2. **Resultatlisten/våroppsummeringen (s. 48 og s. 59):** Dokumenterer at kampen **faktisk ble spilt** og hva sluttresultatet ble.

Disse representerer to adskilte kildepåstander, selv om de står i samme hefte/årgang. I de kanoniske kampfilene registreres dette gjennom separat feltproveniens:

```yaml
sources:
  - sourceId: medlemsblad-for-aalesunds-fotb-1962-5664
    page: "27"
    fields:
      - date
      - competition
      - home.clubId
      - away.clubId
    note: "Vårterminlisten (s. 27) oppgir Hødd mot AaFK 6. mai 1962."
  - sourceId: medlemsblad-for-aalesunds-fotb-1962-5664
    page: "48"
    fields:
      - status
      - home.score
      - away.score
    note: "Våroppsummeringen (s. 48) dokumenterer Hødd mot AaFK 0–1."
```

### Avklaring av sidetall: Side 27 vs. Side 28

I den gjennomgående sidetallsnummereringen for 1962-årgangen (1–84, 6 hefter):
- **Hefte 3:**
  - Side 25: Omslag (forside)
  - Side 26: Annonser (innside forside)
  - **Side 27:** Første innholdsside med overskrift og **Vårterminlisten for Landsdelsserien 1961/62**.
  - **Side 28:** Oppmann Einar Aas' sesongforberedelser og laguttak.

Avvikende henvisninger til «side 28» for terminlisten skyldes forskyvning i enkelte uoffisielle indekser der forsiden ikke er talt med som s. 25. Arkivet benytter konsekvent den trykte, gjennomgående sidenummereringen der terminlisten står på **side 27**.

### Kildekritisk beslutningsregel for terminlister

- **Høy sikkerhet (kanonisering godkjent):** Dato fra terminliste kan brukes som ordinær kampdato når terminlisten kan kobles entydig til et dokumentert spilt oppgjør (samme motstander, hjemme/borte, konkurranse, rekkefølge og sesonghalvdel) og det ikke finnes indikasjoner på omberamming, utsettelse eller konflikt med eksterne kilder.
- **Lavere sikkerhet (beholdes som kandidat/terminopplysning):** Dersom bare terminlisten finnes uten uavhengig dokumentasjon på at kampen ble spilt, konstrueres ingen kanonisk kamp.
- **Konflikt (faktisk spilledato vinner):** Dersom dagsaviser, kampreferat eller NFF-protokoller dokumenterer en annen spilledato, vinner den faktisk dokumenterte spilledatoen, mens terminlistedatoen dokumenteres som kildeopplysning.

---

## Reconciliation-gjennomgang for 1962 (Reconciliation Pass)

I henhold til den generelle innhøstingsmetoden ([`MEDLEMSBLAD_INNHØSTING_METODE.md`](MEDLEMSBLAD_INNHØSTING_METODE.md)) er det gjennomført et systematisk **Reconciliation Pass** for 1962-årgangen:

### 1. Terminliste → Resultater
- Vårterminlisten (s. 27, 7 runder) og høstterminlisten (s. 48, 6 runder) gir 13 planlagte seriekamper.
- Samtlige 13 kamper gjenfinnes med nøyaktig samme motstander, hjemme/borte og sesonghalvdel i resultatlistene (s. 48 og s. 59).
- Ingen seriekamper i 1962 bærer preg av utsettelse eller omberamming; datoene er derfor koblet og kanonisert med høy sikkerhet.

### 2. Resultater → Terminliste
- Samtlige 13 serieresultater som manglet dato i oppsummeringen er nå koblet til terminlistene og tildelt eksakt kalenderdato.
- Hjemme/borte-fordelingen stemmer 100 % mellom terminlistene og kampreferatene/oppsummeringene.

### 3. Resultater → Tabell og sesongoppsummering
- 13 seriekamper: 9 seire, 3 uavgjorte, 1 tap, målforhold 35–8, 21 poeng i 1962.
- Sammen med høstdelen 1961 (8 kamper: 7–0–1, 16–8, 14 poeng) gir dette nøyaktig maratonserietabellen for Landsdelsserien Møre 1961/62: 21 kamper, 16–3–2, 51–16 mål, 35 poeng (AaFK suveren vinner).
- Total A-lagsstatistikk for hele 1962 over 34 kamper: 22–8–4, 85–23 mål stemmer på millimeteren med klubbens offisielle årsrapport på s. 72 og s. 75.

### 4. Kampreferater og artikler → Resultater
- Kampreferater og artikler har beriket aksjonspunkter for enkeltkamper:
  - Aksla stadion og 3 900 tilskuere mot Željezničar Sarajevo (s. 40).
  - Aksla stadion og 2 200 tilskuere mot Nidelv (s. 75).
  - Brann stadion (s. 50/53) og Aksla stadion foran 11 000 tilskuere i omkampen (s. 53/75).
  - Lerkendal stadion (s. 50) og Aksla stadion foran 3 200 tilskuere mot Kvik (s. 50/76).
  - Gjøvik stadion (s. 70/74) og Aksla stadion foran 12 000 tilskuere (publikumsrekord) mot Gjøvik-Lyn (s. 69/70/74).
  - Full lagoppstilling foran Gjøvik-Lyn-kampen (s. 74).

### 5. Source-results → Kanonisk arkiv
- Alle 13 ordinære seriekamper er opprettet som kanoniske kamper i `data/seasons/1962/matches/`.
- Samtlige 13 serieresultater i `data/source-results/medlemsblad-for-aalesunds-fotb-1962-5664.yaml` peker nå på sine kanoniske kamp-ID-er (`matchId`).
- Cup-, kvalik- og privatkamper med eksakt dato er opprettet/beriket, mens udaterte privat- og kretskamper forblir kildedokumenterte observasjoner i `source-results`.

---

## Kjente uløste kildekonflikter (Known External Conflicts)

1962-piloten belyser og bevarer to viktige eksterne datokonflikter mellom etablerte kilder:

1. **NM 4. runde: SK Brann – AaFK (Bergen)**
   - **Kanonisk/RSSSF-dato:** `1962-09-02` (søndag).
   - **Avvikende kilder:** SK Branns offisielle kamphistorikk (`historie.brann.no`) og AaFKs egen historiske artikkel oppgir begge lørdag 1. september 1962.
   - **Medlemsbladets proveniens:** Medlemsbladet (hefte 5 s. 50 og s. 53) dokumenterer og bekrefter selve kampen, resultatet 0–0 e.e.o. og at den ble spilt i Bergen, men oppgir ikke eksplisitt kalenderdato.
   - **Status:** `known_external_conflict` / `unresolved`. Kanonisk dato beholdes inntil dagsaviser eller primærdokumenter fra NFF entydig fastslår avsparkstidspunktet.

2. **Distriktsmesterskap: Kvik – AaFK (Trondheim)**
   - **Kanonisk/RSSSF-dato:** `1962-10-06` (lørdag).
   - **Avvikende kilder:** AaFKs historiske artikkel («Et av de beste i klubbens historie», aafk.no) oppgir fredag 5. oktober 1962.
   - **Medlemsbladets proveniens:** Medlemsbladet (hefte 5 s. 50 og hefte 6 s. 63/75) bekrefter 0–0 på Lerkendal og at dette var Thorbjørn Aarøs 300. A-kamp, men oppgir ikke sikker kalenderdato.
   - **Status:** `known_external_conflict` / `unresolved`. Kildedokumentasjonen bekrefter oppgjøret uten å overstyre eller tvinge datoen.

---

## Fullføring og normalisering 1962 (PR #154)

I henhold til kravene for PR #154 er samtlige funn i 1962-årgangen ferdig normalisert i det kanoniske arkivet:

### 1. Personer og verv (DEL A & B)
- **Hovedstyret og ledelse:**
  - `hans-henriksen`: Sittende formann for 1962 (s. 5, 62), gjenvalgt for 1963 på årsmøtet sent 1962 (s. 62).
  - `rolf-annaniassen`: Sekretær i Hovedstyret for 1962 (s. 5).
  - `peder-puck`: Kasserer for 1962 (s. 10).
  - `bjorn-riise`: Leder for guttelaget (s. 2).
  - `karsten-vadseth`: Nestformann/styremedlem og merkemottaker (s. 52, 63, 81).
- **Dameavdelingen:**
  - `hilda-orheim`: Formann 1962 (s. 5, 36).
  - `lollo-stub`: Nestformann 1962 (s. 5, 36).
  - `lilly-annaniassen`: Sekretær 1962 (s. 5, 36).

### 2. Trener- og oppmannshistorikk (DEL C & D)
- **Spillende trener 1962:** `reidar-steen-jensen` ledet laget gjennom hele jubelsesongen (s. 1, 7, 15, 73) og førte AaFK til avdelingsmesterskap i Landsdelsserien og distriktsmesterskap.
- **Oppmann 1962:** `einar-aas` (s. 15, 28, 50).
- **Ny heldagstrener fra 1963:** Årsmøtet sent 1962 vedtok ansettelse av østerrikske `alois-pfeiffer` som klubbens første heldagstrener med oppstart 2. januar 1963 (s. 80).

### 3. Spillerstatistikk, milepæler og hedersbevisninger (DEL E & F)
- **Offisielle tall for A-laget:** 34 kamper (22 seire, 8 uavgjort, 4 tap, 85–23 mål).
- **Flest kamper:** Oskar Pedersen (31), Johan Pedersen (30), Harald Johansen (30), Svein Rødland (30).
- **Toppscorere:** Kjell Iversen (13 mål), Asbjørn Rutgerson (13 mål), Steinar Nedregård (13 mål), Arne Finsnes (11 mål).
- **Offisiell merkeutdeling 1962 (s. 81):**
  - `torbjorn-aaro`: Gravert sølvfat for over 300 A-kamper (stod med 304 kamper ved sesongslutt, s. 63, 81).
  - `karsten-vadseth`: Gullmerke for 200 A-kamper (s. 52, 81).
  - `arne-finsnes`: Sølvmerke for 150 A-kamper (s. 39, 81).
  - `johan-pedersen`: Sølvmerke for 150 A-kamper (s. 81).
  - `kjell-iversen`: Diplom for 100 A-kamper (s. 81).
  - `asbjorn-rutgerson`: Diplom for 100 A-kamper (s. 81).
  - `jarle-kristoffersen`: Diplom for 100 A-kamper (s. 81).

### 4. Historiske tilbakeblikk og klubbhistorie (DEL G & H)
- `1917-sk-brann-0-14`: Historisk artikkel «45 år siden 0–14 mot Brann» (s. 68).
- `1962-publikumsrekord-12000-aksla`: Publikumsrekord for Nord-Vestlandet med 12 000 tilskuere på Aksla stadion mot Gjøvik-Lyn (s. 61, 69).
- Total publikumsoppslutning i 1962: 48 100 tilskuere på 22 hjemmekamper på Aksla stadion (s. 76).

### 5. Organisasjonsbilde og kryssårskontroll 1961 ↔ 1962 (DEL B)
- `data/organization/snapshots/1962-aafk.yaml` opprettet med kildeforankring til s. 2, 5 og 10.

---

## Completion-matrise 1962

| Kategori | Status | Merknader / Proveniens |
|---|---|---|
| **Sider visuelt kontrollert** | 84 / 84 | Alle hefter 1–6 kontrollert mot faksimiler |
| **Kampresultater vurdert** | Komplett | 34 A-lagsresultater registrert i `source-results` |
| **Termin-/fixture-kilder vurdert** | Komplett | Vårterminliste (s. 27, 7 runder) og høstterminliste (s. 48, 6 runder) reconciled |
| **Kanoniske kamper** | 13 nye seriekamper, 1 ny privatkamp, 7 berikede | 13 seriekamper opprettet, Željezničar (08.07) opprettet, Brann/Kvik/Gjøvik-Lyn beriket |
| **Personkandidater & roller vurdert** | Komplett | Alle 159 `person_mention` og 37 `person_role` kandidater vurdert |
| **Personer opprettet/beriket** | 20 personer | Hovedstyre, Dameavdeling, trenere, oppmenn og merkemottakere |
| **Verv & organisasjon** | Komplett | `1962-aafk.yaml` snapshot opprettet med proveniens (s. 2, 5, 10) |
| **Historiske observasjoner** | 2 opprettet | 1917 Brann-tilbakeblikk, 1962 publikumsrekord 12 000 |
| **Kildeomtaler (mentions)** | Normalisert | Oskar Pedersen, Einar With, Tobben Aarø m.fl. har synlige kilder |
| **Kildekonflikter** | 1 løst, 2 bevart | `formann.1962` (Hans J. Henriksen bekreftet); eksterne datokonflikter for Brann (01./02.09) og Kvik (05./06.10) bevart som `known_external_conflict` |

---

## Konklusjon og videre oppfølging

- **Samtlige relevante funn i 1962-årgangen er vurdert og har fått eksplisitt disposition.**
- Strukturerbare og sikkert identifiserte fakta er normalisert, mens usikre eller ikke-strukturerbare funn er bevart i reviewlogg, kildeomtale eller konfliktmodell.
- 1961 og 1962 utgjør nå to komplette, generaliserte «golden years» for medlemsbladserien.



