# Strategisk vurdering: veien mot full historisk dekning

**Dato:** 23. august 2026
**Omfang:** AaFKs herrelag, senior A-lag, 1914–2026
**Status:** Vurdering. Endrer ingen data.

Målet som er satt er at hver kamp AaFK har spilt skal ha en kanonisk side med
kampfakta, en samtidig Sunnmørsposten-artikkel, alle involverte personer, og
minner og historiske fakta rundt. Dette dokumentet måler hvor langt vi er, hvilke
kilder som faktisk har levert, hvor det stopper opp, og hva som er den billigste
neste bevegelsen.

## 1. Nevneren vi mangler

Arkivet har **1 605 kanoniske kamper**. Det tallet blir bare meningsfullt mot et
anslag over hvor mange kamper som faktisk er spilt. Med 10–25 kamper i året før
krigen, 20–30 i etterkrigstiden og 40–50 i moderne tid ligger universet på
**omtrent 2 900 kamper**. Arkivet dekker altså i underkant av **55 %** av
kamplista — og det er før man spør hva som står *på* kampsidene.

Det finnes ikke et fasitsvar på nevneren, og det er i seg selv et funn. Ingen
kilde vet hvor mange kamper AaFK har spilt. Det er verdt å etablere et eksplisitt,
kildeført estimat per sesong, fordi uten det kan ingen si hva «100 %» betyr.

## 2. Dekningsmatrisen

Fordelingen er ujevn på en måte som ikke synes i totaltallene. Delt i fire
epoker etter hvilken kildesituasjon som faktisk gjelder:

| Epoke | Kamper | Smp-artikkel | Lagoppstilling | Hendelser | Arena | Publikum |
|---|---:|---:|---:|---:|---:|---:|
| 1914–1948 | 105 | 61 | 0 | 1 | 5 | 1 |
| 1949–1981 | 100 | 45 | 5 | 1 | 24 | 9 |
| 1982–2009 | 692 | 1 | 0 | 1 | 6 | 4 |
| 2010–2026 | 708 | 0 | 552 | 650 | 554 | 316 |

Tre ting leses rett ut av tabellen:

**Den historiske innsatsen har virket, men på et lite grunnlag.** 1914–1948 har
58 % avisdekning. Det er den beste avisdekningen i hele arkivet. Men den gjelder
105 kamper av kanskje 400 spilte.

**1949–1981 er det egentlige hullet i kamplista.** 100 kamper på 33 år — rundt tre
i året, mot en virkelighet på 20–30. Dekningen her er i størrelsesorden 12 %.
Årene 1969, 1970, 1972, 1973, 1974 og 1979 har null kamper.

**1982–2009 er et ørkenbelte som ikke diskuteres.** 692 kamper — 43 % av hele
arkivet — med score og lite annet: én avisreferanse, null lagoppstillinger, én
kamp med hendelser, seks med arena. Perioden framstår som dekket fordi
kamplista er komplett, men kampsidene er tomme. Målt mot ambisjonen er dette
den største enkeltmengden ufullstendige sider vi har.

**2010–2026 er nesten ferdig på fakta og har null på fortelling.** FotMob leverer
oppstilling, hendelser, arena og publikum. Ingen av de 708 kampene har en
Sunnmørsposten-lenke, fordi moderne Smp er betalingsmuret og NB-avisene er
lukket for nyere materiale.

## 3. Hva kildene faktisk har levert

| Kilde | Levert | Kostnad per funn | Vurdering |
|---|---|---|---|
| FotMob | 574 kamper med full detalj, 2010– | Nær null, API | Uttømt. Taket er 4. juli 2010 |
| RSSSF | 470 feltbekreftelser | Nær null | Serieresultater, ingen detalj |
| fotball.no | 288 feltbekreftelser | Lav | Dekker 2000-tallet |
| Medlemsblad 1965, «Våre kamper gjennom 50 år» | 1 031 kildepåstander | Innhøstet | **886 fortsatt ukoblet.** Har årsforskyvning som måtte repareres |
| Jubileumsboka 1939 | 422 kildepåstander | Innhøstet | **373 fortsatt ukoblet** |
| SFK årsrapporter 1952–1978 | ~100 påstander | Middels | Nesten alle koblet. Tynt uttrekk fra rike dokumenter |
| NB Sunnmørsposten | 106 kampkoblinger | Høy, visuell kontroll | Bærer hele avisdekningen |
| NB-publikasjoner | 16 577 faktakandidater fra 98 utgivelser | Lav å hente | Rå. 6 381 personomtaler ubearbeidet |
| Innboks / bidrag | 4 arkiverte, 4 åpne saker | Menneskelig | Fungerer, men liten skala |

