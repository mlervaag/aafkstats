# Kilder til overganger

Hvilken kilde arkivet skal hente overganger fra, målt i stedet for gjettet. Alle tall under
er hentet ved å spørre kildene direkte i september 2026, og kommandoene står slik at de kan
kjøres om igjen.

Modellen og feltene ligger i [`DATAMODELL.md`](DATAMODELL.md#overganger); begrunnelsen for
dem i [`OVERGANGER_PLAN.md`](OVERGANGER_PLAN.md). Dette dokumentet handler bare om hvor
opplysningene skal komme fra.

- [Konklusjon](#konklusjon)
- [Kandidatene, med tall](#kandidatene-med-tall)
- [Wikipedias overgangslister](#wikipedias-overgangslister)
- [Sunnmørsposten gjennom Nasjonalbiblioteket](#sunnmørsposten-gjennom-nasjonalbiblioteket)
- [Medlemsbladene](#medlemsbladene)
- [De tre som ble undersøkt og forkastet](#de-tre-som-ble-undersøkt-og-forkastet)
- [Rekkefølgen arbeidet bør tas i](#rekkefølgen-arbeidet-bør-tas-i)

## Konklusjon

Det finnes ingen enkeltkilde som dekker overganger for AaFK. Tre kilder dekker hver sin
epoke, og de skal brukes i denne rekkefølgen:

| Epoke | Kilde | Målt utbytte | Rettigheter |
|---|---|---|---|
| 2010–2026 | Engelsk Wikipedias norske overgangslister | **248 AaFK-overganger** (116 inn, 132 ut) i 27 av 31 vinduer, med **347 referanser** | CC BY-SA, fakta smitter ikke; leverandøren er allerede godkjent |
| 1915–2009 | Sunnmørsposten via Nasjonalbiblioteket | 104 treff på «overgang til AaFK», 202 på «klar for AaFK», 55 på «forlater AaFK» | Fakta og sitat av rimelig omfang; 1936→ er bare synlig i NBs lokaler, men søkefragmentene kommer ut |
| 1950–1980 | AaFK-medlemsbladene | 70 treffsider over 2 202 sider i 86 utgaver | Fritt: `viewability: ALL`, `EVERYWHERE`, CC BY-NC-ND |

Den viktigste enkeltoppdagelsen er at **Wikipedia-listene bærer en fotnote per overgang**.
Arkivet skal ikke kildeføre Wikipedia, men følge fotnoten til klubbmeldingen den peker på og
føre *den* som kilde. Wikipedia blir da et register over hvor primærkildene ligger, ikke en
kilde i seg selv, og det er nøyaktig den rollen `data/providers/wikipedia.yaml` allerede
beskriver: «Brukes til FAKTA, aldri til tekst.»

## Kandidatene, med tall

Sju kilder ble undersøkt. Fire er brukbare, tre er det ikke:

| Kilde | Dekning | Struktur | Utbytte | Dom |
|---|---|---|---|---|
| Engelsk Wikipedia, overgangslister | 2010–2026 | `{{Fs player}}`-maler, én fotnote per rad | 248 overganger | **Ja, først** |
| Sunnmørsposten (NB) | 1915–2024 | Løpende tekst | ~150–400 reelle notiser | **Ja, bredden** |
| AaFK-medlemsbladet (NB) | 1950–1980, 2003–04 | Løpende notiser | 70 treffsider, anslagsvis 20–30 navngitte overganger | **Ja, presisjonen** |
| aafk.no | Inneværende sesong | Nyhetssaker med dato og klubb | Rikt, men arkivdybden er ikke målt | Ja, for det som skjer nå |
| Sunnmøre Fotballkrets' årsrapporter | 1952–2025, 74 rapporter | Skannet uten tekstlag | **0 overgangslister** i 1958, 1972 og 1985 | Nei |
| Norsk Wikipedia, sesongartikler | 2 artikler | – | **0** | Nei |
| Transfermarkt | 2000-tallet | Strukturert | Ikke målt | Nei, uavklarte rettigheter |

## Wikipedias overgangslister

31 artikler med tittelen «List of Norwegian football transfers …» dekker hvert sommer- og
vintervindu fra 2010 til 2026. Hver klubb har sin egen seksjon med «In:» og «Out:», og hver
spiller står som en mal med nasjonalitet, posisjon, draktnummer og motpart:

```
{{Fs player|no=6|nat=NED|name=[[Kaj Ramsteijn]]|pos=DF|other=from {{flagicon|NED}} …}}<ref>…</ref>
```

Målt over alle 31 vinduene: **116 inn, 132 ut, 347 fotnoter**, fordelt på 27 vinduer med
AaFK-seksjon. Fire vinduer mangler seksjonen — dekningen følger hvilken divisjon klubben
spilte i, og 2010–2014 er tynt.

Fotnotene peker som regel på klubbens egen melding (`aafk.no`, `brann.no` og lignende), ofte
med et `archive-url`-øyeblikksbilde. Det er den kilden arkivet skal føre. Feltene i modellen
lar seg fylle direkte: `direction` fra In/Out, `club` fra `other=from/to`, `date` fra
fotnotens `date`, og `kind` fra ordlyden («on loan from» → `loan`, «free agent» → `free`).

**Forbeholdet.** Listene er skrevet av frivillige og er ikke fullstendige. Et vindu uten
AaFK-seksjon betyr at ingen har skrevet den, ikke at ingen skiftet klubb. Og en Wikipedia-rad
uten fotnote skal ikke inn: da mangler den nettopp det arkivet krever.

## Sunnmørsposten gjennom Nasjonalbiblioteket

Dette er den eneste kilden som rekker over hele arkivets levetid, og maskineriet finnes fra
før: `nb-newspaper-search` henter tekstfragmenter, og `nb-visual-review` kontrollerer
kandidatene mot faksimilen.

Målt i Sunnmørsposten alene:

| Søk | Treff |
|---|---|
| `"overgang til AaFK"` | 104 |
| `"klar for AaFK"` | 202 |
| `"meldte overgang"` | 231 |
| `"melder overgang"` | 134 |
| `"forlater AaFK"` | 55 |
| `"signerte for AaFK"` | 38 |

**Frasesøk er hele forskjellen.** `(AaFK OR ÅFK) AND overgang` gir 7 219 treff i
Sunnmørsposten, og de fleste er støy: «overgang frå spannmjølk til flaskemjølk», «overgang
frå direkte til indirekte skatt». `"overgang til AaFK"` gir 104 treff der alle de kontrollerte
faktisk handler om en spiller som skiftet klubb — blant dem Tor Hogne Aarøy og Stig Johansen.
Bruk faste fraser, ikke boolske kombinasjoner.

Tilgangen er delt ved 1936, slik `nb-newspaper-access.ts` allerede dokumenterer: til og med
1935 kan hele teksten lagres, fra 1936 er utgaven bare synlig i NBs lokaler. Det siste hindrer
ikke arbeidet — søkefragmentene kommer ut også for de lukkede årgangene, kontrollert mot 1976
— men det betyr at bare faktaene føres inn, aldri teksten.

## Medlemsbladene

86 utgaver, 2 202 sider, lest side for side gjennom ALTO. Resultatet: **70 sider** nevner
overgang, innmelding eller spilleberettigelse, fordelt over 1950–1980 og 2003–04.

Utbyttet er lavere enn tallet antyder. Mange av de 70 er prinsipielle betraktninger og ikke
hendelser — en helside i 1964 diskuterer om byklubbene burde bytte spillere for å danne et
«stjernelag», og «overgangen fra juniorlaget til A-laget» i 2004 er ikke en klubbovergang i
det hele tatt. Anslagsvis 20–30 av dem navngir en spiller og en klubb.

Til gjengjeld er de av høyeste kvalitet: klubbens egne ord, fri gjenbruk, og ofte med
begrunnelsen for flyttingen. Fire av dem er allerede i arkivet. Eksempler funnet i søket som
ennå ikke er ført inn:

- **1977 nr 3–4:** «Langevågs gode forsvarsspiller Reidar Vågnes som nå er innmeldt i klubben.»
- **1980 nr 1:** «Solid spillerovergang fra Lyn: Harald Thorsen.»
- **1980 nr 1:** «[Nedre]gård og Reidar Vågnes gått tilbake til Langevåg.»

**Et blindspor verdt å notere.** Klubbårsmeldinger lister ofte spillerstallen under «tilgang»
og «avgang», og det så ut som veien til en systematisk liste. Et eget søk på de ordene ga 36
treff, men de handler nesten alle om rekruttering av gutte- og juniorspillere: «tilgangen av
unge spillere har vært stor». Medlemsbladet fører ikke overgangsregnskap. Det er ad hoc
notiser, og de må leses side for side.

## De tre som ble undersøkt og forkastet

**Sunnmøre Fotballkrets' årsrapporter.** Den mest lovende hypotesen, og den eneste
leverandøren i arkivet med `permissionStatus: granted`. 74 rapporter fra 1952 til 2025 ligger
allerede katalogført. Overganger måtte i den perioden godkjennes av kretsen, så en liste over
innvilgede overganger burde stått der.

Den gjør ikke det. Rapportene for 1958, 1972 og 1985 ble hentet, OCR-lest i sin helhet og
gjennomsøkt. Ordet forekommer bare i saksbehandlingsomtale — «VÆR DA MERKSAM PÅ AT NFF PÅ
MINUTTET SVARER PÅ SPILLEOVERGANGER» (1972) og en enkeltsak om dispensasjon fra
overgangsbestemmelsene (1958). Ingen navngitte spillere, ingen lister. Rapportene er dessuten
skannet uten tekstlag, så hver kontroll koster en OCR-runde.

**Norsk Wikipedia.** Har bare to AaFK-sesongartikler i det hele tatt, «Aalesunds Fotballklubb
i 2018» og «… i 1990», og ingen av dem har en overgangsseksjon. Til sammenligning har Brann,
Rosenborg, Vålerenga og Bodø/Glimt slike seksjoner i sine sesongartikler. Kilden finnes altså
i formen, bare ikke for denne klubben.

**Transfermarkt.** Ikke undersøkt videre. Nettstedet svarer ikke på henting herfra, og
vilkårene for gjenbruk er ikke avklart. Etter regelen i `claude.md` skal rettighetsstatusen
ligge i `data/providers/` før noe hentes, og det er ikke gjort. Kilden er nevnt her for å være
avklart som utelatt, ikke som et alternativ som venter.

## Slik ble det høstet

`pnpm ingest:wikipedia-transfers` leser alle vinduene, plukker AaFK-seksjonen og skriver
overgangene inn i personfilene. Tørrkjøring er standard; `--write` skriver, og verktøyet leser
arkivet tilbake etterpå og feiler hvis det ikke validerer.

To ting verktøyet nekter å gjøre:

- **En rad uten fotnote skrives ikke.** Da mangler den nettopp det arkivet krever av en
  overgang, og en rad uten kilde er en påstand.
- **Klubb-ID gjettes ikke.** Bare et treff på normalisert navn mot `data/clubs/` gir `clubId`.
  Omtrent halvparten av motpartene er utenlandske klubber AaFK aldri har møtt, og de står med
  kildens egen skrivemåte og tomt ID-felt. Det er riktig svar, ikke en mangel.

Kildeføringen følger regelen over: `providers` bærer Wikipedia-permalenken til nøyaktig den
revisjonen som ble lest, og meldingen fotnoten peker på står i `note` med tittel, utgiver og
dato. Er meldingen klubbens egen på aafk.no, får den i tillegg sin egen leverandørhenvisning.

## Rekkefølgen arbeidet bør tas i

1. **Wikipedia-listene, 2010–2026.** Størst utbytte per innsats, strukturert nok til å
   maskinlese, og hver rad fører til sin egen primærkilde. En adapter i samme form som
   `wikipedia-squad.ts` kan lese alle 31 artiklene. Krever at klubbmeldingene fotnotene peker
   på registreres i `data/sources/`.
2. **Medlemsbladene, 1950–1980.** Sidene er allerede identifisert av søket over. Arbeidet er
   redaksjonelt og lite: gå gjennom de 70 treffsidene, plukk ut dem som navngir en spiller.
   Fri gjenbruk gjør at hele notisen kan siteres i `note`.
3. **Sunnmørsposten, hullene som står igjen.** Bredest, men dyrest per overgang. Frasesøkene
   over gir kandidatlisten; `nb-visual-review` avgjør. Ta den etter at de to første er ferdige,
   så vet man hvilke år som faktisk mangler.
4. **aafk.no, løpende.** For sesongen som pågår. Arkivdybden bakover er ikke målt, og bør
   måles før noen planlegger en historisk innhøsting derfra.
