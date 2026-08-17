# Visuell kontroll og innhøsting av AaFK Medlemsblad 1965 (Vol. 16 nr. 1–6)

Denne loggen dokumenterer full visuell kontroll og normalisering av **Medlemsblad
for Aalesunds Fotballklubb 1965** (Vol. 16, hefte 1–6, 56 skannede sider). De
trykte originalskannene er kontrollert visuelt side for side som primærkilde,
etter [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](../../HISTORISK_KILDEINNHOSTING_RUNBOOK.md).

| Felt | Verdi |
|---|---|
| Publikasjon | Medlemsblad for Aalesunds fotballklubb |
| Årgang | 1965 (Vol. 16, nr. 1–6) |
| Kilde-ID | `medlemsblad-for-aalesunds-fotb-1965-a2c9` |
| URN | `URN:NBN:no-nb_digitidsskrift_2021060283035_001` |
| Sider i omfang | 56 skann (0001–0056) |
| Batch | `medlemsblad-1965` |

## 1. Paginering: skann-nummer er ikke trykt sidetall

Dette er den viktigste metodiske observasjonen i årgangen, og den skiller 1965 fra
1962-årgangen der de to falt sammen.

- Skann 0001–0028 følger trykt sidetall 1–28 (hefte 1 slutter på trykt s. 16;
  hefte 2-3 følger etter uten at nummereringen brytes i skannrekkefølgen).
- Skann 0029–0040 er hefte 4-5, som starter på nytt med trykt s. 1–12.
- Skann 0041–0056 er hefte 6, som igjen starter på nytt med trykt s. 1–16.

Trykt sidetall er derfor **ikke entydig** innenfor kilden: «s. 13» finnes tre
ganger i årgangen. Runbooken krever at `sourceId + page` er en stabil
kontrollidentitet, og arkivets praksis for 1962 er gjennomgående paginering.
**Alle `page`-verdier i arkivet og i batchmanifestet er derfor skann-nummer.**

## 2. Dekning

| Kategori | Status |
|---|---|
| Sources i scope / reviewed | 1/1 |
| Sider visuelt kontrollert | 56/56 (100 %) |
| Sider uten relevante funn | 9 (annonse- og forsidesider, åpnet og notert) |
| Kildepåstander normalisert | 1031 (995 fra skann 8–16, 36 fra skann 45) |

### Side-for-side-logg

Hver av de 56 skannede sidene er åpnet enkeltvis. Tabellen er loggen: hva som
står på siden, og hvilke funn den ga. Sider uten klubbstoff står med «ingen
relevante funn» — de er lest, ikke hoppet over, og de teller i dekningen.

Skann 8–16 er den store statistikkoppstillingen «Våre kamper gjennom 50 år».
Antallet kilderesultater per side er det som faktisk står i
`data/source-results/`. Metodikken, dobbeltlesingen og avstemmingen for de
sidene er dokumentert i
[`medlemsblad-1965-50ar.md`](medlemsblad-1965-50ar.md).

