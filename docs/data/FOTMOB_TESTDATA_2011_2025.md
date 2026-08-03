# FotMob-testdata 2011–2025

Generert 2026-08-03 med `pnpm ingest:fotmob` for å teste søk, statistikk og
kampvisning med et større datasett.

## Omfang

- 15 sammenhengende ligasesonger, fra 2011 til og med 2025
- 450 seriekamper, 30 per sesong
- Tippeligaen/Eliteserien: 2011–2017, 2020 og 2022–2023
- 1. divisjon/OBOS-ligaen: 2018–2019, 2021 og 2024–2025
- 44 klubber i arkivet etter innhøstingen
- 0 kildefeil og 0 uløste reconcile-problemer

Alle kampene har dato, motstander, hjemme/borte, konkurranse, runde, status og
sluttresultat. Fem kamper fra 2025 har i tillegg hendelser, lagoppstillinger og
lagstatistikk, til sammen 71 hendelser. Denne innhøstingen omfatter ikke NM,
europacup, kvalifisering eller treningskamper.

## Kontroll av søket

Den bygde SQLite-filen gir følgende direkte treff:

| Søk | Treff |
|---|---:|
| `2024` | 30 |
| `Sogndal` | 22 |
| `2013 Tromsø` | 2 |

Dette datasettet er stort nok til å teste kombinerte år-/motstandersøk, historiske
statistikkspørsmål og navigasjon mellom kamplister og kampdetaljer.

## Kilde og begrensninger

Sesongoversiktene kommer fra FotMobs udokumenterte JSON-endepunkt. Råresponsene
ligger bare i gitignorert cache; repoet inneholder normaliserte kampfakta med
kilde-ID, URL, hentet dato og feltproveniens.

FotMobs lisens- og gjenbruksgrunnlag er fortsatt uavklart. Datasettet er derfor et
teknisk testgrunnlag og FotMob en sekundær kilde, ikke endelig fasit. Opplysninger
bør kryssjekkes mot blant annet fotball.no, NIFS og samtidige kampkilder før arkivet
regnes som redaksjonelt komplett.

Den opprinnelige detaljpiloten for 2025 er dokumentert i
[FOTMOB_PILOT_2025.md](FOTMOB_PILOT_2025.md).
