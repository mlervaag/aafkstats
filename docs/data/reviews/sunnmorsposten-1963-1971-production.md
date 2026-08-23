# Review: Datoankret Sunnmørsposten-berikelse 1963–1971

- **Batch-ID:** `sunnmorsposten-1963-1971-production`
- **Profil:** `generic_publication`
- **Modus:** `initial`
- **Opprettet:** 2026-08-23
- **Reviewgrunnlag:** NB OCR-API; `facsimileReviewed: false`

## Produksjonsresultat

Alle 42 canonical kamper med `played`, eksakt dato, begge klubber og sluttresultat ble kjørt med den etablerte datoankrede policyen. Ingen OCR-tekst er lagret.

| År | Scope | OCR-korrelert | Smp-omtale | Kampreferat | Resultatnotis | Preview only | Ingen kandidat | Konflikt | Nye fakta | Complete | Residual |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1963 | 10 | 8 | 10 | 10 | 0 | 0 | 0 | 2 | 0 | 8 | 2 |
| 1964 | 7 | 3 | 5 | 2 | 0 | 0 | 4 | 0 | 0 | 2 | 5 |
| 1965 | 8 | 5 | 6 | 5 | 0 | 0 | 3 | 0 | 0 | 5 | 3 |
| 1966 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| 1967 | 13 | 6 | 6 | 5 | 0 | 2 | 7 | 0 | 0 | 4 | 9 |
| 1968 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| 1969 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1970 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1971 | 2 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 2 |
| **Sum** | **42** | **25** | **30** | **24** | **0** | **3** | **15** | **2** | **0** | **20** | **22** |

27 utgaver ble koblet i denne batchen. 13 kamper hadde eldre Smp-kilder; tre av dem fikk ingen ny lokal OCR-kandidat, derfor er samlet omtaledekning 30. Ingen nye pauseresultater, publikumstall, arenaer, dommere, personer, lagoppstillinger, målscorere, hendelser eller observasjoner ble skrevet.

To resultatavvik er bevart som uløste `conflict_candidate`: AaFK–Spartak 30. juni 1963 og Lillestrøm–AaFK 18. august 1963. Ingen canonical resultater ble endret.

## Residual og arbeidsmengde

20 kamper er `complete`; 22 står i residualkøen: 15 `no_ocr_candidate`, tre preview/tidsmessig svake, to andre svake kandidater og to konflikter. Batchen undersøkte 157 kandidatutgaver og bevarte 148 OCR-kandidater, i snitt 3,52 per kamp.

Av de 27 koblede utgavene var 20 D+1 og 26 innen D−2 til D+2. 1969 og 1970 har ingen canonical kamp som oppfyller scopekravene.

## Sammenligning med senere produksjonssett

| Mål | 1963–1971 | 1972–1978 | 1979 |
| --- | ---: | ---: | ---: |
| Relevant Smp-omtale | 71,4 % | 77,1 % | 79,5 % |
| Kampreferat | 57,1 % | 64,6 % | 61,5 % |
| D+1 blant koblede utgaver | 74,1 % | 66,7 % | 58,1 % |
| Innen D−2 til D+2 | 96,3 % | 97,2 % | 93,5 % |
| Kandidater per kamp | 3,52 | 3,67 | 3,33 |
| Kamper med nye skalarfakta | 0,0 % | 6,3 % | 20,5 % |
| Konfliktandel | 4,8 % | 6,3 % | 2,6 % |
| Complete | 47,6 % | 54,2 % | 56,4 % |

Treffraten faller moderat, ikke brått. Standardvinduet holder fortsatt, og batchen avdekker ingen systematisk metodefeil som tilsier endring før 1952–1962.

## Regresjon og PR #212-avstemming

1972–1978 er uendret: 48 scope, 37 omtaler, 33 OCR-korrelasjoner, 31 kampreferater, tre konflikter, 26 komplette og 22 residual. 1979 er også uendret: 39 scope, 31 omtaler, 30 OCR-korrelasjoner, 24 rapport/resultatnotis, én konflikt, 22 komplette og 17 residual.

PR #212-ledgeren hadde 617 saker i visuell review og 32 `matchedExisting` både før og etter batchen. Nettoendringen er 0; avisberikelsen tilfører proveniens, men disse kampene var allerede canonical.

## Source Inventory

Manifestet er autoritativt for de 27 koblede utgavene: [sunnmorsposten-1963-1971-production.yaml](../../../data/harvests/sunnmorsposten-1963-1971-production.yaml). Alle er `reviewed` etter OCR-produksjonspolicyen; dette betyr ikke faksimilekontroll.