| Skann | Innhold | Funn |
|---:|---|---|
| 1 | Forside, Nr. 1 - 1965, 16. årgang. Hovedoppslag «Tilbake til 2. divisjon?» med kampfoto (Foto: Sunnmørsposten). «Kommer ut seks ganger i året. Redigert av en komite.» | historical_observation ×2 |
| 2 | Kjell Berentzen: «På dommeroppdrag i London — 26 000 så tre nordmenn lede E-cupmatch». Om linjemannsoppdrag i Europacupen West Ham—La Gantoise høsten 1964. Annonser topp/bunn. | historical_observation, person_role |
| 3 | Intervju med Steinar Nedregård om sesongen i Bodø-Glimt. Notis «STATISTIKKEN» (hele statistikken samlet i dette nummeret, stoff som ikke fikk plass i jubileumsskriftet). Notis: Torbjørn Aarø reengasjert som trener. Slutten av Kjell Berentzens dommerartikkel. | historical_observation, person_role ×2 |
| 4 | Intervju med Frantz Løvmo: «ÅFK må opp igjen i 2. divisjon». Om Kråmyra, klubbhuset, ønsker for jubileumsåret. Stort kampfoto nederst. | historical_observation ×2, person_role ×3, retrospective_claim |
| 5 | Oversatt/generell artikkel «En oppmanns første bud: Vær aldri diktatorisk!» (bygger på erfaringer fra Highbury/engelsk proffklubb). Intet klubbstoff. | ingen relevante funn |
| 6 | Kolofon (redaktør Helge Stavik m.fl.), Redaktørens spalte, notiser (klubbmerke, klubbhusets telefon, bladets postadresse), «Takk Harald» (Harald Nord takker av etter 15 år), Terminliste vår/høst 1965, notis om Harald Johansen 150 A-kamper, notis om Einar Aas som keepertrener, fortsettelse av «Bare dommeren var møtt fram». | historical_observation, organization, person_role ×8 |
| 7 | Karsten Vadseth: «Bare dommeren var møtt fram» — tilbakeblikk på kretsfinale i klasse C mot Stranda våren/sommeren 1949. Stort foto. | person, person_role ×2, retrospective_claim ×2 |
| 8 | Start på den store statistikkoppstillingen «Våre kamper gjennom 50 år». Resultatliste 1915(?)–1924 (uten datoer). Annonser topp/bunn. | 105 kilderesultater, historical_observation |
| 9 | Resultatliste, fortsettelse 1924–1930. | 117 kilderesultater |
| 10 | Resultatliste, fortsettelse 1930–1936. | 127 kilderesultater |
| 11 | Resultatliste, fortsettelse 1936–1946 (inkl. krigsårene/1940 og 1945). | 114 kilderesultater |
| 12 | Resultatliste, fortsettelse 1946–1950. | 88 kilderesultater |
| 13 | Resultatliste, fortsettelse 1950-1954. Annonser topp (Trygd forsikring, Ålesunds Elektrisitetsverk) og bunn (Knut A. Larsen, Borgund Sparebank). NB: siden er trykt med sidetallet «15», ikke 13. | 108 kilderesultater, historical_observation ×2 |
| 14 | Resultatliste, fortsettelse 1954-1957. Annonser topp (Sunnmøre Meieri, Alfr. Nesset) og bunn (Ålesund Samvirkelag, Parkgatens Bensinstasjon). Trykt sidetall 14. | 101 kilderesultater |
| 15 | Resultatliste, fortsettelse 1957-1961. Annonse bunn (Aalesunds Sparebank). Trykt sidetall 15. | 111 kilderesultater, historical_observation |
| 16 | Resultatliste, avslutning 1961-1964. Tegnforklaring «* betyr bortekamper for ÅFK». Listen slutter med 1964-turneringskampen mot Stranda. Trykt sidetall 16. Siste side i nr. 1/1965. | 124 kilderesultater, historical_observation ×4 |
| 17 | Forside Nr. 2-3, 1965, 16. årgang. Hovedoppslag «Vinker England i det fjerne?» med foto fra landskampen Norge–Jugoslavia (Foto: Tele-Sport). «Kommer ut seks ganger i året. Redigert av en komite.» Stempel Universitetsbiblioteket i Oslo, Aviskontoret. | ingen relevante funn |
| 18 | «Papir-innsamlingen: Glimrende start — Peder og Co. sier takk til velpakket papir» (Hyttekomitéens dugnad for ny hytte på Ørskogfjellet). Under: «Nye ansikter: Bjarte Remvik — stø senterback på juniorlaget», intervju signert -gren. | historical_observation, organization, person_role, season_fact |
| 19 | Kjell Berentzen: «Vi på tribunen», del 1 — essay om tribunementalitet, sportsånd og fotballhelter. Portrettfoto av Berentzen, kampfoto nederst. | historical_observation, person_role |
| 20 | «Vi på tribunen», del 2 (avsluttes, signert Kjell Berentzen). Notiser i høyre spalte: «Old boys-kamp mot Rollon i juli» og «Bestill diplom til dobbelt nytte» (Hyttekomitéen, Asbjørn Korsnes). Stort publikumsfoto nederst. | historical_observation ×3, person_role |
| 21 | «Impulser utenfra», signert J. L. — om klubbens utenlandske toppbesøk (Canto do Rio, Wiener Sportclub, Tatran Presov, Zelj Sarajevo). Stort kampfoto øverst. Nederst til høyre to småstubber («!» og «ÆREN!», signert A—K.). | historical_observation ×4 |
| 22 | Reidar Skarbøvik: «Minnenes bok», del 1 — referat av cupens 1. runde mot Sandane på Nørvebanen og 2. runde mot Freidig på Lerkendal (sesongen 1950, jf. s. 23). Stort kampfoto. | match_result ×2, retrospective_claim |
| 23 | «Minnenes bok» sluttes øverst til venstre (seriekamp mot Clausenengen, sesongen 1950 avsluttes). Kolofon «MEDLEMSBLADET» (redaktør, medarbeidere, forretningsfører, trykkeri). Redaktørens spalte. «Ta seieren hjem» (Peder-stubb om Gjøvik-turen 1935 og oppmann Erling Flem). Notiser: Svein «Boble» Rødland i Start, juniorlagets seier i Lamberseter-turneringa, takk fra Tove og John Johnsen. | match_result, organization, person_role ×4, retrospective_claim ×2, season_fact ×2 |
| 24 | «Vi unge» (red. Paul Urke): «Juniorene fortsetter der de slapp — deltakelse i cupturnering i Oslo-kretsmesterskap og ny suksess i NM er årets mål». Intervju med oppmann Hans O. Sødergren om juniorlaget, treneren Odv. Aarø, Asbjørn Hellandsvik i jr.-UK, Einar Aas som keepertrener. Notis om bridge-klubbmesterskap. Signert Jean. | organization ×2, person_role ×4, season_fact |
| 25 | Finn Tolaas: «Glimt fra året 1940», del 1 — krigsutbruddet, Nørvebanen ble satt i stand på dugnad, koksgrus hentet fra det påbegynte Aksla stadion, 7 treningskamper mot Rollon, cupstart mot Ørsta 3-1. Stort kampfoto. | historical_observation ×3, retrospective_claim |
| 26 | «Glimt fra året 1940», del 2 (cupvei mot Molde, Rollon, Drafn og Skeid på Bislet; besøk hos Geo Haller). Notisen «Skotten ble stille» (ÅFK—Aberdeen på Nørve, 1-1). «Kamper under midnattssola — mot Bodø-Glimt og Staalkameratene» (privatarrangementer 1965). Ramme «OBS!» med vitser. Ramme «JUBILEUMSSKRIFTET» (pris kr 10.00). Notis om Bjarte Remvik på trenerkurs. | historical_observation ×2, match_result ×5, organization, person_role, retrospective_claim ×2 |
| 27 | Ren annonseside (O. M. Ringdal, S. Stenersen, O. P. Reitebø, Per Rønnestad, Lars Ranes, Sverre Høyer & Erik Sølberg, Tyrholm & Farstad, Knut A. Larsen, Borgund Sparebank, Ålesunds Elektrisitetsverk, Aalesunds Saltkompani, Johs. Paulsen, Parkgatens Bensinstasjon, Sunnmøre Meieri, Høibergs Brus, Trygd, Aalesunds Sparebank). Intet klubbstoff. Uten trykt sidetall. | historical_observation |
| 28 | Ren annonseside / bakside av nr. 2-3 (Gaaseide Service, J. Hagenæs & Co., Jens Skuggen, O. Nørve, Puck & Falkevik, Privatbanken, Gustav Skarbøvik, Gullsmed Danielsen, H. Lausund & Co., A. M. Liaaen, Peter Spjelkavik, Knut Korsbrekke, J. E. Devold, Landes Rutebiler, P. D. Stafseth, K. P. Aarskog, B. Rongve, O. Ellingsen & Sønn). Intet klubbstoff. Uten trykt sidetall. | historical_observation |
| 29 | Forside, hefte nr. 4-5 1965, 16. årgang. Tittel «De hjalp oss tross alt ...!». Foto: B-landslaget på Aksla. Trykt sidetall: 1 (ikke påtrykt). | ingen relevante funn |
| 30 | Trykt s. 2. «Ekstra lyse ÅFK-glimt i Bodø» - reportasje fra A-lagets turné nordover juli 1965: kamp mot Bodø-Glimt (6-4) og mot Stålkameratene i Mo i Rana (1-7). | historical_observation, match_result ×2, person, person_role ×2 |
| 31 | Trykt s. 3. «Rosenborg-kampen: Da Arnfinn stoppet kjeften på Aksla-publikummet» - om 3. rundekamp i cupen mot Rosenborg på Aksla, Arnfinn Gjerde som lagkaptein og syndebukk, Arne Finsnes på reservelaget, privatkamp mot Hødd med 1000 tilskuere. Foto fra Molde-ÅFK. | historical_observation ×4, person_role ×2 |
| 32 | Trykt s. 4. Kjell Havnevik jr.: «Østlandsturen som gav seier i Oslo og Hamar» - juniorlagets tur til Lambertseter ILs 20-årsjubileumsturnering og kamp på Hamar. | historical_observation, person ×2, person_role, retrospective_claim |
| 33 | Trykt s. 5. Ungdomssidene «Vi unge» (red. Paul Urke): portrettintervju med Kjell Havnevik jr.; notis om orkesteret «The Blackjets»; «Kort om SPORT»-foto av Rolf Kvissel intervjuet av NRKs Øivind Johnsen. | historical_observation ×2, person_role ×2, retrospective_claim ×2 |
| 34 | Trykt s. 6. «Fotballopplevelse i Porsgrunn» (sign. Jean/Paul Urke) - Paul Urke reserve på ungdomslandslaget mot Finland i Porsgrunn 8. august; notis «Om reservebenken». | historical_observation, person_role, retrospective_claim |
| 35 | Trykt s. 7. Kolofon/masthead, «Redaktørens spalte», «Slett journalistikk» (ÅFK-Brage 7-1), «Millie-showet gav fint beløp i hytte-kassa», «Kjernekaren Dutte Berg», «Fin slant til kassa» (B-landskampen på Aksla). | historical_observation ×3, match_result ×2, organization ×2, person |
| 36 | Trykt s. 8. Reidar Skarbøvik: «Vi blar i minnenes bok» - tilbakeblikk på sesongen 1951, del 1. Lagbilde. | retrospective_claim ×4 |
| 37 | Trykt s. 9. Fortsettelse av 1951-tilbakeblikket (Clausenengen, Braatt) + «Morsom Old boys-match» mot Rollon sommeren 1965 og notis «Dommeren var også tilstede!». | historical_observation, match_result, person, person_role, retrospective_claim ×2 |
| 38 | Trykt s. 10. Jan Larsen: «Fra fotballbanen og til tribunen» - erindringer, spilte i ÅFK 1953-59, kampen mot Wiener Sportsclub på Aksla. | historical_observation, retrospective_claim ×4 |
| 39 | Trykt s. 11. Kun annonser (O. M. Ringdal, Aalesunds Sparebank, Johs. Havnevik m.fl.). Ingen klubbstoff. | ingen relevante funn |
| 40 | Trykt s. 12. Kun annonser (Gaaseide Service, P. D. Stafseth, Tyrholm & Farstad m.fl.). Ingen klubbstoff. | ingen relevante funn |
| 41 | Forside hefte nr. 6 1965, 16. argang. Overskrift SLUTT FOR I AR. Actionfoto (keeper i luften foran mal, stort publikum). God jul og godt nytt ar! Trykt sidetall 1 (ikke patrykt). | ingen relevante funn |
| 42 | Trykt s. 2. Hovedreferat fra arsmotet 21. november 1965: Stort sett saklige arsmoteforhandlinger. Lovendringer, trenersporsmalet, suspensjonssak, arsberetninger, innledning til valgene. Bilder av Einar Aas, Bjorn Riise, samt Rolf Annaniassen og Asbjorn Rutgersen. | historical_observation, organization ×7, person_role ×2 |
| 43 | Trykt s. 3. Fullstendig valgliste fra arsmotet; Tre nye solvgutter (150 kamper); intervju En prat med goalgetteren Terje Refsnes; Den ble var! (Hallerpokalen, foto); Nye kretsdommere. | historical_observation ×2, organization ×5, person_role |
| 44 | Trykt s. 4. Sesongoppsummering A-laget 1965: Resultatmessig jevnt, god sesong for A-laget - 4. runde i cupen og bronse i 3. div. avd. More. Toppfoto fra kamp mot Lisleby der Bror Johansen scorer pa straffespark. | historical_observation ×5, match_result, season_fact |
| 45 | Trykt s. 5. Jarle Kleive arets AFK-spiller (kaaring 1-2-3), Facts om A-lagets sesong 1965: representasjon, komplett resultatliste (serie, NM cup, turnering, pokal/tippekamper, privatkamper), 3. div. avd. More-tabellen, kamp- og scoringsstatistikk. | 36 kilderesultater, historical_observation ×3, person_role, season_fact ×4 |
| 46 | Trykt s. 6. Reidar Skarbovik: Minnenes bok - fortsettelse av 1951-tilbakeblikket (AFK-Rollon og AFK-KFK pa Aksla). Notisen For et medlem! om Jarle Kristoffersen. Notisen Vi vokser! om medlemsutviklingen 1965. | organization, person_role, retrospective_claim ×2 |
| 47 | Trykt s. 7. Lederartikkel VI KREVER AT: Forstelagsgruppa skal bestaa av 18 mann. Notisen Han Perry om Perry Ystenes. Notisen UNNSKYLD! om manglende vitser fra Paul Urke. Bildesak Boble tilbake i AFK. | historical_observation, organization, person_role |
| 48 | Trykt s. 8. Aktivitet blant de yngre - full gjennomgang av rekrutt-, smaagutte- og guttelagets sesong 1965 med resultatlister og tabeller. Notisen Hvilken Bjorge? Foto av jublende ungdomslag. | historical_observation, season_fact |
| 49 | Trykt s. 9. Kolofon/masthead for Medlemsbladet 1965. Redaktorens spalte. Telefon-overforingen (samarbeid med Sunnmore Arbeideravis). Mange hverdagskamper neste aar? (tilskuertall og matchkonto). AFK et maallag? (maalstatistikk). Velkommen etter! (Finn Kvello ny redaktor). Varm takk til Tobben (Torbjorn Aaro). | historical_observation ×2, organization, person_role ×2, retrospective_claim, season_fact |
| 50 | Trykt s. 10. Ny utmerket sesong av juniorlaget! - KUN ET TAP - KM OG HALLERPOKALEN SIKRET. Lagbilde av juniorlaget. Sesongstatistikk og resultatliste (del 1). | historical_observation ×4, person_role, season_fact |
| 51 | Trykt s. 11. Juniorlagets resultatliste og statistikk (del 2), tabell avdeling A, scoringsstatistikk, kretsmesterliste. God sesong ogsaa for reservelaget - kretsmester, ubeseiret i seriekamper, med resultatliste og statistikk. | historical_observation, person_role, season_fact ×3 |
| 52 | Trykt s. 12. Stor enighet om U-serie! - artikkel av Birger Madsen, sakset fra Fredrikstad FKs medlemsblad Rod Hvit Scoreren (opptrykk). Avslutning av reservelagets scoringsstatistikk og reservelagsserie-tabellen. Helsideannonse for Trafuril liniment. | retrospective_claim, season_fact |
| 53 | Trykt s. 13. Andre og siste del av Birger Madsens opptrykte U-serie-artikkel (avsnittene UNGDOMMEN MAA FAA SIN EGEN KLASSE og utfordringen til Norges Fotballforbund). Nederste halvdel er annonser (Lise Modell A/S, Corner i Skansen, Corner Herreklaer). Ingen AaFK-spesifikt stoff. | historical_observation, retrospective_claim |
| 54 | Trykt s. 14. Kun annonser (H. Lausund & Co., P. D. Stafseth, B. Rongve, J. Hagenaes & Co., O. Norve, Privatbanken, Sverre Hoyer & Erik Solberg, Tyrholm & Farstad, Gryttens Drogeri, A. M. Liaaen, Knut Korsbrekke, Landes Rutebiler, K. P. Aarskog, O. Ellingsen & Sonn, Shell, Jens Skuggen, Puck & Falkevik, Gustav Skarbovik). Ingen klubbstoff. | ingen relevante funn |
| 55 | Trykt s. 15. Kun annonser (Borgund Sparebank, Oscar Pedersen, Martin A. Bjorseth, Inge Skuseth, Froysa & Norve, Peter Spjelkavik, Einar Danielsen, Brodrene Jangaard, Aarflots Bokhandel, P. G. Merok, Oscar Larsen, Carl E. Ronneberg & Sonner, Bernhard Aarseth, Nesset Skipsradio, Dankert Schlyder, E. H. Slyngstad, Frionor). Ingen klubbstoff. | ingen relevante funn |
| 56 | Trykt s. 16, bakside. Kun annonser (Aalesunds Sparebank MIDT I SKUDDLINJEN, O. M. Ringdal, S. Stenersen, Alesund Samvirkelag, Werner Osvold, BP Sydsiden, Rose Drogeri, Hoibergs Mineralvandfabrik, More Kullkran, Harald Mogstad, John Stamnaess, Vestlandske Salslag/Sunnmore Slakteri, Sunnmore Meieri, Rohdins Restaurant, Oskar Rorhuus, Luma Radio Elektrisk, P. A. Johannessen, H. I. Gjortz Sonner). Ingen klubbstoff. Slutt paa argangen 1965. | ingen relevante funn |

