# Avisdiscovery for kilderesultater

Hvordan Nasjonalbibliotekets avissamling brukes til å finne ut når en kamp fra et
kilderesultat ble spilt — og hva samtidige aviser sier om den.

## Premisset

**Kilderesultater er kildeutsagn, ikke kanoniske kamper.** En rad i
`data/source-results/` er hva en bestemt publikasjon påsto på en bestemt side.
Klubbens jubileumsliste «Våre kamper gjennom 50 år» er satt sammen i ettertid, og
den kan ta feil — av resultatet, av konkurransen, av hvem som var hjemmelag.

**Avisdiscovery kan derfor både bekrefte og motsi et kilderesultat.** Begge deler
er verdifulle funn. Et verktøy som bare kunne bekrefte, ville skjult uenighetene.

## Veien gjennom

```
source-result
    ↓  source-result-query.ts     motstander, aliaser, resultat, notat
normalisert søkekontekst
    ↓  discovery.ts               fire søk: motstander × AaFK-skrivemåte
kandidatutgaver
    ↓  evidence.ts                ett bevis per tekstvindu
rangering og verifikasjon
    ↓  discovery.ts               OCR-oppslag for de beste kandidatene
beriket bevis
    ↓  date-inference.ts          «i går», «morgendagens», «kveldens kamp»
kampdato
    ↓  reconciliation.ts          avstemming mot kildens påstand
confirmed · probable · ambiguous · conflict · not_found
```

## Prinsippene

**Resultatet er aldri et filter.** Motstander, AaFK og år er discovery-nøkkelen.
Et resultat som stemmer gir uttelling; et som ikke stemmer gir en merknad. Uten
denne regelen ville en kamp der kilden og avisa er uenige forsvunnet helt — og
det er nettopp de kampene som er mest verdt å finne.

**Utgivelsesdato er ikke kampdato.** Datoen settes bare når teksten sier noe om
tid: «i går» gir dagen før, «morgendagens» dagen etter, «kveldens kamp» samme
dag. Ukedagsnavn alene gir lav tillit og aldri en dato på egen hånd. Uten
tidsuttrykk beholdes utgivelsesdatoen uten at det påstås noen kampdato.

**Sjangeren avgjør hvor mye et treff er verdt.** Et kampreferat veier tyngst,
deretter resultatbørsen. Terminlister, tabeller og tippekuponger trekker ned:
alle nevner begge lagene tett, ingen av dem sier at kampen ble spilt.

**Ingenting skrives.** Kommandoen produserer en rapport. Kanonisering — å opprette
en kamp, sette `matchId`, endre et resultat — er en egen avgjørelse som tas av et
menneske med rapporten foran seg.

**Ingen OCR-tekst lagres.** Rapporten bærer NB-id, URN, avisnavn, utgivelsesdato,
side, lenke, utledede fakta og begrunnelser. Avistekst fra 1936 og framover er
opphavsrettsbeskyttet; leseren følger lenka til siden hos NB.

## Bruk

Én rad:

```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --year 1963 --no 27
```

Et årsspenn, bare rader uten kobling til en kanonisk kamp:

```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1945 --to-year 1964 \
  --unlinked-only --limit 20 \
  --output tmp/nb-discovery-1945-1964.yaml
```

`--dry-run` viser hvilke rader som ville blitt slått opp, med hintene notatet ga,
uten å røre nettet.

## Målt status

Kontrollert mot NB-API-et med kjente kamper:

| Kamp | Forventet | Målt |
|---|---|---|
| Clausenengen 1952 #16 | 1952-05-04, confirmed | **1952-05-04, confirmed** |
| Raufoss 1963 #27 | 1963-06-16, confirmed | 1963-10-20, confirmed — **feil dato** |
| Sarpsborg 1948 #10 | 1948-07-16, conflict | 1948-06-27, ambiguous — **feil dato** |

De to som bommer, bommer av samme grunn: sesongen har to kamper mot den samme
motstanderen, og begge radene deler treffsett. Verktøyet mangler et steg som
fordeler utgavene mellom radene — for eksempel ved å kreve at to rader mot samme
motstander får hver sin dato, og at rekkefølgen i kildens egen liste respekteres.
Til det er på plass bør funn mot motstandere som går igjen i sesongen leses som
kandidater, ikke som svar.

Avstemmingslogikken i seg selv er verifisert: gitt riktig tekstvindu gir den
riktig dato, riktig status og riktig konflikt — se
`packages/ingest/test/nb-newspaper-discovery.test.ts`.
