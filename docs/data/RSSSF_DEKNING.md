# RSSSF Norway som historisk kilde

Kartlagt 3. august 2026. Dette dokumentet er søsteren til
[FotMob-dekningstaket](FOTMOB_DEKNINGSTAK.md): der beskriver hvor den moderne kilden
slutter, beskriver dette hvordan hullet under den ble fylt.

## Hvorfor denne kilden

FotMobs gulv er 2010. Fire kilder ble prøvd for alt eldre:

| Kilde | Utfall |
|---|---|
| fotball.no (NFF) | Svarer, men er en SPA. Både iCal- og Excel-eksporten ignorerer sesongparameteren og gir bare inneværende sesong. Enkeltkampsider finnes tilbake til 90-tallet, men bare hvis man allerede kjenner intern `fiksId` — og å gjette seg gjennom ID-rom er ikke en akseptabel framgangsmåte. |
| worldfootball.net | 403. Bot-sperre. |
| Wikipedia | Har kampene, men formatet skifter fra år til år. Sesongen 2005 har datolinjer i én form, 2007–2009 i en helt annen, og flere år har bare resultattabell uten datoer. En parser ville vært en ny sak per årgang. |
| **RSSSF Norway** (`rsssf.no`) | **Valgt.** Rene tekstsider, én per divisjon per sesong, tilbake til **1902**, og cupen i alle år. |

`robots.txt` på rsssf.no stenger `/cgi-bin/` og `/krets/`. Arkivsidene er åpne.

En kartlegging av 1980–2009 fant **402 AaFK-kamper**.

## Formatet

Sidene er skrevet for mennesker, men strengt nok til å leses maskinelt:

```
Round 1
=======
19/4:   Start - Odd 0-0
        Bryne - Kjelsås 2-0
        Hamarkameratene - Aalesund 3-0
7/5:    Eik-Tønsberg - Strindheim 1-1
```

**Datoen står på den første kampen i en gruppe og gjelder nedover** til neste dato dukker
opp. Det er den viktigste detaljen i hele parseren. Leses den feil, får en hel runde samme
dato — og ingenting i ettertid avslører det, fordi resultatene fortsatt stemmer. Derfor er
datoarven testet for seg, mot en runde der AaFK-kampen står under den *siste* av tre datoer.

Halen på en resultatlinje har fire former:

| Form | Betydning |
|---|---|
| `aet` | Etter ekstraomganger |
| `aet, 3-4 on pen.` | Ekstraomganger og straffesparkkonkurranse |
| `[3-2]` | Straffer i **seriekamp** — norsk særordning på 1980-tallet, der uavgjorte kamper ble avgjort for et bonuspoeng |
| `(*)` | Fotnote nederst på siden |

Cupens runder heter «First round», ikke «Round 1». De føres som rundenummer og ikke som
stadium, slik at cupdata herfra er modellert likt som cupdata fra FotMob — der er runde 1
til 4 tall, og først kvartfinalen får et stadium.

## Ekstraomganger: et valg som måtte tas

RSSSF oppgir **bare sluttresultatet**, aldri stillingen etter 90 minutter. Arkivet vil ha
ordinær tid i `home.score` og det som kom i tillegg i `extraTime`. Den fordelingen finnes
ikke i kilden.

Den ble ikke gjettet. Sluttresultatet føres som scoren, `extraTime` settes til 0–0, og
forbeholdet står i kampens `note`:

> Resultatet er etter ekstraomganger. Kilden oppgir ikke stillingen etter ordinær tid, så
> fordelingen mellom ordinær tid og ekstraomganger er ukjent.

Summen blir dermed riktig, kampen blir korrekt merket som avgjort etter ekstraomganger, og
det eneste som er upresist står skrevet i kampen selv. Alternativet — å droppe merkingen —
ville skjult både opplysningen *og* upresisheten.

Til sammenligning kan FotMob-adapteren utlede stillingen ved 90 fra måltidspunktene, med
kontrollsum. Der finnes hendelsene; her gjør de ikke det.

## Klubbnavn

RSSSF bruker andre navn enn arkivet på noen klubber. Koblingen er et kort, eksplisitt kart
i adapteren:

```
Aalesund      → Aalesunds FK
Odd Grenland  → Odds Ballklubb
Lyn Oslo      → Lyn
Vålerengen    → Vålerenga
```

Omtrentlig navnematching ble vurdert og forkastet: den ville før eller siden slått sammen
to klubber som faktisk er forskjellige, og det er en feil ingen oppdager før noen leser
statistikken nøye. At et navn *mangler* i kartet er derimot ufarlig — da opprettes klubben
som ny, hvilket er riktig for de mange lavere-divisjonslagene AaFK har møtt i cupen.

