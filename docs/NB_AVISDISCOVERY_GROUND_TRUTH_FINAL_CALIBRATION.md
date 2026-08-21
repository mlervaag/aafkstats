# Sluttkalibrering av NB-avisdiscovery mot faksimile-ground-truth

Dato: 2026-08-21  
Grunnlag: PR #186, #187 og #188  
Omfang: discovery, tester og evaluering; ingen kanonisering

## Konklusjon

De tre kjente alvorlige feilene fra PR #188 er borte:

| Sak | Før PR #189 | Etter PR #189 | Faksimile-ground-truth | Resultat |
|---|---|---|---|---|
| KFK 1953 #21 | `confirmed`, 1953-08-23 | `ambiguous`, ingen dato | AaFK–KFK 1–3 ble spilt 1953-09-06 | PASS |
| Herd 1955 #35 | `confirmed`, 1955-05-18 | `ambiguous`, ingen dato, score `unknown` | AaFK–Herd 4–3 er en falsk positiv | PASS |
| Hødd 1963 #18 | `confirmed`, 1963-09-07 | `ambiguous`, ingen dato | Hødd–AaFK 5–2 ble spilt 1963-06-23 | PASS |

Ingen av de 22 faksimilekontrollerte sakene ender nå som kjent falsk
`confirmed`, og ingen `confirmed` har kjent feil eksakt dato.

## Rotårsaker og retting

PR #188 viste tre varianter av samme grunnproblem: signalene var lokale i
teksten, men ikke alltid lokale til samme kamp.

1. En resultatbørs kunne inneholde AaFK i én kamp og motstanderen i en annen.
   Et forventet, eventuelt reversert sifferpar fra den første kampen ble da
   tilgjengelig for det andre lagparet. Parseren avviser nå eksplisitte oppsett
   der motstanderen spiller mot et tredje lag. HTML-markering rundt lagnavn
   normaliseres før denne kontrollen.
2. En lokal AaFK-claim kunne gjelde reservelag eller aldersbestemte lag.
   Sterke markører for reservelag, B-lag, junior, lilleputt og guttelag gjør nå
   scorebeviset ukjent for et senior-source-result.
3. En score kunne arve dato fra et annet fragment, en annen notis eller et annet
   event mot samme motstander. `confirmed` og `conflict` krever nå at score og
   tidsuttrykk er bundet i samme lokale kampclaim. En udatert score og et separat
   datobevis gir `ambiguous` uten eksponert kampdato.

Retrospektivdeteksjonen dekker i tillegg blant annet «sist laga/lagene spilte
mot hverandre», «sist de møttes», «den gang», «forrige gang», «det første
møtet», «vårkampen», «høstkampen», «tidligere i år/sesongen» og «forrige
oppgjør». Markøren gjelder den lokale claimen, slik at datoen for en kommende
kamp ikke daterer et tidligere resultat.

Ingen confidence-terskler er endret.

## Ground-truth-gate

Det hermetiske manifestet
`packages/ingest/test/fixtures/nb-newspaper-ground-truth.yaml` inneholder 22
stabile saker: seks fra PR #186 og seksten fra PR #188. Sakene velges med
`sourceId`, år og nummer; Hødd 1963 bruker sin stabile `hypothesisId`. Kobling
til en kanonisk kamp og `unlinked`-status påvirker ikke utvalget.

Testen bruker korte, syntetiske og strukturelt representative tekstfragmenter.
Den inneholder ikke original avis-OCR og gjør ingen nettverkskall. Alle 22
regresjoner passerer. Direkte, lokalt komplett bevis bekrefter fortsatt ekte
positive og en eksplisitt scorekonflikt er fortsatt mulig.

Den komplette cached/live-baseline-kjøringen gir følgende utfall i det samme
faksimilekontrollerte settet:

| Mål | Resultat |
|---|---:|
| Ground-truth-caser | 22 |
| `confirmed` | 7 |
| `confirmed` med korrekt kamp, score og dato | 7 |
| `confirmed` med feil dato | 0 |
| falske `confirmed` | 0 |
| ekte relasjoner som abstainerer | 11 |
| kontrollerte `conflict`-utfall | 0 |

**Full confirmed precision:** 7 / 7 = **100 %**  
**Relation precision:** 7 / 7 = **100 %**  
**Conflict precision i ground-truth-settet:** ikke beregnbar; settet gir ingen
`conflict`. Den eksisterende eksplisitte conflict-regresjonen passerer.

Tallene gjelder bare det faksimilekontrollerte settet. De er ikke en påstand om
100 prosent presisjon i hele populasjonen.

