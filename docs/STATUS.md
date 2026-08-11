# Status

Hva arkivet er nå, og hva som gjenstår. Kort med vilje: en lang statusfil blir ikke
oppdatert, og en status ingen oppdaterer er verre enn ingen.

Tallene her er de eneste håndskrevne i dokumentasjonen. Alt annet regnes ut av databasen
ved bygging. Kjør `pnpm validate` for dagens tall.

## Hva som står

| Lag | Tilstand |
|---|---|
| Fakta | Kamper, sesonger, tabeller, hendelser, lagoppstillinger og kampstatistikk. Ryggraden, og den er på plass |
| Kilde | Dataleverandører og historiske publikasjoner som hvert sitt objekt, med sidehenvisning per opplysning, kildekonflikter som bevares, og faktakandidater fra Nasjonalbiblioteket |
| Klubb | Personer, roller og verv, organisasjon, stiftere, heder og hjemmebaner |
| Fortelling | **Nesten tomt.** Ingen kampreferat ennå |

Skillet mellom kanoniske kamper og kildedokumenterte resultater er det som gjør at eldre
år kan vises uten å gjettes fram. Se [Arkitektur](ARKITEKTUR.md) for hvordan de behandles
forskjellig.

## Hva som gjenstår

Rekkefølgen er en vurdering, ikke en forpliktelse.

### 1. Identitet

Navneformer fra kildene skal møte riktig person uten falske sammenslåinger. Mekanismen er
`names[]` på personfila, og `pnpm data:duplicates` foreslår kandidatene.

Det står fortsatt navn fra lagoppstillinger uten personfil i det hele tatt. De fleste
trenger nok ingen: en spiller som bare er et navn i én oppstilling teller allerede med i
statistikken. Noen av dem burde hatt en fil.

Klubbidentitet er samme jobb på klubbsiden, og de fem funnene rapporten står med er alle
vurdert som ekte naboklubber.

### 2. En samlet arbeidskø — første versjon står

Arkivet vet allerede hva som mangler: kampfelt som ikke er fylt, ufullstendige sesonger,
kildedokumenterte resultater uten dato, uavklarte personkonflikter, faktakandidater fra
NB, lagoppstillingskandidater uten kamp og navnevarianter som ikke er løst.

Den offentlige siden [`/mangler`](https://aafkarkivet.no/mangler) samler nå de delene som
kan forstås og etterprøves uten internverktøy: kampfelt som ikke er fylt,
kildedokumenterte resultater uten sikker kampidentitet, uavklarte personkonflikter og
lagoppstillingskandidater som må kontrolleres mot originalen.

Rå OCR-treff og navnelikhet fra CLI-rapportene er bevisst ikke publisert som oppgaver.
De er forslag til en redaktør, ikke mangler arkivet har slått fast. Neste arbeid her er
å gjøre identitetsjobbene mer konkrete når de er menneskelig bekreftet.

### 3. Fortellingslaget

Ingen kampreferat ennå. Dette er ikke lenger et problem med datamodellen, men med innhold.
Anbefalingen som står er å velge et lite antall ikoniske kamper og gjøre dem komplette,
framfor å fylle tynt overalt.

### 4. Historisk dekning som vokser sakte

NB-kandidatlaget og de kildedokumenterte resultatene vokser konservativt i bakgrunnen. Det
skal de fortsette å gjøre.

## Hva vi bevisst ikke gjør

Dette er like mye status som lista over. Flere av punktene har vært foreslått og er valgt
bort med hensikt:

- **Ikke senke kravene til hva som er en kamp.** Et resultat uten sikker dato blir et
  kildedokumentert resultat, ikke en kamp med gjettet dato.
- **Ikke la maskinen avgjøre identitet eller konflikt.** Maskinen foreslår, arkivet bevarer
  råformen, mennesket bekrefter. Dette har vi allerede erfart konsekvensen av å bryte, og
  feilene står dokumentert i [NB-runbooken](NB_RESOLVE_RUNBOOK.md).
- **Ikke gjøre AI mer autonom.** Språkmodellen er et tilgangslag, ikke kunnskapsbasen.
- **Ikke bygge CMS, bytte database eller starte redesign.** Plattformen er ikke det som
  mangler.
- **Ikke behandle OCR-tekst som historisk sannhet.** Rå OCR blir ikke arkivinnhold.

## Hvorfor det ser ut som det gjør

Begrunnelsene bak arkitekturvalgene, inkludert Git og YAML framfor en databasetjeneste,
står i [Arkitektur](ARKITEKTUR.md) og i den historiske
[planen fra pilot til arkiv](arkiv/PLAN_FRA_PILOT_TIL_ARKIV.md). Planen er ikke lenger en
plan, men begrunnelsene i den holder.
