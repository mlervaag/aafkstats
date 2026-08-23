# Datoankret avisberikelse

Denne løypa starter med en kanonisk kamp som har eksakt dato, motstander og resultat. Den er separat fra source-result-discovery, som fortsatt brukes når oppgaven er å finne hvilken kamp en udatert kildepåstand gjelder.

## Produksjonsflyt

1. Regenerer køen med `pnpm data:newspaper-enrichment-status`.
2. Velg sesong eller kamp deterministisk fra `data/discovery/newspaper-enrichment-status.yaml`.
3. Kjør discovery, for eksempel `pnpm ingest:nb-newspaper-batch -- --from 1979 --to 1979`.
4. Åpne kandidatsidene i NB-faksimilen. OCR-rangeringen er ikke en godkjenning.
5. Registrer utfallet i `data/discovery/newspaper-enrichment-reviews.yaml` og skriv bare visuelt kontrollerte fakta til canonical data.
6. Kjør statusgeneratoren på nytt. Etter en sesongbatch regenereres også `pnpm data:discovery-status`, slik at PR #212-restkøen kan avstemmes mot nye kamper og avisbevis.

Standardvinduet er D-2 til D+2. Dersom første pass ikke har en sterk kandidat, utvides det til D-3 til D+3. Begge radiusene kan overstyres med `--window-days` og `--expanded-window-days`. Resultatet påvirker rangeringen, men filtrerer aldri bort en kandidat. Mandagsutgaven får høyest datoprioritet etter en søndagskamp.

Discoveryrapporten ligger under `.cache/ingest/nb-newspaper-batch/`. Den bevarer flere kandidatutgaver og flere evidensbiter fra samme utgave, men ingen OCR-tekst. Kandidatene klassifiseres som kampreferat, resultatnotis, forhåndsomtale, laguttak, resultatbørs, tabell, terminliste, annonse eller ukjent.

## Reviewregler

- `candidate_found` og `candidate_review` betyr alltid at faksimilereview gjenstår.
- `not_found` er et gyldig terminalt reviewutfall etter at det konfigurerte vinduet er undersøkt.
- En tabell, terminliste eller annonse bekrefter ikke at kampen ble spilt.
- Et avvikende resultat registreres som konfliktkandidat. Canonical data overskrives ikke automatisk.
- Artikkelen gjennomgås komplett for dato, hjemme/borte, konkurranse, arena, avspark, publikum, dommer, pause, lag, mål, kort, bytter og kildeførte historiske observasjoner.
- Personer opprettes ikke fra tvetydig OCR.
- Avis-OCR lagres ikke i repoet. Reviewledgeren kan lagre NB-id, URN, permanent lenke, utgivelsesdato, side, sikker tittel, strukturerte fakta og en kort note.

1979 er første pilot. Statusrapporten før innhøsting viser 39 kamper i scope og måler dekning, faktayield, konflikter og arbeidsmengde etter hvert som reviewledgeren fylles.
