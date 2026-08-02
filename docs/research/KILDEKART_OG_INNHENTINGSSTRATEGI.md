# Kildekart og innhentingsstrategi for AaFKs kamphistorikk

**Status:** Kartlegging, ikke datainnsamling

**Sist oppdatert:** 3. august 2026

**Omfang:** Aalesunds Fotballklubbs herrelag

## 1. Formål

Dette dokumentet kartlegger hvor `aafkstats` kan finne kampdata, statistikk, kamprapporter og annet kildemateriale om AaFKs herrelag. Det dekker offisielle datakilder, mediearkiver, historiske publikasjoner, kommersielle sportsdatabaser og mer uformelle historikksider.

Dokumentet beskriver også hvordan en framtidig innhenting kan gjennomføres billig og effektivt, hvilke kilder som kan automatiseres, og hvor avtale eller manuell forskning er nødvendig.

Det er ikke lastet ned eller lagret kampdata som del av denne kartleggingen. Dokumentet er heller ikke en juridisk vurdering. Vilkår og lovgrunnlag må kontrolleres på nytt før innhenting eller publisering starter.

## 2. Hovedkonklusjon

Ingen enkeltkilde dekker alle AaFKs kamper siden 1914. En komplett historikk må bygges som en sammensatt database hvor hver kamp og hvert enkelt faktum kan ha flere kilder.

Den mest lovende kombinasjonen er:

1. **NTB/NIFS som mulig lisensiert ryggrad.** NTB har et dokumentert API for strukturerte kampdata og robotgenererte kamprapporter. NIFS oppgir historikk tilbake til 1949 på overordnet nivå, men dekningen må dokumenteres per turnering og sesong.
2. **NFF/FIKS som offisiell kontrollkilde.** Offentlig tilgjengelige kampsider kan være svært detaljerte, særlig fra begynnelsen av 2000-tallet. Historiske importer kan være ufullstendige eller feil. NFF forbyr automatisert innhenting uten avtale.
3. **AaFK Historisk Arkiv og Sunnmørsposten som fortellende hovedkilder.** Disse er viktigst for kampforløp, samtidige vurderinger, sitater og eldre lokalhistorie.
4. **Nasjonalbiblioteket som historisk oppdagelseslag.** Aviser, tidsskrifter, bøker, radio, TV og nettarkiv gjør det mulig å finne stoff som ikke finnes på det åpne nettet.
5. **TV 2 Livesport, NRK, motstanderklubber og motstanderens lokalavis som supplement.** Disse kan gi detaljert kampforløp og et annet perspektiv enn AaFK og Sunnmørsposten.
6. **RSSSF og historikksider som hullfyllere.** De er særlig nyttige for å rekonstruere eldre terminlister og cupkamper.
7. **FotMob, Sofascore, Transfermarkt, Soccerway og Flashscore som kontrollkilder.** De har nyttige moderne data, men automatisert uthenting er normalt forbudt eller teknisk ustabilt.

Den første kommersielle henvendelsen bør gå til NTB. Den første historiske samarbeidshenvendelsen bør gå til AaFK Historisk Arkiv.

## 3. Hva betyr «alle kamper»?

Prosjektet må definere omfanget før en kampliste kan kalles komplett. Minst disse kategoriene må skilles:

- Obligatoriske seriekamper.
- Norgesmesterskapet og kvalifiseringskamper.
- Europacup.
- Andre offisielle cuper og lokale turneringer.
- Treningskamper og sesongoppkjøring.
- Jubileums-, oppvisnings- og testimonialkamper.
- Innendørs- og kortturneringer.
- Kamper mot reserve-, bedrifts-, militær- eller sammensatte lag.
- Avbrutte, annullerte eller utsatte kamper.
- Walkover og kamper avgjort administrativt.
- AaFK II og aldersbestemte lag, som normalt bør være egne enheter.

En praktisk todeling er:

```text
official_competitive  = obligatoriske A-lagskamper
first_team_other      = treningskamper, oppvisningskamper og andre førstelagskamper
```

Da kan hovedhistorikken bli etterprøvbart komplett uten at én ukjent treningskamp fra mellomkrigstiden blokkerer hele prosjektet.

## 4. Prioritert kildematrise

| Kilde | Påvist eller sannsynlig dekning | Kampfakta | Kamprapport og kontekst | Automatisering | Anbefaling |
| --- | --- | --- | --- | --- | --- |
| NTB/NIFS | Generell historikk tilbake til 1949; konkret AaFK-dekning må avklares | Svært god, men varierer per kamp | Fotballrobot for deler av moderne periode | Dokumentert, lisensiert API | Høyeste prioritet |
| NFF/FIKS | Eldre importerte resultater; rikere fra ca. 2001/02 | Offisiell og ofte detaljert | Lite journalistisk prosa | Forbudt uten avtale | Be om eksport og gjenbruksavtale |
| AaFK Historisk Arkiv | 1914–nåtid, ujevnt strukturert | Statistikk i bøker og blader | Svært verdifullt | Avtale/CMS-eksport | Høyeste historiske prioritet |
| Sunnmørsposten | 1914–nåtid | Varierende | Den viktigste løpende lokalkilden | Ikke uten avtale | Be Polaris om arkivtilgang |
| Nasjonalbiblioteket | Aviser fra hele perioden; flere medietyper | Godt for kontroll | Svært godt, men ofte tilgangsbegrenset | Katalog-API for oppdagelse | Bruk som kildeindeks og manuelt arkiv |
| TV 2 Livesport | Påvist detaljert minst fra 2016 | God | Minutt-for-minutt og oppsummering | Forbudt uten samtykke | Be om lisens eller eksport |
| Global Sports Archive | Detaljert AaFK-kamp påvist i 2003 | Svært god | Ingen egentlig journalistisk rapport | Kommersiell API/lisens | Be om dekningsmatrise og pris |
| UEFA | 14 AaFK-kamper i Europa League | Offisiell og detaljert | Begrenset | Ikke systematisk uten tillatelse | Bruk til kontroll eller med lisens |
| RSSSF Norge | Varierende serie- og cuphistorikk | Resultat, dato og tabell | Nei | Enkel HTML, begrenset gjenbruk | God hull- og kontrollkilde |
| Motstanderklubber | Varierer kraftig | Ofte kamptropp og resultat | Ofte gode referater | Må vurderes per nettsted | Søk per kjent kamp |
| Motstanderaviser | Hele perioden, avhengig av avis | Varierende | Svært verdifullt alternativt perspektiv | Ofte manuelt eller lisensiert | Bruk ved hull og viktige kamper |
| FotMob | Påvist AaFK-historikk fra minst 2010/11 | God moderne dekning | Livekommentar, sjelden full rapport | Vilkår forbyr systematisk bruk | Manuell kontrollkilde |
| Transfermarkt | Hovedsakelig 2002/03–nåtid | God på lag, formasjon og overgangsrelaterte data | Nei | Bots/scraping forbudt | Manuell kontrollkilde |
| Sofascore | Påvist AaFK-kamper fra 2010 | Svært god moderne statistikk | Nei | Udokumentert API og scrapingforbud | Manuell kontroll eller avtale |
| Soccerway/Flashscore | Moderne og noe historisk | God, men varierende | Nei | Livesport-vilkår forbyr scraping | Manuell kontrollkilde |
| worldfootball.net | Påvist AaFK-resultater fra 2003 | Dato, runde, slutt- og pauseresultat | Lite | Historikken kan være ufullstendig | Sekundær kontroll |