De to store retrospektive klubbkildene har levert **1 453 påstander og 1 259
ukoblede**. Det er der arbeidskøen ligger — og det er verdt å merke seg at de
begge er *lister*, ikke fortellinger: de gir motstander og resultat, sjelden dato,
aldri lagoppstilling.

## 4. Hvor det stopper opp

### 4.1 Discovery-pipelinen har nådd taket sitt

`data/discovery/discovery-closure-status.yaml` viser 779 hypoteser, hvorav **627
venter på visuell faksimilekontroll** og bare **50 er kanonisert**.

Faksimile-reauditen i august ga fasiten på hva den kontrollen koster og gir: av
109 kontrollerte kandidater ble **21 kanonisert (19 %)**, mens 36 hadde
score-konflikt og 48 pekte på feil hendelse. **77 % av kandidatene var feil.**

Regnestykket videre er ubarmhjertig: 627 gjenstående kandidater × 19 % ≈ **120
kamper til**. Det er hele taket på dagens metode. Metoden kan ikke levere de
1 300 kampene som mangler, uansett hvor mange bølger vi kjører.

### 4.2 Retningen på søket er feil for de tomme årene

Dagens discovery går baklengs: *«finnes det en avisside som beviser denne linja i
jubileumsboka?»* Det forutsetter at det finnes en linje. For 1966–1981 finnes det
ingen retrospektiv klubbliste i det hele tatt — medlemsbladet fra 1965 stopper
der. Baklengs søk kan per konstruksjon ikke finne en eneste kamp i de årene.

Framlengs høsting — *«hva spilte AaFK i 1968?»*, lest sekvensielt gjennom
Sunnmørspostens sportssider — finner kamper ingen bok har listet, og gir
artikkelen, datoen, arenaen og ofte laget i samme gjennomgang. Den er dyrere per
side, men langt billigere per komplett kampside, og den er den eneste veien inn i
1966–1981.

### 4.3 51 rettighetsklarerte rapporter ligger uåpnet

Dette er den viktigste enkeltobservasjonen i vurderingen.

`docs/data/SFK_ARSRAPPORTER_DEKNING.md` viser 74 årsrapporter fra Sunnmøre
Fotballkrets, 1952–2025, 3 356 sider, allerede nedlastet. 51 av dem har ikke
tekstlag; de 23 med tekstlag er alle fra 2002 og senere.

**Innhøstet er 1952–1978 — 27 sammenhengende rapporter.** De 47 fra 1979 til 2025
er ikke gjennomgått, og 23 av dem mangler tekstlag.

Rettighetene er avklart i direkte dialog med kretsens daglige leder 12. august
2026. Det er ingen juridisk, teknisk eller økonomisk hindring.

Men se seksjon 7 før dette prioriteres: de innhøstede rapportene viser at
kretsrapporter **ikke bærer kampdato**, og de kan derfor ikke alene løfte et
resultat til kanonisk kamp.

Kretsen har i tillegg ikke-digitaliserte protokoller fra 1927 og dommerkort fra
1990-årene, tilgjengelig på kretskontoret.

### 4.4 Personlaget er bredt og uten dybde

469 personfiler. **Null har fødselsdato, dødsdato, fødested eller biografi.**
324 har verv, 271 har kilder.

På moderne kamper er navnedekningen nesten lukket: av 266 navn i AaFK-oppstillinger
mangler bare 43 personfil, og de fleste av dem er translitterasjonsvarianter fra
FotMob («Henrik Roervik Bjoerdal», «Tor Hogne Aaroey»). Det er
navnenormalisering, ikke forskning.

Det virkelige personproblemet er at oppstillinger bare finnes fra 2010. For
1914–2009 er 892 av 897 kamper spilt av personer arkivet ikke vet navnet på. Ambisjonen
om «alle personer som har vært involvert» står og faller på lagoppstillinger fra
aviser og kretsrapporter — ikke på personfilene.

Samtidig ligger **6 381 personomtaler** ubearbeidet i NB-uttrekkene. Det er råstoff
til dybde på personene vi allerede har.

### 4.5 Sunnmørsposten er en uavklart avhengighet

Ambisjonen nevner Sunnmørsposten eksplisitt. Rettighetssituasjonen er tredelt:

- **Før ca. 1936:** fritt i NB. Fungerer i dag.
- **Ca. 1936–2004:** i NB, men strømmetilgang gir ikke rett til nedlasting eller
  republisering. Vi bruker den i dag som lenke og faktabekreftelse. Det bærer.