## 3. Sesongen 1965 — kildearitmetikk

Klubbens egen sesongoppstilling på skann 45 fører samtlige A-lagskamper for 1965
uten datoer. Oppstillingen er kontrollregnet mot bladets egne sammendrag på samme
side, og alle fire kontrollsummene stemmer eksakt:

| Kontroll | Utregnet fra kamplista | Trykt i bladet |
|---|---|---|
| Antall kamper | 36 | 36 |
| Samlet | 21-6-9 | 21-6-9 |
| Målforhold | 125–75 | 125–75 |
| Seriekamper | 14, 8-4-2, 46–20 | Sluttabell: 8-4-2, 46–20 |

Sluttabellen for 3. divisjon avdeling Møre 1965 gir Herd 24 p, Molde 21 p og AaFK
20 p på tredjeplass — som stemmer med `data/seasons/1965/season.yaml`, der
plasseringen allerede sto dokumentert fra Sunnmøre Fotballkrets' årsrapport.

Resultatene er ført som kildepåstander i
`data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`. **Ingen av dem
er gjort om til kanoniske kamper**, fordi kilden ikke gir datoer.

To eksisterende kanoniske kamper er beriket med medlemsbladet som uavhengig
bekreftelse: NM 3. runde mot Rosenborg (3–2) og NM 4. runde mot Vålerengen (1–4
sett fra AaFK, spilt på Ullevaal).

