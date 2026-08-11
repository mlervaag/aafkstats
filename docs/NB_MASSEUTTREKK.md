# Masseuttrekk fra Nasjonalbiblioteket

## Resultat 11. august 2026

Alle 98 enkeltpublikasjoner i AaFK-arkivet ble undersøkt gjennom Nasjonalbibliotekets katalog- og IIIF-grensesnitt.

| Tilgang | Publikasjoner | Sider forventet | Sider behandlet | Sidefeil |
|---|---:|---:|---:|---:|
| Sidevis ALTO | 96 | 3 211 | 3 211 | 0 |
| Bare fulltekstsøk | 2 | 139 | 0 | 0 |
| Totalt | 98 | 3 350 | 3 211 | 0 |

Kjøringen fant 4 814 strukturerte faktakandidater. De to `search_only`-bøkene
bidro med 88 kandidater fra målrettede IIIF-søk, uten at søkefragmentene ble lagret i arkivet:

- 1 200 mulige personroller og verv
- 1 767 organisatoriske signaler uten entydig person på samme tekstlinje
- 885 treff på allerede registrerte personer
- 780 resultatlinjer, hvorav 88 var entydige mot ett eksisterende kampresultat
- 108 lagoppstillings- eller stallsignaler
- 74 sesong- og tabellsignaler

84 kampfiler fikk nye kildehenvisninger. De automatiske koblingene krever samme år, eksplisitt AaFK-navn, motstandernavn og samme resultat. Koblingen endrer ikke resultatet; den legger bare til publikasjon og sidetall med merknad om redaksjonell etterkontroll.

### Rettelse: ni koblinger var speilvendte

Regelen godtok opprinnelig også det speilvendte sifferet, og stemplet treffet «entydig» likevel. Ni av de 84 kampfilene fikk dermed en kildehenvisning for et resultat kilden skriver motsatt vei — blant dem 2013-09-13 mot Molde, der målhendelsene i samme fil viser 1-3 mens boka har 3-1. Speilvendingen fordelte seg tilfeldig på hjemme- og bortekamper, så den er ikke et perspektiv som kan regnes om.

De ni henvisningene er fjernet, og regelen krever nå samme rekkefølge. Blant de 75 som står igjen er 17 uavgjorte kamper, der en speilvending er usynlig per definisjon.

### Kandidatlaget er ikke fakta, og er heller ikke fullstendig nok til å bli det

Kandidatene er utledet av én OCR-linje om gangen. På en fler-spaltet side løper linja tvers over spaltene, så et rolleord kan få navnet fra nabospalten. Av de 4 814 kandidatene er 1 628 bare et nøkkelord og et sidetall, 655 er et bart siffer uten år eller motstander, og bare 58 av 1 200 personroller har årstallet `personRole.from` krever.

Andre gjennomgang leser de samme sidene på nytt, spaltevis. Se `NB_RESOLVE_RUNBOOK.md`.

## Hva som lagres

`data/extractions/` inneholder én validert YAML-fil per publikasjon. Den lagrer:

- publikasjon, provider, adapterversjon og innhentingsdato
- OCR-tilgang og sidetall
- SHA-256 av behandlet innhold
- korte faktatokens som navn, rolleord, årstall, resultat og entydige arkiv-ID-er

Rå ALTO, OCR-tekst og sammenhengende prosa lagres bare i `.cache/nb-extract/`, som er ignorert av Git. Dette gjør kjøringen gjenopptakbar uten å publisere eller redistribuere teksten.

## Kjøring

```powershell
pnpm --filter @aafkstats/ingest nb-extract --write --apply
```

Nyttige valg:

- `--source <id>` behandler én publikasjon
- `--refresh` henter alt på nytt
- `--concurrency <n>` styrer samtidighet, standard 3
- `--delay <ms>` legger pause foran hver nettforespørsel, standard 250
- uten `--write` gjøres en tørrkjøring
- `--apply` krever `--write` og kobler bare entydige kampresultater

## Vercel Blob

Den tilgjengelige Blob-instansen er offentlig. Derfor skal rå OCR og ALTO ikke lastes opp dit for disse publikasjonene. Blob kan senere brukes til rettighetsklarerte artefakter eller kompakte, avledede kjørerapporter. `BLOB_READ_WRITE_TOKEN` skal være serverstyrt og må aldri logges eller committes.

## Redaksjonell kø

Visningene `publication_extractions` og `fact_candidates` gjør kandidatene søkbare i SQLite. Kandidater er ikke kanoniske fakta. Personroller, lagoppstillinger og sesongfakta skal kontrolleres mot den oppgitte siden før de flyttes til ordinære person-, kamp- eller sesongfiler.
