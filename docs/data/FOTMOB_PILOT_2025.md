# FotMob-pilot 2025

Generert 2026-08-03 av `pnpm ingest:fotmob`.

## Omfang

- Eksplisitt turnerings-ID: `203`
- Arkivkonkurranse: `forstedivisjon`
- Sesong: 2025
- Kampdetaljer: ja
- Kamper funnet: 30 (30 ferdigspilt)
- Nettverkskall i denne kjøringen: 3 (cachetreff telles ikke)
- Feil: 0

Piloten henter bare strukturerte kampfakta. Den henter ikke livekommentarer, artikler,
bilder, odds, momentum eller skuddkart, og den lager ikke kampreferat.

## Feltdekning

| Felt | Kamper |
|---|---:|
| Tilskuertall | 4/30 (13 %) |
| Hendelser | 5/30 (17 %) |
| Lagoppstillinger | 5/30 (17 %) |
| Lagstatistikk | 5/30 (17 %) |

## Planlagt arkivendring

| Type | Nye | Oppdaterte |
|---|---:|---:|
| Kamper | 30 | 0 |
| Klubber | 14 | 1 |
| Stadioner | 2 | 0 |
| Sesonger | 1 | 0 |

Uløste reconcile-problemer: 0.

## Vurdering

Dette er en avgrenset teknisk dekningsprøve mot et udokumentert endepunkt. FotMobs
vilkår og robots.txt tillater ikke en generell, løpende crawler. Råresponsene ligger bare
i gitignorert cache. Før en større backfill må prosjektet avklare rettighetsgrunnlaget og
velge en lisensiert hovedkilde; FotMob bør i så fall være en sekundær faktakilde.

En vellykket pilot beviser mapping, validering og visning. Den beviser ikke at FotMob er
komplett for andre sesonger, eller at data kan hentes og gjenbrukes systematisk.