## 4. Organisasjon — årsmøtet 21. november 1965

Det ordinære årsmøtet ble holdt i møtesalen i Klubbhuset på Kråmyra søndag
21. november 1965 med om lag 80 stemmeberettigede. Etter runbookens regel om
valgår mot arbeidsår er valgene ført på **1966**, ikke på året de fant sted:
`data/organization/snapshots/1966-aafk.yaml`.

Hovedstyret slik kilden fører det (skann 43): formann Rolf Annaniassen,
nestformann Asbjørn Rutgerson, oppmann Olav Bigset, sekretær Kjell Melsæter,
kasserer Jostein Torset, 1. varamann Ole M. Ringdal, 2. varamann Karsten Vadseth.

Oppmannsvalget er en uavhengig samtidig bekreftelse av rollen `oppmann-1966` på
`olaf-bigseth`, som fram til nå bare hvilte på jubileumsbøkene fra 1989 og 2004.

## 5. Hedersbevisninger og kåringer

- **Sølvmerket for 150 A-kamper** ble delt ut av formannen på årsmøtet til
  Kjell Iversen, Jarle Kristoffersen og Harald «Bror» Johansen (skann 43).
- **Årets AaFK-spiller 1965** ble Jarle Kleive, foran Steinar Nedregård og
  Harald «Bror» Johansen (skann 45).