- **2004–i dag:** eAvis og smp.no er betalingsmuret, og `robots.txt` blokkerer
  boter. **Ingen vei inn uten avtale.**

Kildekartet lister fire avtalemodeller å be om. Ingenting i repoet tyder på at
dialogen er startet — i motsetning til Sunnmøre Fotballkrets, der en samtale
løste rettighetsspørsmålet på én dag.

Dette gater omtrent 1 400 moderne kamper. Selv den minste modellen — metadata,
tittel, ingress, dato og lenke — ville fylle avisdimensjonen for hele
2004–2026 på én gang.

### 4.6 Fortellingslaget finnes ikke

To kampsider av 1 605 har referattekst. 28 historiske observasjoner er registrert.
Datamodellen er klar; innholdet finnes ikke. Dette er som beskrevet i
`docs/STATUS.md` ikke lenger et modellproblem.

## 5. Anbefalt rekkefølge

Prioritert etter kamper og felter per arbeidstime, ikke etter hva som er
interessant.

### Steg 1 — Terminlistene i medlemsbladene 1953–1960

**Hvorfor først:** Det er den eneste kjente kilden til *dato* i arkivet utenom
avisene, metoden er allerede skrevet ned og bevist, og materialet er innhøstet.
Se seksjon 7.

**Mål:** samme behandling som 1962 fikk, for åtte årganger.

**Beslutningsport:** når 1953 er ferdig, vet vi treffraten og kan skalere.

### Steg 1b — OCR av SFK-årsrapportene 1979–2025

**Hvorfor parallelt:** Rettighetsklarert og ren maskinjobb, men verdien er
tabeller og kamptall, ikke datoer. Den gir **nevneren** — hvor mange kamper AaFK
faktisk spilte — ikke kampene selv.

**Mål:** kildeført estimat per sesong over antall spilte kamper.

### Steg 2 — Åpne dialogen med Sunnmørsposten/Polaris

**Hvorfor nå:** Det er den eneste oppgaven med lang ledetid, og den kan gå
parallelt med alt annet. Be om den minste modellen først: metadata, tittel,
ingress, dato og lenke for AaFK-treff fra 2004. Vis fram arkivet — det er fritt,
kildeført og krediterende, og det er et sterkere argument enn en e-post.

**Mål:** avklart ja eller nei. Et nei er også et resultat: da vet vi at
avisdimensjonen for 2004–2026 må droppes fra ambisjonen, og det bør sies høyt.

### Steg 3 — Framlengs avishøsting, sesong for sesong, fra 1966

**Hvorfor:** Baklengs discovery kan ikke nå disse årene. Start i 1966 der
medlemsbladets liste slutter, og les Sunnmørspostens sportssider sekvensielt
gjennom sesongen. Én sesong om gangen, med full kampside som leveranse —
dato, motstander, resultat, arena, lag, artikkel — framfor tynn dekning
overalt.

**Mål:** to sesonger gjennomført som pilot, med målt kostnad per komplett
kampside. Det tallet avgjør om metoden skaleres til hele 1966–1981.

### Steg 4 — Lukk 1982–2009 med lagoppstillinger

**Hvorfor:** 692 kamper med kjent dato og motstander. Oppgaven er ikke å *finne*
kampen, bare å slå opp den kjente datoen i avis eller kretsrapport. Det er den
billigste berikelsen i hele arkivet per kamp, og det er den eneste veien til
personer fra en periode som er innenfor levende minne — der bidragsinnboksen
faktisk kan hjelpe.

**Mål:** oppstilling på alle seriekamper 1982–2009.

### Steg 5 — Personlagets dybde

**Hvorfor sist:** avhenger av at det finnes personer å berike. Kjør
navnenormaliseringen på de 43 translitterasjonsvariantene med én gang — det er en
liten, ren jobb. Deretter høst de 6 381 personomtalene fra NB-uttrekkene til
fødselsår, verv og biografiske fakta, med kildeføring per opplysning som i dag.

### Det som bør nedprioriteres

**De 627 ventende faksimilekandidatene.** Med 19 % treffrate og 77 % feil er
dette dyr kontroll av dårlige hypoteser. Kandidatene bør ikke kastes — de er
kildeførte påstander og hører hjemme i arkivet — men de bør ikke være der
arbeidstimene går. Etter steg 1 og 3 vil mange av dem uansett løses av seg selv,
fordi kampen er funnet en annen vei.

## 6. Er ambisjonen nåbar?

Delvis, og det er verdt å si presist hvilke deler.

