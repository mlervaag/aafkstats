# Datoankret avisberikelse

Denne løypa starter med en kanonisk kamp som har eksakt dato, motstander og resultat. Den er separat fra source-result-discovery, som fortsatt brukes når oppgaven er å finne hvilken kamp en udatert kildepåstand gjelder.

## Produksjonsflyt

1. Regenerer køen med `pnpm data:newspaper-enrichment-status`.
2. Velg sesong eller kamp deterministisk fra `data/discovery/newspaper-enrichment-status.yaml`.
3. Kjør discovery, for eksempel `pnpm ingest:nb-newspaper-batch -- --from 1979 --to 1979`.
4. Kjør `pnpm data:nb-newspaper-pilot-review -- --report <rapport>`. For 1979 er OCR-API-korrelasjon godkjent som reviewgrunnlag fordi faksimilen krever særskilt tilgang.
5. Bruk `--write` for å knytte korrelerte avisutgaver og entydig ankrede kampboksfakta additivt til canonical data.
6. Kjør statusgeneratoren på nytt. Etter en sesongbatch regenereres også `pnpm data:discovery-status`, slik at PR #212-restkøen kan avstemmes mot nye kamper og avisbevis.

Standardvinduet er D-2 til D+2. Dersom første pass ikke har en sterk kandidat, utvides det til D-3 til D+3. Begge radiusene kan overstyres med `--window-days` og `--expanded-window-days`. Resultatet påvirker rangeringen, men filtrerer aldri bort en kandidat. Mandagsutgaven får høyest datoprioritet etter en søndagskamp.

Discoveryrapporten ligger under `.cache/ingest/nb-newspaper-batch/`. Den bevarer flere kandidatutgaver og flere evidensbiter fra samme utgave, men ingen OCR-tekst. Kandidatene klassifiseres som kampreferat, resultatnotis, forhåndsomtale, laguttak, resultatbørs, tabell, terminliste, annonse eller ukjent.

## Reviewregler

- `ocr_correlated` betyr at begge klubber står lokalt bundet i relevant avisstoff innen søkevinduet. `reviewMethod: ocr_api`, `facsimileReviewed: false` og null visuelt kontrollerte sider skal alltid følge funnet.
- `no_ocr_candidate` betyr at API-et ikke ga en lokalt bundet kandidat. Det er ikke det samme som et visuelt fastslått `not_found`.
- `candidate_found` og `candidate_review` er rå discoveryutfall og skal ikke skrives direkte til canonical data.
- `not_found` er et gyldig terminalt reviewutfall etter at det konfigurerte vinduet er undersøkt.
- En tabell, terminliste eller annonse bekrefter ikke at kampen ble spilt.
- Et avvikende resultat registreres som `conflict_candidate`. Canonical data overskrives ikke automatisk.
- Artikkelen gjennomgås komplett for dato, hjemme/borte, konkurranse, arena, avspark, publikum, dommer, pause, lag, mål, kort, bytter og kildeførte historiske observasjoner.
- Personer opprettes ikke fra tvetydig OCR.
- Avis-OCR lagres ikke i repoet. Reviewledgeren kan lagre NB-id, URN, permanent lenke, utgivelsesdato, side, sikker tittel, strukturerte fakta og en kort note.

1979 er første pilot. Eieren har fritatt piloten fra eksplisitt faksimilereview fordi tilgangen krever innlogging og søknad. Fritaket endrer reviewmetoden, ikke proveniensen: rapporten skal aldri kalle OCR-kontroll visuell kontroll.

Pilotresultatene er dokumentert i `docs/NB_CANONICAL_NEWSPAPER_1979_PILOT.md`. Fritaket gjelder 1979-piloten; standardpolicyen for senere sesonger er fortsatt faksimilereview inntil den endres eksplisitt.