## 6. Terminlister

Terminlisten på skann 6 og de planlagte kampene på skann 26 er lest som
terminliste. **Ingen planlagt dato er gjort om til spilledato.** Kilden parer
aldri dato og resultat for samme kamp, så kravet til fixture-reconciliation er
ikke oppfylt for noen kamp i årgangen.

## 7. Bevisst uavklart

Fire spor står åpne i manifestets `unresolved`, og er *ikke* normalisert:

1. **Personer uten fil** (`open-001`). Jarle Kleive, Kjell Melsæter, Jostein
   Torset, Asbjørn Hamar, Helge Stavik og Finn Kvello er navngitt med verv eller
   utmerkelse, men har ingen personfil. De er ikke opprettet her fordi
   identiteten ikke er avstemt mot eksisterende navneformer, og en falsk
   sammenslåing er verre enn en manglende kobling. Snapshotet for 1966 er derfor
   ufullstendig med hensikt, og sier det selv i `note`.
2. **Retrospektive kampreferater fra 1940, 1950 og 1951** (`open-003`, skann
   22–26 og 46). Reidar Skarbøviks «Minnenes bok» og Finn Tolaas' «Glimt fra året
   1940» gir resultater, målscorere og tilskuertall, men ufullstendig datering.
   De hører hjemme i en gjennomgang av faktumårene, ikke i 1965-batchen.
