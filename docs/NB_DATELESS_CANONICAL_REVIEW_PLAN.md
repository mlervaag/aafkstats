# Plan og resultat: datoløs NB-review etter PR #227

Dato: 24. august 2026  
Beslutningsport: `NB_DATELESS_CANONICAL_REVIEW_CLOSED`

## Mål

Denne PR-en lukker tre avgrensede køer uten nye NB-søk:

1. Avklar de 28 lokale kandidatene som kan være eksisterende kanoniske kamper.
2. Fullfør datoreview av Sykkylven 1964 og Ørsta 1971.
3. Test de ti høyest prioriterte atomiske faksimileenhetene fra kandidatlistene.

Arbeidet skal ikke utvide discovery-backloggen. Et claim kobles bare når sesong, motstander, resultat og øvrige kjente identitetsfelt er forenlige. Ny kamp krever i tillegg sikker dato, konkurranse, hjemme/borte og kollisjonskontroll.

## Gjennomføring

### 1. Eksisterende kamper

Alle 28 kandidater ble kontrollert mot dagens arkiv.

- 24 entydige claims er koblet til eksisterende kamper.
- To Rollon-claims med identisk 3–2-resultat er blokkert som søsken-/duplikatambiguitet.
- To Kvik-claims med identisk 1–1-resultat er blokkert av samme grunn.

Den publiserte lokale reviewkøen er regenerert og inneholder nå bare disse fire blokkeringene.

### 2. Datoreview

- Sykkylven 3–2: Faksimilen fastsetter 23. juli 1964 på Aksla. Konkurranseformen er ikke sikker, så kampen er ikke kanonisert.
- Ørsta 1–1 etter ekstraomganger: Faksimilen bekrefter kamp, resultat og NM-kontekst, men ikke eksakt kampdato. Saken er ikke kanonisert.

### 3. Prioritert faksimilepilot

Piloten omfattet 10 atomiske enheter og 13 claims. Resultatet var ett eksakt treff, én juniorside og åtte kandidat-enheter som gjaldt andre hendelser, terminlister eller forhåndsstoff.

Guard 6–2 ble visuelt bekreftet som en treningskamp på Kråmyra 7. april 1959 og er kanonisert med NB-observasjon og kildeclaim-kobling.

Stoppregelen var færre enn tre kanoniseringsklare treff etter ti enheter. Treffraten ble 1 av 10, derfor er de resterende 41 kandidatclaims ikke åpnet i denne PR-en.

## Maskinlesbar dokumentasjon

- Reviewledger: `data/discovery/nb-dateless-canonical-review-1950-1971.yaml`
- Idempotent kommando: `pnpm data:nb-dateless-canonical-review`
- Apply: `pnpm data:nb-dateless-canonical-review -- --apply`

Etter apply skal en ny tørrkjøring rapportere null nye kamper, null nye koblinger, null nye observasjoner og null filer å skrive.
