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

**Resultatet må være bundet til lagparet.** Det holder ikke at AaFK,
motstanderen og en passende score finnes et sted i samme OCR-vindu. Discovery
foretrekker eksplisitte oppsettlinjer og avstår når flere kampoppgjør gjør
tilordningen uklar. En reversert score teller bare når lagrekkefølgen er tydelig.

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

## V1-policy for batch

Standardmodusen er bevisst enkel og konservativ:

1. Rå source-results slås først sammen til kamphypoteser med `resultGroupId`.
2. En singleton går direkte gjennom discovery, enrichment, dato-utledning og
   reconcile. Den går ikke gjennom global allokering.
3. Flere hypoteser med samme år og `opponentClubId` er en sibling-gruppe. Uten
   klubb-ID brukes normalisert trykt motstandernavn.
4. Sibling-grupper gjør ingen NB-kall og ingen automatisk allokering i
   standardmodus. Hver valgt hypotese rapporteres som `ambiguous` med
   `reviewReason: sibling_group`.
5. `--resolve-siblings` slår på den eksisterende allokeringsmotoren for
   eksperimentelle kontrollkjøringer. Flagget skal ikke brukes i første batch.

Sibling-klassifiseringen bruker hele kildefila før `--year`, `--no`,
`--unlinked-only` og `--limit` snevrer inn hva som rapporteres. Dermed kan et
filter aldri gjøre en sibling om til en tilsynelatende singleton.

To eksplisitte kontrollrekkverk ligger i `batch-policy.ts`, i samsvar med
akseptansemanifestet: Clausenengen 1952 #16 er den live-verifiserte automatiske
fast path-saken, mens Sarpsborg 1948 #10 alltid går til manuell vurdering i v1.
Dette er policy, ikke Sarpsborg-spesifikk ranking.

Dry-run og rapporten viser populasjonstall på hypotesenivå, blant annet antall
singletons, sibling-hypoteser, gruppestørrelser og hvor mange sibling-grupper
som har ulike resultater. Den vanlige rapporten viser i tillegg NB-kall,
berikede utgaver og hvor ofte det ble funnet tidsbevis, resultatsamsvar eller
resultatkonflikt. Tallene er observability; de endrer ingen beslutninger.

## Det eksperimentelle fordelingssteget

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

## Bevis per avisutgave, ikke per fragment

Én avisutgave er én kildeenhet med flere bevis. Den er ikke det ene tekstvinduet
som tilfeldigvis scoret høyest.

Skillet er ikke akademisk. Før returnerte verifikasjonen det best scorende
vinduet i utgaven, og da brøt systemet en invariant det ikke har råd til å bryte:

> Å lese mer av samme avisutgave skal aldri svekke det vi allerede har funnet der.

Raufoss-kampen viste hvorfor. Utgaven hadde ett vindu med «i morgen» — altså
datoen — og berikelsen la til et sterkere vindu med kampomtale, men uten
tidsuttrykk. Det nye vant totalscoren, og datoen forsvant. Mer informasjon gjorde
funnet dårligere, og hver gang recall ble forbedret, svekket det en kamp som
allerede virket.

Nå velges en vinner per rolle — beste kampidentitet, beste tidsbevis, beste
resultatbevis — og hver rolle er et maksimum over en mengde som bare vokser.
Berikelse kan løfte et felt, aldri fjerne det. Resultatrollen er likevel
hendelsesbærende: finnes et resultat, kan en dato bare komplettere det fra den
samme lokale kampclaimen. Samme side og samme motstander er ikke
eventidentitet. Retrospektive resultater arver aldri dato fra den aktuelle eller
kommende kampen som omtales rundt dem.

Rollene står likevel på egne bein: bare vinduer som selv navngir begge lagene
kan bidra. Et resultat på side 8 og et tidsuttrykk på side 3 settes ikke sammen
bare fordi de står i samme avis. Et tidligere møte og en kommende kamp settes
heller ikke sammen selv om de står på samme side. Utgaven samler roller; den
oppfinner ikke koblinger.

Faksimile-fasiten fra PR #186 og den etterfølgende rekalibreringen er dokumentert
i [NB_AVISDISCOVERY_GROUND_TRUTH_RECALIBRATION.md](NB_AVISDISCOVERY_GROUND_TRUTH_RECALIBRATION.md).
Sluttkalibreringen mot de 22 kontrollerte sakene fra PR #186 og #188 er
dokumentert i
[NB_AVISDISCOVERY_GROUND_TRUTH_FINAL_CALIBRATION.md](NB_AVISDISCOVERY_GROUND_TRUTH_FINAL_CALIBRATION.md).

## Målt status og akseptansekontroll

De offisielle kontrollcasene styres av et felles akseptansemanifest i
`packages/ingest/test/fixtures/nb-newspaper-acceptance.yaml`.

Kontrollene er delt i to lag:
1. **Deterministisk CI-test:** `packages/ingest/test/nb-newspaper-acceptance.test.ts`
   kjøres under vanlig `pnpm test` uten eksterne nettverkskall, og validerer
   struktur, kildeutvalg og batch-policy samt fixturebasert Clausenengen-avstemming.
2. **Eksplisitt live smoke:** `pnpm --filter @aafkstats/ingest run nb-newspaper-smoke`
   kjøres manuelt mot live NB-API / disk-cache for å etterprøve at
   sluttresultatene faktisk oppfyller forventningene:

```sh
pnpm --filter @aafkstats/ingest run nb-newspaper-smoke
```

Tabellen beskriver status for standardmodus i v1:

| Kamp | Forventet | Målt |
|---|---|---|
| Clausenengen 1952 #16 | automatic, 1952-05-04, confirmed | **automatic, 1952-05-04, confirmed** |
| Raufoss 1963 #27 | manual, sibling_group | **manual, sibling_group** |
| Raufoss 1963 #30 | manual, sibling_group | **manual, sibling_group** |
| Sarpsborg 1948 #10 | manual, sibling_group | **manual, sibling_group** |

Den avanserte motoren og testene er beholdt: bak opt-in får de to Raufoss-radene
hver sin hendelse. Dette er ikke mergekrav eller standardadferd i v1.

Sarpsborg 1948 er nå en test på sikker failure mode, ikke en golden auto-case.
Den står i manuell kø uten at defaultmodusen prøver å løse den.

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
