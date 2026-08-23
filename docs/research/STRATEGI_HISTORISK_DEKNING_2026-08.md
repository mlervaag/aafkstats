# Strategi for historisk dekning etter PR #216

**Oppdatert:** 23. august 2026
**Grunnlag:** validert arbeidskopi av PR #216 mot `origin/main`

Dette dokumentet skiller mellom statusen da strategiarbeidet startet, funnene i
PR #216 og arkivet slik det står etter innhøstingen. Tallene i den første
strategiversjonen er ikke lenger gjeldende status.

## 1. Status før PR #216

Før innhøstingen hadde arkivet:

- 1 605 kanoniske kamper
- 100 kamper fra 1949–1981
- ingen kanoniske kamper i 1956, 1972, 1973, 1974 eller 1979
- 1 777 kildedokumenterte resultatoppføringer
- 28 historiske observasjoner

Den første analysen konkluderte med at medlemsbladene som regel ga motstander
og resultat, men sjelden dato. Derfor ble sekvensiell avishøsting vurdert som
den eneste realistiske veien inn i blindsonen 1966–1981.

Det var feil. Uttrekkslaget hadde ikke bevart OCR-prosaen og fanget i liten grad
daterte kamplinjer i løpende spalter. Manglende terminlistekandidater betydde
ikke at årgangen manglet datoer.

## 2. Hva PR #216 fant

PR-en brukte ALTO til discovery, sidenavigasjon, spaltesplitting og
koordinatbasert paring. Dato, motstander, resultat, hjemme/borte og konkurranse
ble deretter kontrollert visuelt på sidene som bærer kanoniske påstander.

Resultatet er 117 nye kanoniske kamper:

| Sesong | Nye kamper | Metode |
|---:|---:|---|
| 1952 | 6 | direkte daterte resultater |
| 1956 | 5 | terminliste/resultat-avstemming |
| 1957 | 2 | terminliste/resultat-avstemming |
| 1959 | 5 | terminliste/resultat-avstemming |
| 1960 | 3 | terminliste/resultat-avstemming |
| 1963 | 5 | spaltesplitting og terminliste/resultat-avstemming |
| 1964 | 5 | vår-/høstterminliste mot resultatoversikt |
| 1967 | 11 | rekkefølge og resultatoversikt |
| 1972 | 6 | terminliste/resultat-avstemming |
| 1973 | 4 | kolonnebasert terminliste/resultat-avstemming |
| 1974 | 6 | kolonnebasert terminliste/resultat-avstemming |
| 1975 | 7 | spaltesplitting og terminliste/resultat-avstemming |
| 1976 | 9 | vår-/høstterminliste mot resultatoversikt |
| 1977 | 4 | høstterminliste mot resultatoversikt |
| 1979 | 39 | direkte daterte resultater |
| **Sum** | **117** | **45 direkte daterte, 72 avstemte** |

Ingen av de 117 kampene ble fjernet etter faksimilekontrollen. Det betyr ikke
at alle kandidater i materialet ble godkjent. Uleselige scorer, usikker
hjemme/borte-markering og mistanke om omberamming ble fortsatt holdt utenfor.

### Det viktigste metodefunnet

Medlemsbladene er ikke bare resultatarkiv. De er også en stor, tidligere
undervurdert datoreserve:

- enkelte årganger trykker dato, motstander og score i samme linje
- flere årganger trykker terminliste og separat resultatoversikt som kan
  avstemmes etter de ni kontrollpunktene i innhøstingsrunbooken
- 1970-tallsoversiktene krever ofte koordinat- eller spaltesplitting fordi
  lagnavn, bortemerke og score står i ulike kolonner
- terminlistedato brukes aldri når en sterkere kilde dokumenterer en annen
  faktisk spilledato

Den målte avkastningen i denne PR-en erstatter det gamle anslaget: 117 kamper
ble kanonisert fra medlemsbladmaterialet, hvorav 72 krevde
fixture/result-reconciliation.

## 3. Status etter PR #216

`pnpm validate` rapporterer nå:

- 1 722 kanoniske kamper
- 103 år med minst én kanonisk kamp
- 1 887 kildedokumenterte resultatoppføringer
- 400 resultatoppføringer koblet til kanonisk kamp og 1 487 fortsatt ukoblet
- 207 klubber
- 36 historiske observasjoner

Med et fortsatt grovt kampunivers på omtrent 2 900 kamper øker totaldekningen
fra rundt 55 prosent til rundt 59 prosent. Nevneren er fremdeles et anslag og må
bygges kildebasert per sesong.

### Dekning per epoke

| Epoke | Før PR | Etter PR | Endring |
|---|---:|---:|---:|
| 1914–1948 | 105 | 105 | 0 |
| 1949–1981 | 100 | 217 | +117 |
| 1982–2009 | 692 | 692 | 0 |
| 2010–2026 | 708 | 708 | 0 |
| **Sum** | **1 605** | **1 722** | **+117** |