**Kamplista** kan komme svært nær komplett. SFK-rapportene og en systematisk
avisgjennomgang dekker til sammen hele 1952–2026. 1914–1951 vil ha en restmengde
treningskamper som ingen kilde har notert, men serie- og cupkamper er nåbare.

**Personene** er nåbare for alle kamper der en lagoppstilling er trykt. Det er
mest sannsynlig serie- og cupkamper. For treningskamper i mellomkrigstiden vil
laget ofte være tapt for godt.

**Sunnmørsposten-artikkelen på hver kamp** er nåbar for 1914–2004 gjennom NB, som
lenke og bekreftelse. For 2004–2026 er den **ikke nåbar uten avtale**. Dette er
den ene delen av ambisjonen som er avhengig av noen andre enn oss.

**Minner og historiske fakta** har ingen øvre grense og heller ingen automatisk
kilde. Det er den delen som må komme fra mennesker, og den eneste som blir bedre
av at arkivet er synlig. Anbefalingen i `docs/STATUS.md` står: velg et lite antall
ikoniske kamper og gjør dem helt ferdige, framfor å fylle tynt overalt.

Det er en hårete ambisjon. Den er ikke urealistisk. Men den er avhengig av at
tyngdepunktet flyttes fra å verifisere gamle boklister til å lese kildene
framlengs — og av at noen ringer Sunnmørsposten.

---

## 7. Tillegg: hva medlemsblad, kretsrapporter og NFF-årbøker faktisk kan gi

Lagt til 23. august 2026 etter spørsmål om potensialet i de mange uinnhøstede
medlemsbladene, kretsrapportene og NFF-årbøkene, og om antakelsen om at de gir
kamper, men sjelden dato, holder.

**Antakelsen holder.** Målt over alt som er innhøstet:

| Kildefamilie | Påstander | Med dato fra kilden | Koblet til kanonisk kamp |
|---|---:|---:|---:|
| Medlemsblad 1965, retrospektiv 50-årsliste | 1 031 | 0 (0 %) | 145 (14 %) |
| Jubileumsboka 1939, retrospektiv | 422 | 0 (0 %) | 49 (11 %) |
| Medlemsblad, samtidige årganger | 205 | 36 (17 %) | 42 (20 %) |
| SFK årsrapporter | 96 | 3 (3 %) | 34 (35 %) |
| NFF-årbøker | 23 | 0 (0 %) | 11 (47 %) |
| **Sum** | **1 777** | **39 (2 %)** | **281 (15 %)** |

**Bare 2 % av alle innhøstede påstander bærer dato fra kilden selv.** Koblingsraten
er høyere enn datoraten, men den måler noe annet: en påstand kobles først og fremst
når kampen allerede fantes i arkivet fra en annen kilde. NFF-årbøkenes 47 % er ikke
et tegn på at årbøker gir datoer — det er et tegn på at cupkamper er godt dokumentert
andre steder.

Formen på kildene forklarer tallene. SFK-rapportene sier det selv, ordrett, i note
etter note: *«Årsrapporten dokumenterer ikke sikker kampdato.»* NFF-årbøkene gir
cupdiagram med runder og kretstabeller, ikke kampkalender. De retrospektive
klubbbøkene er nummererte lister over motstander og resultat.

### 7.1 Unntaket: terminlisten

Det finnes én kildetype i dette materialet som *er* en kalender, og den ligger
inne i de samme publikasjonene: **terminlisten**.

1962-årgangen er beviset. Der ble vårterminlisten på side 27 og høstterminlisten
på side 48 koblet mot resultatoversikten, og 13 seriekamper som sto uten dato fikk
eksakt kalenderdato. Metoden er skrevet ned med kildekritisk beslutningsregel i
`docs/data/MEDLEMSBLAD_REVIEW_1962.md` — inkludert at terminlistedato bare gjelder
når kampen er dokumentert spilt, og at en dokumentert faktisk spilledato alltid
vinner over den planlagte.

**1962 er det eneste året metoden er brukt.** Uttrekkslaget viser 305
terminliste-signaler i årgangene 1953–1960, og ingen av dem er tatt i bruk:

| Årgang | Sider | Terminliste-signaler | Lagoppstillinger | Kamper i arkivet i dag |
|---:|---:|---:|---:|---:|
| 1953 | 92 | 25 | 4 | 3 |
| 1954 | 148 | 56 | 6 | 1 |
| 1955 | 92 | 37 | 3 | 13 |
| 1956 | 88 | 23 | 0 | 0 |
| 1957 | 92 | 33 | 1 | 1 |
| 1958 | 84 | 37 | 4 | 1 |
| 1959 | 84 | 39 | 9 | 1 |
| 1960 | 84 | 55 | 3 | 1 |
| **Sum** | **764** | **305** | **30** | **21** |
| *1962, der metoden ble brukt* | *84* | *terminliste brukt* | *1* | ***21*** |

