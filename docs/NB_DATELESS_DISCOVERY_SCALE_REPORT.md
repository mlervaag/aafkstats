# Rapport: skalert NB-søk for udaterte resultater

## Sammendrag

Kjøringen behandlet 84 unike aktive discovery-claims uten å skrive kanoniske kamper:

| Pass | Claims | Utfall |
| --- | ---: | --- |
| Lokal avstemming 1915–1974 | 629 vurdert | 28 entydige `existing_match_candidate` |
| NB 1955–1959 | 20 | 20 kandidatlister |
| NB 1960–1964 | 20 | 4 eksisterende match-kandidater, 1 datoevidens, 15 kandidatlister |
| NB 1965–1974 | 20 | 1 datoevidens, 19 kandidatlister |

Fire av de 60 NB-claimene finnes også blant de 28 lokale treffene. Totalt er derfor 84 unike claims berørt: 28 lokale eksisterende match-kandidater, 2 nye datoevidenssaker og 54 avgrensede kandidatlister.

NB-kjøringene ga 916 rå shortlist-treff fordelt på 428 unike avisutgaver. Den versjonerte ledgeren lagrer bare de fire best rangerte kandidatene per claim. Rå OCR-fragmenter ligger bare i `.cache/`.

## Nye datoevidenssaker

### 1964: AaFK–FK Sykkylven 3–2

- `sourceClaimId`: `srcclaim-11f9adfb78cb8e87aba129f936cbf5c4`
- Sunnmørsposten 24. juli 1964, trykt side 8
- NB-utgave: `4b216e8bd63234b8a2c8d4fe4dee0c36`
- maskinelt forslag: 23. juli 1964
- tillatt datointervall: 21.–24. juli 1964
- faksimilepilot: overskriften «ÅFK-Sykkylven 3-2» bekrefter motstander og resultat

Faksimilen bekrefter kampidentiteten, men overskriften alene beviser ikke eksakt spilledato. Saken går derfor til `dateEvidenceReview`, ikke direkte kanonisering.

### 1971: AaFK–Ørsta 1–1 etter ekstraomganger

- `sourceClaimId`: `srcclaim-f9563e86d02ac37a20fea19b6fcb38e1`
- Sunnmørsposten 5. juni 1971, trykt side 6
- NB-utgave: `cc9edf15e772ece5715e3edfe94c637b`
- maskinelt forslag: 4. juni 1971
- tillatt datointervall: 2.–5. juni 1971
- faksimilepilot: overskriften «ÅFK-Ørsta 1-1 e.e.o.» bekrefter claimets resultat, ekstraomganger og motstander

Claimet er NM 1. runde. Faksimilen gir svært sterk event-identitet, men eksakt dato skal fortsatt bekreftes i produksjonsreview.

## Hva målingen sier om videre skalering

Den lokale avstemmingen ga 28 kandidater uten nettverkskostnad. Dette passet bør alltid kjøres først.

Det begrensede månedssøket ga to datoevidenssaker av 60 claims. Fordelingen var ujevn:

- 1955–1959: 0 av 20
- 1960–1964: 1 av 20
- 1965–1974: 1 av 20

Samme maskinelle pass bør derfor ikke skaleres blindt gjennom resten av 1950-tallet. Der er kandidatlistene mer verdifulle som rangert visuell kø enn som grunnlag for flere alias- og månedsspørringer.

## Anbefalt neste PR: review og kanonisering

Neste PR bør være liten og produksjonsrettet:

1. Review de 28 lokale `existing_match_candidate`-claimene mot source-result og canonical match. Skriv bare entydige `matchId`-koblinger.
2. Fullfør datoreview for Sykkylven 1964 og Ørsta 1971. Opprett eller koble kamp bare dersom dato, hjemme/borte, konkurranse og event collision er avklart.
3. Velg 10–20 atomiske enheter fra de 54 kandidatlistene. Prioriter én sterk resultatside, scorekonflikter og sibling-grupper som kan vurderes samlet.
4. La resten bli stående som eksplisitt kandidatkø. Ikke start nye brede årssøk.

Den målte rekkefølgen blir dermed: gratis koblinger, to sterke datoevidenssaker, liten faksimilebatch, stopp.