De syv bekreftede sakene er Nordlandet 1948 #15, Eid 1952 #4, Årstad 1952 #8,
Clausenengen 1952 #16, Hødd 1953 #19, Måløy 1955 #34 og Spjelkavik 1963 #1.

De tre tidligere kjente over-abstention-sakene er fortsatt konservative:

| Sak | Status etter PR #189 | Ground truth |
|---|---|---|
| Lyn 1952 #9 | `ambiguous` | 1952-07-10 |
| Braatt 1958 #15 | `probable` | 1958-05-11 |
| Sunnmøringen 1963 #14 | `ambiguous` | 1963-09-29 |

De er ikke løftet med usikker layoutheuristikk.

## Singleton-baseline før og etter

Kjøringen bruker nøyaktig de samme stabile hypothesis-ID-ene som sluttrapportene
fra PR #187. Koblede rader er derfor med. Standard sibling-policy er uendret.

| Batch | Status | Før | Etter |
|---|---|---:|---:|
| 01 | confirmed | 2 | 1 |
| 01 | conflict | 0 | 0 |
| 01 | probable | 6 | 7 |
| 01 | ambiguous | 87 | 87 |
| 01 | not_found | 5 | 5 |
| 02 | confirmed | 8 | 6 |
| 02 | conflict | 1 | 2 |
| 02 | probable | 8 | 9 |
| 02 | ambiguous | 238 | 238 |
| 02 | not_found | 5 | 5 |
| 03 | confirmed | 4 | 1 |
| 03 | conflict | 4 | 3 |
| 03 | probable | 16 | 16 |
| 03 | ambiguous | 154 | 158 |
| 03 | not_found | 2 | 2 |

Alle statusendringer:

| Batch | Sak | Før | Etter | Forklaring |
|---|---|---|---|---|
| 01 | Øvre Telemark 1949 #5 | confirmed | probable | score og dato lå ikke i samme maskinelle claim |
| 02 | Moss 1953 #6 | confirmed | probable | scoreclaimet manglet lokal dato |
| 02 | KFK 1953 #21 | confirmed | ambiguous | 3–1 tilhørte AaFK–Hødd; 1953-08-23 ble undertrykt |
| 02 | Clausenengen 1955 #15 | ambiguous | confirmed | falsk konkurrerende datoarv på samme side ble fjernet |
| 02 | Herd 1955 #35 | confirmed | ambiguous | reservelagsclaim og Ørsta–Herd-score ble avvist |
| 02 | Rollon 1959 #4 | ambiguous | conflict | lokalt datert scoreavvik står igjen når urelatert datoarv fjernes |
| 03 | Langevåg 1949 #17 | confirmed | ambiguous | udatert score og separat dato kan ikke allokeres maskinelt |
| 03 | Herd 1959 #13 | probable | ambiguous | udatert score og separat dato kan ikke allokeres maskinelt |
| 03 | Volda 1959 | conflict | probable | tidligere scorekonflikt mangler eventbundet dato |
| 03 | Årstad 1963 #11 | confirmed | ambiguous | udatert score og separat dato kan ikke allokeres maskinelt |
| 03 | Hødd 1963 #18 | confirmed | ambiguous | septemberdatoen tilhørte en kommende kamp |

Clausenengen 1955 #15 er eneste nye `confirmed` og er ikke
faksimileverifisert i ground-truth-settet. Rollon 1959 #4 er en ny `conflict` og
skal fortsatt behandles redaksjonelt. Ingen ny status er kanonisert av denne
PR-en.

## Avgrensning

- Pipeline-status er et maskinelt discovery-resultat.
- Faksimile-ground-truth er menneskelig kontroll av den konkrete avissiden.
- Kanonisering er en separat redaksjonell handling.

PR-en oppretter ingen kamper, endrer ingen produksjons-source-results, lagrer
ingen OCR/fulltekst og endrer ikke sibling-policy. Ordinær CI er hermetisk.

## Manuell provider- og sibling-verifikasjon

Den eksplisitte NB-smoken ble kjørt separat fra CI mot live NB/disk-cache. Alle
fire kontroller passerte: Clausenengen 1952 ble `confirmed` med 1952-05-04, og
de tre sibling-sakene ble sendt til manuell kø.

Sibling-piloten ble også reevaluert: 2 eksakt korrekte allokeringer, 6 korrekt
avviste, 11 feilaktige og 7 uverifiserte. Det viktigste sikkerhetsmålet er
uendret: 0 falske high-confidence-allokeringer. Den strengere eventbindingen gir
flere konservative uallokeringer i den eksplisitte opt-in-motoren; default er
fortsatt manuell `sibling_group`.

## Beslutningsport

READY_FOR_NEW_NB_DISCOVERY