## 5. Offisielle og lisensierbare datakilder

### 5.1 NTB/NIFS

NIFS leveres av NTB. AaFK bruker `teamId=46`.

Viktige innganger:

- [AaFKs lagprofil i NIFS](https://www.nifs.no/lagprofil.php?countryId=1&stageId=6683&teamId=46&tournamentId=5)
- [AaFKs historiske tilskuertall](https://www.nifs.no/tilskuertall.php?fromYear=1948&mode=topSeasonAverages&teamId=46&toYear=2026&tournamentId=5)
- [Dokumentasjon for NTB Football Robot API](https://api.ntb.no/portal/docs/football-robot)
- [NTB API Hub – oppstart og autentisering](https://api.ntb.no/portal/getting_started)
- [NTBs presentasjon av Fotballrobot](https://www.ntb.no/sport/fotballrobot)

Det dokumenterte API-et har blant annet mønstre for:

```text
GET /football/v1/matches?teamId=46
GET /football/v1/stages?teamId=46
GET /football/v1/teams/46
GET /football/v1/summary/{matchId}?focusTeam=46
GET /football/v1/summary-version
```

Avhengig av kampens dekning kan kampobjektene inneholde:

- Lag og resultat.
- Resultat ved pause, 90 minutter og slutt.
- Stadion og publikum.
- Sesong, turnering og stage.
- Målscorere, assists og minutter.
- Kort, straffer, cornere og skudd.
- Dommere og andre funksjonærer.
- Lagoppstillinger og spillere.
- Dekningsflagg som forteller hvilke datatyper som finnes.
- Eksterne ID-er fra NFF/FIKS, TV 2, Enetpulse og andre systemer.

Eksterne ID-er er spesielt verdifulle fordi de kan koble samme kamp på tvers av leverandører.

Fotballrobotens sammendrag kan inneholde:

- Overskrift og tittel.
- Ingress.
- Brødtekst som ren tekst og HTML.
- NTB-byline.
- Språk, publiseringstid og versjon.
- Fokus på et bestemt lag gjennom `focusTeam`.

Robotrapportene ble innført i moderne tid og må ikke antas å finnes tilbake til 1949. Dekningen må avklares per turnering og år.

#### Spørsmål til NTB

- Kan NTB levere et komplett historisk uttrekk for AaFK senior herrer?
- Hvilke sesonger og turneringer har fullstendige kampresultater?
- Når begynner dekningen av lagoppstillinger, hendelser, dommere og tilskuere?
- Hvor langt tilbake finnes Fotballrobot-rapporter?
- Kan eldre NIFS-data leveres som bulkfil?
- Kan rapporttekst og kampfakta vises offentlig på `aafkstats`?
- Kan egne, avledede sammendrag publiseres?
- Hva koster historisk engangsuttak sammenlignet med løpende feed?
- Følger kryssreferanser til NFF-, FIKS-, TV 2- og Enetpulse-ID-er med?

NIFS-nettstedets `robots.txt` blokkerer alle roboter. Nettstedet bør ikke skrapes; API eller avtalt eksport er riktig spor. En eventuell MIT-lisens på OpenAPI-spesifikasjonen gjelder programvarebeskrivelsen, ikke automatisk sportsdataene eller rapporttekstene.

### 5.2 NFF/FIKS

Viktige identiteter:

```text
AaFK klubb:       fiksId=996
AaFK senior menn: fiksId=15
```

Innganger:

- [AaFKs offentlige lagside](https://www.fotball.no/fotballdata/lag/hjem/?fiksId=15&underside=kamper)
- Kampdetalj: `https://www.fotball.no/fotballdata/kamp/?fiksId={intern_kamp_id}`
- Hendelser: `https://www.fotball.no/fotballdata/kamp/?fiksId={intern_kamp_id}&underside=kamphendelser`

Den interne `fiksId`-en i kamp-URL-en er ikke det samme som kampnummeret som vises på siden.

Påviste eksempler:

- [Detaljert kamp fra 2003](https://www.fotball.no/fotballdata/kamp/?fiksId=3481158)
- [Kamp fra 1996 med resultat, arena, publikum og funksjonærer](https://www.fotball.no/fotballdata/kamp/?fiksId=3478068)
- [Detaljert kamp fra 1997](https://www.fotball.no/fotballdata/kamp/?fiksId=3475836)
- [Detaljert kamp fra 1998](https://www.fotball.no/fotballdata/kamp/?fiksId=3475917)
- [Rik kampdata fra 2001/02-perioden](https://www.fotball.no/fotballdata/kamp/?fiksId=3459421)
- [1990-turnering med resultater](https://www.fotball.no/fotballdata/turnering/hjem/?fiksId=83051)
- [Kvalifisering til 1. divisjon 2000, spilt i 1999](https://www.fotball.no/fotballdata/turnering/hjem/?fiksId=83145)

Mulige felter:

- Dato og klokkeslett.
- Lag, sluttresultat og pauseresultat.
- Turnering, runde og kampnummer.
- Arena og underlag.
- Tilskuertall.
- Startoppstilling, benk, kaptein og lagledelse.
- Mål med tidspunkt og type.
- Kort med årsak.
- Bytter.
- Dommere, assistenter, fjerdedommer og nyere VAR-roller.

Det finnes også et kalenderendepunkt som brukes av nettstedet:

```text
https://www.fotball.no/footballapi/Calendar/GetCalendar?tournamentId={turnerings-id}
```

At endepunktet er teknisk tilgjengelig betyr ikke at det er et åpent, lisensiert API.

Eldre importerte data må kvalitetsmerkes. NFF-sider fra 1990-tallet kan ha resultat og arena, men mangle lagoppstillinger og hendelser. Enkelte opplysninger kan også være feil. Den offentlige 1999-kvalifiseringen er bekreftet, mens full terminliste for AaFKs 2. divisjon i 1999 og full 2000-sesong ikke er bekreftet i denne kartleggingen.

[NFFs FIKS-vilkår](https://www.fotball.no/tema/om-nff/nffs-personvernerklaring/fiks/brukervilkar/) og nettstedets bunntekst sier at NFF eier dataene, at gjenbruk krever avtale, og at automatiserte roboter og spidere ikke er tillatt.

Prosjektet bør derfor be NFF om en engangseksport, en API-avtale eller skriftlig tillatelse til et begrenset historisk uttrekk.

### 5.3 UEFA

UEFA oppgir 14 Europa League-kamper for AaFK:

- 2010/11: 2 kamper.
- 2011/12: 8 kamper.
- 2012/13: 4 kamper.

Innganger:

- [AaFKs UEFA-historikk, klubb-ID 82819](https://www.uefa.com/uefaeuropaleague/history/clubs/82819--aalesund/)
- [Eksempel: AaFK–Tirana](https://www.uefa.com/uefaeuropaleague/match/2009741--aalesund-vs-tirana/matchinfo/)

UEFA-sidene kan ha egne visninger for kampinfo, hendelser og lagoppstillinger. UEFA forbyr systematisk innsamling i vilkårene. Kilden bør brukes manuelt til kontroll eller gjennom avtale.

### 5.4 Global Sports Archive / Data Sports Group

AaFK bruker `teamId=1361`.

- [AaFKs kampside](https://globalsportsarchive.com/en/soccer/team/aalesunds-fk/1361/matches)
- [Sogndal–AaFK 25. mai 2003](https://globalsportsarchive.com/en/soccer/match/2003-05-25/sogndal-fotball-vs-aalesunds-fk/205387)
- [Prisforespørsel for Global Sports API](https://www.globalsportsapi.com/home/pricing)

2003-eksemplet inneholder:

- Slutt- og pauseresultat.
- Arena og tilskuertall.
- Hoveddommer, assistenter og fjerdedommer.
- Komplette startellevere og benker.
- Trenere.
- Mål, kort og bytter med minutter.

Dette gjør kilden til en interessant kandidat for strukturert historikk fra minst 2003. Åpen `robots.txt` er ikke det samme som tillatelse til kommersiell gjenbruk. Be leverandøren dokumentere dekning for serie, cup, Europa og privatkamper før en avtale inngås.

## 6. Klubb- og lokalhistoriske kilder

### 6.1 AaFK Historisk Arkiv

[AaFK Historisk Arkiv](https://www.aafk.no/historisk-arkiv) er den viktigste inngangen til klubbens egen historie.

Kartleggingen fant:

- [Medlemsblad 1950–1979](https://www.aafk.no/historisk-arkiv/medlemsblad-1950-1979): 149 utgaver og 1 862 sider.
- [Direkte NB-søk i medlemsbladene](https://www.nb.no/search?mediatype=tidsskrift&seriestitle=%22Medlemsblad+for+Aalesunds+fotballklubb%22).
- [Jubileumshefter](https://www.aafk.no/historisk-arkiv/jubileumhefter).
- [Oversikt over bøker](https://www.aafk.no/historisk-arkiv/boker).
- [«Tango siden 1914»](https://www.nb.no/items/806b1f18be55956b70c68ec5876c62e5?page=0).
- [«Opp fra Myra»](https://www.nb.no/items/6192bd2eb1584db142ca3286b16adb73?page=0&searchText=aalesunds+fotballklubb).
- [«CUP-minner»](https://www.nb.no/items/30c43cd380a0425ff2de901fa28c1363?page=0&searchText=aalesunds+fotballklubb).
- [«Supporterserien 2013: Aalesund»](https://www.nb.no/items/91b5d5776c9d0595a9a953b9a07788eb?page=0&searchText=aalesunds+fotballklubb).
- [«Aalesund Quiz»](https://www.nb.no/items/fd430e124c560297b404a707b3757f33?page=0&searchText=aalesunds+fotballklubb).
- [Kontaktinformasjon for Historisk Arkiv](https://www.aafk.no/historisk-arkiv/kontakt).

Materialet kan inneholde kampreferater, spillerstatistikk, bilder og opplysninger fra klubbens første år. Klubben har også omtalt interne foto- og statistikkdatabaser som kan undersøkes gjennom samarbeid eller besøk.

Nyere AaFK-artikler følger normalt mønsteret `https://www.aafk.no/nyheter/{slug}`. Et påvist eksempel er [kampreferatet AaFK–Tromsø 2–6](https://www.aafk.no/nyheter/kampreferat-aafk-tromso-2-6). Arkivet er ujevnt, men artikler er påvist tilbake til minst 2017.

AaFKs nettsted ligger på en felles NTF-plattform. [NTFs vilkår](https://www.obos-ligaen.no/vilkar-og-betingelser) begrenser kopiering, lagring og automatisert bruk. Be klubben om CMS-eksport i stedet for å crawle plattformen.

En ønsket eksport bør minst ha:

```text
canonical_url
published_at
updated_at
author
title
lead
body_html
tags
media_references
legacy_id
```

Rett til tekst, bilder og video må avklares separat.

### 6.2 Sunnmørsposten

Sunnmørsposten ble etablert før AaFK og er den viktigste løpende, samtidige lokalkilden fra 1914.

Tre arkivlag er relevante:

1. Nasjonalbibliotekets skannede papiraviser, særlig før det moderne nettarkivet.
2. [Sunnmørspostens søkbare eAvisarkiv fra 10. november 2004](https://www.buyandread.com/next/pub.htm?pub=24).
3. `smp.no` og `tv.smp.no` for nettartikler, video, direktesendinger og reaksjoner.

Påviste eksempler:

- [Betalingsmuret kampartikkel](https://www.smp.no/sport/i/Ear2p5/aafk-tok-poeng-i-sjansefattig-kamp).
- [Historisk langformat om Henrik Hoff](https://interaktiv.smp.no/2017/shorthand/hoff/).
- [Video: treningskamp Molde–AaFK](https://tv.smp.no/video/21806/treningskamp-molde-fk-aalesunds-fk).
- [Video: HamKam–AaFK](https://tv.smp.no/video/23214/direkte-hamkam-aafk).

Påviste URL-mønstre:

```text
https://www.smp.no/sport/i/{id}/{slug}
https://www.smp.no/sport/aafk/i/{id}/{slug}
https://tv.smp.no/video/{numerisk_id}/{slug}
https://www.smp.no/sitemaps/smpno-root-sitemap.xml
https://tv.smp.no/sitemaps/smp-play-sitemap.xml
```

`smp.no/robots.txt` blokkerer mange navngitte søke- og KI-boter. Betalingsmur eller abonnementsinnlogging må ikke omgås. Be Polaris/Sunnmørsposten om én av disse modellene:

- Metadata, tittel, ingress, dato og lenke.
- Begrenset arkiv-API eller eksport av AaFK-treff.
- Rett til å lage egne sammendrag med kildehenvisning.
- Avtalte korte utdrag.
- Innbygging av godkjent videospiller.

### 6.3 Sunnmøre Fotballkrets og NFF-årbøker

Sunnmøre Fotballkrets har historiske årsberetninger og annen kretsdokumentasjon:

- [Kretsens historieside](https://www.fotball.no/kretser/sunnmore/om-kretsen/historie/)
- [Årsrapport 1973](https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1973.pdf)
- [Eksempel på eldre skannet rapport fra 1956](https://historikk.com/dokument/femti89.pdf)

Årsberetningene kan dokumentere tabeller, sesongforløp, organisatoriske forhold og hvilke andre trykte kilder som inneholder enkeltresultater. Rapporten fra 1973 peker blant annet på NFFs årbok for individuelle resultater.

Historisk forskning bør også undersøke:

- NFFs årbøker, utgitt årlig siden 1912.
- NFFs adressebøker fra omkring 1940.
- NFFs historieverk.
- Norske fotballencyklopedier.
- Lokale og nasjonale sportsperiodika.

## 7. Medie- og arkivkilder

### 7.1 Nasjonalbibliotekets avissamling

[Nasjonalbibliotekets avissamling](https://www.nb.no/samlingen/aviser/) er så godt som komplett fra 1763 til i dag. For AaFK kan den brukes til Sunnmørsposten, Møre-Nytt, Sunnmøringen, Romsdals Budstikke og motstanderens lokalaviser.

Viktige innganger:

- [Veiledning for avissøk og tilgang](https://www.nb.no/avisveiledning/)
- [NBs API-dokumentasjon](https://api.nb.no/)
- [Søketips](https://www.nb.no/hjelp-og-informasjon/slik-soker-du-i-samlingen/)
- [Tilgang og rettigheter](https://www.nb.no/tilgang/rettigheter/)

Et framtidig oppdagelsessøk kan se slik ut:

```text
https://api.nb.no/catalog/v1/items
  ?q=%22Aalesunds%20Fotballklubb%22
  &filter=mediatype:aviser
  &snippets=aviser
  &fragments=2
  &fragSize=300
  &page=0
  &size=20
```

Katalog-API-et kan returnere:

- Avisnavn og serie.
- Utgivelsesdato.
- URN og dokument-ID.
- Side og korte OCR-fragmenter.
- `accessInfo`, `license`, `viewability` og `isPublicDomain`.

API-et bør brukes til å finne og indeksere kilder, ikke til å rekonstruere hele beskyttede artikler fra OCR-fragmenter. NBs `robots.txt` oppgir fire sekunders crawl-forsinkelse.

Gode søkevarianter:

```text
"Aalesunds Fotballklubb"
"Aalesunds FK"
AaFK
Aafk
"Aa. F. K."
Aalesund
Ålesund
{motstander} + {kampdato}
```

OCR-feil gjør at fuzzy søk, spillernavn og kampdato ± tre dager ofte er nødvendig.

Aviser eldre enn 90 år er normalt åpne. Nyere materiale kan kreve tilgang på bibliotek eller forsknings-/dokumentasjonssøknad. Strømmetilgang betyr ikke rett til nedlasting eller viderepublisering.

### 7.2 Nasjonalbibliotekets nettarkiv

Nettarkivet kan gjenfinne døde eller endrede URL-er fra `aafk.no`, `smp.no`, `tv2.no` og motstanderklubber.

- [Informasjon om tilgang til nettarkivet](https://www.nb.no/samlingen/nettarkivet/tilgang-til-nettarkivet/)
- [URL-søk](https://nettarkivet.nb.no/search/)
- [Åpen prototype](https://nettarkivet.beta.nb.no/)

Den åpne prototypen dekker foreløpig hovedsakelig offentlige nettsteder fra 2005–2013. Redaktørstyrte nettsteder kan kreve bruk av særskilte bibliotekterminaler. Nettarkivet er derfor et manuelt gjenfinningslag, ikke et produksjons-API.

### 7.3 Radio- og TV-arkivet

[NBs kringkastingsarkiv](https://www.nb.no/samlingen/kringkasting/) omfatter blant annet:

- Komplett samling av NRKs sendinger etter 1990.
- TV 2 og TVNorge fra 1992.
- Historiske NRK-radio- og TV-programmer før 1990.
- Distriktsnyheter, Radiosporten, Dagsrevyen og store cup-/europakamper.

Dette er særlig interessant for viktige kamper, intervjuer og samtidige vurderinger. Materialet må normalt undersøkes manuelt, og publisering av klipp eller transkripsjoner krever rettighetsavklaring.

[NRKs arkivinformasjon](https://info.nrk.no/tv-spons-og-salg-av-nrks-innhold/arkiv/) beskriver søk, rettighetsklarering og levering av klipp. Nasjonalbiblioteket viser til `innholdssalg@nrk.no` og `nyhetssalg@tv2.no` for bruksrettigheter.

### 7.4 Retriever/Atekst

[Retriever Mediearkiv](https://retriever.no/no/blog/medieinnsikt-med-atekst) gir samlet søk i et stort antall nordiske kilder, med deler av historikken tilbake til 1980-årene.

Styrker:

- Sunnmørsposten og motstanderens lokalavis i samme søk.
- Papirartikler uten fungerende nettadresse.
- NTB-stoff som er republisert i flere aviser.
- Tittel, ingress, dato og fulltekst der abonnementet tillater det.

Begrensninger:

- Kommersiell og kildeavhengig tilgang.
- Ingen rett til systematisk masseuthenting gjennom vanlig abonnement.
- Universitetstilganger har uttaksgrenser og skal ikke automatiseres.

[NTNUs veiledning](https://i.ntnu.no/wiki/-/wiki/Norsk/tilgang%2Btil%2Batekst) sier uttrykkelig at automatisk eller massiv nedlasting ikke er tillatt, og oppgir en grense på 400 artikler per bruker. Bruk Retriever manuelt til hullanalyse eller inngå en egen prosjektavtale.

### 7.5 NRK

NRK Møre og Romsdal, Radiosporten og det gamle nettarkivet kan ha:

- Direkterapporter.
- Etterkampintervjuer.
- Distriktsnyheter.
- Analyse av større serie-, cup- og europakamper.

Eksempler:

- [Radiosportens serieåpning i 2007](https://arkiv.nrk.no/programoversikt/avansert/index685c.html)
- [Omtale av AaFKs europacuptap mot AZ](https://arkiv.nrk.no/blogg.nrk.no/fotball/2011/08/26/er-norsk-toppfotball-i-ferd-med-a-ratne-pa-rot/index.html)
- [Kampkontekst rundt Molde–Aalesund 5–2](https://arkiv.nrk.no/blogg.nrk.no/fotball/2011/07/06/sunny-makeover/index.html)

NRKs `robots.txt` reserverer innholdet mot tekst-/datautvinning og KI-bruk. [PSAPI-dokumentasjonen](https://psapi.nrk.no/documentation/) sier at API-ene er laget for NRKs egen bruk og ikke kan brukes til å lage offentlige tredjepartstjenester. NRK bør derfor håndteres manuelt eller gjennom avtale.

### 7.6 TV 2 Livesport

TV 2 Livesport kan inneholde noen av de rikeste maskinlesbare moderne kampsidene:

- Kampinfo, pause- og sluttresultat.
- Lagoppstillinger og bytter.
- Mål, kort, cornere og andre hendelser.
- Minutt-for-minutt-journalistikk.
- Redaksjonell oppsummering.
- Egne visninger for statistikk, lag, oversikt og referat.

Påviste eksempler:

- [Spjelkavik–Aalesund 0–1, NM 2016](https://www.television.no/livesport/fotball/kamper/spjelkavik-aalesund/6aac6db0-b8d3-5d0f-bfb5-d9b9765e0c79/referat)
- [Aalesund–Vålerenga 1–1, 2020](https://www.television.no/livesport/fotball/kamper/aalesund-valerenga/bb3ef672-8fe0-4db2-9e51-96bfa63c4997/referat)
- [Aalesund–Egersund 2–3, 2025, statistikk](https://www.television.no/livesport/fotball/kamper/aalesund-egersund/a9158f20-7baf-52b2-9ff2-b47434844a3f/stats)

URL-mønster:

```text
https://www.television.no/livesport/fotball/kamper/{hjemme}-{borte}/{uuid}/{referat|stats|lag|oversikt}
```

`television.no` presenteres som TV 2 Livesport og bør rettighetsmessig behandles som TV 2-innhold til noe annet er skriftlig avklart. TV 2s `robots.txt` forbyr automatisert tilgang, uthenting, datamining og databasebygging uten skriftlig forhåndssamtykke.

## 8. Uoffisielle og alternative historikkilder

### 8.1 RSSSF Norge

RSSSF har enkle og stabile HTML-sider med norsk serie- og cuphistorikk.

Eksempler:

- [NM 1921](https://rsssf.no/1921/Cup.html)
- [NM 1922](https://www.rsssf.no/1922/Cup.html)
- [NM 1926](https://www.rsssf.no/1926/Cup.html)
- [NM 1927](https://www.rsssf.no/1927/Cup.html)
- [3. divisjon 1980](https://www.rsssf.no/1980/Third.html)
- [NM 1980](https://www.rsssf.no/1980/Cup.html)
- [1. divisjon 1997](https://www.rsssf.no/1997/First.html)
- [1. divisjon 2002](https://www.rsssf.no/2002/First.html)

Høyere divisjoner har oftere komplette kampresultater. Eldre og lavere nivåer kan være begrenset til sluttabell. RSSSF har vanligvis ikke lagoppstillinger eller rapporttekst.

Sidene tillater privat, ikke-kommersiell kopiering med kildeangivelse, men ber om tillatelse til kommersiell bruk. Kilden egner seg godt til å finne hull og kontrollere kronologi.

### 8.2 Motstanderklubbenes historikksider

Historikksider hos andre klubber kan inneholde materiale som har forsvunnet fra AaFKs egne nettsider.

Påviste eksempler:

- [Tromsø ILs statistikk mot Aalesund](https://statistikk.til.no/lag/aalesund-fk)
- [Lyns motstanderoversikt for Aalesund](https://lynhistorie.no/statistikk/motstander_detalj.php?lag=Aalesund)
- [Lyns kampdetalj fra 1987](https://lynhistorie.no/kamper/kamp.php?id=754)
- [Rosenborgs kampreferat «Poengtap på overtid»](https://www.rbk.no/nyheter/poengtap-pa-overtid)
- [Rosenborg-webs historiske omtale](https://www.rbkweb.no/vis/14215)

Disse kildene bør søkes etter at en kanonisk kampliste finnes. For en bestemt kamp er søk på hjemmelag, bortelag og dato mer effektivt enn generell crawling av hele nettstedet.

### 8.3 Motstanderens lokalavis

Eksempler på aktuelle avispar:

| Motstander/område | Aktuell kilde |
| --- | --- |
| Molde | Romsdals Budstikke |
| Rosenborg | Adresseavisen |
| Brann | Bergens Tidende |
| Viking/Bryne | Stavanger Aftenblad/Jærbladet |
| Start | Fædrelandsvennen |
| Tromsø | iTromsø/Nordlys |
| Stabæk | Budstikka |
| Lillestrøm | Romerikes Blad |
| Hødd og søre Sunnmøre | Vikebladet, Møre-Nytt og lokale arkiver |

Motstanderavisen er særlig viktig når Sunnmørsposten mangler, når kampen gikk på bortebane, eller når man ønsker to uavhengige beskrivelser av kampbildet.

### 8.4 VG Live og andre liveplattformer

VG Live har automatiserte tidslinjer og rapporter, for eksempel [KFUM–Aalesund](https://vglive.vg.no/fotball/kfum-aalesund/480664/rapport). Kilden kan være god for manuell kontroll av moderne hendelser, men bør ikke automatiseres uten avklaring av vilkår og underliggende dataleverandør.

## 9. Moderne resultattjenester

Disse tjenestene er nyttige for kontroll, men bør ikke være grunnmuren i databasen.

### 9.1 Identiteter

```text
NTB/NIFS       teamId 46
NFF/FIKS       teamId 15, clubId 996
UEFA           clubId 82819
FotMob         teamId 8404
Sofascore      teamId 677
Transfermarkt  clubId 5619
Soccerway      legacy teamId 1602
Flashscore     teamId nyrL8gfh
GSA            teamId 1361
Wikidata       Q214992
```

### 9.2 FotMob

- [AaFK, lag-ID 8404](https://www.fotmob.com/teams/8404/fixtures/aalesund)
- [AaFK–AZ fra 2011](https://www.fotmob.com/matches/aalesund-vs-az-alkmaar/2vd3xd)
- [FotMobs vilkår](https://www.fotmob.com/term-of-service)

Nyere kamper kan ha xG, momentum, skuddkart, lagoppstilling, skader, odds og livekommentar. Eldre kamper kan være begrenset til resultat og enkelte hendelser. Interne API-ruter er udokumenterte og har endret seg. Vilkårene forbyr automatiserte tjenester og systematisk eller regelmessig bruk.

### 9.3 Transfermarkt

- [AaFKs kampplan, klubb-ID 5619](https://www.transfermarkt.com/aalesunds-fk/spielplan/verein/5619)
- [Sesong 2010](https://www.transfermarkt.com/aalesunds-fk/spielplan/verein/5619/saison_id/2010/plus/1)
- [Transfermarkts vilkår](https://www.transfermarkt.us/intern/anb)

Sesongvis dekning er sammenhengende hovedsakelig fra 2002/03. Nyere kamper kan ha publikum, formasjon, lagoppstilling og hendelser. Automatisert kopiering og skjermskraping er forbudt.

### 9.4 Sofascore

- [AaFK, lag-ID 677](https://www.sofascore.com/football/team/aalesunds-fk/677)
- [Motherwell–AaFK 2010](https://www.sofascore.com/football/match/motherwell-aalesunds-fk/CnsWW)
- [Sofascores vilkår](https://www.sofascore.com/pl/terms-and-conditions)

Udokumenterte endepunkter har typisk hatt mønstre som:

```text
/api/v1/team/677/events/last/{page}
/api/v1/event/{id}/statistics
/api/v1/event/{id}/incidents
/api/v1/event/{id}/lineups
/api/v1/event/{id}/shotmap
```

Endepunktene returnerte HTTP 403 under teknisk kontroll i kartleggingen. Vilkårene forbyr automatisert uttrekk, aggregering og reproduksjon uten samtykke.

### 9.5 Soccerway og Flashscore

- [Soccerway, gammel AaFK-ID 1602](https://www.soccerway.com/teams/norway/alesunds-fotballklub/1602/matches/)
- [Stabæk–AaFK 2003](https://www.soccerway.com/matches/2003/10/26/norway/eliteserien/stabak-idrettsforening/alesunds-fotballklub/51598/)
- [Flashscore, AaFK-ID `nyrL8gfh`](https://www.flashscore.com/team/aalesund/nyrL8gfh/results/)
- [Livesports vilkår](https://www.livesport.eu/terms-of-use/en)

Begge ligger i Livesport-universet og bør ikke behandles som to uavhengige valideringskilder. Vilkårene forbyr automatiserte forespørsler, scraping og gjenskaping av databasen. Flashscore har også identitetsrisiko fordi AaFK og AaFK 2 kan blandes.

### 9.6 worldfootball.net

Sesong-URL-er følger normalt mønsteret:

```text
https://www.worldfootball.net/teams/aalesunds-fk/{season}/3/
```

[Innbyrdes oppgjør mot Odd](https://www.worldfootball.net/teams/aalesunds-fk/odds-bk/11/) viser AaFK-data fra 2003 og nyere. Kilden er nyttig for dato, runde og pause-/sluttresultat, men egne vilkår sier at historikken kan være ufullstendig.

## 10. Åpne datasett og identitetskilder

### 10.1 football-data.co.uk

[Norske CSV-filer](https://www.football-data.co.uk/norway.php) finnes for toppserien fra omkring 2012/13. Nyere år kan inneholde skudd, cornere, kort og odds. [Feltbeskrivelse](https://www.football-data.co.uk/notes.txt).

Kilden dekker ikke OBOS-ligaen, NM eller eldre perioder hvor AaFK var utenfor toppserien. Gjenbrukslisensen er ikke tydelig nok til å anta fri offentlig bruk.

### 10.2 Kaggle

[Domestic Football Results 1888–2019](https://www.kaggle.com/datasets/schochastics/domestic-football-results-from-1888-to-2019) kan brukes til bulk-kontroll av toppserieresultater. Lisens, opphav og datakvalitet må vurderes for hvert enkelt datasett.

### 10.3 OpenFootball

[OpenFootball `football.json`](https://github.com/openfootball/football.json) publiserer tilgjengelige datasett som public domain. Norsk AaFK-dekning er ikke bekreftet og må undersøkes før kilden planlegges inn.

### 10.4 Wikidata og Wikipedia

- [AaFK på Wikidata, Q214992](https://www.wikidata.org/wiki/Q214992)
- [Wikidata Data access](https://www.wikidata.org/wiki/Help:Data_access)
- [Wikidata-lisensen](https://www.wikidata.org/wiki/Wikidata:Licensing)

Wikidata er CC0 og egner seg til klubbidentitet, navnevarianter og eksterne ID-er. Den inneholder lite strukturert informasjon om hver kamp. Wikipedia-sesongsider kan hjelpe med referanser og resultatmatriser, men tekstinnholdet er CC BY-SA og må attribueres etter lisensen.

### 10.5 Norsk aviskorpus

[Norwegian Newspaper Corpus](https://data.norge.no/en/datasets/50245b01-99a2-3fd0-b288-bdfd91ebf57c/norwegian-newspaper-corpus) dekker 1998–2019 og er publisert med CC BY-NC 4.0. Eldre dokumentasjon oppgir Sunnmørsposten blant kildene. Det kan være nyttig til forskning og prototyping, men `NC` gjør det uegnet som ukritisk grunnlag for en kommersiell tjeneste.

NB har også et [nettaviskorpus for 2019–2022](https://www.nb.no/samlingen/nettarkivet/forskning/korpus-med-nettaviser/) til analyse gjennom digital-humaniora-infrastruktur. Tilgang og publiseringsrett må vurderes separat.

## 11. Dekningsstrategi per periode

### 1914–1948

Primærkilder:

- Sunnmørsposten og andre aviser hos NB.
- AaFKs jubileumsbøker og klubbarkiv.
- NFFs årbøker og adressebøker.
- Sunnmøre Fotballkrets.
- RSSSF for cup og enkelte nasjonale turneringer.

Dette blir den mest manuelle perioden. OCR, navnevarianter og endrede turneringsstrukturer gjør kildekontroll nødvendig.

### 1949–1979

Primærkilder:

- NTB/NIFS dersom dekningen kan leveres.
- AaFKs medlemsblad 1950–1979.
- Sunnmørsposten og motstanderaviser.
- NFF-årbøker og kretsrapporter.
- RSSSF for serie og cup der kampnivå finnes.

Medlemsbladene er spesielt viktige for fortellende rapporter og spilleropplysninger.

### 1980–2001

Primærkilder:

- NTB/NIFS.
- NFF/FIKS, med kontroll av importfeil.
- RSSSF.
- Sunnmørsposten, Retriever og NB.
- Klubb- og motstanderhistorikk.

Denne perioden bør kunne få en rimelig komplett kampkronologi, men lagoppstillinger og hendelser vil variere.

### 2002–2015

Primærkilder:

- NFF/FIKS.
- NTB/NIFS.
- Global Sports Archive.
- Sunnmørspostens eAvis fra 2004.
- TV 2, NRK og klubbnettsider.
- Transfermarkt, FotMob og Soccerway som manuell kontroll.

Her bør lagoppstillinger og hendelser kunne bli gode for en stor andel av kampene.

### 2016–nåtid

Primærkilder:

- NTB og Fotballrobot.
- NFF/FIKS.
- AaFKs egne kampreferater.
- TV 2 Livesport.
- Sunnmørsposten og NRK.
- Moderne statistikkleverandører.

Dette er den enkleste perioden å automatisere, forutsatt at nødvendige avtaler inngås.

## 12. Rettslig og praktisk risikomodell

### 12.1 Én gangs innhenting er ikke et frikort

At et historisk uttrekk bare gjøres én gang reduserer belastningen på nettstedet. Det fjerner ikke nødvendigvis risikoen knyttet til avtalevilkår, opphavsrett eller databasevern.

[Åndsverkloven § 24](https://lovdata.no/dokument/LTI/lov/2018-06-15-40/%C2%A72) gir databaseprodusenten enerett til uttrekk eller gjenbruk av hele eller vesentlige deler av en database når innsamling, kontroll eller presentasjon har krevd en vesentlig investering. Bestemmelsen omfatter også gjentatt og systematisk uttrekk av mindre deler i visse tilfeller.

Et komplett engangsuttrekk kan derfor ligne tydeligere på uttrekk av en vesentlig del enn noen få manuelle oppslag.

Regjeringen fremmet i mars 2026 [Prop. 41 LS (2025–2026)](https://www.regjeringen.no/no/dokumenter/prop.-41-ls-20252026/id3154279/) med forslag til nye regler om tekst- og datautvinning. Ved kartleggingen 3. august 2026 viste [Stortingets saksside](https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=200243) at lovforslaget fortsatt var til behandling i komiteen. Prosjektet bør ikke anta at et nytt generelt unntak gjelder før lovendring og ikrafttredelse er bekreftet.

### 12.2 Fakta, databaser og redaksjonell tekst

Tre lag må holdes fra hverandre:

1. **Enkeltfakta:** dato, resultat og målscorer har et annet vern enn en skrevet artikkel.
2. **Databasesammenstillingen:** et omfattende uttrekk av én leverandørs samlede data kan være databasevernet selv om enkeltfakta ikke er det.
3. **Kamprapporten:** journalistens formuleringer, analyse, bilder, lyd og video er normalt opphavsrettslig vernet.

Et vanlig abonnement gir lesetilgang, ikke automatisk rett til automatisert uttrekk, lagring eller republisering.

### 12.3 Trafikklys for innhenting

#### Grønt

- Dokumenterte, åpne API-er innenfor lisensen.
- Wikidata og andre eksplisitt CC0-/public-domain-kilder.
- NBs katalog-API for metadata og tillatte OCR-fragmenter.
- Materiale som er falt i det fri, etter kontroll av metadata.
- Data mottatt gjennom skriftlig avtale.

#### Gult

- Åpne klubb- og historikksider uten eksplisitt automatiseringsforbud.
- Global Sports Archive før lisens er avklart.
- RSSSF til intern, ikke-kommersiell forskning.
- Åpne motstanderartikler og historikkprosjekter.

På gule kilder bør prosjektet hente få sider, holde lav fart, identifisere crawleren, lagre kildehenvisning og unngå fulltekst i produksjonsdatabasen.

#### Rødt

- NFF/FIKS uten avtale.
- NIFS-nettstedet.
- FotMob, Transfermarkt, Sofascore og Livesport.
- TV 2, NRK og SMP der automatisering er reservert eller forbudt.
- Retriever gjennom vanlig bruker- eller universitetstilgang.
- Alt bak betalingsmur, CAPTCHA eller innlogging uten uttrykkelig maskintilgang.

### 12.4 Grenser som ikke bør krysses

Prosjektet bør ikke:

- Omgå betalingsmur eller autentisering.
- Bruke private eller lekkede API-nøkler.
- Omgå CAPTCHA eller ratebegrensning.
- Rotere IP-adresser for å skjule eller videreføre blokkert trafikk.
- Etterligne mobilapper for å omgå tilgangskontroll.
- Massehente bilder, video eller komplette avisarkiver.
- Publisere kopierte kamprapporter.
- Bruke maskinparafrasering av én beskyttet artikkel som omvei rundt lisens.

## 13. Forsvarlig modell for en uoffisiell engangshøsting

En kontrollert engangshøsting kan være nyttig som intern kartlegging, særlig på grønne og gule kilder. Formålet bør først være å finne dekning, URL-er, kildetyper og hull — ikke å publisere alt som kan lastes ned.

### 13.1 Fire adskilte lag

```text
source_discovery
  URL, tittel, dato, kilde-ID og mulig kamp

research_cache
  eventuelt råmateriale til intern analyse
  aldri direkte tilgjengelig fra offentlig nettside

normalized_facts
  egne kampfelter med kilde og sikkerhetsgrad

publishable_content
  klarerte fakta, egne sammendrag og lisensiert tekst
```

Hver kilde bør ha maskinlesbare regler:

```text
access_policy
robots_status
terms_status
allowed_content
publication_rights
raw_storage_allowed
rate_limit
last_reviewed_at
```

### 13.2 Teknisk opptreden på gule kilder

- Én samtidig forespørsel per domene.
- Flere sekunder mellom forespørsler.
- Fast, ærlig `User-Agent` med prosjekt og kontaktadresse.
- Lokal URL-cache slik at samme side ikke hentes på nytt.
- Støtte for gjenopptakelse fremfor omstart.
- Respekt for HTTP 429, 403 og `Retry-After`.
- Ingen innlogging, CAPTCHA-omgåelse eller skjult nettleserautomatisering.
- Innholdshash for deduplisering.
- Full logg over URL, tidspunkt, responsstatus og kildeversjon.
- En kill switch per kilde.

### 13.3 Hva engangscrawlen bør produsere

Første resultat bør være en kildeindeks:

```text
source_url
publisher
source_type
title
published_at
possible_match_id
access_status
rights_status
content_available
last_checked_at
```

Den bør ikke automatisk flytte full artikkeltekst inn i produksjonsdatabasen.

## 14. Foreslått datamodell

### 14.1 Kamp

```text
match
  id
  match_type
  status
  date
  kickoff_time
  season
  competition_id
  round
  home_team_id
  away_team_id
  venue_id
  score_ht_home
  score_ht_away
  score_ft_home
  score_ft_away
  score_et_home
  score_et_away
  penalties_home
  penalties_away
```

### 14.2 Kildekobling

```text
match_source
  id
  match_id
  source_id
  source_match_id
  source_team_id
  original_url
  archived_url
  retrieved_at
  rights_status
  source_perspective
```

### 14.3 Observasjon per felt eller påstand

```text
observation
  id
  match_id
  source_id
  claim_type
  value
  page_or_timestamp
  confidence
  is_fact
  is_editorial_assessment
  conflicts_with
```

Dette gjør det mulig å bevare at NFF oppgir 4 318 tilskuere mens Sunnmørsposten oppgir 4 381, i stedet for å overskrive konflikten.

### 14.4 Fortellende kilder

```text
narrative_source
  id
  match_id
  publisher
  publication_or_program
  title
  byline
  published_at
  original_url
  page_or_timestamp
  language
  paywall
  rights_basis
  perspective
  allowed_excerpt
```

```text
narrative
  id
  match_id
  text
  generation_method
  supporting_source_ids
  publication_rights
  model_and_version
  reviewed_by
  reviewed_at
```

### 14.5 Navn og identitet

Lag, turneringer, arenaer og personer trenger aliaser:

```text
entity_alias
  entity_type
  entity_id
  alias
  valid_from
  valid_to
  source_id
```

Eksempler på nødvendige AaFK-varianter er `Aalesunds Fotballklubb`, `Aalesunds FK`, `Aalesund`, `Ålesund`, `AaFK`, `Aafk` og OCR-varianter som `Aa. F. K.`.

## 15. Kobling og kvalitetskontroll

En kamp bør i utgangspunktet kobles på:

```text
(dato, turnering, hjemmelag, bortelag, resultat)
```

Men systemet må tåle:

- Kampdato som avviker én dag i eldre kilder.
- Utsatte kamper.
- Historiske klubbnavn og navneendringer.
- Ekstraomganger og straffesparkkonkurranse.
- Nøytral bane.
- Omvendt hjemme-/bortelag i enkelte kilder.
- Feil i OCR eller historisk import.
- AaFK versus AaFK II.

Foreslåtte sikkerhetsnivåer:

```text
verified_official
verified_multiple_sources
probable
single_source
conflicting
unverified
```

Hvert felt bør ha egen sikkerhetsgrad. En kamp kan ha sikkert resultat, men usikkert tilskuertall og ufullstendig lagoppstilling.

## 16. Modell for egne kamprapporter

Den offentlige rapporten bør være en ny, selvstendig tekst. Den bør ikke være en kopiert eller lett omskrevet avisartikkel.

Et godt datagrunnlag er:

- Resultatutvikling.
- Mål og assist.
- Kort og utvisninger.
- Lagoppstillinger og bytter.
- Kampstatistikk.
- Korte, nødvendige og attribuerte sitater.
- Samtidige vurderinger fra minst to kilder.

Rapporten bør markere hva slags tekst den er:

```text
licensed_original_report
editorial_summary
automated_event_summary
historical_reconstruction
```

For tidlige kamper kan `historical_reconstruction` være mer ærlig enn å late som man har et fullstendig kampreferat.

Perspektiver bør bevares. «AaFK dominerte» er en redaksjonell vurdering; «AaFK hadde 14 avslutninger mot 7» er et faktum fra en bestemt statistikkilde.

## 17. Billig og effektiv agentflyt

### 17.1 Prinsipp

Del arbeidet etter kilde og tidsperiode, ikke med én agent per kamp. En kildeagent kan gjenbruke søkemønstre, parser og cache for mange kamper. Det reduserer nettverkstrafikk, modellbruk og duplikatarbeid.

### 17.2 Foreslått arbeidsflyt

1. **Bygg kanonisk kampskall.** Bruk lisensiert NTB-/NFF-eksport, RSSSF og åpne kilder til dato, motstander, turnering og resultat.
2. **Kjør deterministisk kildesøk.** Søk på dato ± tre dager, begge lag og navnevarianter. Ikke bruk en språkmodell til vanlig URL-oppdagelse.
3. **Lag bare kildeindeks først.** Registrer tittel, dato, URL, tilgangstype og mulig kamp-ID.
4. **Dedupliser.** NTB-stoff og syndikerte artikler kan ligge i mange aviser med små overskriftsendringer.
5. **Kjør billig klassifisering.** En liten modell kan avgjøre hvilken kamp en tekst gjelder og hvilke datatyper den sannsynligvis inneholder.
6. **Trekk ut påstander.** Send bare autorisert tekst eller OCR til ekstraksjon. Lag strukturerte observasjoner med kilde og sikkerhetsgrad.
7. **Bruk sterkere modell selektivt.** Reserver den for rik fortelling, dårlig OCR, navnekonflikter og viktige kamper.
8. **Generer original rapport.** Krev minst to uavhengige kilder eller én lisensiert, detaljert hendelsesfeed.
9. **Kontroller konflikter.** En egen verifikasjonsjobb sammenligner resultat, dato, lag, målscorere og publikum på tvers av kilder.
10. **Menneskelig revisjon.** Prioriter eldre kamper, cupkamper, store hendelser og alt som fortsatt er merket `conflicting`.

### 17.3 Agentroller

```text
source-discovery-agent
  finner URL-er og kildemetadata

match-linker
  kobler kilder til kanoniske kamper

fact-extractor
  lager observasjoner med kildebelegg

deduplication-agent
  finner NTB-kopier og nærduplikater

rights-gate
  stopper innhold uten godkjent rettighetsstatus

narrative-writer
  skriver egne sammendrag fra godkjente kilder

conflict-reviewer
  identifiserer og prioriterer kildekonflikter
```

`rights-gate` bør være deterministisk kode, ikke en språkmodellbeslutning.

### 17.4 Kostnadskontroll

- Cache alle søk og HTTP-responser der lisensen tillater det.
- Bruk hashes før tekst sendes til modell.
- Kjør samme parser over en hel kilde eller sesong.
- Send bare relevante tekstutsnitt, ikke hele aviser eller nettsider.
- Skill OCR-rensing fra faktatrekk.
- Bruk regelbasert uttrekk for resultat, dato, minutt og tabeller.
- Bruk språkmodell først når språklig forståelse faktisk er nødvendig.
- Generer rapport én gang etter at fakta er låst.
- Regenerer ikke uendrede kamper.
- Mål kostnad per ferdig kamp og per løst konflikt.

## 18. Dokumentert forbilde: «Alt om Start»

Fædrelandsvennens prosjekt [«Alt om Start»](https://www.skup.no/sites/default/files/2025-10/metoderapport---alt-om-start.pdf) er den nærmeste dokumenterte parallellen.

Prosjektet kartla 2 249 offisielle Start-kamper fra 1912 til 2024. Metoderapporten beskriver blant annet:

- Langvarig manuelt arbeid med lokale aviser, klubbarkiv, NFF og NIFS.
- At eldre opplysninger hos NFF kan være feil.
- NFF-årbøker, adressebøker og fotballencyklopedier som sentrale kilder.
- Motstanderens lokalavis som viktig kilde ved bortekamper.
- Behovet for å finne terminlisten først og deretter søke rundt kampdato.
- At automatisering fungerer best for de siste 20–25 sesongene.
- At gamle aviskamper ofte krever flere minutters manuelt arbeid hver.
- At KI kan hjelpe med standardisering og analyse, men ikke erstatte kildekontroll.

Dette støtter en todelt strategi for AaFK: automatisert moderne import og kildeassistert historisk forskning.

## 19. Foreslått gjennomføringsrekkefølge

### Fase 0: Avgrensning og rettigheter

- Definer kampomfanget.
- Opprett kilderegister og rettighetsstatuser.
- Kontakt NTB, NFF og AaFK Historisk Arkiv.
- Be Global Sports Archive om dekningsmatrise og pris.
- Be Polaris/SMP og TV 2 om aktuelle arkivmodeller.

### Fase 1: Dekningsprøve

Velg noen testår, for eksempel:

- 1921: tidlig cup og avisarkiv.
- 1956: medlemsblad, kretsrapport og avis.
- 1980: lavere divisjon og RSSSF.
- 1999: kjent hull i offentlig NFF-dekning.
- 2003: rik NFF- og Global Sports Archive-dekning.
- 2011: serie, cup og Europa.
- 2020: moderne NFF-, NTB- og TV 2-dekning.

Målet er å måle feltdybde, tidsbruk, OCR-kvalitet, rettighetsstatus og kostnad før hele historikken behandles.

### Fase 2: Kanonisk kampliste

- Importer lisensiert hovedkilde hvis avtale foreligger.
- Bygg serie- og cupskall per sesong.
- Koble eksterne ID-er.
- Finn manglende kamper med RSSSF, årbøker og aviser.
- Merk konflikter og hull eksplisitt.

### Fase 3: Moderne berikelse

- Prioriter 2002–nåtid.
- Legg inn lag, hendelser, dommere, publikum og statistikk.
- Koble AaFK-, SMP-, TV 2- og motstanderreferater.
- Generer egne rapporter der rettighetsgrunnlaget er klart.

### Fase 4: Historisk berikelse

- Arbeid sesongvis bakover.
- Bruk medlemsblad, bøker, NFF-årbøker og aviser.
- Registrer sidehenvisning og OCR-kvalitet.
- Prioriter obligatoriske kamper før treningskamper.

### Fase 5: Publisering og løpende drift

- Eksponer bare innhold som har godkjent publiseringsstatus.
- Vis kilde og sikkerhetsgrad.
- Gi brukere mulighet til å melde feil.
- Bevar historikk når et faktum korrigeres.
- Kjør løpende import fra offisiell eller lisensiert feed.

## 20. Kontaktliste og ønskede avtaler

| Aktør | Hva prosjektet bør be om |
| --- | --- |
| NTB | Historisk AaFK-bulkfil, API, Fotballrobot, rett til visning og avledede tekster |
| NFF/FIKS | Uttrekk for klubb 996/lag 15, ID-koblinger og gjenbruksrett |
| AaFK Historisk Arkiv | CMS-eksport, arkivdatabase, medlemsblad, statistikk og publiseringsrett |
| Polaris/Sunnmørsposten | AaFK-treff, metadata/API, sammendragsrett og eventuelle utdrag |
| TV 2 | Livesport-arkiv, kamp-ID-er, dataeksport og rapportrettigheter |
| Global Sports Archive | Dekningsmatrise og pris for historisk AaFK-data |
| Retriever | Prosjektavtale for søk eller eksport, ikke vanlig sluttbrukertilgang |
| NRK | Søk, klipp og rettighetsklarering for utvalgte historiske kamper |
| RSSSF Norge | Tillatelse dersom prosjektet får kommersiell karakter |

## 21. Åpne spørsmål

- Hvor komplett er NIFS for AaFK før 2002?
- Hvilke turneringer og nivåer kan NTB levere i bulk?
- Når starter Fotballrobot-dekningen for AaFK og lavere divisjoner?
- Har AaFK en intern, strukturert kampdatabase som ikke ligger offentlig?
- Kan klubben bistå med en korreksjonsgruppe eller historisk redaksjon?
- Hvor komplett er NFF/FIKS for 1999 og 2000?
- Har TV 2 bevart alle tidligere Altomfotball- og Livesport-kampobjekter?
- Kan Sunnmørsposten levere metadata og tekstutdrag uten full artikkelreproduksjon?
- Hvor langt tilbake har Global Sports Archive fullstendige lagoppstillinger for Norge?
- Skal `aafkstats` være ikke-kommersielt, reklamefinansiert eller abonnementsbasert? Dette påvirker kildeavtalene.
- Skal hele kamprapporter vises, eller holder egne sammendrag med lenker til originalene?

## 22. Anbefalt beslutning

Prosjektet bør ikke starte med å bygge én stor scraper mot NFF, FotMob eller NIFS. Start med et kilderegister og en liten dekningsprøve. Parallelt bør NTB, NFF og AaFK kontaktes.

En kontrollert engangshøsting er fornuftig for åpne, lavrisiko historikksider og til kildeoppdagelse. Den bør produsere en intern kildeindeks, ikke automatisk en offentlig kopi av kildenes databaser eller artikler.

Den langsiktige databasen bør eie sin egen struktur, bevare opphav per felt og kunne fjerne én kilde uten å miste resten av kampen. Kamprapporter bør enten være lisensiert tekst eller nye, kildebaserte sammendrag. Dette gir best kombinasjon av historisk dybde, etterprøvbarhet, kostnadskontroll og mulighet for offentlig publisering.
