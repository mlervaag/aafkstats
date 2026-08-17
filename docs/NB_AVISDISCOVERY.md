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

## Fordelingssteget

Én avishendelse kan bare tilhøre én kamp. Det er hele grepet.

Møtte AaFK Raufoss to ganger i 1963, finnes det to kamper og to sett avisomtale.
Vurderes hver kilderad for seg, får begge radene den hendelsen som ser sterkest
ut alene — og da havner begge på samme kamp. Det skjedde: rad #27 fra juni fikk
oktoberkampen, med «høy» tillit.

Derfor er spørsmålet ikke «hvilken hendelse passer best til denne raden», men
«hvilken fordeling av alle hendelsene på alle radene er best samlet sett».

```
kilderader i samme sesong mot samme klubb
        ↓  buildHypotheses            resultGroupId slår sammen kildepåstander
kamphypoteser
        ↓  discoverNewspaperIssues    ett søk for hele gruppen
avisutgaver
        ↓  clusterEvidence            forhåndsomtale + kampdag + referat = én hendelse
avishendelser
        ↓  allocateEvents             beste én-til-én-fordeling, med margin
tildeling
        ↓  reconcile                  bare de bevisene kampen faktisk fikk
status
```

Tre detaljer som viste seg å være avgjørende:

- **Søsken telles før brukerfilteret.** Slår man opp bare rad #27, må verktøyet
  likevel vite at sesongen har en kamp til mot samme motstander. Ellers finnes
  det ingen konkurranse om hendelsene.
- **Gruppen nøkles på klubb-ID**, ikke på det trykte navnet. Ellers blir
  «Clausenengen», «CFK» og «Clausenengen FK» tre forskjellige motstandere.
- **Kildens rekkefølge er mykt bevis.** Står #27 før #30, teller det at
  hendelsene ligger i samme rekkefølge — men samtidig avisdekning kan overstyre
  lista, som allerede er tatt i å ta feil om andre ting.

Tilliten i fordelingen er marginen til nest beste løsning, ikke summen av
enkeltsignaler. To fordelinger på 190 og 188 poeng er ikke et sikkert svar,
uansett hvor sterke enkeltkantene er.

## Berikelse med spredning i tid

Hvilke utgaver som får OCR-oppslag avgjør hvilke hendelser som i det hele tatt
kan bygges. Tar man de N beste i året, blir sesongen dublert der den allerede er
godt dekket, og tynn der den er tynn.

Derfor velges to kandidater i hver måned først, og deretter fylles budsjettet
opp etter styrke. Budsjettet vokser med antall kamper i gruppen: skal to kamper
skilles, må discovery finne minst to hendelser. Blir fordelingen likevel usikker,
utvides berikelsen rundt de månedene som er i spill — de tildelte hendelsene og
de som konkurrerte om å bli det, med nabomånedene.

Én per måned var for tynt: en måned har rundt tjuefem utgaver, og kampreferatet
er ikke alltid den best rangerte av dem etter det grove søket. Med bare én per
måned falt riktig juniutgave ut, og Raufoss-kampen mistet datoen sin igjen.

Vinduene styrer bare hvilke utgaver som leses, aldri hva som regnes som bevis for
at kampen fant sted.

## Målt status

Kontrollert mot NB-API-et:

| Kamp | Forventet | Målt |
|---|---|---|
| Clausenengen 1952 #16 | 1952-05-04, confirmed | **1952-05-04, confirmed** |
| Raufoss 1963 #27 | 1963-06-16, confirmed | **1963-06-16, confirmed** |
| Raufoss 1963 #30 | egen hendelse | **egen hendelse** |
| Sarpsborg 1948 #10 | 1948-07-16, conflict | 1948-10-17, ambiguous — **feil hendelse** |

Søskeninvarianten holder: de to Raufoss-radene får hver sin hendelse, og
junikampen dateres ikke lenger til oktober. Clausenengen-søsknene oppfører seg
likedan, og #22 melder i tillegg at avisa oppgir 1-1 mot kildens 0-0.

Sarpsborg 1948 står fortsatt igjen, og en måling av alle julikandidatene viser
hvorfor — det er ikke det man skulle tro.

Utgavene fra 15., 16. og 17. juli **er** i kandidatsettet. Problemet er hva det
grove søket returnerer som utdrag for dem: annonser og urelaterte spalter.

| Utgave | Grov score | Sjanger | Utdraget det grove søket ga |
|---|---:|---|---|
| 19480715 | 8 | fixture_list | «Bakeri og Konditori … Aalesunds Dampbakeri A/S» |
| 19480716 | 17 | fixture_list | «Aalesund kirke blir åpen hver dag fra kl. 11-14» |
| 19480709 | 38 | article | landsskytterstevne |
| 19480730 | 41 | article | «Aalesund—Rollon på Stadion søndag» |

Kampomtalen — «morgendagens fotballkamp mellom Sarpsborg FK og ÅFK på Nørve» —
finnes i de samme utgavene, men ikke i utdragene søketjenesten valgte. Den
kommer først fram ved OCR-oppslaget.

Det betyr at den grove poengsummen er en dårlig indikator på om en utgave er verdt
et OCR-kall, i akkurat de tilfellene der den trengs mest. Turnétrengselen jeg
antok var forklaringen, er det altså ikke: 13. og 14. juli (Sarpsborg mot Molde og
Hødd) ligger lavt de også. Utvelgelsen må derfor ikke bare vekte AaFK-nærhet
høyere — den må kunne bruke et kall på en utgave som ser uinteressant ut i det
grove søket, når måneden ellers ikke har noe sterkt.

Avstemmingen er verifisert uavhengig av dette: mates julitekstene inn direkte,
gir de 1948-07-16 og `conflict` med kildens 1-0 mot avisas 2-1
(`packages/ingest/test/nb-newspaper-discovery.test.ts`).