Den ene årgangen der terminlisten ble brukt har like mange kanoniske kamper som
alle åtte årgangene der den ikke ble brukt. 1959-årgangen alene har 39
terminliste-signaler fordelt på 20 sider, mens innhøstingen bare brukte side 60 —
sesongoppsummeringens resultatliste uten datoer. Resultatet er 29 påstander og
én kobling.

Et forsiktig anslag: 1953–1960 kan gå fra 21 til **120–180 kanoniske kamper med
eksakt dato**. Det er den klart største kjente dato-reserven utenom avisene, og
den krever ingen ny kilde, ingen avtale og ingen OCR.

### 7.2 Blindsonen 1966–1980: kamper ja, dato usikkert

Her har antakelsen mest rett, og her er også det største ukjente.

52 medlemsbladutgaver fra 1966 til 1980 er uttrekkslest — 702 sider, 499
resultatkandidater, 28 lagoppstillingssignaler og 1 022 personomtaler. **Ikke én
av dem er innhøstet til `source-results`.** Arkivet har 20 kanoniske kamper fra de
15 årene.

Ingen av årgangene viser terminliste-signaler. Men det betyr ikke sikkert at
datoene mangler: dette er kvartalsvise blad utgitt *mens sesongen pågikk*, og et
samtidig kampreferat nevner ofte datoen i prosa. **Uttrekkslaget kan ikke svare på
det**, fordi kandidatskjemaet bare bevarer sider, navn, årstall og siffer — ikke
OCR-prosaen. Spørsmålet kan bare avgjøres ved å åpne sidene.

Det bør avgjøres tidlig, med én årgang som prøve. Faller den ut positivt, er
1966–1980 langt billigere å lukke enn en systematisk avisgjennomgang. Faller den
ut negativt, vet vi at avisen er eneste vei, og 499 resultatkandidater blir
kildedokumenterte resultater i stedet for kamper — fortsatt verdt å ha, men noe
annet enn kanoniske sider.

### 7.3 Der potensialet faktisk er størst: personene

Uttrekkene fra de 98 publikasjonene inneholder **6 381 personomtaler, 2 139
verv-signaler og 117 lagoppstillingssignaler**. Innhøstingen har hittil hentet
kampresultater ut av dem og latt personmaterialet ligge — også i publikasjoner som
allerede *er* innhøstet: de har 3 772 personomtaler og 1 358 verv-signaler som
ikke er brukt.

Sett mot personlaget slik det står — 469 filer, ingen med fødselsdato eller
biografi, og 892 av 897 kamper før 2010 uten et eneste navn — er dette det største
enkeltpotensialet i hele materialet. Og det er den delen som er *minst* avhengig
av dato: en person kan knyttes til en sesong, et verv eller en klubb uten at noen
kamp dateres.

For 1966–1980 finnes 1 022 personomtaler og 28 lagoppstillingssignaler fra
nøyaktig de årene arkivet ikke kjenner en eneste spiller. Selv om ingen av kampene
i den perioden lar seg datere, kan personene stå.

### 7.4 Hva de tre kildefamiliene bør brukes til

| Kildefamilie | Uinnhøstet | Gir dato | Bør brukes til |
|---|---|---|---|
| Medlemsblad 1953–1960 | Terminlistene | **Ja** | Kanoniske kamper med eksakt dato. Første prioritet |
| Medlemsblad 1966–1980 | 52 utgaver, 702 sider | Ukjent | Prøv én årgang. Kamplista uansett, personene sikkert |
| Medlemsblad, bøker og jubileumsskrift | 80 utgivelser, 2 063 sider | Nei | Personer, verv, minner og sesongfakta |
| SFK årsrapporter 1979–2025 | 47 rapporter | **Nei** (3 %) | Nevneren: hvor mange kamper ble spilt. Tabeller og kretsstruktur |
| NFF-årbøker 1921– | ~100 årganger | **Nei** (0 %) | Nevneren for cup og krets, tabeller, tillitsvalgte |

De to siste linjene er en korreksjon av seksjon 5 slik den sto 23. august om
morgenen. Kretsrapportene og NFF-årbøkene er verdt å hente, men ikke fordi de
gir kanoniske kamper — de gir oss retten til å si hvor mange kamper vi mangler.
Det er en forutsetning for å kunne måle «100 %», ikke en snarvei til det.
