# Innhentingsplan for Sunnmøre Fotballkrets' årsrapporter

Sunnmøre Fotballkrets publiserer én årsrapport for hvert år fra 1952 til 2025 på
[kretsens historieside](https://www.fotball.no/kretser/sunnmore/om-kretsen/historie/).
Serien består av 74 rapporter uten årshull. Den skal behandles som ett avgrenset
kildekorpus, med 1966-rapporten som kontrollert testgrunnlag.

Målet er å finne AaFK-fakta i alle rapportene uten å blande ungdoms-, reserve- og
kretslagsdata inn i A-lagets kampstatistikk. PDF-ene skal ikke legges i git. Arkivet
lagrer stabile kilde-ID-er, den offisielle lenken, korte faktapunkter og presis
proveniens.

## Avgrensning og rettigheter

Provider-ID-en er `sunnmore-fotballkrets`. Tillatelsen gjelder kretsens historiske
materiale og kan ikke overføres til NFF/FIKS eller andre deler av fotball.no.

Innhentingen skal:

- lese bare den offisielle historiesiden som indeks;
- følge lenker der synlig tekst matcher `^Årsrapport\s+(19|20)\d{2}$`;
- godta bare HTTPS-lenker på `www.fotball.no` som peker til PDF;
- bruke indeksens faktiske `href`, aldri konstruere en URL fra årstallet;
- bruke hurtiglager og være idempotent;
- tørrkjøre som standard og kreve `--write` for YAML-endringer;
- stoppe med en synlig feil ved manglende år, duplikate år eller duplikate URL-er.

## Leveranser

Arbeidet deles i små PR-er. Hver PR skal kunne valideres og vurderes uten at resten
av korpuset er ferdig.

### 1. Oppdagelse og kildekatalog

Lag `packages/ingest/src/cli/sfk-annual-reports.ts` med provider-policy som port.
CLI-en henter indekssiden én gang og skriver i tørrkjøring et sortert manifest med:

```json
{
  "year": 1966,
  "url": "https://www.fotball.no/globalassets/krets/sunnmore/om-kretsen/arsrapporter/arsrapport-1966.pdf"
}
```

Ved `--write` kan den opprette én `annual_report`-source per år under `data/sources/`.
Kilde-ID-en skal være `sunnmore-fotballkrets-arsrapport-{år}` og peke til serien
`sunnmore-fotballkrets-arsrapporter`. Første akseptansekriterium er nøyaktig 74 unike
år fra 1952 til 2025.

### 2. Teknisk kartlegging

Last hver PDF til ignorert hurtiglager og registrer arbeidsmetadata i et generert
manifest uten å gjøre funnene kanoniske:

| Felt | Betydning |
|---|---|
| `year`, `url`, `sha256` | identitet og endringskontroll |
| `pages` | antall PDF-sider |
| `textLayer` | om vanlig tekstuttrekk gir brukbar tekst |
| `ocrStatus` | `not_needed`, `pending`, `complete` eller `failed` |
| `aafkMentions` | antall søketreff etter normalisering av AaFK-navn |
| `seniorTable`, `cupResults` | om rapporten har mulige A-lagsfakta |
| `reserve`, `junior`, `youth` | om andre lagtyper er omtalt |
| `people`, `officials` | om personer, verv, kurs eller dommere er omtalt |
| `extractionStatus` | `unreviewed`, `candidate`, `reviewed` eller `complete` |

PDF-er med tekstlag kjøres gjennom vanlig PDF-tekstuttrekk. Skannede rapporter OCR-leses
lokalt. OCR-tekst er arbeidsdata og skal ikke publiseres eller brukes som kanonisk fakta
uten visuell kontroll mot den aktuelle PDF-siden.

### 3. Faktakandidater

Uttrekket leter etter AaFK-navn som `AaFK`, `Aafk`, `ÅFK`, `Aalesund` og
`Aalesunds FK`, men trefflisten må kontrolleres manuelt. Kandidater sorteres i:

- A-lag: serie, cup, kvalifisering, treningskamper og sesongmeta;
- andre lag: reserve, junior, gutt, smågutt og senere aldersklasser;
- personer: spillere, dommere, trenere, kurs og kretsverv;
- hendelser: protester, administrative avgjørelser og utmerkelser.

Bare A-lagskamper med sikker dato og identitet kan bli kanoniske kampfiler. Resultater
uten dato eller sikker hjemme/borte-plassering legges i `data/source-results/`.
Andre lagtyper forblir researchdata til datamodellen uttrykkelig støtter dem.

### 4. Menneskelig kontroll og normalisering

For hvert år skal en kontrollør:

1. åpne alle sider med kandidater;
2. kontrollere navn, resultat, konkurranse, runde og lagtype visuelt;
3. registrere nøyaktig PDF-side;
4. kryssjekke tabellsummer og, når mulig, en uavhengig kilde;
5. koble til eksisterende klubb-, person-, kamp- og konkurranse-ID-er;
6. la uklar identitet være `null` i stedet for å gjette;
7. kjøre validering og databasebygg før PR.

1966 er fasiten for arbeidsflyten: side 4 inneholder tre senior-NM-resultater og den
fulle tabellen for 3. divisjon Møre. De to udaterte NM-kampene ligger i
`source-results`, mens Frigg-kampen kobles til den eksisterende kampfilen.

## Prioritering

Første pass kartlegger alle 74 rapportene. Deretter behandles periodene etter hullene
i AaFK-arkivet, med eldre skannede rapporter først:

1. 1952–1959
2. 1960–1969
3. 1970–1979
4. 1980–1989
5. 1990–1999
6. 2000–2009
7. 2010–2025

Hver periode deles videre slik at én PR normalt dekker ett år eller ett lite,
sammenhengende årsspenn. En periode er ferdig når alle rapportene har teknisk status,
alle AaFK-treff er kontrollert, alle publiserte fakta har sidehenvisning, og alle bevisste
utelatelser er forklart.

## Kontroller som skal automatiseres

Discovery-testene skal bevise at:

- alle år 1952–2025 finnes nøyaktig én gang;
- alle URL-er kommer fra den kanoniske indeksen;
- både `globalassets`- og `contentassets`-lenker håndteres;
- kjente kontrollår 1952, 1966, 2015, 2016, 2019, 2021, 2024 og 2025 finnes;
- ingen URL utledes fra et årstall;
- gjentatt kjøring uten endret indeks gir identisk manifest.

For hvert normalisert år skal `pnpm validate`, fixture-validering, `pnpm db:build`,
`pnpm typecheck`, `pnpm lint` og `pnpm test` passere.

## Separate spor

Årsrapportarbeidet skal ikke blokkere disse kildene, men de føres separat:

- ikke-digitaliserte protokoller fra 1927 og senere på kretskontoret;
- eldre dommerkort, hovedsakelig fra 1990-årene til digitale kamprapporter;
- historiesidens oversikter over kretsmestere og utdanning;
- Excel-filene med kretslagsspillere fra 1990 og fremover;
- et senere skjema for fotballkrets som organisasjon og for eksplisitte lagtyper.
