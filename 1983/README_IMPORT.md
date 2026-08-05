# AaFKstats importpakke: NFF fiksId 83034

Denne pakken legger inn AaFKs 22 seriekamper i 2. divisjon avdeling B i 1983,
sluttabellen, korrigert sesongmetadata, en kildekatalogoppføring og tre klubbfiler
som manglet i repoet da pakken ble laget.

## Import

1. Ta en kopi eller opprett en ny Git-gren.
2. Pakk ut innholdet i rotmappen til `mlervaag/aafkstats`.
3. Tillat sammenslåing av mapper. Eksisterende cupkamper i
   `data/seasons/1983/matches/` skal ikke slettes.
4. Kontroller endringene med:

```bash
pnpm validate
pnpm db:build
pnpm test
```

## Viktig om `season.yaml`

Eksisterende `data/seasons/1983/season.yaml` beskriver bare NM. Pakken erstatter den
med sesongens hovedkonkurranse, `forstedivisjon`. De to NM-kampene blir liggende og
beholder `competition.id: nm`.

## Bevisst utelatte felt

NFF-siden viser klokkeslett `00:00` for alle kamper. Flere banefelt er også åpenbart
forskjøvet mellom kampene. Derfor er verken `kickoff` eller `venueId` importert.

## Kontrollsummer for AaFK

* 22 kamper
* 4 seire
* 3 uavgjorte
* 15 tap
* 23 mål for
* 46 mål mot
* 11 poeng etter datidens topoengssystem
* 11. plass av 12

## Kilder

* NFF Fotballdata, kamper, fiksId 83034
* NFF Fotballdata, tabell, fiksId 83034
* RSSSF Norway, bare brukt til å kontrollere opp- og nedrykksutfall

Se `audit/nff-83034-extracted.json` for den normaliserte uttrekksfilen.