Koblingen `Aalesund → Aalesunds FK` er ikke valgfri. Uten den blir vårt eget lag en egen
klubb ved siden av seg selv, og skjemaet avviser hver eneste kamp fordi ingen av sidene er
arkivets AaFK.

## Når to kilder møtes

Sesongen 2010 finnes hos begge: FotMob har runde 15–30, RSSSF har alle 30. Det er første
gang arkivet har to kilder på samme kamp.

Standarden er å **stoppe**. Reconcile nekter å røre en kamp som allerede finnes uten at
kilden eier den, fordi et ordentlig observasjonslag for flere kilder ikke er bygget ennå
(se fase B i [planen](../PLAN_FRA_PILOT_TIL_ARKIV.md)). En stille sammenslåing ville skjult
hvem som mente hva.

For 2010 ville det betydd at 15 kamper ingen har, forble uten. Derfor finnes
`--skip-existing`: de overlappende kampene står i fred og telles, de nye skrives. Hver kamp
har fortsatt nøyaktig én kilde — dette er en oppdeling per kamp, ikke en sammenslåing.

Flagget er ikke standard, og skal ikke bli det. Det er riktig når to kilder dekker hver sin
del av en sesong, og feil når de dekker samme del.

## Rettigheter

Dette er ikke avklart, og det er verdt å si tydelig.

Nettstedet oppgir at privat, ikke-kommersiell kopiering er tillatt med kreditering, mens
kommersiell bruk krever skriftlig tillatelse. Et offentlig GitHub-arkiv og et offentlig
nettsted er ikke åpenbart privat bruk. `robots.txt` stenger bare `/cgi-bin/` og `/krets/`,
så *hentingen* er grei — men henting og publisering er to forskjellige spørsmål.

`data/sources/rsssf.yaml` fører derfor `publicRedistribution: permission_required` og
`permissionStatus: pending`, og innhøstings-CLI-en **nekter å skrive** fra RSSSF til den
statusen endrer seg. Tørrkjøring og kartlegging virker fortsatt.

Neste steg er å be lars@rsssf.no skriftlig om tillatelse til automatisert uthenting og
offentlig publisering av normaliserte kampfakta, med tydelig kreditering og lenke tilbake
til kildesiden fra hver kamp. Det er en realistisk forespørsel: arkivet konkurrerer ikke med
nettstedet, kopierer ingen tekst, og sender trafikk tilbake.

De 417 kampene som allerede ligger inne, ble hentet før denne porten fantes.

## Kartlegging framfor gjetting

`pnpm ingest:rsssf-discover -- --from 1914 --to 1979` henter årsindeksen, følger lenkene og
klassifiserer hver side. Den skriver aldri data.

Det er nødvendig fordi filnavnene varierer: `Premier`, `First` og `Cup` holder fra 1980, men
bakover heter sidene `Hoved`, `Landsdel`, `Krets`, `Second`, `Third`, `Fourth` og `Ecup`, og
hvilke som finnes skifter fra år til år. En adapter som må gjette filnavn finner ikke det
den ikke vet om.

Hver side klassifiseres to ganger — etter hva indeksen kaller den, og etter hva som faktisk
står på den:

| Klasse | Betyr |
|---|---|
| `match_list` | Kampoversikt runde for runde. Kan høstes |
| `mixed` | Stort sett tabeller, men med kamper i tillegg — typisk kvalifisering |
| `tables_only` | Bare tabeller. Kan brukes til kontroll, ikke til enkeltkamper |
| `unknown` | Verken tabeller eller kamper vi kjenner igjen |

`mixed` finnes fordi «tables only» i indeksen ofte er en sannhet med modifikasjoner: 3.
divisjon i 1965 er merket slik og er stort sett tabeller, men har åtte ekte
kvalifiseringskamper nederst. En klassifisering med bare to utfall ville kastet dem.

Når etikett og innhold spriker, er det innholdet som gjelder, og siden flagges for kontroll.

## Hva som fortsatt mangler

- **Før 1980.** RSSSF har sidene helt tilbake til 1902. Kartleggingen viser hvor mye som
  faktisk er hentbart — se dekningskartet.
- **Europakampene.** Ingen av kildene vi har brukt dekker AaFKs europacupkvalifisering.
  Kildekartet peker på UEFA, og antallet er lite nok til at manuell registrering med
  kildehenvisning er forsvarlig.
- **Detaljer.** RSSSF gir dato, lag, resultat og runde. Ingen målscorere, lagoppstillinger,
  tilskuertall eller dommere. For kamper før 2010 er det fortsatt bare kampfakta.