3. **Konflikten mot 1962** (`konf-029`). Se seksjon 4: fire av seks seriekamper
   høsten 1962 er ført med andre sifre i 50-årslista enn i medlemsbladet fra
   1962. Begge påstandene står i arkivet, og uenigheten er ikke avgjort.
4. **Seks uleselige rader** (`uleselig-030`). Tre med skadet siffer og tre
   walkover-notiser uten navngitt motstander. De er ikke ført som kildepåstander,
   og er listet i [`medlemsblad-1965-50ar.md`](medlemsblad-1965-50ar.md).

**«Våre kamper gjennom 50 år» er ikke lenger et åpent spor.** Den er innhøstet i
denne batchen: 995 kildepåstander på 46 sesonger fra 1915 til 1964, normalisert
under faktumår. Metodikken, dobbeltlesingen, avstemmingen mot arkivet og
konflikten mot 1962 er dokumentert i sin helhet i
[`medlemsblad-1965-50ar.md`](medlemsblad-1965-50ar.md).

## 8. Kontroller

- `pnpm data:historical-harvest:check --batch medlemsblad-1965` → PASS
  (56/56 sider, 32 funn, 28 normaliserte, 4 uavklarte, 0 destruktive endringer).
- `pnpm validate` → grønn, 1777 kildedokumenterte resultater i arkivet.
- Batchen står som `status: normalized`, ikke `complete`: sidedekningen er
  fullstendig og funnene er normalisert, men de fire sporene over er bevisst
  latt stå åpne.