1972 har nå 6 kamper, 1973 har 4, 1974 har 6 og 1979 har 39. 1969 og 1970 er
fortsatt tomme i den historiske blindsonen.

## 4. Åpne konflikter og konservative avgrensninger

Faksimilekontroll løser ikke alt. Følgende står fortsatt åpent:

- 1979-årsberetningen oppgir 22 seriekamper, men viser bare 20 daterte
  serielinjer. Målsummen bekrefter avviket, men identifiserer ikke de to manglende
  kampene.
- Henning 9. juni 1974 har motstridende hjemme/borte-markering og er ikke
  kanonisert.
- Fire vårkamper i 1976 har bortemerke som ikke kan leses sikkert og er ikke
  kanonisert.
- To 1960-kamper har hjemme/borte-avvik mellom terminliste og
  resultatoversikt.
- Privatkampblokken i 1959 avviker mellom tidligere innhøsting og ny
  koordinatbasert lesing. Ingen gammel kildepåstand er overskrevet.
- Flere linjer i 1952, 1963, 1964, 1967, 1972–1975 har uleselig score eller
  mangler en entydig motpart i terminlisten. De er bevart som kildepåstander
  eller review-funn, ikke presset inn som sikre kamper.

Walkover uten spilt kamp behandles ikke som ordinær kamp. Planlagt dato taper
alltid mot dokumentert faktisk spilledato.

## 5. Konkurranse og klubbidentitet

### 1977

AaFK spilte i 3. divisjon avdeling Møre i 1977. Repoet modellerer nivået med den
stabile identiteten `andredivisjon`; konkurransefilen har det historiske navnet
«3. divisjon» til og med 1990 og «2. divisjon» fra 1991. Sesongfilen,
sluttabellen, Bergsøy-kampen og de fire nye kampene bruker derfor korrekt samme
identitet. Det trengs ingen ny konkurranse-ID.

### Vard

Ligatabellene for 1973 og 1975 identifiserer «Vard» som klubben fra Haugesund.
De to nye kampene og de nye source-result-koblingene bruker derfor
`vard-haugesund`.

`vard` er en eldre, allerede brukt klubbidentitet i arkivet. Den slettes eller
omskrives ikke i denne PR-en, fordi det ville mutere eksisterende historiske
data og bryte preservation-vernet. Nye funn skal ikke videreføre splitten.

## 6. Ny anbefalt rekkefølge

### 1. Tøm medlemsbladene systematisk

Kjør først alle samtidige årganger med daterte resultater eller en avstembar
terminliste. Prioriter tomme og tynne sesonger, og mål utbyttet per årgang.
ALTO brukes til discovery; kanoniserende sider kontrolleres visuelt.

Dette er nå den billigste kjente veien til selve kampene.

### 2. Bruk Sunnmørsposten målrettet

Avisarbeidet flyttes fra generell kampdiscovery til oppgaver medlemsbladene
ikke løser godt:

- faktisk spilledato ved omberamming
- verifikasjon av tvilsomme koblinger
- lagoppstilling, målscorere og hendelser
- arena og publikum
- kampreferat og personstoff
- kamper medlemsbladet ikke kan datere

Sekvensiell avishøsting er fortsatt nødvendig for år uten brukbar
medlemsbladdekning, men bør ikke være førstevalg for å finne kampene.

### 3. Bygg en kildeført nevner fra krets- og forbundsrapporter

SFK-årsrapporter og NFF-årbøker gir tabeller, turneringsstruktur og antall
kamper. De gir sjelden sikker dato. Bruk dem til å måle hva som mangler og til å
kontrollere sesongsummer, ikke som en snarvei til kanoniske kampdatoer.

### 4. Avklar tilgang til Sunnmørsposten/Polaris

Dialogen bør gå parallelt med innhøstingen. Metadata, tittel, ingress, dato og
lenke for AaFK-treff fra 2004 vil gi stor verdi selv uten fulltekst.

### 5. Berik 1982–2009 og personlaget

Perioden har 692 kjente kamper, men svært få oppstillinger, hendelser, arenaer
og publikumsdata. Når kampene allerede er datert, er avis- og
kretsrapportoppslag en berikelsesoppgave, ikke discovery.

De 6 381 personomtalene og 117 lagoppstillingssignalene i
publikasjonsuttrekkene er fortsatt en stor, separat arbeidskø.

## 7. Hva som fortsatt begrenser ambisjonen

Kamplista kan komme nær komplett, men ikke ved én metode alene.
Medlemsbladene gir nå den beste billige datoruten. Kretsrapportene gir
kontrollsummer. Avisene gir faktisk spilledato og detaljene rundt kampen.

For 2004–2026 er Sunnmørsposten avhengig av avtale. For eldre treningskamper kan
det finnes en reell restmengde som ingen bevart kilde dokumenterer. Disse
grensene skal stå eksplisitt; de skal ikke fylles med antakelser.
