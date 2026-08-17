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
| Annonse- og tomsider | Åpnet og notert, teller i dekningen |

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

Tre spor står åpne i manifestets `unresolved`, og er *ikke* normalisert:

1. **Personer uten fil.** Jarle Kleive, Kjell Melsæter, Jostein Torset, Asbjørn
   Hamar, Helge Stavik og Finn Kvello er navngitt med verv eller utmerkelse, men
   har ingen personfil. De er ikke opprettet her fordi identiteten ikke er
   avstemt mot eksisterende navneformer, og en falsk sammenslåing er verre enn en
   manglende kobling. Snapshotet for 1966 er derfor ufullstendig med hensikt, og
   sier det selv i `note`.
2. **«Våre kamper gjennom 50 år» (skann 8–16).** Klubbens samlede
   resultatoppstilling fra 1915 til 1964, uten datoer. Dette er en retrospektiv
   sekundærframstilling trykt i jubileumsåret, og den må avstemmes mot de
   årgangsvise primærkildene før den kan bli arkivinnhold. Den er den enkeltvis
   største uutnyttede ressursen i årgangen.
3. **Retrospektive kampreferater fra 1940, 1950 og 1951** (skann 22–26 og 46).
   Reidar Skarbøviks «Minnenes bok» og Finn Tolaas' «Glimt fra året 1940» gir
   resultater, målscorere og tilskuertall, men ufullstendig datering. De hører
   hjemme i en gjennomgang av faktumårene, ikke i 1965-batchen.

## 8. Kontroller

- `pnpm data:historical-harvest:check --batch medlemsblad-1965` → PASS
  (56/56 sider, 27 funn, 24 normaliserte, 3 uavklarte, 0 destruktive endringer).
- Batchen står som `status: normalized`, ikke `complete`: sidedekningen er
  fullstendig og funnene er normalisert, men de tre sporene over er bevisst
  latt stå åpne.
